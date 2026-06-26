"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { portalFetch } from "@/lib/portal/portal-fetch";
import {
	commissionFromPercentOfGrossCents,
	grossProfitBeforeCommissionCents,
	paymentFeeCentsForSaleEntries,
} from "@/lib/resale/resale-commission";
import {
	buildCommissionCostDescription,
	isCommissionCostDescription,
	isSaleDerivedCostDescription,
} from "@/lib/resale/resale-sale-costs";
import type {
	ResaleDeviceRow,
	SeminovosFilters,
	SeminovosStats,
} from "@/lib/seminovos/fetch-seminovos-data";
import {
	copyImeiWithPortalToast,
	copyTextWithPortalToast,
	printResaleDeviceLabel,
} from "@/lib/seminovos/resale-portal-clipboard";
import { buildConectizeStockWhatsAppTexts } from "@/lib/seminovos/whatsapp-stock-broadcast-text";
import {
	groupDevicesByModel,
	parseStorageGb,
} from "@/lib/seminovos/group-devices-by-model";
import {
	buildCopyClienteText,
	buildCopyLojistaText,
} from "@/lib/seminovos/seminovos-device-actions";
import { revendaPath } from "@/lib/revenda/revenda-paths";
import { formatCpfCnpj } from "@/lib/utils/format-cpf-cnpj";
import { formatDateBr } from "@/lib/utils/format-date";
import { formatCentsBr } from "@/lib/utils/format-money";
import {
	formatMoneyInput,
	maskedFromCents,
	moneyToCentsFromMasked,
} from "@/lib/utils/money";
import {
	BarChart3,
	Calculator,
	ChevronDown,
	ChevronRight,
	Copy,
	DollarSign,
	Eye,
	EyeOff,
	FileInput,
	Loader2,
	MessageCircle,
	MoreHorizontal,
	Package,
	Plus,
	Receipt,
	Search,
	Trash2,
	TrendingUp,
	Undo2,
	Wrench,
} from "lucide-react";
import { ResaleDeviceStandardActionItems } from "@/components/resale/ResaleDeviceStandardActionItems";
import { ResaleSimulatePaymentDialog } from "@/components/resale/ResaleSimulatePaymentDialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeviceBadges } from "./DeviceBadges";
import { ResaleDeviceTermsDialog } from "./ResaleDeviceTermsDialog";
import {
	ResaleSellAdminProfitCard,
	ResaleSellCommissionFields,
	type ResaleSellCommissionPanelRef,
	type SellCommissionInitial,
	type SellCommissionSnapshot,
} from "./ResaleSellCommissionPanel";
import { SeminovoDeviceCard } from "./SeminovoDeviceCard";
import { SeminovosFilterCollapsible } from "./SeminovosFilterCollapsible";
import { SellPaymentPricingHint } from "./SellPaymentPricingHint";
import {
	SellTradeInSection,
	newEmptySellTradeInLine,
	type SellTradeInLine,
} from "./SellTradeInSection";
import { WhatsAppTextModalButton } from "@/components/whatsapp-text-modal";

const DEFAULT_SELL_COMMISSION_INITIAL: SellCommissionInitial = {
	enabled: false,
	userId: "",
	kind: "fixed",
	percentRaw: "",
	fixedMasked: maskedFromCents(3000),
};

type SellAddonCatalogRow = {
	id: string;
	name: string;
	sku: string | null;
	sale_price_cents: number | null;
	cost_price_cents: number | null;
	stock: number;
};

type SellAddonLine = {
	productId: string;
	name: string;
	quantity: number;
	unitSaleCents: number;
	unitCostCents: number;
};

type CostRow = { id?: string; description: string; value_cents: number };

type CreditInstallmentFee = { installments: number; fee_percent: number };

type PaymentMethod = {
	id: string;
	description: string;
	type: string;
	fee_percent: number;
	credit_installment_fees: CreditInstallmentFee[];
	sort_order: number;
};

type ResaleDevice = {
	id: string;
	device_name: string | null;
	model: string | null;
	color: string | null;
	storage_gb: string | null;
	battery: string | null;
	condition: string | null;
	info: string | null;
	imei: string | null;
	imei2?: string | null;
	serial?: string | null;
	purchase_value_cents: number | null;
	wholesale_value_cents: number | null;
	sale_value_cents: number | null;
	sold_for_cents: number | null;
	actual_profit_cents?: number | null;
	expected_profit_wholesale_cents: number | null;
	expected_profit_sale_cents?: number | null;
	advertised: boolean;
	tested: boolean;
	label: string | null;
	sold: boolean;
	purchase_date: string | null;
	sale_date: string | null;
	costs: CostRow[];
	payment_method_id?: string | null;
	payment_installments?: number | null;
	sale_payment_methods?: Array<{
		payment_method_id: string;
		value_cents?: number | null;
		installments?: number;
	}> | null;
	buyer_name?: string | null;
	buyer_cpf?: string | null;
	sale_details?: string | null;
	stock_type?: string | null;
	sale_commission_user_id?: string | null;
	display_image_url?: string | null;
	trade_ins?: Array<{
		id?: string;
		device_name: string | null;
		imei: string | null;
		info: string | null;
		condition: string | null;
		value_cents: number;
		received_device_id?: string | null;
	}>;
};

type TeamUser = {
	id: string;
	email: string | null;
	full_name: string | null;
	role: string;
};

type SalePaymentEntry = {
	rowKey: string;
	payment_method_id: string;
	value_cents: number | null;
	installments: number;
};

function makeSalePaymentRowKey(): string {
	return typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function newEmptySalePaymentRow(): SalePaymentEntry {
	return {
		rowKey: makeSalePaymentRowKey(),
		payment_method_id: "",
		value_cents: null,
		installments: 1,
	};
}

function centsToReais(cents: number | null | undefined): string {
	if (cents === null || cents === undefined) return "";
	return maskedFromCents(cents);
}

function sortSoldDevices(list: ResaleDevice[]): ResaleDevice[] {
	return [...list].sort((a, b) => {
		const dateA = a.sale_date || "";
		const dateB = b.sale_date || "";
		if (dateA !== dateB) return dateB.localeCompare(dateA);
		return (a.id || "").localeCompare(b.id || "");
	});
}

type OperacionalSeminovosFilters = Omit<
	SeminovosFilters,
	"stockType" | "valueMinCents" | "valueMaxCents"
> & {
	stockType: "seminovo" | "lacrado";
};

const SOLD_SEARCH_PAGE_SIZE = 20

function hasActiveDeviceSearch(filters: OperacionalSeminovosFilters): boolean {
	return Boolean(
		filters.q?.trim() ||
		filters.deviceName?.trim() ||
		filters.condition?.trim() ||
		filters.storageGb?.trim() ||
		filters.color?.trim() ||
		filters.purchaseDateFrom ||
		filters.purchaseDateTo,
	)
}

function buildResaleDevicesListQuery(
	filters: OperacionalSeminovosFilters,
	sold: boolean,
	opts?: { limit?: number; offset?: number },
): string {
	const p = new URLSearchParams();
	p.set("sold", sold ? "true" : "false");
	p.set("stockType", filters.stockType);
	if (filters.q) p.set("q", filters.q);
	if (filters.condition) p.set("condition", filters.condition);
	if (filters.storageGb) p.set("storageGb", filters.storageGb);
	if (filters.color) p.set("color", filters.color);
	if (filters.purchaseDateFrom) p.set("purchaseDateFrom", filters.purchaseDateFrom);
	if (filters.purchaseDateTo) p.set("purchaseDateTo", filters.purchaseDateTo);
	const dn = (filters.deviceName || "").trim();
	if (dn) p.set("deviceName", dn);
	if (opts?.limit != null) {
		p.set("limit", String(opts.limit));
		p.set("offset", String(opts.offset ?? 0));
	}
	return p.toString();
}

type SeminovosListClientProps = {
	initialDevices: ResaleDeviceRow[];
	initialStats: SeminovosStats;
	filterInitialValues: OperacionalSeminovosFilters;
	/** Nomes distintos para o filtro por modelo (listagem operacional). */
	distinctDeviceNames?: string[];
	role: string;
};

export function SeminovosListClient({
	initialDevices,
	initialStats,
	filterInitialValues,
	distinctDeviceNames = [],
	role,
}: SeminovosListClientProps) {
	const isAdmin = role === "admin" || role === "platform_admin";
	const router = useRouter();
	const novaDeviceHref =
		filterInitialValues.stockType === "lacrado"
			? revendaPath.novaNovo
			: revendaPath.nova;
	const [devices, setDevices] = useState<ResaleDevice[]>(
		initialDevices as ResaleDevice[],
	);
	const [isLoading] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<ResaleDevice | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isBulkEdit, setIsBulkEdit] = useState(false);
	const [isSavingBulk, setIsSavingBulk] = useState(false);
	const [editedDevices, setEditedDevices] = useState<ResaleDevice[]>([]);
	const [sellModalTarget, setSellModalTarget] = useState<ResaleDevice | null>(
		null,
	);
	const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
	const sellCommissionPanelRef = useRef<ResaleSellCommissionPanelRef>(null);
	const [sellCommissionSnapshot, setSellCommissionSnapshot] =
		useState<SellCommissionSnapshot>(DEFAULT_SELL_COMMISSION_INITIAL);
	const [commissionBoot, setCommissionBoot] = useState<{
		seq: number;
		initial: SellCommissionInitial;
	}>({
		seq: 0,
		initial: DEFAULT_SELL_COMMISSION_INITIAL,
	});
	const [sellDate, setSellDate] = useState("");
	const [isSavingSell, setIsSavingSell] = useState(false);
	const [sellAddonQuery, setSellAddonQuery] = useState("");
	const [sellAddonBusy, setSellAddonBusy] = useState(false);
	const [sellAddonResults, setSellAddonResults] = useState<SellAddonCatalogRow[]>(
		[],
	);
	const [sellAddonItems, setSellAddonItems] = useState<SellAddonLine[]>([]);
	const sellAddonSearchCacheRef = useRef<Map<string, SellAddonCatalogRow[]>>(
		new Map(),
	);
	const [sellPaymentMethods, setSellPaymentMethods] = useState<
		SalePaymentEntry[]
	>([]);
	const [sellGenerateWarrantyTerm, setSellGenerateWarrantyTerm] =
		useState(false);
	const [sellBuyerName, setSellBuyerName] = useState("");
	const [sellBuyerCpf, setSellBuyerCpf] = useState("");
	const [sellSaleDetails, setSellSaleDetails] = useState("");
	const [sellTradeInEnabled, setSellTradeInEnabled] = useState(false);
	const [sellTradeInLines, setSellTradeInLines] = useState<SellTradeInLine[]>(
		[],
	);
	const [costModalTarget, setCostModalTarget] = useState<ResaleDevice | null>(
		null,
	);
	const [costDescription, setCostDescription] = useState("");
	const [costValue, setCostValue] = useState("");
	const [isSavingCost, setIsSavingCost] = useState(false);
	const [showPurchaseValue, setShowPurchaseValue] = useState(isAdmin);
	const [showWholesaleValue, setShowWholesaleValue] = useState(true);
	const [simulateModalTarget, setSimulateModalTarget] =
		useState<ResaleDevice | null>(null);
	const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
	const [soldDevices, setSoldDevices] = useState<ResaleDevice[]>([]);
	const [soldCollapsibleOpen, setSoldCollapsibleOpen] = useState(false);
	const [isLoadingSold, setIsLoadingSold] = useState(false);
	const [soldHasMore, setSoldHasMore] = useState(false);
	const [soldTotal, setSoldTotal] = useState<number | null>(null);
	const [stats, setStats] = useState<SeminovosStats | null>(initialStats);
	const [termsDevice, setTermsDevice] = useState<ResaleDevice | null>(null);
	const [showTermsDialog, setShowTermsDialog] = useState(false);
	const [filterNotTested, setFilterNotTested] = useState(false);
	const [filterNotAdvertised, setFilterNotAdvertised] = useState(false);
	const [filterNoLabel, setFilterNoLabel] = useState(false);
	const [filterWithInfo, setFilterWithInfo] = useState(false);

	useEffect(() => {
		setDevices(initialDevices as ResaleDevice[]);
		setStats(initialStats);
	}, [initialDevices, initialStats]);

	useEffect(() => {
		setSellCommissionSnapshot(commissionBoot.initial);
	}, [commissionBoot.seq, commissionBoot.initial]);

	useEffect(() => {
		if (!sellModalTarget) {
			setSellAddonResults([]);
			return;
		}
		const q = sellAddonQuery.trim();
		if (q.length < 2) {
			setSellAddonResults([]);
			setSellAddonBusy(false);
			return;
		}
		const cached = sellAddonSearchCacheRef.current.get(q);
		if (cached) {
			setSellAddonResults(cached);
			setSellAddonBusy(false);
			return;
		}
		let cancelled = false;
		const controller = new AbortController();
		const t = window.setTimeout(() => {
			void (async () => {
				setSellAddonBusy(true);
				try {
					const res = await portalFetch(
						`/api/portal/pdv/catalog?q=${encodeURIComponent(q)}`,
						{ signal: controller.signal },
					);
					const data = await res?.json().catch(() => null);
					if (cancelled) return;
					if (data?.ok && Array.isArray(data.products)) {
						const products = data.products as SellAddonCatalogRow[];
						sellAddonSearchCacheRef.current.set(q, products);
						setSellAddonResults(products);
					} else {
						setSellAddonResults([]);
					}
				} finally {
					if (!cancelled) setSellAddonBusy(false);
				}
			})();
		}, 280);
		return () => {
			cancelled = true;
			controller.abort();
			window.clearTimeout(t);
		};
	}, [sellModalTarget, sellAddonQuery]);

	const hasDeviceSearch = useMemo(
		() => hasActiveDeviceSearch(filterInitialValues),
		[filterInitialValues],
	);

	const loadSoldDevices = useCallback(
		async (opts?: { append?: boolean; offset?: number }) => {
			const append = opts?.append ?? false;
			const offset = opts?.offset ?? 0;
			const paginate = hasDeviceSearch;
			setIsLoadingSold(true);
			try {
				const qs = buildResaleDevicesListQuery(
					filterInitialValues,
					true,
					paginate
						? { limit: SOLD_SEARCH_PAGE_SIZE, offset }
						: undefined,
				);
				const res = await portalFetch(`/api/portal/resale-devices?${qs}`);
				const data = await res?.json().catch(() => null);
				if (data?.ok && Array.isArray(data.devices)) {
					setSoldDevices((prev) =>
						append ? [...prev, ...data.devices] : data.devices,
					);
					setSoldHasMore(Boolean(data.hasMore));
					setSoldTotal(
						typeof data.total === "number" ? data.total : null,
					);
				} else if (!append) {
					setSoldDevices([]);
					setSoldHasMore(false);
					setSoldTotal(null);
				}
			} catch {
				if (!append) {
					setSoldDevices([]);
					setSoldHasMore(false);
					setSoldTotal(null);
				}
			} finally {
				setIsLoadingSold(false);
			}
		},
		[filterInitialValues, hasDeviceSearch],
	);

	const filterInitialKey = useMemo(
		() => JSON.stringify(filterInitialValues),
		[filterInitialValues],
	);

	useEffect(() => {
		setSoldDevices([]);
		setSoldHasMore(false);
		setSoldTotal(null);
	}, [filterInitialKey]);

	useEffect(() => {
		if (!hasDeviceSearch) return;
		setSoldCollapsibleOpen(true);
		void loadSoldDevices({ append: false, offset: 0 });
	}, [hasDeviceSearch, filterInitialKey, loadSoldDevices]);

	function handleLoadMoreSold() {
		if (!soldHasMore || isLoadingSold) return;
		void loadSoldDevices({ append: true, offset: soldDevices.length });
	}

	useEffect(() => {
		if (isBulkEdit) {
			const grouped = groupDevicesByModel(devices);
			setEditedDevices(grouped.flatMap((g) => g.devices));
		}
	}, [devices, isBulkEdit]);

	async function handleDelete() {
		if (!deleteTarget || isDeleting) return;
		setIsDeleting(true);
		try {
			const res = await portalFetch(
				`/api/portal/resale-devices/${deleteTarget.id}`,
				{ method: "DELETE" },
			);
			const data = await res?.json().catch(() => null);
			if (data?.ok) {
				router.refresh();
				setDeleteTarget(null);
			}
		} finally {
			setIsDeleting(false);
		}
	}

	const groupedAvailableAll = groupDevicesByModel(devices);
	const flatAvailableAll = groupedAvailableAll.flatMap((g) => g.devices);

	const seminovosQuickFilterChips = useMemo(() => {
		const r: { id: string; text: string }[] = [];
		if (filterNotTested) r.push({ id: "op-nt", text: "Não testados" });
		if (filterNotAdvertised) r.push({ id: "op-na", text: "Não anunciados" });
		if (filterNoLabel) r.push({ id: "op-nl", text: "Sem etiqueta" });
		if (filterWithInfo) r.push({ id: "op-wi", text: "Com informação" });
		return r;
	}, [
		filterNotTested,
		filterNotAdvertised,
		filterNoLabel,
		filterWithInfo,
	]);

	const filteredDevices = devices.filter((d) => {
		if (filterNotTested && d.tested) return false;
		if (filterNotAdvertised && d.advertised) return false;
		if (filterNoLabel && d.label) return false;
		if (filterWithInfo && !d.info) return false;
		return true;
	});

	const filteredSoldDevices = useMemo(() => {
		return soldDevices.filter((d) => {
			if (filterNotTested && d.tested) return false;
			if (filterNotAdvertised && d.advertised) return false;
			if (filterNoLabel && d.label) return false;
			if (filterWithInfo && !d.info) return false;
			return true;
		});
	}, [
		soldDevices,
		filterNotTested,
		filterNotAdvertised,
		filterNoLabel,
		filterWithInfo,
	]);

	const groupedAvailable = groupDevicesByModel(filteredDevices);
	const flatAvailable = groupedAvailable.flatMap((g) => g.devices);
	const rows = isBulkEdit ? editedDevices : flatAvailable;

	function updateRow<K extends keyof ResaleDevice>(
		id: string,
		field: K,
		value: ResaleDevice[K],
	) {
		setEditedDevices((prev) =>
			prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
		);
	}

	function updateMoney<K extends keyof ResaleDevice>(
		id: string,
		field: K,
		raw: string,
	) {
		const masked = formatMoneyInput(raw);
		const cents = moneyToCentsFromMasked(masked);
		setEditedDevices((prev) =>
			prev.map((d) =>
				d.id === id ? { ...d, [field]: (cents ?? null) as ResaleDevice[K] } : d,
			),
		);
	}

	async function handleStartBulkEdit() {
		setEditedDevices(groupDevicesByModel(devices).flatMap((g) => g.devices));
		setIsBulkEdit(true);
	}

	function handleCancelBulkEdit() {
		setIsBulkEdit(false);
		setEditedDevices(groupDevicesByModel(devices).flatMap((g) => g.devices));
	}

	function getChangedUpdates(): Array<
		{ id: string } & Record<string, unknown>
	> {
		const originalMap = new Map(flatAvailableAll.map((d) => [d.id, d]));
		const updates: Array<{ id: string } & Record<string, unknown>> = [];
		for (const edited of editedDevices) {
			const orig = originalMap.get(edited.id);
			if (!orig) continue;
			const changed: Record<string, unknown> = {};
			const fields: (keyof ResaleDevice)[] = [
				"device_name",
				"color",
				"storage_gb",
				"battery",
				"condition",
				"info",
				"imei",
				"purchase_date",
				"sale_date",
				"wholesale_value_cents",
				"sale_value_cents",
				"sold_for_cents",
			];
			if (isAdmin) fields.push("purchase_value_cents");
			for (const k of fields) {
				const v = edited[k];
				const o = orig[k];
				if (
					v !== o &&
					(v != null || o != null) &&
					String(v ?? "") !== String(o ?? "")
				) {
					changed[k] = v;
				}
			}
			if (edited.stock_type === "lacrado") {
				const hadWear =
					Boolean(String(orig.battery ?? "").trim()) ||
					Boolean(String(orig.condition ?? "").trim());
				const editedWear =
					Boolean(String(edited.battery ?? "").trim()) ||
					Boolean(String(edited.condition ?? "").trim());
				if (hadWear || editedWear) {
					changed.battery = null;
					changed.condition = null;
				}
			}
			if (Object.keys(changed).length > 0) {
				updates.push({ id: edited.id, ...changed });
			}
		}
		return updates;
	}

	async function handleSaveBulkEdit() {
		if (!isBulkEdit || isSavingBulk) return;
		const updates = getChangedUpdates();
		if (updates.length === 0) {
			setIsBulkEdit(false);
			return;
		}
		setIsSavingBulk(true);
		try {
			const res = await portalFetch("/api/portal/resale-devices/bulk", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ updates }),
			});
			const data = await res?.json().catch(() => null);
			if (data?.ok) {
				router.refresh();
				setIsBulkEdit(false);
			} else if (data?.error === "partial_failure" && data?.results) {
				const failed = (data.results as { id: string; ok: boolean }[]).filter(
					(r: { ok: boolean }) => !r.ok,
				);
				if (failed.length > 0) {
					console.error("Erro ao salvar alguns itens:", failed);
				}
				router.refresh();
				setIsBulkEdit(false);
			}
		} finally {
			setIsSavingBulk(false);
		}
	}

	function openSellModal(d: ResaleDevice) {
		const pms =
			Array.isArray(d.sale_payment_methods) && d.sale_payment_methods.length > 0
				? d.sale_payment_methods.map((e) => ({
						rowKey: makeSalePaymentRowKey(),
						payment_method_id: String(e.payment_method_id ?? ""),
						value_cents: e.value_cents != null ? Number(e.value_cents) : null,
						installments:
							e.installments != null ? Math.max(1, Number(e.installments)) : 1,
					}))
				: d.payment_method_id
					? [
							{
								rowKey: makeSalePaymentRowKey(),
								payment_method_id: d.payment_method_id,
								value_cents: null,
								installments: d.payment_installments ?? 1,
							},
						]
					: [newEmptySalePaymentRow()];
		setSellPaymentMethods(pms.length > 0 ? pms : [newEmptySalePaymentRow()]);
		setSellDate(new Date().toISOString().slice(0, 10));
		setSellGenerateWarrantyTerm(false);
		setSellBuyerName("");
		setSellBuyerCpf("");
		setSellSaleDetails("");
		setSellTradeInEnabled(false);
		setSellTradeInLines([]);
		setSellAddonQuery("");
		setSellAddonItems([]);
		setCommissionBoot((b) => ({
			seq: b.seq + 1,
			initial: DEFAULT_SELL_COMMISSION_INITIAL,
		}));
		loadPaymentMethods();
		loadTeamUsers();
		setSellModalTarget(d);
	}

	function openEditSellModal(d: ResaleDevice) {
		const soldCents = d.sold_for_cents ?? null;
		const pms =
			Array.isArray(d.sale_payment_methods) && d.sale_payment_methods.length > 0
				? d.sale_payment_methods.map((e) => ({
						rowKey: makeSalePaymentRowKey(),
						payment_method_id: String(e.payment_method_id ?? ""),
						value_cents: e.value_cents != null ? Number(e.value_cents) : null,
						installments:
							e.installments != null ? Math.max(1, Number(e.installments)) : 1,
					}))
				: d.payment_method_id
					? [
							{
								rowKey: makeSalePaymentRowKey(),
								payment_method_id: d.payment_method_id,
								value_cents: soldCents,
								installments: d.payment_installments ?? 1,
							},
						]
					: [newEmptySalePaymentRow()];
		setSellPaymentMethods(pms.length > 0 ? pms : [newEmptySalePaymentRow()]);
		setSellDate(d.sale_date || new Date().toISOString().slice(0, 10));
		const hasTermData = Boolean(
			(d.buyer_name && d.buyer_name.trim()) ||
			(d.buyer_cpf && d.buyer_cpf.trim()) ||
			(d.sale_details && d.sale_details.trim()),
		);
		setSellGenerateWarrantyTerm(hasTermData);
		setSellBuyerName(d.buyer_name ?? "");
		setSellBuyerCpf(formatCpfCnpj(d.buyer_cpf ?? ""));
		setSellSaleDetails(d.sale_details ?? (hasTermData ? (d.info ?? "") : ""));
		const commLine = (d.costs || []).find((c) =>
			isCommissionCostDescription(c.description),
		);
		const commUserId = d.sale_commission_user_id ?? "";
		const commissionInitial: SellCommissionInitial =
			commLine && commUserId
				? {
						enabled: true,
						userId: commUserId,
						kind: "fixed",
						percentRaw: "",
						fixedMasked: maskedFromCents(commLine.value_cents ?? 0),
					}
				: DEFAULT_SELL_COMMISSION_INITIAL;
		setSellTradeInEnabled(false);
		setSellTradeInLines([]);
		setSellAddonQuery("");
		setSellAddonItems([]);
		setCommissionBoot((b) => ({ seq: b.seq + 1, initial: commissionInitial }));
		loadPaymentMethods();
		loadTeamUsers();
		setSellModalTarget(d);
	}

	function getValidSellTradeInLines(): SellTradeInLine[] {
		if (!sellTradeInEnabled) return [];
		return sellTradeInLines.filter(
			(l) => l.deviceName.trim() && l.valueCents != null && l.valueCents > 0,
		);
	}

	function getSellTradeInTotalCents(): number {
		return getValidSellTradeInLines().reduce(
			(acc, l) => acc + (l.valueCents ?? 0),
			0,
		);
	}

	function setSellPaymentMethodAt(i: number, upd: Partial<SalePaymentEntry>) {
		setSellPaymentMethods((prev) => {
			const next = [...prev];
			next[i] = { ...next[i], ...upd };
			return next;
		});
	}

	function addSellPaymentMethod() {
		setSellPaymentMethods((prev) => [...prev, newEmptySalePaymentRow()]);
	}

	function removeSellPaymentMethod(i: number) {
		setSellPaymentMethods((prev) => prev.filter((_, idx) => idx !== i));
	}

	function getSellPaymentsTotalCents(): number | null {
		const valid = sellPaymentMethods.filter((e) => e.payment_method_id?.trim());
		if (valid.length === 0) return null;
		let sum = 0;
		for (const e of valid) {
			const v = e.value_cents;
			if (v == null || v <= 0) return null;
			sum += v;
		}
		if (sum <= 0) return null;
		return sum;
	}

	function getSellAddonRevenueCents(): number {
		return sellAddonItems.reduce(
			(acc, l) => acc + l.quantity * l.unitSaleCents,
			0,
		);
	}

	function getSellAddonCostTotalCents(): number {
		return sellAddonItems.reduce(
			(acc, l) => acc + l.quantity * l.unitCostCents,
			0,
		);
	}

	function getSellCashNetFromPaymentsCents(): number | null {
		const valid = sellPaymentMethods.filter((e) => e.payment_method_id?.trim());
		if (valid.length === 0) return 0;
		const sum = getSellPaymentsTotalCents();
		if (sum == null) return null;
		const fee = paymentFeeCentsForSaleEntries(valid, paymentMethods);
		return sum - fee;
	}

	function getSellNetFromPaymentsCents(): number | null {
		const cashNet = getSellCashNetFromPaymentsCents();
		if (cashNet === null) return null;
		const tradeIn = getSellTradeInTotalCents();
		const total = cashNet + tradeIn;
		if (total <= 0) return null;
		return total;
	}

	/** Valor bruto do aparelho (total cobrado nas formas de pagamento − extras). */
	function getSellDeviceSaleCents(): number | null {
		const gross = getSellPaymentsTotalCents();
		if (gross === null) return null;
		const device = gross - getSellAddonRevenueCents();
		return device > 0 ? device : null;
	}

	/** Receita bruta da operação: pagamentos + troca (taxas são deduzidas no painel). */
	function getSellTransactionTotalCents(): number | null {
		const gross = getSellPaymentsTotalCents();
		const tradeIn = getSellTradeInTotalCents();
		if (gross === null && tradeIn <= 0) return null;
		const total = (gross ?? 0) + tradeIn;
		if (total <= 0) return null;
		return total;
	}

	function addSellAddonProduct(p: SellAddonCatalogRow) {
		const unitSale = Number(p.sale_price_cents) || 0;
		const unitCost = Number(p.cost_price_cents) || 0;
		setSellAddonItems((prev) => {
			const idx = prev.findIndex((x) => x.productId === p.id);
			if (idx < 0) {
				return [
					...prev,
					{
						productId: p.id,
						name: p.name,
						quantity: 1,
						unitSaleCents: unitSale,
						unitCostCents: unitCost,
					},
				];
			}
			const next = [...prev];
			next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
			return next;
		});
		setSellAddonQuery('');
		setSellAddonResults([]);
	}

	function updateSellAddonQty(productId: string, quantity: number) {
		const q = Math.max(1, Math.round(Number(quantity) || 1));
		setSellAddonItems((prev) =>
			prev.map((x) => (x.productId === productId ? { ...x, quantity: q } : x)),
		);
	}

	function updateSellAddonUnitSaleMasked(productId: string, masked: string) {
		const cents = moneyToCentsFromMasked(formatMoneyInput(masked));
		setSellAddonItems((prev) =>
			prev.map((x) =>
				x.productId === productId
					? {
							...x,
							unitSaleCents: cents === null ? 0 : Math.max(0, cents),
						}
					: x,
			),
		);
	}

	function removeSellAddonLine(productId: string) {
		setSellAddonItems((prev) => prev.filter((x) => x.productId !== productId));
	}

	function openCostModal(d: ResaleDevice) {
		setCostDescription("");
		setCostValue("");
		setCostModalTarget(d);
	}

	const loadPaymentMethods = useCallback(async () => {
		const res = await portalFetch("/api/portal/payment-methods");
		const data = await res?.json().catch(() => null);
		if (data?.ok && Array.isArray(data.paymentMethods)) {
			setPaymentMethods(data.paymentMethods);
		}
	}, []);

	const loadTeamUsers = useCallback(async () => {
		const res = await portalFetch("/api/portal/team-users");
		const data = await res?.json().catch(() => null);
		if (data?.ok && Array.isArray(data.users)) {
			setTeamUsers(data.users as TeamUser[]);
		}
	}, []);

	function openSimulateModal(d: ResaleDevice) {
		setSimulateModalTarget(d);
		loadPaymentMethods();
	}

	function buildWhatsAppTexts() {
		const available = devices.filter((d) => !d.sold);
		return buildConectizeStockWhatsAppTexts(available);
	}

	async function handleConfirmCost() {
		const d = costModalTarget;
		if (!d || isSavingCost) return;
		const valueCents = moneyToCentsFromMasked(costValue);
		if (valueCents === null) return;
		setIsSavingCost(true);
		try {
			const res = await portalFetch(
				`/api/portal/resale-devices/${d.id}/costs`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						description: costDescription.trim() || null,
						value_cents: valueCents,
					}),
				},
			);
			const data = await res?.json().catch(() => null);
			if (data?.ok && data?.cost) {
				const newCost: CostRow = {
					id: data.cost.id,
					description: data.cost.description ?? "",
					value_cents: data.cost.value_cents ?? 0,
				};
				const updateDevice = (dev: ResaleDevice) =>
					dev.id === d.id
						? { ...dev, costs: [...(dev.costs || []), newCost] }
						: dev;
				setDevices((prev) => prev.map(updateDevice));
				setEditedDevices((prev) => prev.map(updateDevice));
				setCostModalTarget(null);
				toast({ description: "Custo adicionado", duration: 2000 });
			}
		} finally {
			setIsSavingCost(false);
		}
	}

	async function handleConfirmSell() {
		const d = sellModalTarget;
		if (!d || isSavingSell) return;

		const validMethods = sellPaymentMethods.filter((e) =>
			e.payment_method_id?.trim(),
		);
		const tradeInLines = getValidSellTradeInLines();
		const tradeInTotal = getSellTradeInTotalCents();

		if (sellTradeInEnabled && tradeInLines.length === 0) {
			toast({
				title: "Aparelho na troca",
				description:
					"Informe ao menos um aparelho com nome e valor para a troca.",
				variant: "destructive",
			});
			return;
		}

		if (validMethods.length > 0) {
			const paymentsSumCheck = getSellPaymentsTotalCents();
			if (paymentsSumCheck === null) {
				toast({
					title: "Valores de pagamento",
					description:
						"Informe o valor (R$) em cada forma de pagamento usada.",
					variant: "destructive",
				});
				return;
			}
		}

		if (validMethods.length === 0 && tradeInTotal <= 0) {
			toast({
				title: "Pagamento",
				description:
					"Informe ao menos uma forma de pagamento ou aparelho(s) na troca.",
				variant: "destructive",
			});
			return;
		}

		const transactionTotal = getSellTransactionTotalCents();
		if (transactionTotal === null || transactionTotal <= 0) {
			toast({
				title: "Valor da venda",
				description:
					"O total da venda (pagamentos + troca) deve ser maior que zero.",
				variant: "destructive",
			});
			return;
		}

		if (sellPaymentMethods.length > 1) {
			const anyEmpty = sellPaymentMethods.some(
				(e) => !e.payment_method_id?.trim(),
			);
			if (anyEmpty) {
				toast({
					title: "Forma de pagamento",
					description: "Selecione a forma de pagamento em todas as linhas.",
					variant: "destructive",
				});
				return;
			}
		}

		const paymentsSum = getSellPaymentsTotalCents() ?? 0;

		const paymentFeeCents = paymentFeeCentsForSaleEntries(
			validMethods,
			paymentMethods,
		);

		const baseCosts = (d.costs || []).map((c) => ({
			description: (c.description ?? "") || null,
			value_cents: c.value_cents ?? 0,
		}));

		const costsWithoutDerived = baseCosts.filter(
			(c) => !isSaleDerivedCostDescription(c.description),
		);
		const addonOpCents = getSellAddonCostTotalCents();
		const addonCostLines =
			sellAddonItems.length > 0
				? sellAddonItems.map((l) => ({
						description: `${l.name} (custo estoque) × ${l.quantity}`,
						value_cents: l.quantity * l.unitCostCents,
					}))
				: [];
		const baseOperationalTotal =
			costsWithoutDerived.reduce(
				(acc, c) => acc + (c.value_cents ?? 0),
				0,
			) + addonOpCents;
		const purchaseCents = d.purchase_value_cents ?? 0;

		const comm = sellCommissionPanelRef.current?.getValues();
		const sellCommissionEnabled = comm?.enabled ?? false;
		const sellCommissionUserId = comm?.userId ?? "";
		const sellCommissionKind = comm?.kind ?? "percent";
		const sellCommissionPercent = comm?.percentRaw ?? "";
		const sellCommissionFixed = comm?.fixedMasked ?? "";

		let costsPayload = [...costsWithoutDerived, ...addonCostLines];
		if (paymentFeeCents > 0) {
			costsPayload.push({
				description: "Taxa forma de pagamento",
				value_cents: paymentFeeCents,
			});
		}

		let commissionUserIdForDb: string | null = null;
		let commissionCents = 0;
		if (sellCommissionEnabled) {
			const uid = sellCommissionUserId.trim();
			if (!uid) {
				toast({
					title: "Comissão",
					description: "Selecione o colaborador.",
					variant: "destructive",
				});
				return;
			}
			const selectedUser = teamUsers.find((u) => u.id === uid);
			if (!selectedUser) {
				toast({
					title: "Comissão",
					description: "Colaborador inválido.",
					variant: "destructive",
				});
				return;
			}
			if (sellCommissionKind === "percent") {
				const p = Number.parseFloat(sellCommissionPercent.replace(",", "."));
				if (!Number.isFinite(p) || p <= 0) {
					toast({
						title: "Comissão",
						description: "Informe um percentual válido.",
						variant: "destructive",
					});
					return;
				}
				const gross = grossProfitBeforeCommissionCents(
					paymentsSum,
					purchaseCents,
					baseOperationalTotal,
					paymentFeeCents,
					tradeInTotal,
				);
				commissionCents = commissionFromPercentOfGrossCents(gross, p);
			} else {
				const fc = moneyToCentsFromMasked(sellCommissionFixed);
				if (fc === null || fc <= 0) {
					toast({
						title: "Comissão",
						description: "Informe um valor fixo válido.",
						variant: "destructive",
					});
					return;
				}
				commissionCents = fc;
			}
			if (commissionCents <= 0) {
				toast({
					title: "Comissão",
					description:
						sellCommissionKind === "percent"
							? "Com percentual sobre o lucro bruto, o lucro precisa ser positivo e o percentual deve gerar comissão maior que zero."
							: "O valor da comissão deve ser maior que zero.",
					variant: "destructive",
				});
				return;
			}
			commissionUserIdForDb = uid;
			const label =
				(selectedUser.full_name || "").trim() ||
				selectedUser.email ||
				"Colaborador";
			costsPayload = [
				...costsPayload,
				{
					description: buildCommissionCostDescription(label),
					value_cents: commissionCents,
				},
			];
		}

		const salePaymentMethodsPayload = validMethods.map((e) => ({
			payment_method_id: e.payment_method_id,
			value_cents: e.value_cents ?? 0,
			installments: e.installments ?? 1,
		}));

		const payload: Record<string, unknown> = {
			sold: true,
			sold_for_cents: transactionTotal,
			sale_date: sellDate || null,
			sale_payment_methods: salePaymentMethodsPayload,
			sale_commission_user_id: sellCommissionEnabled
				? commissionUserIdForDb
				: null,
			buyer_name: sellGenerateWarrantyTerm
				? sellBuyerName.trim() || null
				: null,
			buyer_cpf: sellGenerateWarrantyTerm ? sellBuyerCpf.trim() || null : null,
			sale_details: sellGenerateWarrantyTerm
				? sellSaleDetails.trim() || null
				: null,
			costs: costsPayload,
			...(sellAddonItems.length > 0
				? {
						addon_inventory_lines: sellAddonItems.map((l) => ({
							product_id: l.productId,
							quantity: l.quantity,
						})),
					}
				: {}),
			...(tradeInLines.length > 0
				? {
						trade_in_devices: tradeInLines.map((l) => ({
							device_name: l.deviceName.trim(),
							imei: l.imei.trim() || null,
							info: l.info.trim() || null,
							condition: l.condition.trim() || null,
							value_cents: l.valueCents,
						})),
					}
				: {}),
		};

		setIsSavingSell(true);
		try {
			const res = await portalFetch(`/api/portal/resale-devices/${d.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res?.json().catch(() => null);
			if (data?.ok) {
				const updated = data.device as ResaleDevice;
				setSellModalTarget(null);
				if (sellGenerateWarrantyTerm) {
					setTermsDevice(updated);
					setShowTermsDialog(true);
				}
				router.refresh();
				if (soldCollapsibleOpen) loadSoldDevices();
				toast({ description: "Aparelho marcado como vendido", duration: 2000 });
			} else if (data?.error === "stock_unavailable") {
				toast({
					title: "Estoque insuficiente",
					description:
						"Um dos produtos extras não tem quantidade suficiente em estoque para esta venda.",
					variant: "destructive",
				});
			} else if (data?.error === "trade_in_table_missing") {
				toast({
					title: "Banco de dados",
					description:
						"A tabela de troca na venda ainda não existe no Supabase. Execute a migration 20260519120000_resale_device_trade_ins (SQL em supabase/scripts/apply-resale-device-trade-ins.sql).",
					variant: "destructive",
				});
			} else if (data?.error === "trade_in_failed") {
				toast({
					title: "Troca",
					description:
						data?.detail
							? `Não foi possível cadastrar os aparelhos em troca: ${data.detail}`
							: "Não foi possível cadastrar os aparelhos recebidos em troca. A venda foi revertida.",
					variant: "destructive",
				});
			}
		} finally {
			setIsSavingSell(false);
		}
	}

	async function handleCancelSell(d: ResaleDevice) {
		if (isSavingSell) return;
		if (
			!confirm(
				"Cancelar a venda deste aparelho? O valor e a data de venda serão removidos.",
			)
		)
			return;
		setIsSavingSell(true);
		try {
			const res = await portalFetch(`/api/portal/resale-devices/${d.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sold: false,
					sold_for_cents: null,
					sale_date: null,
					payment_method_id: null,
					payment_installments: null,
					sale_payment_methods: [],
					buyer_name: null,
					buyer_cpf: null,
					sale_details: null,
				}),
			});
			const data = await res?.json().catch(() => null);
			if (data?.ok) {
				router.refresh();
				if (soldCollapsibleOpen) loadSoldDevices();
				toast({ description: "Venda cancelada", duration: 2000 });
			}
		} finally {
			setIsSavingSell(false);
		}
	}

	async function handleCopyDeviceLojista(d: ResaleDevice) {
		const text = buildCopyLojistaText(d);
		if (!text) return;
		await copyTextWithPortalToast(text);
	}

	async function handleCopyDeviceCliente(d: ResaleDevice) {
		const text = buildCopyClienteText(d);
		if (!text) return;
		await copyTextWithPortalToast(text);
	}

	function handlePrintLabel(d: ResaleDevice) {
		printResaleDeviceLabel(d);
	}

	return (
		<>
			<div className="space-y-4">
				{isBulkEdit ? (
					<div className="flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={handleCancelBulkEdit}
							disabled={isSavingBulk}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleSaveBulkEdit}
							disabled={isSavingBulk}
						>
							{isSavingBulk ? "Salvando…" : "Salvar alterações"}
						</Button>
					</div>
				) : null}

				<SeminovosFilterCollapsible
					key={[
						filterInitialValues.q,
						filterInitialValues.condition,
						filterInitialValues.storageGb,
						filterInitialValues.color,
						filterInitialValues.purchaseDateFrom,
						filterInitialValues.purchaseDateTo,
						filterInitialValues.stockType,
						filterInitialValues.deviceName || '',
					].join('|')}
					initialValues={filterInitialValues}
					filterFormAction={
						filterInitialValues.stockType === 'lacrado'
							? revendaPath.novos
							: revendaPath.seminovos
					}
					distinctDeviceNames={distinctDeviceNames}
					quickFilters={{
						notTested: filterNotTested,
						notAdvertised: filterNotAdvertised,
						noLabel: filterNoLabel,
						withInfo: filterWithInfo,
						onToggleNotTested: () => setFilterNotTested((v) => !v),
						onToggleNotAdvertised: () => setFilterNotAdvertised((v) => !v),
						onToggleNoLabel: () => setFilterNoLabel((v) => !v),
						onToggleWithInfo: () => setFilterWithInfo((v) => !v),
					}}
					extraAppliedChips={seminovosQuickFilterChips}
					onClearClientFilters={() => {
						setFilterNotTested(false);
						setFilterNotAdvertised(false);
						setFilterNoLabel(false);
						setFilterWithInfo(false);
					}}
				/>

				{isAdmin ? (
					<ResumoFinanceiro
						devices={devices}
						stats={stats}
						showValues
						variant="overview-only"
					/>
				) : null}

				<Card>
					<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3 sm:pb-4">
						<CardTitle className="text-lg sm:text-xl">
							Lista de aparelhos
						</CardTitle>
						{!isBulkEdit ? (
							<div className="flex flex-wrap items-center justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={handleStartBulkEdit}
								>
									Edição em massa
								</Button>
								<WhatsAppTextModalButton
									buildTexts={buildWhatsAppTexts}
									className="shrink-0 touch-manipulation"
								/>
								<Button variant="default" size="icon" className="shrink-0 touch-manipulation" asChild>
									<Link href={novaDeviceHref} aria-label="Cadastrar aparelho">
										<Plus className="h-4 w-4" aria-hidden />
									</Link>
								</Button>
							</div>
						) : null}
					</CardHeader>
					<CardContent className="px-3 sm:px-6">
						{isLoading ? (
							<p className="text-sm text-muted-foreground">Carregando…</p>
						) : (
							<>
								{groupedAvailable.length === 0 ? (
									<p className="text-sm text-muted-foreground mb-4">
										Nenhum aparelho disponível.{" "}
										<Link
											href={novaDeviceHref}
											className="text-primary underline"
										>
											Cadastrar aparelho
										</Link>
									</p>
								) : (
									<>
										{!isBulkEdit && (
											<div className="space-y-5">
												{groupedAvailable.map((g) => (
													<div key={g.modelKey}>
														<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
															{g.modelKey}
														</p>
														<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6">
															{g.devices.map((d) => (
																<SeminovoDeviceCard
																	key={d.id}
																	device={d}
																	variant="available"
																	canViewPurchaseValue={isAdmin}
																	showPurchaseValue={isAdmin && showPurchaseValue}
																	showWholesaleValue={showWholesaleValue}
																	renderMenu={(device) => (
																		<>
																			{!device.sold ? (
																				<DropdownMenuItem
																					onClick={() =>
																						openSellModal(
																							device as ResaleDevice,
																						)
																					}
																				>
																					<DollarSign className="h-3.5 w-3.5 mr-1.5" />
																					Vendido
																				</DropdownMenuItem>
																			) : (
																				<DropdownMenuItem
																					onClick={() =>
																						handleCancelSell(
																							device as ResaleDevice,
																						)
																					}
																					disabled={isSavingSell}
																				>
																					<Undo2 className="h-3.5 w-3.5 mr-1.5" />
																					Cancelar venda
																				</DropdownMenuItem>
																			)}
																			<DropdownMenuItem
																				onClick={() =>
																					openCostModal(device as ResaleDevice)
																				}
																			>
																				<Receipt className="h-3.5 w-3.5 mr-1.5" />
																				Adicionar custo
																			</DropdownMenuItem>
																			<ResaleDeviceStandardActionItems
																				device={device}
																				onSimulate={() =>
																					openSimulateModal(
																						device as ResaleDevice,
																					)
																				}
																				onPrintLabel={() =>
																					handlePrintLabel(
																						device as ResaleDevice,
																					)
																				}
																				onCopyLojista={() =>
																					void handleCopyDeviceLojista(
																						device as ResaleDevice,
																					)
																				}
																				onCopyCliente={() =>
																					void handleCopyDeviceCliente(
																						device as ResaleDevice,
																					)
																				}
																				onCopyImei={() =>
																					void copyImeiWithPortalToast(
																						device.imei,
																					)
																				}
																			/>
																			<DropdownMenuItem
																				className="text-destructive focus:text-destructive"
																				onClick={() =>
																					setDeleteTarget(
																						device as ResaleDevice,
																					)
																				}
																			>
																				<Trash2 className="h-3.5 w-3.5 mr-1.5" />
																				Excluir
																			</DropdownMenuItem>
																		</>
																	)}
																/>
															))}
														</div>
													</div>
												))}
											</div>
										)}
										{isBulkEdit && (
											<div className="overflow-x-auto">
												<Table>
													<colgroup>
														<col className="w-[22%]" />
														<col className="w-[11%]" />
														<col className="w-[14%]" />
														{isAdmin ? <col className="w-[9%]" /> : null}
														<col className="w-[8%]" />
														<col className="w-[12%]" />
														<col className="w-[10%]" />
														<col className="w-[4%]" />
													</colgroup>
													<TableHeader>
														<TableRow>
															<TableHead>Aparelho</TableHead>
															<TableHead>IMEI</TableHead>
															<TableHead>Informações</TableHead>
															{isAdmin ? (
																<TableHead>
																	<span className="inline-flex items-center gap-1.5">
																		Valor compra
																		<Button
																			type="button"
																			variant="ghost"
																			size="icon"
																			className="h-7 w-7"
																			onClick={(e) => {
																				e.stopPropagation();
																				setShowPurchaseValue((v) => !v);
																			}}
																			title={
																				showPurchaseValue
																					? "Ocultar valor de compra"
																					: "Exibir valor de compra"
																			}
																			aria-label={
																				showPurchaseValue
																					? "Ocultar valor de compra"
																					: "Exibir valor de compra"
																			}
																		>
																			{showPurchaseValue ? (
																				<EyeOff className="h-3.5 w-3.5" />
																			) : (
																				<Eye className="h-3.5 w-3.5" />
																			)}
																		</Button>
																	</span>
																</TableHead>
															) : null}
															<TableHead>Custos</TableHead>
															<TableHead>
																<span className="inline-flex items-center gap-1.5">
																	Valores
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7"
																		onClick={(e) => {
																			e.stopPropagation();
																			setShowWholesaleValue((v) => !v);
																		}}
																		title={
																			showWholesaleValue
																				? "Ocultar valor de atacado"
																				: "Exibir valor de atacado"
																		}
																		aria-label={
																			showWholesaleValue
																				? "Ocultar valor de atacado"
																				: "Exibir valor de atacado"
																		}
																	>
																		{showWholesaleValue ? (
																			<EyeOff className="h-3.5 w-3.5" />
																		) : (
																			<Eye className="h-3.5 w-3.5" />
																		)}
																	</Button>
																</span>
															</TableHead>
															<TableHead>Data</TableHead>
															<TableHead className="text-right">
																Ações
															</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{(!isBulkEdit
															? groupedAvailable.flatMap((g) => [
																	{
																		type: "group" as const,
																		key: `group-${g.modelKey}`,
																		modelKey: g.modelKey,
																	},
																	...g.devices.map((d) => ({
																		type: "device" as const,
																		key: d.id,
																		d,
																	})),
																])
															: rows.map((d) => ({
																	type: "device" as const,
																	key: d.id,
																	d,
																}))
														).map((item) =>
															item.type === "group" ? (
																<TableRow
																	key={item.key}
																	className="bg-muted/40 hover:bg-muted/40"
																>
																	<TableCell
																		colSpan={isAdmin ? 8 : 7}
																		className="font-semibold py-2 text-sm"
																	>
																		{item.modelKey}
																	</TableCell>
																</TableRow>
															) : (
																(() => {
																	const d = item.d;
																	const totalCostsCents = (
																		d.costs || []
																	).reduce(
																		(acc, c) => acc + (c.value_cents ?? 0),
																		0,
																	);
																	const isNovoRow = d.stock_type === "lacrado";
																	const aparelhoTitle = [
																		d.device_name,
																		d.storage_gb,
																		d.color,
																		...(isNovoRow ? [] : [d.battery, d.condition]),
																	]
																		.filter(Boolean)
																		.join(" | ");
																	return (
																		<TableRow
																			key={d.id}
																			className={`${!isBulkEdit ? "cursor-pointer" : ""} ${d.sold ? "bg-muted/60" : ""}`}
																		>
																			{!isBulkEdit ? (
																				<TableCell
																					colSpan={isAdmin ? 7 : 6}
																					className="relative p-0 align-middle"
																				>
																					<Link
																						href={revendaPath.device(d.id)}
																						className="absolute inset-0 z-0"
																						aria-label={`Abrir aparelho ${aparelhoTitle || d.device_name || d.id}`}
																					/>
																					<div
																						className="relative z-10 grid items-center py-2 px-4 pointer-events-none [&_button]:pointer-events-auto min-w-0"
																						style={{
																							gridTemplateColumns:
																								isAdmin
																									? "22fr 11fr 14fr 9fr 8fr 12fr 10fr"
																									: "22fr 11fr 14fr 8fr 12fr 10fr",
																						}}
																					>
																						<DeviceBadges
																							deviceName={d.device_name}
																							storageGb={d.storage_gb}
																							color={d.color}
																							battery={d.battery}
																							condition={d.condition}
																							omitBatteryCondition={isNovoRow}
																						/>
																						<span>
																							{d.imei ? (
																								<button
																									type="button"
																									onClick={(e) => {
																										e.stopPropagation();
																										e.preventDefault();
																										navigator?.clipboard
																											?.writeText(d.imei || "")
																											.then(() => {
																												toast({
																													description:
																														"Copiado para a área de transferência",
																													duration: 2000,
																												});
																											})
																											.catch(() => {});
																									}}
																									className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted/70 hover:bg-muted border border-border/60 cursor-pointer transition-colors"
																									title="Clique para copiar"
																								>
																									<span className="truncate max-w-[115px]">
																										{d.imei}
																									</span>
																									<Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
																								</button>
																							) : (
																								"-"
																							)}
																						</span>
																						<span
																							className="max-w-[220px] truncate min-w-0"
																							title={d.info || ""}
																						>
																							{d.info || "-"}
																						</span>
																						{isAdmin ? (
																							<span className="min-w-0">
																								{showPurchaseValue ? (
																									d.purchase_value_cents !=
																									null ? (
																										`R$ ${centsToReais(d.purchase_value_cents)}`
																									) : (
																										"-"
																									)
																								) : (
																									<Skeleton className="h-4 w-16" />
																								)}
																							</span>
																						) : null}
																						<span className="min-w-0">
																							{totalCostsCents > 0
																								? `R$ ${centsToReais(totalCostsCents)}`
																								: "-"}
																						</span>
																						<span className="whitespace-nowrap min-w-0">
																							{d.sold ? (
																								<span className="block text-xs leading-tight">
																									{d.sold_for_cents != null
																										? `R$ ${centsToReais(d.sold_for_cents)}`
																										: "-"}
																								</span>
																							) : (
																								<>
																									<span className="block text-xs leading-tight">
																										{d.sale_value_cents != null
																											? `R$ ${centsToReais(d.sale_value_cents)}`
																											: "-"}
																									</span>
																									{showWholesaleValue && (
																										<span className="block text-xs leading-tight text-muted-foreground">
																											{d.wholesale_value_cents !=
																											null
																												? `R$ ${centsToReais(d.wholesale_value_cents)}`
																												: "-"}
																										</span>
																									)}
																								</>
																							)}
																						</span>
																						<span className="whitespace-nowrap min-w-0">
																							{d.sale_date ? (
																								<>
																									<span className="block text-xs leading-tight">
																										{d.purchase_date
																											? formatDateBr(
																													d.purchase_date,
																												)
																											: "-"}
																									</span>
																									<span className="block text-xs leading-tight text-muted-foreground">
																										{formatDateBr(d.sale_date)}
																									</span>
																								</>
																							) : (
																								<span className="block text-xs leading-tight">
																									{d.purchase_date
																										? formatDateBr(
																												d.purchase_date,
																											)
																										: "-"}
																								</span>
																							)}
																						</span>
																					</div>
																				</TableCell>
																			) : (
																				<>
																					<TableCell
																						className="font-medium"
																						title={
																							aparelhoTitle ||
																							d.device_name ||
																							""
																						}
																					>
																						{isBulkEdit ? (
																							<div className="space-y-1">
																								<div className="flex items-center gap-1">
																									<Input
																										value={d.device_name || ""}
																										onChange={(e) =>
																											updateRow(
																												d.id,
																												"device_name",
																												e.target.value,
																											)
																										}
																										placeholder="Nome"
																										className="h-8 text-sm"
																									/>
																									<span className="text-muted-foreground shrink-0">
																										-
																									</span>
																									<Input
																										value={d.storage_gb || ""}
																										onChange={(e) =>
																											updateRow(
																												d.id,
																												"storage_gb",
																												e.target.value || "",
																											)
																										}
																										placeholder="GB"
																										className="h-8 w-14 text-sm"
																									/>
																								</div>
																								<div className="flex items-center gap-1">
																									<Input
																										value={d.color || ""}
																										onChange={(e) =>
																											updateRow(
																												d.id,
																												"color",
																												e.target.value || "",
																											)
																										}
																										placeholder="Cor"
																										className="h-8 text-xs"
																									/>
																									{d.stock_type !== "lacrado" ? (
																										<>
																											<span className="text-muted-foreground shrink-0">
																												-
																											</span>
																											<Input
																												inputMode="numeric"
																												value={d.battery || ""}
																												onChange={(e) => {
																													const digits =
																														e.target.value.replace(
																															/\D/g,
																															"",
																														);
																													if (!digits) {
																														updateRow(
																															d.id,
																															"battery",
																															"",
																														);
																														return;
																													}
																													let n = Number.parseInt(
																														digits,
																														10,
																													);
																													if (Number.isNaN(n)) {
																														updateRow(
																															d.id,
																															"battery",
																															"",
																														);
																														return;
																													}
																													if (n > 100) n = 100;
																													updateRow(
																														d.id,
																														"battery",
																														`${n}%`,
																													);
																												}}
																												placeholder="Bateria"
																												className="h-8 w-16 text-xs"
																											/>
																											<span className="text-muted-foreground shrink-0">
																												-
																											</span>
																											<select
																												className="h-8 rounded-md border border-input bg-background px-2 text-xs w-16"
																												value={d.condition || ""}
																												onChange={(e) =>
																													updateRow(
																														d.id,
																														"condition",
																														e.target.value || "",
																													)
																												}
																											>
																												<option value="">
																													Estado
																												</option>
																												<option value="A+">
																													A+
																												</option>
																												<option value="A">A</option>
																												<option value="A-">
																													A-
																												</option>
																												<option value="B+">
																													B+
																												</option>
																												<option value="B">B</option>
																												<option value="B-">
																													B-
																												</option>
																											</select>
																										</>
																									) : null}
																								</div>
																							</div>
																						) : (
																							<DeviceBadges
																								deviceName={d.device_name}
																								storageGb={d.storage_gb}
																								color={d.color}
																								battery={d.battery}
																								condition={d.condition}
																								omitBatteryCondition={isNovoRow}
																							/>
																						)}
																					</TableCell>
																					<TableCell>
																						{isBulkEdit ? (
																							<Input
																								value={d.imei || ""}
																								onChange={(e) =>
																									updateRow(
																										d.id,
																										"imei",
																										e.target.value,
																									)
																								}
																								placeholder="IMEI"
																							/>
																						) : d.imei ? (
																							<button
																								type="button"
																								onClick={(e) => {
																									e.stopPropagation();
																									navigator?.clipboard
																										?.writeText(d.imei || "")
																										.then(() => {
																											toast({
																												description:
																													"Copiado para a área de transferência",
																												duration: 2000,
																											});
																										})
																										.catch(() => {});
																								}}
																								className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted/70 hover:bg-muted border border-border/60 cursor-pointer transition-colors"
																								title="Clique para copiar"
																							>
																								<span className="truncate max-w-[115px]">
																									{d.imei}
																								</span>
																								<Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
																							</button>
																						) : (
																							"-"
																						)}
																					</TableCell>
																					<TableCell
																						className="max-w-[220px] truncate"
																						title={d.info || ""}
																					>
																						{isBulkEdit ? (
																							<Input
																								value={d.info || ""}
																								onChange={(e) =>
																									updateRow(
																										d.id,
																										"info",
																										e.target.value,
																									)
																								}
																								placeholder="Informações"
																							/>
																						) : (
																							d.info || "-"
																						)}
																					</TableCell>
																					{isAdmin ? (
																						<TableCell>
																							{showPurchaseValue ? (
																								isBulkEdit ? (
																									<Input
																										value={
																											d.purchase_value_cents !=
																											null
																												? centsToReais(
																														d.purchase_value_cents,
																													)
																												: ""
																										}
																										onChange={(e) =>
																											updateMoney(
																												d.id,
																												"purchase_value_cents",
																												e.target.value,
																											)
																										}
																										placeholder="0,00"
																									/>
																								) : d.purchase_value_cents !=
																								  null ? (
																									`R$ ${centsToReais(d.purchase_value_cents)}`
																								) : (
																									"-"
																								)
																							) : (
																								<Skeleton className="h-8 w-20" />
																							)}
																						</TableCell>
																					) : null}
																					<TableCell>
																						{totalCostsCents > 0
																							? `R$ ${centsToReais(totalCostsCents)}`
																							: "-"}
																					</TableCell>
																					<TableCell className="whitespace-nowrap">
																						{isBulkEdit ? (
																							<div className="flex flex-col gap-1">
																								{d.sold ? (
																									<Input
																										value={
																											d.sold_for_cents != null
																												? centsToReais(
																														d.sold_for_cents,
																													)
																												: ""
																										}
																										onChange={(e) =>
																											updateMoney(
																												d.id,
																												"sold_for_cents",
																												e.target.value,
																											)
																										}
																										placeholder="Valor da venda"
																										className="h-8 text-xs"
																									/>
																								) : (
																									<>
																										<Input
																											value={
																												d.sale_value_cents !=
																												null
																													? centsToReais(
																															d.sale_value_cents,
																														)
																													: ""
																											}
																											onChange={(e) =>
																												updateMoney(
																													d.id,
																													"sale_value_cents",
																													e.target.value,
																												)
																											}
																											placeholder="Varejo"
																											className="h-8 text-xs"
																										/>
																										{showWholesaleValue && (
																											<Input
																												value={
																													d.wholesale_value_cents !=
																													null
																														? centsToReais(
																																d.wholesale_value_cents,
																															)
																														: ""
																												}
																												onChange={(e) =>
																													updateMoney(
																														d.id,
																														"wholesale_value_cents",
																														e.target.value,
																													)
																												}
																												placeholder="Atacado"
																												className="h-8 text-xs"
																											/>
																										)}
																									</>
																								)}
																							</div>
																						) : (
																							<div className="flex flex-col text-xs leading-tight">
																								{d.sold ? (
																									<span>
																										{d.sold_for_cents != null
																											? `R$ ${centsToReais(d.sold_for_cents)}`
																											: "-"}
																									</span>
																								) : (
																									<>
																										<span>
																											{d.sale_value_cents !=
																											null
																												? `R$ ${centsToReais(d.sale_value_cents)}`
																												: "-"}
																										</span>
																										{showWholesaleValue && (
																											<span className="text-muted-foreground">
																												{d.wholesale_value_cents !=
																												null
																													? `R$ ${centsToReais(d.wholesale_value_cents)}`
																													: "-"}
																											</span>
																										)}
																									</>
																								)}
																							</div>
																						)}
																					</TableCell>
																					<TableCell className="whitespace-nowrap">
																						{isBulkEdit ? (
																							<div className="flex flex-col gap-1">
																								<Input
																									type="date"
																									value={d.purchase_date || ""}
																									onChange={(e) =>
																										updateRow(
																											d.id,
																											"purchase_date",
																											e.target.value,
																										)
																									}
																									className="h-8 text-xs"
																								/>
																								<Input
																									type="date"
																									value={d.sale_date || ""}
																									onChange={(e) =>
																										updateRow(
																											d.id,
																											"sale_date",
																											e.target.value,
																										)
																									}
																									className="h-8 text-xs"
																								/>
																							</div>
																						) : (
																							<div className="flex flex-col text-xs leading-tight">
																								{d.sale_date ? (
																									<>
																										<span>
																											{d.purchase_date
																												? formatDateBr(
																														d.purchase_date,
																													)
																												: "-"}
																										</span>
																										<span className="text-muted-foreground">
																											{formatDateBr(
																												d.sale_date,
																											)}
																										</span>
																									</>
																								) : (
																									<span>
																										{d.purchase_date
																											? formatDateBr(
																													d.purchase_date,
																												)
																											: "-"}
																									</span>
																								)}
																							</div>
																						)}
																					</TableCell>
																				</>
																			)}
																			<TableCell
																				className="text-right relative z-10"
																				onClick={(e) => e.stopPropagation()}
																			>
																				<DropdownMenu>
																					<DropdownMenuTrigger asChild>
																						<Button
																							variant="ghost"
																							size="icon"
																							className="h-8 w-8"
																							aria-label="Ações"
																						>
																							<MoreHorizontal className="h-4 w-4" />
																						</Button>
																					</DropdownMenuTrigger>
																					<DropdownMenuContent align="end">
																						{!d.sold ? (
																							<DropdownMenuItem
																								onClick={() => openSellModal(d)}
																							>
																								<DollarSign className="h-3.5 w-3.5 mr-1.5" />
																								Vendido
																							</DropdownMenuItem>
																						) : (
																							<>
																								<DropdownMenuItem
																									onClick={() =>
																										openEditSellModal(d)
																									}
																									disabled={isSavingSell}
																								>
																									<DollarSign className="h-3.5 w-3.5 mr-1.5" />
																									Editar venda
																								</DropdownMenuItem>
																								<DropdownMenuItem
																									onClick={() =>
																										handleCancelSell(d)
																									}
																									disabled={isSavingSell}
																								>
																									<Undo2 className="h-3.5 w-3.5 mr-1.5" />
																									Cancelar venda
																								</DropdownMenuItem>
																							</>
																						)}
																						{d.sold &&
																							((d.buyer_name &&
																								d.buyer_name.trim()) ||
																								(d.buyer_cpf &&
																									d.buyer_cpf.trim()) ||
																								(d.sale_details &&
																									d.sale_details.trim())) && (
																								<DropdownMenuItem
																									onClick={() => {
																										setTermsDevice(d);
																										setShowTermsDialog(true);
																									}}
																								>
																									<FileInput className="h-3.5 w-3.5 mr-1.5" />
																									Ver termos de compra
																								</DropdownMenuItem>
																							)}
																						<DropdownMenuItem
																							onClick={() => openCostModal(d)}
																						>
																							<Receipt className="h-3.5 w-3.5 mr-1.5" />
																							Adicionar custo
																						</DropdownMenuItem>
																						<ResaleDeviceStandardActionItems
																							device={d}
																							onSimulate={() =>
																								openSimulateModal(d)
																							}
																							onPrintLabel={() =>
																								handlePrintLabel(d)
																							}
																							onCopyLojista={() =>
																								void handleCopyDeviceLojista(d)
																							}
																							onCopyCliente={() =>
																								void handleCopyDeviceCliente(d)
																							}
																							onCopyImei={() =>
																								void copyImeiWithPortalToast(
																									d.imei,
																								)
																							}
																						/>
																						<DropdownMenuItem
																							className="text-destructive focus:text-destructive"
																							onClick={() => setDeleteTarget(d)}
																						>
																							<Trash2 className="h-3.5 w-3.5 mr-1.5" />
																							Excluir
																						</DropdownMenuItem>
																					</DropdownMenuContent>
																				</DropdownMenu>
																			</TableCell>
																		</TableRow>
																	);
																})()
															),
														)}
													</TableBody>
												</Table>
											</div>
										)}
									</>
								)}
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<Collapsible
						open={soldCollapsibleOpen}
						onOpenChange={(open) => {
							setSoldCollapsibleOpen(open);
							if (
								open &&
								!hasDeviceSearch &&
								soldDevices.length === 0 &&
								!isLoadingSold
							) {
								void loadSoldDevices({ append: false, offset: 0 });
							}
						}}
					>
						<CardHeader className="pb-3 sm:pb-6">
							<CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left py-2 min-h-[3rem] touch-manipulation">
								<div className="min-w-0">
									<CardTitle className="text-base sm:text-lg">
										{hasDeviceSearch
											? "Vendidos na busca"
											: "Aparelhos vendidos"}
									</CardTitle>
									<CardDescription className="text-xs sm:text-sm">
										{hasDeviceSearch
											? soldTotal != null
												? `${soldTotal} aparelho${soldTotal === 1 ? "" : "s"} vendido${soldTotal === 1 ? "" : "s"} encontrado${soldTotal === 1 ? "" : "s"} com os filtros atuais.`
												: "Resultados vendidos que correspondem à busca."
											: "Clique para expandir e carregar a lista."}
									</CardDescription>
								</div>
								<span className="flex items-center gap-2 shrink-0">
									{isLoadingSold ? (
										<span className="text-muted-foreground">Carregando…</span>
									) : soldCollapsibleOpen ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
								</span>
							</CollapsibleTrigger>
						</CardHeader>
						<CollapsibleContent asChild>
							<CardContent className="px-3 sm:px-6 pt-0">
								{soldCollapsibleOpen && (
									<>
										{isLoadingSold ? (
											<p className="text-sm text-muted-foreground py-4">
												Carregando vendidos…
											</p>
										) : soldDevices.length === 0 ? (
											<p className="text-sm text-muted-foreground py-4">
												Nenhum aparelho vendido com os filtros atuais.
											</p>
										) : filteredSoldDevices.length === 0 ? (
											<p className="text-sm text-muted-foreground py-4">
												Nenhum resultado com os filtros rápidos ativos.
											</p>
										) : (
											<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
												{sortSoldDevices(filteredSoldDevices).map((d) => (
													<SeminovoDeviceCard
														key={d.id}
														device={d}
														variant="sold"
														canViewPurchaseValue={isAdmin}
														showPurchaseValue={isAdmin && showPurchaseValue}
														showWholesaleValue={showWholesaleValue}
														renderMenu={(device) => (
															<>
																<DropdownMenuItem
																	onClick={() =>
																		openEditSellModal(device as ResaleDevice)
																	}
																	disabled={isSavingSell}
																>
																	<DollarSign className="h-3.5 w-3.5 mr-1.5" />
																	Editar venda
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() =>
																		handleCancelSell(device as ResaleDevice)
																	}
																	disabled={isSavingSell}
																>
																	<Undo2 className="h-3.5 w-3.5 mr-1.5" />
																	Cancelar venda
																</DropdownMenuItem>
																{((device.buyer_name &&
																	device.buyer_name.trim()) ||
																	(device.buyer_cpf &&
																		device.buyer_cpf.trim()) ||
																	(device.sale_details &&
																		device.sale_details.trim())) && (
																	<DropdownMenuItem
																		onClick={() => {
																			setTermsDevice(device as ResaleDevice);
																			setShowTermsDialog(true);
																		}}
																	>
																		<FileInput className="h-3.5 w-3.5 mr-1.5" />
																		Ver termos de compra
																	</DropdownMenuItem>
																)}
																<DropdownMenuItem
																	onClick={() =>
																		openCostModal(device as ResaleDevice)
																	}
																>
																	<Receipt className="h-3.5 w-3.5 mr-1.5" />
																	Adicionar custo
																</DropdownMenuItem>
																<ResaleDeviceStandardActionItems
																	device={device}
																	includeSimulate={false}
																	onPrintLabel={() =>
																		handlePrintLabel(device as ResaleDevice)
																	}
																	onCopyLojista={() =>
																		void handleCopyDeviceLojista(
																			device as ResaleDevice,
																		)
																	}
																	onCopyCliente={() =>
																		void handleCopyDeviceCliente(
																			device as ResaleDevice,
																		)
																	}
																	onCopyImei={() =>
																		void copyImeiWithPortalToast(device.imei)
																	}
																/>
																<DropdownMenuItem
																	className="text-destructive focus:text-destructive"
																	onClick={() =>
																		setDeleteTarget(device as ResaleDevice)
																	}
																>
																	<Trash2 className="h-3.5 w-3.5 mr-1.5" />
																	Excluir
																</DropdownMenuItem>
															</>
														)}
													/>
												))}
											</div>
										)}
										{hasDeviceSearch && soldHasMore ? (
											<div className="flex justify-center pt-2">
												<Button
													type="button"
													variant="outline"
													onClick={handleLoadMoreSold}
													disabled={isLoadingSold}
												>
													{isLoadingSold
														? "Carregando…"
														: "Carregar mais vendidos"}
												</Button>
											</div>
										) : null}
									</>
								)}
							</CardContent>
						</CollapsibleContent>
					</Collapsible>
				</Card>
			</div>

			<ResaleSimulatePaymentDialog
				device={
					simulateModalTarget
						? {
								sale_value_cents: simulateModalTarget.sale_value_cents,
								wholesale_value_cents:
									simulateModalTarget.wholesale_value_cents,
							}
						: null
				}
				paymentMethods={paymentMethods}
				onClose={() => setSimulateModalTarget(null)}
			/>
			<ResaleDeviceTermsDialog
				open={showTermsDialog}
				onOpenChange={setShowTermsDialog}
				device={
					termsDevice
						? {
								id: termsDevice.id,
								device_name: termsDevice.device_name,
								model: termsDevice.model,
								color: termsDevice.color,
								storage_gb: termsDevice.storage_gb,
								battery: termsDevice.battery,
								imei: termsDevice.imei,
								serial: termsDevice.serial,
								sold_for_cents: termsDevice.sold_for_cents,
								sale_date: termsDevice.sale_date,
								buyer_name: termsDevice.buyer_name ?? null,
								buyer_cpf: termsDevice.buyer_cpf ?? null,
								sale_details: termsDevice.sale_details ?? null,
								payment_method_id: termsDevice.payment_method_id ?? null,
								payment_installments: termsDevice.payment_installments ?? null,
								sale_payment_methods: termsDevice.sale_payment_methods ?? null,
							}
						: null
				}
			/>

			<Dialog
				open={!!costModalTarget}
				onOpenChange={(open) => !open && setCostModalTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Adicionar custo</DialogTitle>
						<DialogDescription>
							Informe a descrição e o valor do custo adicional para este
							aparelho.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Descrição</label>
							<Input
								value={costDescription}
								onChange={(e) => setCostDescription(e.target.value)}
								placeholder="Ex: Troca de tela, frete..."
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Valor (R$)</label>
							<Input
								value={costValue}
								onChange={(e) => setCostValue(formatMoneyInput(e.target.value))}
								placeholder="0,00"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setCostModalTarget(null)}
							disabled={isSavingCost}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleConfirmCost}
							disabled={isSavingCost || !costValue.trim()}
						>
							{isSavingCost ? "Salvando…" : "Adicionar"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!sellModalTarget}
				onOpenChange={(open) => !open && setSellModalTarget(null)}
			>
				<DialogContent className="max-w-3xl sm:max-w-5xl w-[min(96vw,72rem)] max-h-[90vh] overflow-y-auto gap-0">
					<DialogHeader className="pb-2">
						<DialogTitle>Marcar como vendido</DialogTitle>
						<DialogDescription>
							Informe data, formas de pagamento, troca, comissão, extras e termo de garantia.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-5 py-4 lg:grid-cols-2 lg:gap-6 lg:items-start">
						<div className="flex flex-col gap-4 min-w-0">
							{sellModalTarget ? (
								<>
									<div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm space-y-2">
										<p className="font-medium text-foreground">
											{sellModalTarget.device_name ||
												sellModalTarget.model ||
												"Aparelho"}
										</p>
										<p className="text-muted-foreground text-xs leading-snug">
											{[
												sellModalTarget.model,
												sellModalTarget.storage_gb,
												sellModalTarget.color,
											]
												.filter(Boolean)
												.join(" · ")}
										</p>
										{sellModalTarget.battery?.trim() ? (
											<p className="text-xs text-muted-foreground">
												Bateria: {sellModalTarget.battery}
											</p>
										) : null}
										{sellModalTarget.imei?.trim() ? (
											<p className="text-xs text-muted-foreground font-mono break-all">
												IMEI: {sellModalTarget.imei}
											</p>
										) : null}
										{sellModalTarget.serial?.trim() ? (
											<p className="text-xs text-muted-foreground">
												S/N: {sellModalTarget.serial}
											</p>
										) : null}
									</div>
									<ResaleSellCommissionFields
										key={commissionBoot.seq}
										ref={sellCommissionPanelRef}
										device={sellModalTarget}
										sellPaymentMethods={sellPaymentMethods}
										paymentMethods={paymentMethods}
										teamUsers={teamUsers}
										initial={commissionBoot.initial}
										addonCostTotalCents={getSellAddonCostTotalCents()}
										tradeInTotalCents={getSellTradeInTotalCents()}
										onSnapshotChange={setSellCommissionSnapshot}
									/>
									<SellTradeInSection
										enabled={sellTradeInEnabled}
										onEnabledChange={setSellTradeInEnabled}
										lines={sellTradeInLines}
										onLinesChange={setSellTradeInLines}
									/>
									<div className="space-y-3 rounded-md border p-3">
										<div className="flex items-start space-x-2">
											<Checkbox
												id="sell-generate-term"
												className="mt-0.5"
												checked={sellGenerateWarrantyTerm}
												onCheckedChange={(v) => {
													const on = v === true;
													setSellGenerateWarrantyTerm(on);
													if (
														on &&
														!sellSaleDetails.trim() &&
														sellModalTarget?.info?.trim()
													) {
														setSellSaleDetails(sellModalTarget.info.trim());
													}
												}}
											/>
											<Label
												htmlFor="sell-generate-term"
												className="font-normal cursor-pointer leading-snug"
											>
												Gerar termo de garantia
											</Label>
										</div>
										{sellGenerateWarrantyTerm ? (
											<div className="space-y-3 border-t pt-3 pl-1">
												<div className="space-y-2">
													<Label>Nome completo do comprador</Label>
													<Input
														value={sellBuyerName}
														onChange={(e) => setSellBuyerName(e.target.value)}
														placeholder="Nome completo"
													/>
												</div>
												<div className="space-y-2">
													<Label>CPF/CNPJ do comprador</Label>
													<Input
														value={sellBuyerCpf}
														onChange={(e) =>
															setSellBuyerCpf(formatCpfCnpj(e.target.value))
														}
														placeholder="CPF ou CNPJ"
														inputMode="numeric"
													/>
												</div>
												<div className="space-y-2">
													<Label>Detalhes do aparelho no termo</Label>
													<Textarea
														value={sellSaleDetails}
														onChange={(e) => setSellSaleDetails(e.target.value)}
														placeholder="Texto exibido no termo de compra."
														rows={3}
													/>
												</div>
											</div>
										) : null}
									</div>
									<div className="space-y-2">
										<Label htmlFor="sell-date">Data da venda</Label>
										<Input
											id="sell-date"
											type="date"
											value={sellDate}
											onChange={(e) => setSellDate(e.target.value)}
										/>
									</div>
								</>
							) : null}
						</div>

						<div className="flex flex-col gap-4 min-w-0">
							{sellModalTarget ? (
								<>
						<div className="space-y-3">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
								<div className="flex-1 space-y-1.5">
									<Label className="text-sm">Adicionar produto à venda</Label>
									<div className="relative">
										<Search className="absolute left-2.5 top-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											value={sellAddonQuery}
											onChange={(e) => setSellAddonQuery(e.target.value)}
											placeholder="Buscar por nome, SKU ou código…"
											className="h-9 pl-8"
											disabled={!sellModalTarget}
										/>
										{sellAddonQuery.trim().length >= 2 ? (
											<div className="absolute z-30 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
												{sellAddonBusy ? (
													<div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
														Buscando...
													</div>
												) : sellAddonResults.length > 0 ? (
													<ul className="max-h-56 overflow-y-auto divide-y text-sm">
														{sellAddonResults.map((p) => (
															<li key={p.id}>
																<button
																	type="button"
																	className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-muted/60"
																	onClick={() => addSellAddonProduct(p)}
																>
																	<span className="truncate font-medium">{p.name}</span>
																	<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
																		{p.sale_price_cents != null
																			? formatCentsBr(p.sale_price_cents)
																			: "—"}{" "}
																		· est. {p.stock}
																	</span>
																</button>
															</li>
														))}
													</ul>
												) : (
													<p className="p-3 text-xs text-muted-foreground">
														Nenhum produto encontrado.
													</p>
												)}
											</div>
										) : null}
									</div>
								</div>
							</div>
							{sellAddonQuery.trim().length > 0 &&
							sellAddonQuery.trim().length < 2 ? (
								<p className="text-xs text-muted-foreground py-1">
									Continue digitando para filtrar o catálogo.
								</p>
							) : null}
							{sellAddonItems.length > 0 ? (
								<div className="space-y-2">
									<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
										Itens na venda
									</p>
									<div className="hidden md:grid md:grid-cols-12 md:gap-3 text-xs font-medium text-muted-foreground px-1">
										<div className="md:col-span-5">Produto</div>
										<div className="md:col-span-2">Qtd.</div>
										<div className="md:col-span-2">Venda (R$)</div>
										<div className="md:col-span-2">Total</div>
										<div className="md:col-span-1 text-right">Ações</div>
									</div>
									<ul className="space-y-3">
										{sellAddonItems.map((line) => (
											<li
												key={line.productId}
												className="grid gap-3 md:grid-cols-12 items-end"
											>
												<div className="md:col-span-5 space-y-1">
													<Label className="md:hidden">Produto</Label>
													<Input value={line.name} readOnly className="h-9" />
												</div>
												<div className="md:col-span-2 space-y-1">
													<Label className="md:hidden">Qtd.</Label>
													<Input
														type="number"
														min={1}
														className="h-9"
														value={line.quantity}
														onChange={(e) =>
															updateSellAddonQty(
																line.productId,
																Number(e.target.value),
															)
														}
													/>
												</div>
												<div className="md:col-span-2 space-y-1">
													<Label className="md:hidden">Venda (R$)</Label>
													<Input
														className="h-9"
														value={maskedFromCents(line.unitSaleCents)}
														onChange={(e) =>
															updateSellAddonUnitSaleMasked(
																line.productId,
																e.target.value,
															)
														}
														inputMode="decimal"
														placeholder="0,00"
													/>
												</div>
												<div className="md:col-span-2 space-y-1">
													<Label className="md:hidden">Total</Label>
													<Input
														value={maskedFromCents(
															line.quantity * line.unitSaleCents,
														)}
														readOnly
														className="h-9"
													/>
												</div>
												<div className="md:col-span-1 flex justify-end">
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-500/10"
														onClick={() => removeSellAddonLine(line.productId)}
														aria-label="Remover item"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</div>
											</li>
										))}
									</ul>
								</div>
							) : null}
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label>Formas de pagamento</Label>
							</div>
							<div className="space-y-3">
								<div className="hidden md:grid md:grid-cols-12 md:gap-3 text-xs font-medium text-muted-foreground px-1">
									<div className="md:col-span-6 flex items-center gap-0.5">
										<span>Forma de pagamento</span>
										{sellModalTarget ? (
											<SellPaymentPricingHint
												purchaseValueCents={sellModalTarget.purchase_value_cents}
												wholesaleValueCents={sellModalTarget.wholesale_value_cents}
												saleValueCents={sellModalTarget.sale_value_cents}
												costs={sellModalTarget.costs}
												canViewPurchaseValue={isAdmin && showPurchaseValue}
											/>
										) : null}
									</div>
									<div className="md:col-span-3">Valor</div>
									<div className="md:col-span-2">Parcelas</div>
									<div className="md:col-span-1 text-right">Ações</div>
								</div>
								{sellPaymentMethods.map((entry, i) => (
									<div
										key={entry.rowKey}
										className="grid gap-3 md:grid-cols-12 items-end"
									>
										<div className="md:col-span-6 space-y-1">
											<div className="flex items-center gap-0.5 md:hidden">
											<Label>Forma de pagamento</Label>
											{sellModalTarget ? (
												<SellPaymentPricingHint
													purchaseValueCents={sellModalTarget.purchase_value_cents}
													wholesaleValueCents={sellModalTarget.wholesale_value_cents}
													saleValueCents={sellModalTarget.sale_value_cents}
													costs={sellModalTarget.costs}
													canViewPurchaseValue={isAdmin && showPurchaseValue}
												/>
											) : null}
										</div>
											<Select
												value={entry.payment_method_id || "__none__"}
												onValueChange={(v) => {
													if (v === "__none__") {
														setSellPaymentMethodAt(i, {
															payment_method_id: "",
															value_cents: null,
															installments: 1,
														});
														return;
													}
													setSellPaymentMethodAt(i, {
														payment_method_id: v,
														installments: 1,
													});
												}}
											>
												<SelectTrigger className="h-9">
													<SelectValue placeholder="Selecione..." />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="__none__">Nenhum</SelectItem>
													{paymentMethods.map((pm) => (
														<SelectItem key={pm.id} value={pm.id}>
															{pm.description}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="md:col-span-3 space-y-1">
											<Label className="md:hidden">Valor</Label>
											<Input
												value={
													entry.value_cents != null
														? maskedFromCents(entry.value_cents)
														: ""
												}
												onChange={(e) => {
													const raw = moneyToCentsFromMasked(
														formatMoneyInput(e.target.value),
													);
													setSellPaymentMethodAt(i, { value_cents: raw });
												}}
												placeholder="0,00"
												className="h-9"
											/>
										</div>
										{entry.payment_method_id &&
											(() => {
												const pm = paymentMethods.find(
													(p) => p.id === entry.payment_method_id,
												);
												const isCredit = pm?.type === "credito";
												if (!isCredit) {
													return <div className="hidden md:block md:col-span-2" aria-hidden />;
												}
												const maxInstallments = pm?.credit_installment_fees
													?.length
													? Math.max(
															...pm.credit_installment_fees.map(
																(f) => f.installments,
															),
														)
													: 12;
												return (
													<div className="md:col-span-2 space-y-1">
														<Label className="md:hidden">Parcelas</Label>
														<Select
															value={String(entry.installments || 1)}
															onValueChange={(v) =>
																setSellPaymentMethodAt(i, {
																	installments: Number(v) || 1,
																})
															}
														>
															<SelectTrigger className="h-9">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{Array.from(
																	{ length: maxInstallments },
																	(_, n) => n + 1,
																).map((n) => (
																	<SelectItem key={n} value={String(n)}>
																		{n}x
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												);
											})()}
										<div className="md:col-span-1 flex justify-end">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-500/10"
												onClick={() => removeSellPaymentMethod(i)}
												disabled={sellPaymentMethods.length <= 1}
												aria-label="Remover forma de pagamento"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</div>
								))}
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addSellPaymentMethod}
								className="w-full border-dashed border-green-600 bg-green-600/5 text-green-700 hover:bg-green-600/10 hover:text-green-800"
							>
								<Plus className="h-4 w-4 mr-2" />
								Incluir forma de pagamento
							</Button>
							{(() => {
								const sum = getSellPaymentsTotalCents();
								const cashNet = getSellCashNetFromPaymentsCents();
								const tradeIn = getSellTradeInTotalCents();
								const net = getSellNetFromPaymentsCents();
								if (net == null || net <= 0) return null;
								const tradeLines = getValidSellTradeInLines();
								return (
									<div className="text-sm text-muted-foreground pt-1 space-y-1">
										{tradeLines.length > 0 ? (
											<ul className="text-xs space-y-0.5">
												{tradeLines.map((l) => (
													<li key={l.rowKey}>
														Troca: {l.deviceName.trim()} —{" "}
														{formatCentsBr(l.valueCents ?? 0)}
													</li>
												))}
											</ul>
										) : null}
										<p>
											Total líquido da venda:{" "}
											<span className="text-green-600 font-medium">
												{formatCentsBr(net)}
											</span>
											{sum != null &&
											cashNet != null &&
											sum > cashNet ? (
												<>
													{" — "}
													Total a cobrar: {formatCentsBr(sum)}
												</>
											) : null}
											{tradeIn > 0 && cashNet != null && cashNet > 0 ? (
												<span className="text-xs block text-muted-foreground">
													(inclui {formatCentsBr(tradeIn)} em troca)
												</span>
											) : null}
										</p>
									</div>
								);
							})()}
						</div>
									<ResaleSellAdminProfitCard
										device={sellModalTarget}
										sellPaymentMethods={sellPaymentMethods}
										paymentMethods={paymentMethods}
										isAdmin={isAdmin}
										transactionTotalCents={getSellTransactionTotalCents()}
										deviceSaleCents={getSellDeviceSaleCents()}
										tradeInTotalCents={getSellTradeInTotalCents()}
										addonLines={sellAddonItems}
										addonCostTotalCents={getSellAddonCostTotalCents()}
										commissionUserName={
											teamUsers.find(
												(u) => u.id === sellCommissionSnapshot.userId,
											)?.full_name ||
											teamUsers.find(
												(u) => u.id === sellCommissionSnapshot.userId,
											)?.email ||
											null
										}
										commission={sellCommissionSnapshot}
									/>
								</>
							) : null}
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setSellModalTarget(null)}
							disabled={isSavingSell}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleConfirmSell}
							disabled={(() => {
								const net = getSellNetFromPaymentsCents();
								const cashNet = getSellCashNetFromPaymentsCents();
								if (sellPaymentMethods.some((e) => e.payment_method_id?.trim())) {
									if (cashNet === null) return true;
								}
								if (sellTradeInEnabled && getValidSellTradeInLines().length === 0) {
									return true;
								}
								return isSavingSell || net === null || net <= 0;
							})()}
						>
							{isSavingSell ? "Salvando…" : "Confirmar venda"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!deleteTarget}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir aparelho</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir este aparelho? Os custos vinculados
							também serão removidos.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting ? "Excluindo…" : "Excluir"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

type ResumoProps = {
	devices: ResaleDevice[];
	stats: SeminovosStats | null;
	showValues: boolean;
	/** Resumo enxuto na visão geral (admin). */
	variant?: "full" | "overview-only";
};

function formatVariacao(
	atual: number,
	anterior: number,
): { text: string; positive: boolean } | null {
	if (anterior === 0) return null;
	const variacao = ((atual - anterior) / anterior) * 100;
	const positive = variacao >= 0;
	const text = `${positive ? "+" : ""}${variacao.toFixed(1)}%`;
	return { text, positive };
}

function ResumoFinanceiro({
	devices,
	stats,
	showValues,
	variant = "full",
}: ResumoProps) {
	const qtd = devices.length;
	const estoqueCents = devices.reduce(
		(acc, d) => acc + (d.purchase_value_cents ?? 0),
		0,
	);
	const margemPrevistaAtacadoCents = devices.reduce(
		(acc, d) => acc + (d.expected_profit_wholesale_cents ?? 0),
		0,
	);
	const valorPotencialVarejoCents = devices.reduce(
		(acc, d) => acc + (d.sale_value_cents ?? 0),
		0,
	);
	const margemPrevistaVarejoCents = devices.reduce(
		(acc, d) => acc + (d.expected_profit_sale_cents ?? 0),
		0,
	);
	const custoReparosCents = devices.reduce((acc, d) => {
		const costs = (d.costs || []).reduce((c, x) => c + (x.value_cents ?? 0), 0);
		return acc + costs;
	}, 0);
	const ticketMedioCents = qtd > 0 ? Math.round(estoqueCents / qtd) : 0;

	const vendasMesCents = stats?.soldThisMonthCents ?? 0;
	const vendasMesQty = stats?.soldThisMonthCount ?? 0;
	const lucroRealMesCents = stats?.profitThisMonthCents ?? 0;
	const ticketMedioVendaCents =
		vendasMesQty > 0 ? Math.round(vendasMesCents / vendasMesQty) : 0;

	const vendasMesAntCents = stats?.soldLastMonthCents ?? 0;
	const lucroMesAntCents = stats?.profitLastMonthCents ?? 0;
	const variacaoVendas = formatVariacao(vendasMesCents, vendasMesAntCents);
	const variacaoLucro = formatVariacao(lucroRealMesCents, lucroMesAntCents);

	const totalComVendas = qtd + vendasMesQty;
	const taxaConversao =
		totalComVendas > 0 ? (vendasMesQty / totalComVendas) * 100 : 0;

	const vendasMesQtyLabel =
		vendasMesQty === 0
			? "0 vendas"
			: vendasMesQty === 1
				? "1 venda"
				: `${vendasMesQty} vendas`;

	const hoje = new Date();
	const diasEmEstoque = devices
		.filter(
			(d) =>
				d.purchase_date && /^\d{4}-\d{2}-\d{2}/.test(String(d.purchase_date)),
		)
		.map((d) => {
			const dateStr = String(d.purchase_date).slice(0, 10);
			const compra = new Date(dateStr + "T12:00:00");
			const dias = Math.floor(
				(hoje.getTime() - compra.getTime()) / (1000 * 60 * 60 * 24),
			);
			return dias >= 0 ? dias : 0;
		});
	const tempoMedioEstoqueDias =
		diasEmEstoque.length > 0
			? Math.round(
					diasEmEstoque.reduce((a, b) => a + b, 0) / diasEmEstoque.length,
				)
			: 0;

	const blocks = [
		{
			title: "Disponíveis",
			value: String(qtd),
			sub: undefined as string | undefined,
			icon: Package,
			color:
				"bg-emerald-500/20 border-emerald-500/40 text-emerald-800 dark:text-emerald-300",
			hideValue: false,
		},
		{
			title: "Valor em estoque",
			value: `R$ ${centsToReais(estoqueCents)}`,
			sub: undefined,
			icon: DollarSign,
			color:
				"bg-blue-500/20 border-blue-500/40 text-blue-800 dark:text-blue-300",
			hideValue: true,
		},
		{
			title: "Ticket médio (compra)",
			value: `R$ ${centsToReais(ticketMedioCents)}`,
			sub: undefined,
			icon: BarChart3,
			color:
				"bg-slate-500/20 border-slate-500/40 text-slate-800 dark:text-slate-300",
			hideValue: true,
		},
		{
			title: "Tempo de estoque",
			value: tempoMedioEstoqueDias > 0 ? `${tempoMedioEstoqueDias} dias` : "-",
			sub:
				diasEmEstoque.length > 0
					? `${diasEmEstoque.length} com data`
					: undefined,
			icon: BarChart3,
			color: "bg-sky-500/20 border-sky-500/40 text-sky-800 dark:text-sky-300",
			hideValue: false,
		},
		{
			title: "Valor potencial (varejo)",
			value: `R$ ${centsToReais(valorPotencialVarejoCents)}`,
			sub: undefined,
			icon: TrendingUp,
			color:
				"bg-cyan-500/20 border-cyan-500/40 text-cyan-800 dark:text-cyan-300",
			hideValue: true,
		},
		{
			title: "Margem prevista (atacado)",
			value: `R$ ${centsToReais(margemPrevistaAtacadoCents)}`,
			sub: undefined,
			icon: Calculator,
			color:
				"bg-violet-500/20 border-violet-500/40 text-violet-800 dark:text-violet-300",
			hideValue: true,
		},
		{
			title: "Margem prevista (varejo)",
			value: `R$ ${centsToReais(margemPrevistaVarejoCents)}`,
			sub: undefined,
			icon: Calculator,
			color:
				"bg-indigo-500/20 border-indigo-500/40 text-indigo-800 dark:text-indigo-300",
			hideValue: true,
		},
		{
			title: "Custo em reparos",
			value: `R$ ${centsToReais(custoReparosCents)}`,
			sub: undefined,
			icon: Wrench,
			color:
				"bg-orange-500/20 border-orange-500/40 text-orange-800 dark:text-orange-300",
			hideValue: true,
		},
		{
			title: "Taxa de conversão (mês)",
			value: `${taxaConversao.toFixed(1)}%`,
			sub:
				totalComVendas > 0
					? `${vendasMesQty}/${totalComVendas} vendidos`
					: undefined,
			icon: TrendingUp,
			color:
				"bg-teal-500/20 border-teal-500/40 text-teal-800 dark:text-teal-300",
			hideValue: false,
		},
		{
			title: "Vendas esse mês",
			value: `R$ ${centsToReais(vendasMesCents)}`,
			sub: variacaoVendas
				? `${vendasMesQtyLabel} · ${variacaoVendas.text} vs mês ant.`
				: vendasMesQtyLabel,
			icon: DollarSign,
			color:
				"bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-300",
			hideValue: true,
		},
		{
			title: "Ticket médio (venda)",
			value: `R$ ${centsToReais(ticketMedioVendaCents)}`,
			sub: vendasMesQty > 0 ? `mês atual` : undefined,
			icon: BarChart3,
			color:
				"bg-amber-600/20 border-amber-600/40 text-amber-900 dark:text-amber-200",
			hideValue: true,
		},
		{
			title: "Lucro real (mês)",
			value: `R$ ${centsToReais(lucroRealMesCents)}`,
			sub: variacaoLucro ? `${variacaoLucro.text} vs mês ant` : undefined,
			icon: TrendingUp,
			color:
				"bg-green-600/25 border-green-600/50 text-green-900 dark:text-green-200",
			hideValue: true,
		},
	];

	const ticketMedioCompraEVendaBlock = {
		title: "Ticket médio (compra e venda)",
		value: `Compra: R$ ${centsToReais(ticketMedioCents)}`,
		sub:
			vendasMesQty > 0
				? `Venda: R$ ${centsToReais(ticketMedioVendaCents)}`
				: "Venda: —",
		icon: BarChart3,
		color:
			"bg-slate-500/20 border-slate-500/40 text-slate-800 dark:text-slate-300",
		hideValue: true,
	};

	const disponiveisBlock = blocks.find((b) => b.title === "Disponíveis");
	const valorEmEstoqueBlock = blocks.find((b) => b.title === "Valor em estoque");
	const tempoEstoqueBlock = blocks.find((b) => b.title === "Tempo de estoque");
	const vendasMesBlock = blocks.find((b) => b.title === "Vendas esse mês");

	const blocksToRender =
		variant === "overview-only" &&
		disponiveisBlock &&
		valorEmEstoqueBlock &&
		tempoEstoqueBlock &&
		vendasMesBlock
			? [
					disponiveisBlock,
					valorEmEstoqueBlock,
					ticketMedioCompraEVendaBlock,
					tempoEstoqueBlock,
					vendasMesBlock,
				]
			: blocks;

	const gridClassName =
		variant === "overview-only"
			? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3"
			: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3";

	const grid = (
		<div className={gridClassName}>
			{blocksToRender.map((b) => {
				const Icon = b.icon;
				return (
					<div
						key={b.title}
						className={`rounded-xl border-2 px-3 py-2.5 sm:px-4 sm:py-3.5 min-h-[72px] sm:min-h-[88px] flex flex-col justify-center transition-colors ${b.color}`}
					>
						<div className="flex items-center gap-2 mb-1">
							<Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 opacity-90" />
							<p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider opacity-90 truncate">
								{b.title}
							</p>
						</div>
						{showValues || !b.hideValue ? (
							<>
								<p className="text-base sm:text-lg font-bold leading-tight break-words">
									{b.value}
								</p>
								{b.sub != null && (
									<p className="text-[11px] mt-0.5 opacity-85">{b.sub}</p>
								)}
							</>
						) : (
							<Skeleton className="h-7 w-24 mt-1" />
						)}
					</div>
				);
			})}
		</div>
	);

	if (variant === "overview-only") {
		return grid;
	}

	return <div className="space-y-4">{grid}</div>;
}
