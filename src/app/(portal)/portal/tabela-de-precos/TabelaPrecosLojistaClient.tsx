"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Battery,
	Camera,
	Loader2,
	Monitor,
	Palette,
	Smartphone,
	Wrench,
	X,
	type LucideIcon,
} from "lucide-react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

type DeviceCatalogRow = {
	id: string;
	brand: string | null;
	device_type: string | null;
	model: string | null;
};

type SelectedDevice = { id: string; label: string };

type CatalogRow = {
	productId: string;
	productName: string;
	productKind: string;
	salePriceCents: number | null;
	pricingTagName: string | null;
	deviceModelLabel: string | null;
	brandName: string | null;
};

function formatBrl(cents: number | null) {
	if (cents == null) return "—";
	const v = cents / 100;
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeTagKey(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

function getTagVisual(tagName: string): { icon: LucideIcon; label: string } {
	const n = normalizeTagKey(tagName);
	if (n.includes("display")) return { icon: Monitor, label: "Display" };
	if (n.includes("bateria")) return { icon: Battery, label: "Bateria" };
	if (n.includes("troca de vidro") || n.includes("vidro"))
		return { icon: Wrench, label: "Troca de vidro" };
	if (n.includes("tampa")) return { icon: Palette, label: "Tampa" };
	if (n.includes("camera")) return { icon: Camera, label: "Câmera" };
	return { icon: Smartphone, label: tagName || "Sem tag" };
}

export function TabelaPrecosLojistaClient() {
	const [deviceCatalog, setDeviceCatalog] = useState<DeviceCatalogRow[]>([]);
	const [catalogLoading, setCatalogLoading] = useState(true);
	const [deviceQuery, setDeviceQuery] = useState("");
	const [suggestions, setSuggestions] = useState<
		{ value: string; label: string }[]
	>([]);
	const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const deviceInputRef = useRef<HTMLInputElement | null>(null);
	const pendingFocusSearchRef = useRef(false);

	const [selectedDevice, setSelectedDevice] = useState<SelectedDevice | null>(
		null,
	);

	const [rows, setRows] = useState<CatalogRow[]>([]);
	const [loadingRows, setLoadingRows] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			setCatalogLoading(true);
			const res = await fetch("/api/portal/lojista/device-models?limit=2000");
			const json = await res.json().catch(() => null);
			if (cancelled || !res.ok || !json?.ok) {
				setDeviceCatalog([]);
				setCatalogLoading(false);
				return;
			}
			setDeviceCatalog((json.deviceModels || []) as DeviceCatalogRow[]);
			setCatalogLoading(false);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const deviceOptions = useMemo(
		() =>
			deviceCatalog
				.map((d) => ({
					value: d.id,
					label:
						[d.brand, d.device_type, d.model].filter(Boolean).join(" ") || d.id,
				}))
				.sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
		[deviceCatalog],
	);

	useEffect(() => {
		const q = deviceQuery.trim().toLowerCase();
		if (q.length < 2) {
			setSuggestions([]);
			return;
		}
		setSuggestions(
			deviceOptions
				.filter((o) => o.label.toLowerCase().includes(q))
				.slice(0, 50),
		);
	}, [deviceQuery, deviceOptions]);

	const fetchPrices = useCallback(async () => {
		if (!selectedDevice?.id) {
			setRows([]);
			setLoadingRows(false);
			return;
		}
		setLoadingRows(true);
		setError(null);
		const qs = new URLSearchParams();
		qs.set("deviceModelId", selectedDevice.id);
		const res = await fetch(
			`/api/portal/lojista/catalogo-precos?${qs.toString()}`,
		);
		const json = await res.json().catch(() => null);
		setLoadingRows(false);
		if (!res.ok || !json?.ok) {
			setError("Não foi possível carregar preços.");
			setRows([]);
			return;
		}
		const raw = (json.items || []) as Record<string, unknown>[];
		setRows(
			raw.map((r) => ({
				productId: String(r.productId),
				productName: String(r.productName),
				productKind: String(r.productKind),
				salePriceCents:
					typeof r.salePriceCents === "number" ? r.salePriceCents : null,
				pricingTagName:
					r.pricingTagName != null ? String(r.pricingTagName) : null,
				deviceModelLabel:
					r.deviceModelLabel != null ? String(r.deviceModelLabel) : null,
				brandName: r.brandName != null ? String(r.brandName) : null,
			})),
		);
	}, [selectedDevice]);

	useEffect(() => {
		void fetchPrices();
	}, [fetchPrices]);

	function handlePick(opt: { value: string; label: string }) {
		setSelectedDevice({ id: opt.value, label: opt.label });
		setDeviceQuery("");
		setSuggestions([]);
	}

	function clearDevice() {
		pendingFocusSearchRef.current = false;
		setSelectedDevice(null);
		setDeviceQuery("");
		setSuggestions([]);
		setRows([]);
		setError(null);
	}

	function beginEditDeviceSearch() {
		if (!selectedDevice) return;
		pendingFocusSearchRef.current = true;
		const label = selectedDevice.label;
		setSelectedDevice(null);
		setDeviceQuery(label);
	}

	useLayoutEffect(() => {
		if (!pendingFocusSearchRef.current) return;
		if (selectedDevice != null) return;
		pendingFocusSearchRef.current = false;
		const el = deviceInputRef.current;
		if (!el) return;
		el.focus();
		el.select();
	}, [selectedDevice]);

	const groupedRows = useMemo(() => {
		const grouped = new Map<string, CatalogRow[]>();
		for (const row of rows) {
			const key = (row.pricingTagName || "Sem tag").trim() || "Sem tag";
			const current = grouped.get(key) || [];
			current.push(row);
			grouped.set(key, current);
		}

		const groups = [...grouped.entries()]
			.map(([tagName, items]) => ({
				tagName,
				items: [...items].sort((a, b) =>
					a.productName.localeCompare(b.productName, "pt-BR"),
				),
			}))
			.sort((a, b) => a.tagName.localeCompare(b.tagName, "pt-BR"));

		return groups;
	}, [rows]);

	return (
		<div className="space-y-4">
			<Card className="min-w-0 max-w-full">
				<CardHeader className="space-y-1">
					<CardTitle className="text-lg">Dispositivo e lojista</CardTitle>
					<CardDescription>
						Selecione um modelo para carregar as opções comerciais por tag.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid gap-2 md:grid-cols-2">
						<div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
							<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
								Dispositivo
							</p>
							<p className="mt-1 truncate font-medium">
								{selectedDevice?.label || "Nenhum selecionado"}
							</p>
						</div>
						<div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
							<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
								Lojista
							</p>
							<p className="mt-1 font-medium">Tabela comercial aplicada</p>
						</div>
					</div>
					{selectedDevice ? (
						<div className="space-y-2">
							<Label>Trocar dispositivo</Label>
							<div className="flex min-h-10 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 text-sm shadow-sm">
								<button
									type="button"
									className="min-w-0 flex-1 cursor-text truncate px-3 py-2 text-left font-medium text-foreground outline-none ring-offset-background hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
									onClick={beginEditDeviceSearch}
									title="Clique para editar a busca"
								>
									{selectedDevice.label}
								</button>
								<button
									type="button"
									className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
									onClick={(e) => {
										e.stopPropagation();
										clearDevice();
									}}
									aria-label="Limpar modelo"
								>
									<X className="h-4 w-4" aria-hidden />
								</button>
							</div>
						</div>
					) : (
						<div className="relative space-y-2">
							<Label htmlFor="tabela-device-search">Selecionar modelo</Label>
							<div className="relative">
								<Input
									ref={deviceInputRef}
									id="tabela-device-search"
									placeholder="Marca, tipo ou modelo (mín. 2 caracteres)…"
									value={deviceQuery}
									onChange={(e) => setDeviceQuery(e.target.value)}
									onBlur={() => {
										blurRef.current = setTimeout(() => setSuggestions([]), 150);
									}}
									onFocus={() => {
										if (blurRef.current) {
											clearTimeout(blurRef.current);
											blurRef.current = null;
										}
									}}
									disabled={catalogLoading}
									autoComplete="off"
								/>
								{catalogLoading ? (
									<span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
										Carregando…
									</span>
								) : null}
								{suggestions.length > 0 ? (
									<ul className="absolute z-20 mt-1 max-h-52 w-full list-none overflow-auto rounded-md border bg-popover p-0 py-1 shadow-md">
										{suggestions.map((opt) => (
											<li key={opt.value}>
												<button
													type="button"
													className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
													onMouseDown={(e) => e.preventDefault()}
													onClick={() => handlePick(opt)}
												>
													{opt.label}
												</button>
											</li>
										))}
										{suggestions.length === 50 ? (
											<li className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
												Lista limitada a 50 itens — refine a busca.
											</li>
										) : null}
									</ul>
								) : null}
							</div>
							{!catalogLoading &&
							deviceQuery.trim().length > 0 &&
							deviceQuery.trim().length < 2 ? (
								<p className="text-xs text-muted-foreground">
									Mínimo 2 caracteres.
								</p>
							) : null}
							{!catalogLoading &&
							deviceQuery.trim().length >= 2 &&
							suggestions.length === 0 ? (
								<p className="text-xs text-muted-foreground">
									Nenhum modelo encontrado.
								</p>
							) : null}
						</div>
					)}
				</CardContent>
			</Card>

			{error ? <p className="text-sm text-destructive">{error}</p> : null}

			<Card className="min-w-0 max-w-full border-muted">
				<CardHeader className="space-y-1">
					<CardTitle className="text-lg">Preços por tag</CardTitle>
					<CardDescription>
						Exibição agrupada por tag com as opções disponíveis para o
						dispositivo selecionado.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!selectedDevice ? (
						<p className="py-10 text-center text-sm text-muted-foreground">
							Selecione um modelo de aparelho acima para consultar os preços.
						</p>
					) : loadingRows && rows.length === 0 ? (
						<div className="flex justify-center py-12 text-muted-foreground">
							<Loader2 className="h-8 w-8 animate-spin" />
						</div>
					) : !loadingRows && groupedRows.length === 0 ? (
						<p className="py-8 text-center text-sm text-muted-foreground">
							Nenhum item cadastrado para este modelo.
						</p>
					) : (
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
							{groupedRows.map((group) => {
								const visual = getTagVisual(group.tagName);
								const Icon = visual.icon;
								return (
									<Card key={group.tagName} className="border-border/70">
										<CardHeader className="pb-3">
											<div className="flex items-center justify-between gap-2">
												<div className="flex min-w-0 items-center gap-2">
													<div className="rounded-md border bg-muted/50 p-1.5">
														<Icon className="h-4 w-4 text-primary" />
													</div>
													<CardTitle className="truncate text-base">
														{visual.label}
													</CardTitle>
												</div>
												<Badge variant="secondary">
													{group.items.length} opção
													{group.items.length === 1 ? "" : "ões"}
												</Badge>
											</div>
										</CardHeader>
										<CardContent className="space-y-2">
											{group.items.map((item) => (
												<div
													key={item.productId}
													className="flex items-start justify-between gap-2 rounded-md border bg-background px-3 py-2"
												>
													<div className="min-w-0">
														<p className="truncate text-sm font-medium">
															{item.productName}
														</p>
														{item.productKind ? (
															<p className="text-xs text-muted-foreground">
																{item.productKind}
															</p>
														) : null}
													</div>
													<p className="shrink-0 text-sm font-semibold tabular-nums text-primary">
														{formatBrl(item.salePriceCents)}
													</p>
												</div>
											))}
										</CardContent>
									</Card>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
