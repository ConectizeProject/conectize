import {
	blingProdutoApiPath,
	getBlingClientForCurrentUser,
	normalizeBlingProductId,
} from "@/lib/integrations/bling/api";
import { mapBlingProductToLocal } from "@/lib/integrations/bling/mappers";
import {
	getVirtualStockFromEstoqueApiResponse,
	getVirtualStockTargetFromMappedProduct,
} from "@/lib/integrations/bling/stock-reconcile";
import { createProductSyncSnapshot } from "@/lib/products/bling-sync";
import { fetchProductHasVariationChildren } from "@/lib/products/parent-has-variations";
import {
	addStockMovement,
	countProductsWithParentBlingId,
	getLastStockEntryUnitValueCents,
	getProductById,
	getProductCurrentStock,
	updateProduct,
} from "@/lib/products/service";
import { createSupabaseServerClient, getPortalAuth } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Evita gravar CMV igual ao preço de venda (espelho Bling ou entrada antiga errada). */
function isPlausibleCostUnit(
	unitCents: number | null | undefined,
	saleCents: number | null | undefined,
): unitCents is number {
	if (unitCents == null || !Number.isFinite(unitCents) || unitCents < 0)
		return false;
	if (saleCents != null && unitCents === saleCents) return false;
	return true;
}

export async function POST(request: Request) {
	const { user, role } = await getPortalAuth();
	if (!user) {
		return NextResponse.json(
			{ ok: false, error: "not_authenticated" },
			{ status: 401 },
		);
	}
	const normalizedRole = role === "customer" ? "user" : role;
	if (normalizedRole === "user" || !normalizedRole) {
		return NextResponse.json(
			{ ok: false, error: "forbidden" },
			{ status: 403 },
		);
	}

	const body = (await request.json().catch(() => ({}))) as {
		productId?: string;
	};
	const productId = String(body.productId || "").trim();
	if (!productId) {
		return NextResponse.json(
			{ ok: false, error: "product_id_required" },
			{ status: 400 },
		);
	}

	const current = await getProductById(productId);
	if (!current.ok || !("product" in current)) {
		return NextResponse.json(
			{ ok: false, error: "product_not_found" },
			{ status: 404 },
		);
	}
	if (!current.product.blingId) {
		return NextResponse.json(
			{ ok: false, error: "product_not_linked_bling" },
			{ status: 400 },
		);
	}

	const blingProductId = normalizeBlingProductId(current.product.blingId);
	if (!blingProductId) {
		return NextResponse.json(
			{
				ok: false,
				error: "bling_id_invalid",
				message: "ID do Bling vazio ou inválido no cadastro do produto.",
			},
			{ status: 400 },
		);
	}

	const clientRes = await getBlingClientForCurrentUser();
	if (!clientRes.ok || !("client" in clientRes)) {
		const error =
			"error" in clientRes ? clientRes.error : "bling_client_unavailable";
		return NextResponse.json({ ok: false, error }, { status: 400 });
	}

	try {
		const data = await clientRes.client.request<
			| {
					data?: Record<string, unknown>;
			  }
			| Record<string, unknown>
		>({
			method: "GET",
			path: blingProdutoApiPath(blingProductId),
		});

		const local = mapBlingProductToLocal(data, blingProductId);
		const saleCentsFromBling = local.salePriceCents ?? null;

		if (!String(local.name || "").trim()) {
			return NextResponse.json(
				{
					ok: false,
					error: "bling_product_name_missing",
					message:
						"O Bling retornou o produto sem nome. Confira o ID vinculado e tente importar de novo.",
				},
				{ status: 422 },
			);
		}

		const effectiveKind = local.kind ?? current.product.kind;
		let stockAdjustedBy: number | null = null;

		const lastEntryBeforeRes = await getLastStockEntryUnitValueCents(productId);
		const lastEntryUnitBefore = lastEntryBeforeRes.ok
			? lastEntryBeforeRes.unitValueCents
			: null;

		const supabase = await createSupabaseServerClient();
		const isParentWithVariations = await fetchProductHasVariationChildren(
			supabase,
			productId,
		);

		if (effectiveKind !== "service" && !isParentWithVariations) {
			let targetVirtual = getVirtualStockTargetFromMappedProduct(local);
			if (targetVirtual === null) {
				try {
					const estoqueRes = await clientRes.client.request<unknown>({
						method: "GET",
						path: blingProdutoApiPath(blingProductId, "estoque"),
					});
					targetVirtual = getVirtualStockFromEstoqueApiResponse(estoqueRes);
				} catch {
					/** Pai com variações (`formato` V) costuma não ter GET /produtos/{id}/estoque — estoque só nas variações. */
					targetVirtual = null;
				}
			}
			if (targetVirtual !== null) {
				const stockRes = await getProductCurrentStock(productId);
				const balance =
					stockRes.ok && "currentStock" in stockRes ? stockRes.currentStock : 0;
				const diff = targetVirtual - balance;
				stockAdjustedBy = Number.isFinite(diff) ? diff : null;
				if (Number.isFinite(diff) && diff !== 0) {
					let unitCents = 0;
					for (const c of [
						local.costPriceCents,
						lastEntryUnitBefore,
						current.product.costPriceCents,
					]) {
						if (isPlausibleCostUnit(c, saleCentsFromBling)) {
							unitCents = c;
							break;
						}
					}
					const movRes = await addStockMovement(productId, {
						type: diff > 0 ? "entry" : "exit",
						quantity: Math.abs(diff),
						unitValueCents: unitCents,
						source: "bling",
						externalReference: `bling:atualizar-pelo-bling:${productId}`,
					});
					if (!movRes.ok) {
						return NextResponse.json(
							{
								ok: false,
								error: "stock_reconcile_failed",
								detail: "error" in movRes ? movRes.error : "db_error",
							},
							{ status: 500 },
						);
					}
				}
			}
		}

		const lastEntryAfterRes = await getLastStockEntryUnitValueCents(productId);
		const rawLastEntryUnit = lastEntryAfterRes.ok
			? lastEntryAfterRes.unitValueCents
			: null;

		const costFromLastEntry = isPlausibleCostUnit(
			rawLastEntryUnit,
			saleCentsFromBling,
		)
			? rawLastEntryUnit
			: null;

		let costPriceCentsToSave: number | null | undefined;
		if (current.product.costPriceManualEditedAt) {
			costPriceCentsToSave = undefined;
		} else if (isPlausibleCostUnit(local.costPriceCents, saleCentsFromBling)) {
			costPriceCentsToSave = local.costPriceCents ?? undefined;
		} else if (costFromLastEntry != null) {
			costPriceCentsToSave = costFromLastEntry;
		} else if (
			isPlausibleCostUnit(current.product.costPriceCents, saleCentsFromBling)
		) {
			costPriceCentsToSave = current.product.costPriceCents ?? undefined;
		} else {
			costPriceCentsToSave = undefined;
		}

		const incomingImage =
			local.imageUrl != null && String(local.imageUrl).trim()
				? String(local.imageUrl).trim()
				: null;
		const preserveImage =
			!incomingImage &&
			Boolean(
				current.product.imageUrl && String(current.product.imageUrl).trim(),
			);

		const variationCountRes = await countProductsWithParentBlingId(
			current.product.blingId,
		);
		const isPortalParentWithVariations =
			isParentWithVariations ||
			(variationCountRes.ok && variationCountRes.count > 0);

		const incomingParentBling =
			local.parentBlingId != null && String(local.parentBlingId).trim() !== ""
				? String(local.parentBlingId).trim()
				: "";
		const dbParentBling =
			current.product.parentBlingId != null &&
			String(current.product.parentBlingId).trim() !== ""
				? String(current.product.parentBlingId).trim()
				: "";

		const parentBlingPatch: { parentBlingId?: string | null } = {};
		if (isPortalParentWithVariations) {
			parentBlingPatch.parentBlingId = null;
		} else if (incomingParentBling) {
			parentBlingPatch.parentBlingId = incomingParentBling;
		} else if (dbParentBling) {
			// Variação: o GET do Bling muitas vezes não traz produtoPai — não apagar o vínculo.
		} else {
			parentBlingPatch.parentBlingId = local.parentBlingId ?? null;
		}

		const updateRes = await updateProduct(productId, {
			name: local.name,
			sku: local.sku ?? undefined,
			barcode: local.barcode ?? undefined,
			description: local.description ?? undefined,
			imageUrl: preserveImage ? undefined : incomingImage ?? null,
			salePriceCents: local.salePriceCents ?? undefined,
			costPriceCents: costPriceCentsToSave,
			isActive: local.isActive ?? undefined,
			blingId:
				normalizeBlingProductId(local.blingId ?? blingProductId) ||
				blingProductId,
			blingSyncPending: false,
			blingSyncSnapshot: createProductSyncSnapshot(local),
			kind: local.kind ?? undefined,
			ncm: local.ncm,
			cest: local.cest,
			cfop: local.cfop,
			fiscalOrigin: local.fiscalOrigin,
			fiscalUnit: local.fiscalUnit,
			icmsCsosn: local.icmsCsosn,
			icmsCst: local.icmsCst,
			pisCst: local.pisCst,
			cofinsCst: local.cofinsCst,
			...parentBlingPatch,
		});

		if (!updateRes.ok) {
			const code = "error" in updateRes ? updateRes.error : "db_error";
			return NextResponse.json(
				{
					ok: false,
					error: code,
					message:
						code === "not_authenticated"
							? "Sessão expirada. Entre novamente."
							: code === "nothing_to_update"
								? "Nada para atualizar."
								: "Falha ao salvar o produto no banco.",
				},
				{ status: code === "not_authenticated" ? 401 : 500 },
			);
		}

		return NextResponse.json({ ok: true, stockAdjustedBy });
	} catch (err) {
		console.error("[bling sync-product] exceção", err);
		const message = err instanceof Error ? err.message : "unknown_error";
		return NextResponse.json(
			{ ok: false, error: "bling_request_failed", message },
			{ status: 502 },
		);
	}
}
