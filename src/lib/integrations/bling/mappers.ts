export type LocalProduct = {
	id?: string;
	blingId?: string | null;
	parentBlingId?: string | null;
	name: string;
	sku?: string | null;
	barcode?: string | null;
	description?: string | null;
	imageUrl?: string | null;
	kind?: "product" | "service" | null;
	salePriceCents?: number | null;
	costPriceCents?: number | null;
	isActive?: boolean;
	ncm?: string | null;
	cest?: string | null;
	cfop?: string | null;
	fiscalOrigin?: number | null;
	fiscalUnit?: string | null;
	icmsCsosn?: string | null;
	icmsCst?: string | null;
	pisCst?: string | null;
	cofinsCst?: string | null;
	/** Estoque atual no Bling; usado na importação para criar/alinhar movimentos. */
	estoqueAtual?: number;
};

export type LocalStockMovement = {
	type: "entry" | "exit" | "loss";
	quantity: number;
	unitValueCents: number;
	totalValueCents: number;
	source: "bling" | "manual" | "system";
	externalReference?: string | null;
	createdAt?: string;
};

/** API Bling v3: listagem retorna estoque em estoque.saldoVirtualTotal, custo em precoCusto; código de barras em gtin ou codigoBarras. */
type BlingProductDto = {
	id?: number | string;
	/** ID do produto pai (variação) — pode vir flat ou só dentro de produtoPai. */
	idProdutoPai?: number | string;
	produtoPai?: { id?: number | string };
	produto_pai?: { id?: number | string };
	pai?: { id?: number | string };
	nome?: string;
	codigo?: string;
	gtin?: string;
	gtinEmbalagem?: string;
	codigoBarras?: string;
	descricao?: string;
	descricaoCurta?: string;
	situacao?: string;
	tipo?: string;
	preco?: number;
	custo?: number;
	precoCusto?: number;
	estoqueAtual?: number;
	quantidadeEstoque?: number;
	estoque?: { saldoVirtualTotal?: number };
	fornecedor?: { precoCusto?: unknown; precoCompra?: unknown };
	/** Lista de vínculos produto–fornecedor (custo de compra costuma vir aqui). */
	fornecedores?: unknown;
	imagemURL?: string;
	imagemUrl?: string;
	urlImagem?: string;
	midia?: unknown;
};

function trimUrl(v: unknown): string | null {
	if (v == null || v === "") return null;
	const s = String(v).trim();
	return s || null;
}

function urlFromImagemItem(item: unknown): string | null {
	if (item == null) return null;
	if (typeof item === "string") return trimUrl(item);
	if (typeof item !== "object" || Array.isArray(item)) return null;
	const rec = item as Record<string, unknown>;
	return trimUrl(
		rec.link ?? rec.Link ?? rec.linkMiniatura ?? rec.url ?? rec.URL ?? rec.href,
	);
}

function urlsFromImagemArray(arr: unknown): string | null {
	if (!Array.isArray(arr) || arr.length === 0) return null;
	for (const item of arr) {
		const u = urlFromImagemItem(item);
		if (u) return u;
	}
	return null;
}

/**
 * Bling v3: `midia.imagens` pode ser:
 * - objeto `{ internas, externas, imagensURL }`
 * - array direto `[{ link: "..." }, ...]`
 */
function urlsFromImagensObject(img: Record<string, unknown>): string | null {
	const fromInternas = urlsFromImagemArray(img.internas);
	if (fromInternas) return fromInternas;

	const fromExternas = urlsFromImagemArray(img.externas);
	if (fromExternas) return fromExternas;

	const imagensUrlRaw = img.imagensURL ?? img.imagensUrl;
	if (Array.isArray(imagensUrlRaw)) {
		for (const entry of imagensUrlRaw) {
			const u = urlFromImagemItem(entry);
			if (u) return u;
		}
	}

	for (const v of Object.values(img)) {
		if (!Array.isArray(v) || v.length === 0) continue;
		const u = urlsFromImagemArray(v);
		if (u) return u;
	}

	return null;
}

function imageUrlFromMidia(midia: unknown): string | null {
	if (!midia || typeof midia !== "object" || Array.isArray(midia)) return null;
	const m = midia as Record<string, unknown>;
	const rawImagens = m.imagens;

	if (Array.isArray(rawImagens)) {
		return urlsFromImagemArray(rawImagens);
	}

	if (
		rawImagens &&
		typeof rawImagens === "object" &&
		!Array.isArray(rawImagens)
	) {
		return urlsFromImagensObject(rawImagens as Record<string, unknown>);
	}

	return null;
}

function recordPropCI(
	obj: Record<string, unknown>,
	nameLower: string,
): unknown {
	for (const key of Object.keys(obj)) {
		if (key.toLowerCase() === nameLower) return obj[key];
	}
	return undefined;
}

function readPropCI(
	obj: Record<string, unknown>,
	names: string[],
): { found: boolean; value: unknown } {
	for (const wanted of names) {
		const lower = wanted.toLowerCase();
		for (const key of Object.keys(obj)) {
			if (key.toLowerCase() === lower) return { found: true, value: obj[key] };
		}
	}
	return { found: false, value: undefined };
}

function objectPropCI(obj: Record<string, unknown>, names: string[]): Record<string, unknown> | null {
	const found = readPropCI(obj, names);
	if (!found.found || !found.value || typeof found.value !== "object" || Array.isArray(found.value)) {
		return null;
	}
	return found.value as Record<string, unknown>;
}

function fiscalContainersFrom(
	flat: Record<string, unknown>,
	slice: Record<string, unknown>,
): Record<string, unknown>[] {
	const containers: Record<string, unknown>[] = [slice, flat];
	const nestedKeys = [
		"tributacao",
		"tributação",
		"tributacaoProduto",
		"dadosFiscais",
		"dados_fiscais",
		"fiscal",
		"produtoFiscal",
	];
	for (const source of [slice, flat]) {
		for (const key of nestedKeys) {
			const nested = objectPropCI(source, [key]);
			if (nested) containers.push(nested);
		}
	}
	return containers;
}

function nestedFiscalContainers(
	containers: Record<string, unknown>[],
	names: string[],
): Record<string, unknown>[] {
	const nested: Record<string, unknown>[] = [];
	for (const container of containers) {
		const item = objectPropCI(container, names);
		if (item) nested.push(item);
	}
	return [...nested, ...containers];
}

function readFiscalValue(
	containers: Record<string, unknown>[],
	names: string[],
): { found: boolean; value: unknown } {
	for (const container of containers) {
		const found = readPropCI(container, names);
		if (found.found) return found;
	}
	return { found: false, value: undefined };
}

function fiscalDigits(
	containers: Record<string, unknown>[],
	names: string[],
	maxLength: number,
): string | null | undefined {
	const found = readFiscalValue(containers, names);
	if (!found.found) return undefined;
	const digits = String(found.value ?? "").replace(/\D/g, "").slice(0, maxLength);
	return digits || null;
}

function fiscalText(
	containers: Record<string, unknown>[],
	names: string[],
	maxLength: number,
): string | null | undefined {
	const found = readFiscalValue(containers, names);
	if (!found.found) return undefined;
	const text = String(found.value ?? "").trim().toUpperCase().slice(0, maxLength);
	return text || null;
}

function fiscalOrigin(
	containers: Record<string, unknown>[],
): number | null | undefined {
	const found = readFiscalValue(containers, [
		"origem",
		"origemFiscal",
		"codigoOrigem",
		"codigo_origem",
		"origemMercadoria",
	]);
	if (!found.found) return undefined;
	const digits = String(found.value ?? "").replace(/\D/g, "");
	if (!digits) return null;
	const n = Number(digits[0]);
	return Number.isInteger(n) && n >= 0 && n <= 8 ? n : null;
}

function extractFiscalFields(
	flat: Record<string, unknown>,
	slice: Record<string, unknown>,
): Pick<
	LocalProduct,
	| "ncm"
	| "cest"
	| "cfop"
	| "fiscalOrigin"
	| "fiscalUnit"
	| "icmsCsosn"
	| "icmsCst"
	| "pisCst"
	| "cofinsCst"
> {
	const containers = fiscalContainersFrom(flat, slice);
	const icmsContainers = nestedFiscalContainers(containers, ["icms", "ICMS"]);
	const pisContainers = nestedFiscalContainers(containers, ["pis", "PIS"]);
	const cofinsContainers = nestedFiscalContainers(containers, ["cofins", "COFINS"]);

	return {
		ncm: fiscalDigits(containers, ["ncm", "classificacaoFiscal", "classificacao_fiscal"], 8),
		cest: fiscalDigits(containers, ["cest", "codigoCest", "codigoCEST", "codigo_cest"], 7),
		cfop: fiscalDigits(containers, ["cfop", "cfopPadrao", "cfop_padrao", "cfopSaida", "cfop_saida"], 4),
		fiscalOrigin: fiscalOrigin(containers),
		fiscalUnit: fiscalText(containers, ["unidade", "unidadeMedida", "unidade_medida", "un"], 6),
		icmsCsosn: fiscalDigits(icmsContainers, ["csosn", "icmsCsosn", "codigoCsosn", "codigo_csosn"], 3),
		icmsCst: fiscalDigits(icmsContainers, ["cst", "icmsCst", "codigoCst", "codigo_cst"], 3),
		pisCst: fiscalDigits(pisContainers, ["cst", "pisCst", "cstPis", "codigoCst", "codigo_cst"], 2),
		cofinsCst: fiscalDigits(cofinsContainers, ["cst", "cofinsCst", "cstCofins", "codigoCst", "codigo_cst"], 2),
	};
}

/** Bling v3: `imagemURL` na raiz ou imagens em `midia.imagens` (internas/externas/imagensURL). */
function extractBlingProductImageUrl(
	flat: Record<string, unknown>,
): string | null {
	const direct = trimUrl(
		flat.imagemURL ??
			flat.imagemUrl ??
			flat.urlImagem ??
			recordPropCI(flat, "imagemurl"),
	);
	if (direct) return direct;
	const midia = flat.midia ?? recordPropCI(flat, "midia");
	return imageUrlFromMidia(midia);
}

/** Quando o GET retorna o pai (`formato` V) e o portal está vinculado a uma variação, a foto pode estar só no item de `variacoes`. */
function findVariacaoSliceByBlingId(
	flat: Record<string, unknown>,
	blingId: string,
): Record<string, unknown> | null {
	const key = String(blingId).trim();
	if (!key) return null;
	const lists = [flat.variacoes, flat.variações];
	for (const raw of lists) {
		if (!Array.isArray(raw)) continue;
		for (const item of raw) {
			if (!item || typeof item !== "object" || Array.isArray(item)) continue;
			const rec = item as Record<string, unknown>;
			const id = rec.id;
			if (id != null && String(id).trim() === key) return rec;
		}
	}
	return null;
}

/** Quando o GET devolve o pai e o `bling_id` do portal é da variação, preço/estoque ficam no item de `variacoes`. */
function resolveProductDataSlice(
	flat: Record<string, unknown>,
	knownBlingId?: string | null,
): Record<string, unknown> {
	if (!knownBlingId) return flat;
	const known = String(knownBlingId).trim();
	if (!known) return flat;
	const rootId =
		flat.id != null && String(flat.id).trim() !== ""
			? String(flat.id).trim()
			: "";
	if (!rootId || known === rootId) return flat;
	const slice = findVariacaoSliceByBlingId(flat, known);
	return slice ?? flat;
}

function getBarcode(dto: BlingProductDto): string | null {
	const v = dto.gtin ?? dto.codigoBarras ?? dto.gtinEmbalagem;
	if (v == null || v === "") return null;
	const s = String(v).trim();
	return s || null;
}

/** Converte preço/custo do JSON Bling (número ou string). */
function toMoneyCents(v: unknown): number | null {
	if (v == null || v === "") return null;
	if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100);
	if (typeof v === "string") {
		const t = v.trim().replace(/\s/g, "").replace(",", ".");
		if (t === "") return null;
		const n = Number(t);
		if (!Number.isFinite(n)) return null;
		return Math.round(n * 100);
	}
	return null;
}

function precoAsNumber(dto: BlingProductDto): number | null {
	const p = dto.preco;
	if (typeof p === "number" && Number.isFinite(p)) return p;
	if (typeof p === "string") {
		const n = Number(String(p).trim().replace(",", "."));
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function supplierPrecoCustoCents(dto: BlingProductDto): number | null {
	const f = dto.fornecedor;
	if (!f || typeof f !== "object" || Array.isArray(f)) return null;
	const rec = f as Record<string, unknown>;
	for (const key of [
		"precoCusto",
		"precoCompra",
		"preco_custo",
		"preco_compra",
	]) {
		if (!(key in rec)) continue;
		const c = toMoneyCents(rec[key]);
		if (c != null && c > 0) return c;
	}
	return null;
}

/** Custo a partir de `fornecedores[]` — prioriza vínculo com `padrao: true`, senão o primeiro. */
function supplierCostFromFornecedoresArray(dto: BlingProductDto): number | null {
	const raw = dto.fornecedores;
	if (!Array.isArray(raw) || raw.length === 0) return null;
	const rows = raw.filter(
		(x): x is Record<string, unknown> =>
			Boolean(x && typeof x === "object" && !Array.isArray(x)),
	);
	if (rows.length === 0) return null;
	const preferred = rows.find(
		(x) =>
			x.padrao === true ||
			x.padrao === "true" ||
			String(x.padrao).toLowerCase() === "true",
	);
	const ordered = preferred ? [preferred, ...rows.filter((x) => x !== preferred)] : rows;
	for (const item of ordered) {
		const c = toMoneyCents(
			item.precoCusto ?? item.precoCompra ?? item.preco_custo ?? item.preco_compra,
		);
		if (c != null && c > 0) return c;
	}
	return null;
}

/**
 * `preco` = venda. Custo: prioriza `fornecedores[]` / `fornecedor`, depois `precoCusto` na raiz; `custo` costuma espelhar venda.
 */
function resolveSaleAndCostCents(dto: BlingProductDto): {
	saleCents: number | null;
	costCents: number | null;
} {
	const saleFromPreco = toMoneyCents(dto.preco);
	const precoNum = precoAsNumber(dto);

	let costCents: number | null = null;

	const fromFornecedoresList = supplierCostFromFornecedoresArray(dto);
	if (fromFornecedoresList != null) {
		costCents = fromFornecedoresList;
	}

	if (costCents == null) {
		const sup = supplierPrecoCustoCents(dto);
		if (sup != null) costCents = sup;
	}

	if (costCents == null && dto.precoCusto !== undefined && dto.precoCusto !== null) {
		const pc = toMoneyCents(dto.precoCusto);
		if (pc != null && pc > 0) {
			costCents = pc;
		}
	}

	if (costCents == null && dto.custo !== undefined && dto.custo !== null) {
		const custoCents = toMoneyCents(dto.custo);
		const precoZero = precoNum == null || precoNum === 0;
		if (precoZero && custoCents != null && custoCents > 0) {
			costCents = null;
		} else if (
			custoCents != null &&
			saleFromPreco != null &&
			custoCents === saleFromPreco
		) {
			costCents = null;
		} else {
			costCents = custoCents;
		}
	}

	let saleCents = saleFromPreco;
	if (
		(saleCents == null || saleCents === 0) &&
		dto.custo !== undefined &&
		dto.custo !== null
	) {
		const custoCents = toMoneyCents(dto.custo);
		const costIsUnsetOrZero = costCents == null || costCents === 0;
		if (custoCents != null && custoCents > 0 && costIsUnsetOrZero) {
			saleCents = custoCents;
		}
	}

	return { saleCents, costCents };
}

function getStock(dto: BlingProductDto): number | undefined {
	const fromNested =
		typeof dto.estoque?.saldoVirtualTotal === "number" &&
		Number.isFinite(dto.estoque.saldoVirtualTotal)
			? dto.estoque.saldoVirtualTotal
			: undefined;
	const fromRoot =
		typeof dto.estoqueAtual === "number" && dto.estoqueAtual >= 0
			? dto.estoqueAtual
			: undefined;
	const fromQty =
		typeof dto.quantidadeEstoque === "number" && dto.quantidadeEstoque >= 0
			? dto.quantidadeEstoque
			: undefined;
	const n = fromNested ?? fromRoot ?? fromQty;
	return n !== undefined && Number.isFinite(n) ? Number(n) : undefined;
}

function asTrimmedId(v: unknown): string | null {
	if (v == null || v === "") return null;
	if (typeof v === "number" && (!Number.isFinite(v) || v === 0)) return null;
	const s = String(v).trim();
	if (!s || s === "0") return null;
	return s;
}

/**
 * Remove envelopes comuns da API v3 (`data`, `produto`) e array de um único item.
 */
export function unwrapBlingProductDto(raw: unknown): Record<string, unknown> {
	let cur: unknown = raw;
	for (let i = 0; i < 8; i++) {
		if (Array.isArray(cur)) {
			if (cur.length !== 1 || cur[0] == null || typeof cur[0] !== "object") {
				return {};
			}
			cur = cur[0];
			continue;
		}
		if (!cur || typeof cur !== "object") return {};
		const r = cur as Record<string, unknown>;
		if (
			r.data != null &&
			typeof r.data === "object" &&
			!Array.isArray(r.data)
		) {
			cur = r.data;
			continue;
		}
		if (
			r.produto != null &&
			typeof r.produto === "object" &&
			!Array.isArray(r.produto)
		) {
			cur = r.produto;
			continue;
		}
		break;
	}
	if (Array.isArray(cur) || !cur || typeof cur !== "object") return {};
	return cur as Record<string, unknown>;
}

/** idProdutoPai no Bling pode vir como número/string ou só em produtoPai.id / produto_pai.id. */
function extractParentBlingIdFromDto(
	raw: Record<string, unknown>,
): string | null {
	const flat =
		asTrimmedId(raw.idProdutoPai) ??
		asTrimmedId(raw.id_produto_pai) ??
		asTrimmedId(raw.produtoPaiId) ??
		asTrimmedId(raw.idPai) ??
		asTrimmedId(raw.id_pai);
	if (flat) return flat;

	if (raw.produtoPai != null && typeof raw.produtoPai !== "object") {
		const primitiveParent = asTrimmedId(raw.produtoPai);
		if (primitiveParent) return primitiveParent;
	}
	if (raw.produto_pai != null && typeof raw.produto_pai !== "object") {
		const primitiveParent = asTrimmedId(raw.produto_pai);
		if (primitiveParent) return primitiveParent;
	}

	const fromNestedObject = (obj: unknown): string | null => {
		if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
		return asTrimmedId((obj as Record<string, unknown>).id);
	};

	for (const key of Object.keys(raw)) {
		if (key.toLowerCase() === "produtopai" || key === "produto_pai") {
			const nested = fromNestedObject(raw[key]);
			if (nested) return nested;
		}
	}

	const variacaoRaw = raw.variacao;
	if (
		variacaoRaw &&
		typeof variacaoRaw === "object" &&
		!Array.isArray(variacaoRaw)
	) {
		const pp = (variacaoRaw as Record<string, unknown>).produtoPai;
		const fromVar = fromNestedObject(pp);
		if (fromVar) return fromVar;
	}

	return (
		fromNestedObject(raw.produtoPai) ??
		fromNestedObject(raw.produto_pai) ??
		fromNestedObject(raw.pai) ??
		null
	);
}

/**
 * Quando `produtoPai` não vem na raiz (ex.: só dentro de `variacoes`), busca em profundidade limitada.
 * Ignora `produtoPai.id` igual ao próprio produto (comum no pai com lista de variações).
 */
function deepFindParentBlingId(
	root: Record<string, unknown>,
	ownBlingId: string,
): string | null {
	const queue: unknown[] = [root];
	const seen = new WeakSet<object>();
	let visited = 0;
	const maxNodes = 2500;

	while (queue.length > 0 && visited < maxNodes) {
		const node = queue.shift();
		if (node == null || typeof node !== "object") continue;
		if (Array.isArray(node)) {
			for (const item of node) queue.push(item);
			continue;
		}
		if (seen.has(node)) continue;
		seen.add(node);
		visited++;

		const rec = node as Record<string, unknown>;
		for (const key of Object.keys(rec)) {
			if (!/^produtopai$/i.test(key) && key !== "produto_pai") continue;
			const v = rec[key];
			if (!v || typeof v !== "object" || Array.isArray(v)) continue;
			const pid = asTrimmedId((v as Record<string, unknown>).id);
			if (pid && pid !== ownBlingId) return pid;
		}
		for (const key of Object.keys(rec)) {
			const v = rec[key];
			if (v != null && typeof v === "object") queue.push(v);
		}
	}
	return null;
}

function resolveParentBlingId(
	flat: Record<string, unknown>,
	ownBlingIdHint: string,
): string | null {
	const ownFromDto = flat.id != null ? String(flat.id).trim() : "";
	const ownId = ownFromDto || ownBlingIdHint;
	let parentId = extractParentBlingIdFromDto(flat);
	if (parentId && ownId && parentId === ownId) parentId = null;
	if (!parentId && ownId) parentId = deepFindParentBlingId(flat, ownId) ?? null;
	if (parentId && ownId && parentId === ownId) return null;
	return parentId;
}

export type MapBlingProductContext = {
	/** Nomes de produtos raiz na mesma página de listagem (import em lote). */
	parentNameByBlingId?: ReadonlyMap<string, string>;
};

function trimTxt(v: unknown): string {
	if (v == null || v === "") return "";
	return String(v).replace(/\s+/g, " ").trim();
}

function nomeFromParentObject(obj: unknown): string {
	if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "";
	return trimTxt((obj as Record<string, unknown>).nome);
}

function resolveBlingParentNameForVariation(
	rootFlat: Record<string, unknown>,
	slice: Record<string, unknown>,
	parentBlingId: string,
	ctx?: MapBlingProductContext,
): string {
	const fromCtx = ctx?.parentNameByBlingId?.get(parentBlingId);
	if (fromCtx) return fromCtx;

	const fromSliceNested = [
		nomeFromParentObject(slice.produtoPai),
		nomeFromParentObject(slice.produto_pai),
		nomeFromParentObject(slice.pai),
	];
	for (const n of fromSliceNested) {
		if (n) return n;
	}

	const varWrap = slice.variacao ?? slice.variação;
	if (varWrap && typeof varWrap === "object" && !Array.isArray(varWrap)) {
		const rec = varWrap as Record<string, unknown>;
		const nested =
			nomeFromParentObject(rec.produtoPai) ||
			nomeFromParentObject(rec.produto_pai);
		if (nested) return nested;
	}

	const rootId = asTrimmedId(rootFlat.id);
	if (rootId === parentBlingId) return trimTxt(rootFlat.nome);

	return "";
}

type VariationPart = { tipo: string; valor: string };

function readCaracteristicasParts(slice: Record<string, unknown>): VariationPart[] {
	const raw = slice.caracteristicas ?? slice.características;
	if (!Array.isArray(raw) || raw.length === 0) return [];
	const out: VariationPart[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue;
		const row = item as Record<string, unknown>;
		const tipo = trimTxt(row.nome ?? row.descricao);
		const valor = trimTxt(
			row.valor ?? row.valorNome ?? row.nomeValor ?? row.valorDaVariacao,
		);
		if (tipo || valor) out.push({ tipo, valor });
	}
	return out;
}

function readVariacaoWrapperParts(
	slice: Record<string, unknown>,
	parentName: string,
	sliceNome: string,
): VariationPart[] {
	const v = slice.variacao ?? slice.variação;
	if (!v || typeof v !== "object" || Array.isArray(v)) return [];
	const rec = v as Record<string, unknown>;
	let tipo = trimTxt(rec.nome ?? rec.tipo ?? rec.descricao);
	let valor = trimTxt(
		rec.valorNome ??
			rec.valor ??
			rec.valorDaVariacao ??
			rec.nomeCompletoVariacao ??
			rec.nomeVariacao,
	);
	if (tipo && !valor) {
		const sn = sliceNome.trim();
		const pn = parentName.trim();
		if (sn && (!pn || sn.toLowerCase() !== pn.toLowerCase())) valor = sn;
	}
	if (!tipo && !valor) return [];
	return [{ tipo, valor }];
}

function parseTailAfterParentName(
	parentName: string,
	sliceNome: string,
): VariationPart | null {
	const pn = parentName.trim();
	const sn = sliceNome.trim();
	if (!pn || !sn) return null;
	if (sn.toLowerCase() === pn.toLowerCase()) return null;
	if (!sn.toLowerCase().startsWith(pn.toLowerCase())) return null;
	const tail = sn.slice(pn.length).trim();
	if (!tail) return null;
	const m = tail.match(/^([^:]+):\s*(.+)$/i);
	if (m) return { tipo: m[1].trim(), valor: m[2].trim() };
	return { tipo: "", valor: tail };
}

function mergeVariationParts(
	slice: Record<string, unknown>,
	parentName: string,
	sliceNome: string,
): VariationPart[] {
	const fromChars = readCaracteristicasParts(slice);
	if (fromChars.length > 0) return fromChars;

	const fromVar = readVariacaoWrapperParts(slice, parentName, sliceNome);
	if (fromVar.length > 0 && (fromVar[0].tipo || fromVar[0].valor)) return fromVar;

	const parsed = parseTailAfterParentName(parentName, sliceNome);
	if (parsed && (parsed.tipo || parsed.valor)) return [parsed];

	const sn = sliceNome.trim();
	const pn = parentName.trim();
	if (sn && (!pn || sn.toLowerCase() !== pn.toLowerCase())) {
		if (!pn || !sn.toLowerCase().startsWith(pn.toLowerCase())) {
			return [{ tipo: "", valor: sn }];
		}
	}
	return [];
}

function buildVariationDisplayName(
	parentName: string,
	parts: VariationPart[],
	fallbackNome: string,
): string {
	const p = parentName.trim();
	const fb = fallbackNome.trim();
	if (parts.length === 0) return fb || p || "Produto";

	const segments = parts
		.filter((x) => x.valor || x.tipo)
		.map(({ tipo, valor }) => {
			const t = tipo.trim();
			const v = valor.trim();
			if (t && v) return `${t.toLowerCase()}:${v}`;
			return v || t;
		})
		.filter(Boolean);

	if (p && segments.length > 0) return `${p} ${segments.join(" ")}`.trim();
	if (segments.length > 0) return segments.join(" ");
	return fb || p || "Produto";
}

/**
 * Monta mapa `id Bling do pai` → `nome` a partir de itens de uma página `/produtos`.
 */
export function buildParentNameByBlingIdFromPageItems(
	items: Array<{ produto?: Record<string, unknown> } | Record<string, unknown>>,
): Map<string, string> {
	const map = new Map<string, string>();
	for (const raw of items) {
		const dto =
			(raw as { produto?: Record<string, unknown> }).produto ??
			(raw as Record<string, unknown>);
		const flat = unwrapBlingProductDto(dto) as Record<string, unknown>;
		const id = asTrimmedId(flat.id);
		if (!id) continue;
		const parentId = resolveParentBlingId(flat, id);
		if (parentId) continue;
		const nome = trimTxt(flat.nome);
		if (nome) map.set(id, nome);
	}
	return map;
}

/**
 * @param knownBlingId — ID Bling do item já visto no portal (ex.: URL do GET); usado se o JSON não trouxer `id` na raiz após unwrap.
 */
export function mapBlingProductToLocal(
	rawDto: unknown,
	knownBlingId?: string | null,
	ctx?: MapBlingProductContext,
): LocalProduct {
	const flat = unwrapBlingProductDto(rawDto) as Record<string, unknown>;
	const slice = resolveProductDataSlice(flat, knownBlingId);
	const dto = slice as unknown as BlingProductDto;
	const idFromDto = dto.id != null ? String(dto.id) : null;
	const id =
		idFromDto ??
		(knownBlingId != null && String(knownBlingId).trim()
			? String(knownBlingId).trim()
			: null);
	const ownHint = String(idFromDto ?? knownBlingId ?? "").trim();
	const parentId = resolveParentBlingId(slice, ownHint);
	const sliceNome = String(dto.nome || "").trim();
	let name = sliceNome;
	if (parentId) {
		const parentName = resolveBlingParentNameForVariation(
			flat,
			slice as Record<string, unknown>,
			parentId,
			ctx,
		);
		const parts = mergeVariationParts(
			slice as Record<string, unknown>,
			parentName,
			sliceNome,
		);
		name = buildVariationDisplayName(parentName, parts, sliceNome);
	}
	const barcode = getBarcode(dto);
	const { saleCents, costCents } = resolveSaleAndCostCents(dto);
	const estoqueAtual = getStock(dto);
	const imageUrl = extractBlingProductImageUrl(slice);
	const fiscal = extractFiscalFields(flat, slice);
	const tipo = (dto.tipo || "").toString().toUpperCase();
	const kind: "product" | "service" | null =
		tipo === "P" ? "product" : tipo === "S" ? "service" : null;

	const situacao = (dto.situacao || "").toString().trim().toUpperCase();
	/** Bling: A/ATIVO ativo; I/INATIVO inativo; E costuma ser excluído (webhook após exclusão). */
	const isInactiveSituacao = (s: string) => {
		if (!s) return false;
		return (
			s === "INATIVO" ||
			s === "I" ||
			s === "E" ||
			s === "EXCLUIDO" ||
			s === "EXCLUÍDO"
		);
	};
	const isActive = situacao ? !isInactiveSituacao(situacao) : true;

	return {
		blingId: id,
		parentBlingId: parentId,
		name,
		sku: dto.codigo ? String(dto.codigo).trim() : null,
		barcode: barcode ?? null,
		description:
			(dto.descricao ?? dto.descricaoCurta)
				? String(dto.descricao ?? dto.descricaoCurta ?? "").trim()
				: null,
		salePriceCents: saleCents,
		costPriceCents: costCents,
		isActive,
		imageUrl,
		kind,
		...fiscal,
		estoqueAtual,
	};
}

export function mapLocalProductToBling(
	product: LocalProduct,
): Record<string, unknown> {
	const payload: Record<string, unknown> = {};

	if (product.name) payload.nome = product.name;
	if (product.sku !== undefined) payload.codigo = product.sku ?? "";
	if (product.barcode !== undefined) {
		const barcode = product.barcode ?? "";
		/** Bling aceita gtin e/ou codigoBarras; a UI costuma espelhar o GTIN em ambos. */
		payload.gtin = barcode;
		payload.codigoBarras = barcode;
	}
	if (product.description !== undefined)
		payload.descricao = product.description ?? "";
	if (typeof product.salePriceCents === "number")
		payload.preco = product.salePriceCents / 100;
	/** Custo fica só no Conectize; o Bling não é atualizado com CMV/custo pelo portal. */
	if (typeof product.isActive === "boolean") {
		payload.situacao = product.isActive ? "A" : "I";
	}
	if (product.kind === "product") payload.tipo = "P";
	if (product.kind === "service") payload.tipo = "S";

	return payload;
}
