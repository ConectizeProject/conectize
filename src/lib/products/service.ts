import { createSupabaseServerClient, getAuthUser } from "@/lib/supabase/server";
import { allocateCatalogSortKeyForInsert } from "@/lib/products/catalog-sort-key";
import {
	composePortalVariationDisplayName,
	parseVariationAttributeKeys,
	parseVariationAttributeValues,
} from "@/lib/products/variation-display-name";
import { createProductSyncSnapshot } from "@/lib/products/bling-sync";
import {
	ensurePortalOrganizationContext,
	getPortalOrganizationId,
} from "@/lib/organizations/portal-organization-context";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeOptionalUuid(value: unknown): string | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	const s = String(value).trim().toLowerCase();
	if (!s) return null;
	return UUID_RE.test(s) ? s : null;
}

export type Product = {
	id: string;
	blingId: string | null;
	/** ID do produto pai no Bling; null se não é variação. */
	parentBlingId: string | null;
	/** ID portal do pai (quando resolvido); útil para carregar definição de atributos. */
	parentProductId: string | null;
	/** No pai: nomes dos atributos de variação em ordem (ex.: ["Tamanho","Cor"]). */
	variationAttributeKeys: string[];
	/** Na variação: valores por atributo (chaves iguais às do pai). */
	variationAttributeValues: Record<string, string>;
	blingSyncPending: boolean;
	blingSyncSnapshot: ProductSyncSnapshot | null;
	kind?: "product" | "service" | null;
	name: string;
	sku: string | null;
	barcode: string | null;
	description: string | null;
	imageUrl?: string | null;
	salePriceCents: number | null;
	pricingTagId: string | null;
	costPriceCents: number | null;
	/** Quando o custo foi alterado pelo cadastro no portal (não por sync/import). */
	costPriceManualEditedAt: string | null;
	isActive: boolean;
	/** Ordenação do catálogo: raiz (12 dígitos) ou variação `raiz` + `.` + sufixo (6 dígitos). */
	catalogSortKey: string | null;
	createdAt: string;
	updatedAt: string;
};

export type ProductSyncSnapshot = {
	name: string;
	sku: string | null;
	barcode: string | null;
	description: string | null;
	salePriceCents: number | null;
	costPriceCents: number | null;
	isActive: boolean;
	kind: "product" | "service" | null;
};

export type CreateProductInput = {
	blingId?: string | null;
	blingSyncPending?: boolean;
	blingSyncSnapshot?: ProductSyncSnapshot | null;
	parentProductId?: string | null;
	/** ID do produto pai no Bling; null = não é variação. */
	parentBlingId?: string | null;
	/** Valores dos atributos (só variação); o nome composto é derivado no servidor quando o pai tem chaves. */
	variationAttributeValues?: Record<string, string> | null;
	/** Chaves de atributo no produto pai (só raiz). */
	variationAttributeKeys?: string[] | null;
	kind?: "product" | "service" | null;
	name: string;
	sku?: string | null;
	barcode?: string | null;
	description?: string | null;
	imageUrl?: string | null;
	salePriceCents?: number | null;
	pricingTagId?: string | null;
	costPriceCents?: number | null;
	isActive?: boolean;
};

export type UpdateProductInput = Partial<CreateProductInput> & {
	/** Interno: grava `cost_price_manual_edited_at` junto com `costPriceCents`. */
	costPriceManuallyEdited?: boolean;
};

export type StockMovementType = "entry" | "exit" | "loss";

export type StockMovement = {
	id: string;
	productId: string;
	type: StockMovementType;
	quantity: number;
	unitValueCents: number;
	totalValueCents: number;
	source: "manual" | "bling" | "system" | "pdv_sale" | "service_order";
	externalReference: string | null;
	createdAt: string;
};

export type AddStockMovementInput = {
	type: StockMovementType;
	quantity: number;
	unitValueCents?: number | null;
	source?: "manual" | "bling" | "system" | "pdv_sale" | "service_order";
	externalReference?: string | null;
};

type AuthFailure = {
	ok: false;
	error: "not_authenticated";
};

type AuthSuccess = {
	ok: true;
	supabase: SupabaseServerClient;
	userId: string;
	organizationId: string;
};

type CreateProductResult =
	| { ok: true; product: Product }
	| AuthFailure
	| { ok: false; error: "name_required" | "db_error" };

type UpdateProductResult =
	| { ok: true; product: Product }
	| AuthFailure
	| { ok: false; error: "nothing_to_update" | "db_error" };

type DeleteProductResult =
	| { ok: true }
	| AuthFailure
	| { ok: false; error: "db_error" };

type GetProductResult =
	| { ok: true; product: Product }
	| AuthFailure
	| { ok: false; error: "not_found" };

type GetProductWithVariationsResult =
	| { ok: true; product: Product; variations: Product[] }
	| AuthFailure
	| { ok: false; error: "not_found" };

type ListProductsResult =
	| { ok: true; items: Product[]; total: number }
	| AuthFailure
	| { ok: false; error: "db_error" };

type AddStockMovementResult =
	| { ok: true; movement: StockMovement; currentStock: number | null }
	| AuthFailure
	| { ok: false; error: "quantity_invalid" | "type_invalid" | "db_error" };

type ListStockMovementsResult =
	| { ok: true; items: StockMovement[] }
	| AuthFailure
	| { ok: false; error: "db_error" };

type GetProductCurrentStockResult =
	| { ok: true; currentStock: number }
	| AuthFailure
	| { ok: false; error: "db_error" };

type GetLastStockEntryUnitValueResult =
	| { ok: true; unitValueCents: number | null }
	| { ok: false; error: "not_authenticated" }
	| { ok: false; error: "db_error" };

type GetProductWithStockResult =
	| { ok: true; product: Product; currentStock: number }
	| AuthFailure
	| { ok: false; error: "not_found" | "db_error" };

type ReplaceCompatibleModelsResult =
	| { ok: true }
	| AuthFailure
	| { ok: false; error: "db_error" };

type ReorderVariationsResult =
	| { ok: true; variations: Product[] }
	| AuthFailure
	| {
			ok: false;
			error:
				| "parent_not_found"
				| "invalid_variations"
				| "not_a_parent"
				| "db_error";
	  };

async function requireAuth(): Promise<AuthSuccess | AuthFailure> {
	const supabase = await createSupabaseServerClient();
	const { user } = await getAuthUser();
	if (!user) {
		return { ok: false as const, error: "not_authenticated" as const };
	}
	await ensurePortalOrganizationContext(supabase, user.id);
	const organizationId = await getPortalOrganizationId(supabase, user.id);
	if (!organizationId) {
		return { ok: false as const, error: "not_authenticated" as const };
	}
	return { ok: true as const, supabase, userId: user.id, organizationId };
}

function normalizeMoney(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const num = Number(value);
	if (!Number.isFinite(num) || num < 0) return null;
	return Math.round(num);
}

/**
 * Centavos vindos do PostgREST: `integer` costuma ser number; `numeric` pode vir string.
 * Sem isso, `cost_price_cents` string → `costPriceCents: null` no mapRowToProduct.
 */
function parseRowCents(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.round(value);
	}
	if (typeof value === "string") {
		const t = value.trim();
		if (t === "") return null;
		const n = Number(t.replace(",", "."));
		if (!Number.isFinite(n) || n < 0) return null;
		return Math.round(n);
	}
	return null;
}

export async function createProduct(
	input: CreateProductInput,
): Promise<CreateProductResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const name = String(input.name || "").trim();
	if (!name) {
		return { ok: false as const, error: "name_required" as const };
	}

	const attrKeys = parseVariationAttributeKeys(input.variationAttributeKeys);
	const attrVals = parseVariationAttributeValues(input.variationAttributeValues);

	let finalName = name;

	const parentKey =
		input.parentBlingId != null ? String(input.parentBlingId).trim() : "";
	const parentProductIdFromInput = normalizeOptionalUuid(input.parentProductId) ?? null;
	let parentProductId: string | null = null;
	let resolvedParentBlingId: string | null = parentKey && parentKey !== "0" ? parentKey : null;

	if (parentProductIdFromInput) {
		const { data: parentById } = await auth.supabase
			.from("products")
			.select("id, bling_id")
			.eq("id", parentProductIdFromInput)
			.limit(1)
			.maybeSingle();
		parentProductId = parentById?.id ? String(parentById.id) : parentProductIdFromInput;
		if (!resolvedParentBlingId && parentById?.bling_id != null) {
			const k = String(parentById.bling_id).trim();
			resolvedParentBlingId = k || null;
		}
		if (parentProductIdFromInput && Object.keys(attrVals).length > 0) {
			const { data: parentRow } = await auth.supabase
				.from("products")
				.select("name, variation_attribute_keys")
				.eq("id", parentProductIdFromInput)
				.maybeSingle();
			if (parentRow) {
				const pKeys = parseVariationAttributeKeys(
					(parentRow as { variation_attribute_keys?: unknown }).variation_attribute_keys,
				);
				if (pKeys.length > 0) {
					finalName = composePortalVariationDisplayName(
						String((parentRow as { name?: unknown }).name || "").trim(),
						pKeys,
						attrVals,
					);
				}
			}
		}
	} else if (parentKey && parentKey !== "0") {
		const { data: parentRow } = await auth.supabase
			.from("products")
			.select("id")
			.eq("bling_id", parentKey)
			.limit(1)
			.maybeSingle();
		parentProductId = parentRow?.id ? String(parentRow.id) : null;
	}

	const catalogSortKey = await allocateCatalogSortKeyForInsert(auth.supabase, {
		parentBlingId: resolvedParentBlingId,
	});

	const pricingTagId = normalizeOptionalUuid(input.pricingTagId);

	const payload = {
		organization_id: auth.organizationId,
		bling_id: input.blingId ?? null,
		bling_sync_pending: input.blingSyncPending ?? false,
		bling_sync_snapshot: input.blingSyncSnapshot ?? null,
		parent_bling_id: resolvedParentBlingId,
		parent_product_id: parentProductId,
		name: finalName,
		sku: input.sku ? String(input.sku).trim() : null,
		barcode: input.barcode ? String(input.barcode).trim() : null,
		description: input.description ? String(input.description).trim() : null,
		image_url:
			input.imageUrl != null && String(input.imageUrl).trim()
				? String(input.imageUrl).trim()
				: null,
		sale_price_cents: normalizeMoney(input.salePriceCents),
		...(pricingTagId !== undefined
			? { pricing_tag_id: pricingTagId }
			: {}),
		cost_price_cents: normalizeMoney(input.costPriceCents),
		is_active: input.isActive ?? true,
		created_by: auth.userId,
		catalog_sort_key: catalogSortKey,
		variation_attribute_keys: attrKeys,
		variation_attribute_values: attrVals,
	};

	const { data, error } = await auth.supabase
		.from("products")
		.insert(payload)
		.select("*")
		.maybeSingle();

	if (error || !data) {
		return { ok: false as const, error: "db_error" as const };
	}

	return { ok: true as const, product: mapRowToProduct(data) };
}

export async function getProductByIdWithVariations(
	id: string,
): Promise<GetProductWithVariationsResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const { data, error } = await auth.supabase
		.from("products")
		.select("*")
		.eq("id", id)
		.maybeSingle();

	if (error || !data) {
		return { ok: false as const, error: "not_found" as const };
	}

	const product = mapRowToProduct(data);
	if (product.parentBlingId != null) {
		return { ok: true as const, product, variations: [] };
	}

	const blingKey = product.blingId ? String(product.blingId).trim() : "";

	if (blingKey) {
		const { data: vars } = await auth.supabase
			.from("products")
			.select("*")
			.eq("parent_bling_id", blingKey)
			.eq("is_active", true)
			.order("catalog_sort_key", { ascending: true, nullsFirst: false });

		return {
			ok: true as const,
			product,
			variations: (vars ?? []).map(mapRowToProduct),
		};
	}

	const { data: byParentUuid } = await auth.supabase
		.from("products")
		.select("*")
		.eq("parent_product_id", product.id)
		.eq("is_active", true)
		.order("catalog_sort_key", { ascending: true, nullsFirst: false });

	return {
		ok: true as const,
		product,
		variations: (byParentUuid ?? []).map(mapRowToProduct),
	};
}

export type ApplyImageUrlToVariationsResult =
	| { ok: true; updatedCount: number }
	| {
		ok: false;
		error: "not_authenticated" | "not_found" | "not_a_parent" | "db_error";
	};

/** Atualiza `image_url` de todas as variações ativas do pai (mesma regra de `getProductByIdWithVariations`). */
export async function applyImageUrlToActiveVariations(
	parentProductId: string,
	imageUrl: string | null,
): Promise<ApplyImageUrlToVariationsResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const id = String(parentProductId || "").trim().toLowerCase();
	if (!UUID_RE.test(id)) return { ok: false, error: "not_found" };

	const withVars = await getProductByIdWithVariations(id);
	if (!withVars.ok) return { ok: false, error: "not_found" };

	const parentPb =
		withVars.product.parentBlingId != null
			? String(withVars.product.parentBlingId).trim()
			: "";
	if (parentPb) return { ok: false, error: "not_a_parent" };

	const ids = withVars.variations.map((v) => v.id);
	if (ids.length === 0) return { ok: true, updatedCount: 0 };

	const normalizedUrl =
		imageUrl != null && String(imageUrl).trim()
			? String(imageUrl).trim()
			: null;

	const { error: updErr } = await auth.supabase
		.from("products")
		.update({
			image_url: normalizedUrl,
			updated_at: new Date().toISOString(),
		})
		.in("id", ids);

	if (updErr) return { ok: false, error: "db_error" };
	return { ok: true, updatedCount: ids.length };
}

export async function reorderProductVariations(
	parentProductId: string,
	orderedVariationIds: string[],
): Promise<ReorderVariationsResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const normalizedIds = [
		...new Set(
			orderedVariationIds
				.map((id) => String(id || "").trim().toLowerCase())
				.filter((id) => UUID_RE.test(id)),
		),
	];
	if (normalizedIds.length === 0) {
		return { ok: false as const, error: "invalid_variations" as const };
	}

	const { data: parentRow, error: parentErr } = await auth.supabase
		.from("products")
		.select("id, bling_id, parent_bling_id, catalog_sort_key")
		.eq("id", parentProductId)
		.maybeSingle();

	if (parentErr || !parentRow) {
		return { ok: false as const, error: "parent_not_found" as const };
	}
	if ((parentRow.parent_bling_id != null && String(parentRow.parent_bling_id).trim() !== "")) {
		return { ok: false as const, error: "not_a_parent" as const };
	}

	const parentBlingId = parentRow.bling_id != null ? String(parentRow.bling_id).trim() : "";
	let query = auth.supabase
		.from("products")
		.select("id, catalog_sort_key")
		.in("id", normalizedIds);

	if (parentBlingId) {
		query = query.eq("parent_bling_id", parentBlingId);
	} else {
		query = query.eq("parent_product_id", parentProductId);
	}

	const { data: variationRows, error: varsErr } = await query;
	if (varsErr || !variationRows) {
		return { ok: false as const, error: "db_error" as const };
	}
	if (variationRows.length !== normalizedIds.length) {
		return { ok: false as const, error: "invalid_variations" as const };
	}

	const parentCatalogSortKeyRaw =
		parentRow.catalog_sort_key != null ? String(parentRow.catalog_sort_key).trim() : "";
	const parentRootKey = parentCatalogSortKeyRaw && !parentCatalogSortKeyRaw.includes(".")
		? parentCatalogSortKeyRaw
		: null;
	if (!parentRootKey) {
		return { ok: false as const, error: "db_error" as const };
	}

	for (let i = 0; i < normalizedIds.length; i++) {
		const variationId = normalizedIds[i];
		const suffix = String(i + 1).padStart(6, "0");
		const catalogSortKey = `${parentRootKey}.${suffix}`;
		const { error: updErr } = await auth.supabase
			.from("products")
			.update({
				catalog_sort_key: catalogSortKey,
				updated_at: new Date().toISOString(),
			})
			.eq("id", variationId);
		if (updErr) {
			return { ok: false as const, error: "db_error" as const };
		}
	}

	const reloaded = await getProductByIdWithVariations(parentProductId);
	if (!reloaded.ok) {
		return { ok: false as const, error: "db_error" as const };
	}

	return { ok: true as const, variations: reloaded.variations };
}

export async function updateProduct(
	id: string,
	input: UpdateProductInput,
): Promise<UpdateProductResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const patch: Record<string, unknown> = {};

	if (input.blingId !== undefined) patch.bling_id = input.blingId;
	if (input.blingSyncPending !== undefined)
		patch.bling_sync_pending = Boolean(input.blingSyncPending);
	if (input.blingSyncSnapshot !== undefined)
		patch.bling_sync_snapshot = input.blingSyncSnapshot;
	if (input.kind !== undefined) patch.kind = input.kind;
	if (input.name !== undefined) patch.name = String(input.name || "").trim();
	if (input.sku !== undefined)
		patch.sku = input.sku ? String(input.sku).trim() : null;
	if (input.barcode !== undefined)
		patch.barcode = input.barcode ? String(input.barcode).trim() : null;
	if (input.description !== undefined) {
		patch.description = input.description
			? String(input.description).trim()
			: null;
	}
	if (input.imageUrl !== undefined) {
		patch.image_url =
			input.imageUrl != null && String(input.imageUrl).trim()
				? String(input.imageUrl).trim()
				: null;
	}
	if (input.salePriceCents !== undefined) {
		patch.sale_price_cents = normalizeMoney(input.salePriceCents);
	}
	if (input.pricingTagId !== undefined) {
		patch.pricing_tag_id = normalizeOptionalUuid(input.pricingTagId) ?? null;
	}
	if (input.costPriceCents !== undefined) {
		patch.cost_price_cents = normalizeMoney(input.costPriceCents);
	}
	if (
		input.costPriceManuallyEdited === true &&
		input.costPriceCents !== undefined
	) {
		patch.cost_price_manual_edited_at = new Date().toISOString();
	}
	if (input.isActive !== undefined) patch.is_active = Boolean(input.isActive);

	if (input.variationAttributeKeys !== undefined) {
		patch.variation_attribute_keys = parseVariationAttributeKeys(
			input.variationAttributeKeys,
		);
	}
	if (input.variationAttributeValues !== undefined) {
		patch.variation_attribute_values = parseVariationAttributeValues(
			input.variationAttributeValues,
		);
	}

	if (input.parentBlingId !== undefined) {
		const key =
			input.parentBlingId != null ? String(input.parentBlingId).trim() : "";
		if (!key || key === "0") {
			patch.parent_bling_id = null;
			patch.parent_product_id = null;
		} else {
			patch.parent_bling_id = key;
			const { data: parentRow } = await auth.supabase
				.from("products")
				.select("id")
				.eq("bling_id", key)
				.limit(1)
				.maybeSingle();
			patch.parent_product_id = parentRow?.id ? String(parentRow.id) : null;
		}
	}

	if (Object.keys(patch).length === 0) {
		return { ok: false as const, error: "nothing_to_update" as const };
	}

	patch.updated_at = new Date().toISOString();

	const { data, error } = await auth.supabase
		.from("products")
		.update(patch)
		.eq("id", id)
		.select("*")
		.maybeSingle();

	if (error || !data) {
		return { ok: false as const, error: "db_error" as const };
	}

	return { ok: true as const, product: mapRowToProduct(data) };
}

export async function getParentProductForVariation(
	child: Product,
): Promise<
	| { ok: true; parent: Product }
	| { ok: false; error: "not_authenticated" | "not_found" }
> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	let parentId: string | null = child.parentProductId;
	if (!parentId && child.parentBlingId) {
		const { data } = await auth.supabase
			.from("products")
			.select("id")
			.eq("bling_id", child.parentBlingId)
			.limit(1)
			.maybeSingle();
		parentId = data?.id ? String(data.id) : null;
	}
	if (!parentId) return { ok: false, error: "not_found" };

	const res = await getProductById(parentId);
	if (!res.ok || !("product" in res)) return { ok: false, error: "not_found" };
	return { ok: true, parent: res.product };
}

export async function recomputeVariationDisplayNamesForParent(
	parentProductId: string,
): Promise<
	| { ok: true; updated: number }
	| { ok: false; error: "not_authenticated" | "not_found" | "db_error" }
> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const withVars = await getProductByIdWithVariations(parentProductId);
	if (!withVars.ok) return { ok: false, error: "not_found" };

	const parent = withVars.product;
	const keys = parent.variationAttributeKeys;
	if (keys.length === 0) return { ok: true, updated: 0 };

	const parentName = parent.name.trim();
	let updated = 0;

	for (const v of withVars.variations) {
		const newName = composePortalVariationDisplayName(
			parentName,
			keys,
			v.variationAttributeValues,
		);
		if (!newName || newName === v.name) continue;

		const snapshot = createProductSyncSnapshot({
			name: newName,
			sku: v.sku,
			barcode: v.barcode,
			description: v.description,
			salePriceCents: v.salePriceCents,
			costPriceCents: v.costPriceCents,
			isActive: v.isActive,
			kind: v.kind ?? null,
		});

		const { error } = await auth.supabase
			.from("products")
			.update({
				name: newName,
				bling_sync_snapshot: snapshot,
				updated_at: new Date().toISOString(),
			})
			.eq("id", v.id);

		if (!error) updated += 1;
	}

	return { ok: true, updated };
}

/** Quantidade de cadastros (ex.: variações) que apontam `parent_bling_id` para este ID do Bling. */
export async function countProductsWithParentBlingId(
	parentBlingId: string,
): Promise<
	| { ok: true; count: number }
	| { ok: false; error: "not_authenticated" | "db_error" }
> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const key = String(parentBlingId || "").trim();
	if (!key) return { ok: true as const, count: 0 };

	const { count, error } = await auth.supabase
		.from("products")
		.select("id", { count: "exact", head: true })
		.eq("parent_bling_id", key);

	if (error) return { ok: false as const, error: "db_error" as const };
	return { ok: true as const, count: count ?? 0 };
}

export async function deleteProduct(id: string): Promise<DeleteProductResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const { error } = await auth.supabase
		.from("products")
		.update({ is_active: false, updated_at: new Date().toISOString() })
		.eq("id", id);

	if (error) {
		return { ok: false as const, error: "db_error" as const };
	}

	return { ok: true as const };
}

export async function replaceProductCompatibleDeviceModels(
	productId: string,
	deviceModelIds: string[],
): Promise<ReplaceCompatibleModelsResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const unique = [
		...new Set(
			deviceModelIds
				.map((id) => String(id || "").trim().toLowerCase())
				.filter((id) => UUID_RE.test(id)),
		),
	];

	const { error: delErr } = await auth.supabase
		.from("product_compatible_device_models")
		.delete()
		.eq("product_id", productId);

	if (delErr) {
		return { ok: false as const, error: "db_error" as const };
	}

	if (unique.length === 0) {
		return { ok: true as const };
	}

	const rows = unique.map((device_model_id) => ({
		organization_id: auth.organizationId,
		product_id: productId,
		device_model_id,
	}));

	const { error: insErr } = await auth.supabase
		.from("product_compatible_device_models")
		.insert(rows);

	if (insErr) {
		return { ok: false as const, error: "db_error" as const };
	}

	return { ok: true as const };
}

/** Modelos compatíveis com rótulo para formulário do portal (marca · tipo · modelo). */
export async function getProductCompatibleModelsForForm(
	productId: string,
): Promise<
	| { ok: true; entries: { id: string; label: string }[] }
	| AuthFailure
	| { ok: false; error: "db_error" }
> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const { data: pcRows, error } = await auth.supabase
		.from("product_compatible_device_models")
		.select(
			`
      device_model_id,
      device_models (
        id,
        model,
        device_types (
          name,
          device_brands ( name )
        )
      )
    `,
		)
		.eq("product_id", productId);

	if (error) {
		return { ok: false as const, error: "db_error" as const };
	}

	const entries: { id: string; label: string }[] = [];
	for (const row of pcRows || []) {
		const r = row as {
			device_model_id?: string;
			device_models?: unknown;
		};
		const mid = r.device_model_id ? String(r.device_model_id) : "";
		const dmRaw = r.device_models;
		const dm = Array.isArray(dmRaw) ? dmRaw[0] : dmRaw;
		if (!mid || !dm || typeof dm !== "object") continue;
		const dmo = dm as { model?: string | null; device_types?: unknown };
		const dtRaw = dmo.device_types;
		const dt = Array.isArray(dtRaw) ? dtRaw[0] : dtRaw;
		const dto =
			dt && typeof dt === "object"
				? (dt as { name?: string | null; device_brands?: unknown })
				: null;
		const brRaw = dto?.device_brands;
		const br = Array.isArray(brRaw) ? brRaw[0] : brRaw;
		const bro =
			br && typeof br === "object"
				? (br as { name?: string | null })
				: null;
		const parts = [bro?.name, dto?.name, dmo.model]
			.filter(Boolean)
			.map((x) => String(x).trim());
		entries.push({
			id: mid,
			label: parts.join(" · ") || mid,
		});
	}

	return { ok: true as const, entries };
}

export async function listProductCompatibleDeviceModelIds(
	productId: string,
): Promise<
	| { ok: true; deviceModelIds: string[] }
	| AuthFailure
	| { ok: false; error: "db_error" }
> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const { data, error } = await auth.supabase
		.from("product_compatible_device_models")
		.select("device_model_id")
		.eq("product_id", productId);

	if (error || !data) {
		return { ok: false as const, error: "db_error" as const };
	}

	const deviceModelIds = data.map((row) =>
		String((row as { device_model_id: string }).device_model_id),
	);
	return { ok: true as const, deviceModelIds };
}

export async function getProductById(id: string): Promise<GetProductResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const { data, error } = await auth.supabase
		.from("products")
		.select("*")
		.eq("id", id)
		.maybeSingle();

	if (error || !data) {
		return { ok: false as const, error: "not_found" as const };
	}

	return { ok: true as const, product: mapRowToProduct(data) };
}

export async function listProducts(
	params: {
		search?: string;
		active?: boolean | null;
		limit?: number;
		offset?: number;
	} = {},
): Promise<ListProductsResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	let query = auth.supabase
		.from("products")
		.select("*", { count: "exact" })
		.order("created_at", { ascending: false });

	if (params.search) {
		const term = `%${params.search.trim()}%`;
		query = query.or(
			`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`,
		);
	}

	if (params.active !== null && params.active !== undefined) {
		query = query.eq("is_active", params.active);
	}

	const limit =
		params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;
	const offset = params.offset && params.offset > 0 ? params.offset : 0;

	query = query.range(offset, offset + limit - 1);

	const { data, error, count } = await query;

	if (error || !data) {
		return { ok: false as const, error: "db_error" as const };
	}

	return {
		ok: true as const,
		items: data.map(mapRowToProduct),
		total: count ?? data.length,
	};
}

export async function addStockMovement(
	productId: string,
	input: AddStockMovementInput,
): Promise<AddStockMovementResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const quantity = Number(input.quantity);
	if (!Number.isFinite(quantity) || quantity <= 0) {
		return { ok: false as const, error: "quantity_invalid" as const };
	}

	const type: StockMovementType = input.type;
	if (!["entry", "exit", "loss"].includes(type)) {
		return { ok: false as const, error: "type_invalid" as const };
	}

	const unitValueCents = normalizeMoney(input.unitValueCents ?? 0) ?? 0;
	const totalValueCents = unitValueCents * quantity;

	const { data: inserted, error } = await auth.supabase
		.from("product_stock_movements")
		.insert({
			organization_id: auth.organizationId,
			product_id: productId,
			type,
			quantity,
			unit_value_cents: unitValueCents,
			total_value_cents: totalValueCents,
			source: input.source || "manual",
			external_reference: input.externalReference ?? null,
			created_by: auth.userId,
		})
		.select("*")
		.maybeSingle();

	if (error || !inserted) {
		return { ok: false as const, error: "db_error" as const };
	}

	const movement = mapRowToMovement(inserted);
	const currentStock = await getProductCurrentStock(productId);

	return {
		ok: true as const,
		movement,
		currentStock:
			currentStock.ok && "currentStock" in currentStock
				? currentStock.currentStock
				: null,
	};
}

export async function listStockMovements(
	productId: string,
): Promise<ListStockMovementsResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const { data, error } = await auth.supabase
		.from("product_stock_movements")
		.select("*")
		.eq("product_id", productId)
		.order("created_at", { ascending: false });

	if (error || !data) {
		return { ok: false as const, error: "db_error" as const };
	}

	return {
		ok: true as const,
		items: data.map(mapRowToMovement),
	};
}

export async function getProductCurrentStock(
	productId: string,
): Promise<GetProductCurrentStockResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const { data, error } = await auth.supabase
		.from("product_stock_movements")
		.select("type, quantity")
		.eq("product_id", productId);

	if (error || !data) {
		return { ok: false as const, error: "db_error" as const };
	}

	let balance = 0;
	for (const row of data) {
		const type = (row as { type: StockMovementType }).type;
		const quantity = Number((row as { quantity: number }).quantity) || 0;
		if (!Number.isFinite(quantity) || quantity <= 0) continue;
		if (type === "entry") balance += quantity;
		else if (type === "exit" || type === "loss") balance -= quantity;
	}

	return { ok: true as const, currentStock: balance };
}

/** Valor unitário (centavos) da movimentação de entrada mais recente; `null` se não houver entrada. */
export async function getLastStockEntryUnitValueCents(
	productId: string,
): Promise<GetLastStockEntryUnitValueResult> {
	const auth = await requireAuth();
	if (!auth.ok) return { ok: false, error: "not_authenticated" };

	const { data, error } = await auth.supabase
		.from("product_stock_movements")
		.select("unit_value_cents")
		.eq("product_id", productId)
		.eq("type", "entry")
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) {
		return { ok: false as const, error: "db_error" as const };
	}
	if (!data) {
		return { ok: true as const, unitValueCents: null };
	}
	const v = (data as { unit_value_cents?: unknown }).unit_value_cents;
	const n = parseRowCents(v);
	return { ok: true as const, unitValueCents: n };
}

export async function getProductWithStock(
	id: string,
): Promise<GetProductWithStockResult> {
	const [productRes, stockRes] = await Promise.all([
		getProductById(id),
		getProductCurrentStock(id),
	]);
	if (!productRes.ok) {
		return {
			ok: false,
			error: "error" in productRes ? productRes.error : "not_found",
		};
	}
	if (!stockRes.ok) {
		return {
			ok: false,
			error: "error" in stockRes ? stockRes.error : "db_error",
		};
	}

	return {
		ok: true as const,
		product: productRes.product,
		currentStock: stockRes.currentStock,
	};
}

function mapRowToProduct(row: Record<string, unknown>): Product {
	const createdAt = typeof row.created_at === "string" ? row.created_at : "";
	const updatedAt =
		typeof row.updated_at === "string" ? row.updated_at : createdAt;

	const rawParentBling = row.parent_bling_id;
	const parentBlingId =
		rawParentBling != null && String(rawParentBling).trim() !== ""
			? String(rawParentBling).trim()
			: null;

	const rawParentProductUuid = row.parent_product_id;
	const parentProductId =
		rawParentProductUuid != null &&
		String(rawParentProductUuid).trim() !== "" &&
		UUID_RE.test(String(rawParentProductUuid).trim().toLowerCase())
			? String(rawParentProductUuid).trim().toLowerCase()
			: null;

	const variationAttributeKeys = parseVariationAttributeKeys(
		row.variation_attribute_keys,
	);
	const variationAttributeValues = parseVariationAttributeValues(
		row.variation_attribute_values,
	);

	const rawCatalogSort =
		row.catalog_sort_key != null && String(row.catalog_sort_key).trim() !== ""
			? String(row.catalog_sort_key).trim()
			: null;

	const rawTag = row.pricing_tag_id;
	const pricingTagId =
		rawTag != null && String(rawTag).trim() !== "" && UUID_RE.test(String(rawTag).trim())
			? String(rawTag).trim().toLowerCase()
			: null;

	return {
		id: String(row.id),
		blingId: row.bling_id ? String(row.bling_id) : null,
		parentBlingId,
		parentProductId,
		variationAttributeKeys,
		variationAttributeValues,
		blingSyncPending: Boolean(row.bling_sync_pending ?? false),
		blingSyncSnapshot: mapRowToProductSyncSnapshot(row.bling_sync_snapshot),
		kind: row.kind === "product" || row.kind === "service" ? row.kind : null,
		name: String(row.name || "").trim(),
		sku: row.sku ? String(row.sku).trim() : null,
		barcode: row.barcode ? String(row.barcode).trim() : null,
		description: row.description ? String(row.description).trim() : null,
		imageUrl: row.image_url ? String(row.image_url) : null,
		salePriceCents: parseRowCents(row.sale_price_cents),
		pricingTagId,
		costPriceCents: parseRowCents(row.cost_price_cents),
		costPriceManualEditedAt:
			typeof row.cost_price_manual_edited_at === "string"
				? row.cost_price_manual_edited_at
				: null,
		isActive: Boolean(row.is_active ?? true),
		catalogSortKey: rawCatalogSort,
		createdAt,
		updatedAt,
	};
}

function mapRowToProductSyncSnapshot(
	value: unknown,
): ProductSyncSnapshot | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;

	const snapshot = value as Record<string, unknown>;
	const kind =
		snapshot.kind === "product" || snapshot.kind === "service"
			? snapshot.kind
			: null;

	return {
		name: String(snapshot.name || "").trim(),
		sku: snapshot.sku ? String(snapshot.sku).trim() : null,
		barcode: snapshot.barcode ? String(snapshot.barcode).trim() : null,
		description: snapshot.description
			? String(snapshot.description).trim()
			: null,
		salePriceCents: parseRowCents(snapshot.salePriceCents),
		costPriceCents: parseRowCents(snapshot.costPriceCents),
		isActive: Boolean(snapshot.isActive ?? true),
		kind,
	};
}

function mapRowToMovement(row: Record<string, unknown>): StockMovement {
	const source =
		row.source === "bling" || row.source === "system" || row.source === "manual" || row.source === "pdv_sale" || row.source === "service_order"
			? row.source
			: "manual";
	const createdAt = typeof row.created_at === "string" ? row.created_at : "";

	return {
		id: String(row.id),
		productId: String(row.product_id),
		type: row.type as StockMovementType,
		quantity: Number(row.quantity) || 0,
		unitValueCents: Number(row.unit_value_cents) || 0,
		totalValueCents: Number(row.total_value_cents) || 0,
		source,
		externalReference: row.external_reference
			? String(row.external_reference)
			: null,
		createdAt,
	};
}
