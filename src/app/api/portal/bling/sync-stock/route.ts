import {
	blingProdutoApiPath,
	getBlingClientForCurrentUser,
	normalizeBlingProductId,
} from "@/lib/integrations/bling/api";
import { getVirtualStockFromEstoqueApiResponse } from "@/lib/integrations/bling/stock-reconcile";
import {
	addStockMovement,
	getProductById,
	getProductCurrentStock,
} from "@/lib/products/service";
import { getPortalAuth } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
			{ ok: false, error: "bling_id_invalid" },
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
		if (current.product.kind === "service") {
			return NextResponse.json({
				ok: true,
				adjustedBy: 0,
				skipped: "service" as const,
			});
		}

		let data: unknown;
		try {
			data = await clientRes.client.request<unknown>({
				method: "GET",
				path: blingProdutoApiPath(blingProductId, "estoque"),
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : "";
			const looksNotFound = /não encontrad|nao encontrad|404/i.test(msg);
			if (looksNotFound) {
				return NextResponse.json({
					ok: true,
					adjustedBy: 0,
					skipped: "bling_no_stock_resource" as const,
					message:
						'No Bling, o estoque deste cadastro fica nas variações, não no produto pai. Sincronize cada variação ou use "Atualizar pelo Bling" no item filho.',
				});
			}
			return NextResponse.json(
				{
					ok: false,
					error: "bling_request_failed",
					message: msg || "unknown_error",
				},
				{ status: 502 },
			);
		}

		const targetVirtual = getVirtualStockFromEstoqueApiResponse(data);
		if (targetVirtual === null) {
			return NextResponse.json(
				{ ok: false, error: "bling_stock_payload_unrecognized" },
				{ status: 502 },
			);
		}

		const localRes = await getProductCurrentStock(productId);
		const localBalance =
			localRes.ok && "currentStock" in localRes ? localRes.currentStock : 0;

		const diff = targetVirtual - localBalance;
		if (diff !== 0) {
			const movRes = await addStockMovement(productId, {
				type: diff > 0 ? "entry" : "exit",
				quantity: Math.abs(diff),
				unitValueCents: current.product.costPriceCents ?? 0,
				source: "bling",
				externalReference: `bling:sync-estoque:${productId}`,
			});
			if (!movRes.ok) {
				return NextResponse.json(
					{ ok: false, error: "error" in movRes ? movRes.error : "db_error" },
					{ status: 500 },
				);
			}
		}

		return NextResponse.json({ ok: true, adjustedBy: diff });
	} catch (err) {
		const message = err instanceof Error ? err.message : "unknown_error";
		return NextResponse.json(
			{ ok: false, error: "bling_request_failed", message },
			{ status: 502 },
		);
	}
}
