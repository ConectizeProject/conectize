"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { portalFetch } from "@/lib/portal/portal-fetch";
import {
	ChevronDown,
	ChevronRight,
	MoreHorizontal,
	Pencil,
	Plus,
	Smartphone,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type DeviceBrandRow = { id: string; name: string; created_at?: string | null };
type DeviceTypeRow = {
	id: string;
	brand_id: string;
	name: string;
	brand_name?: string | null;
	created_at?: string | null;
};
type DeviceModelRow = {
	id: string;
	model: string;
	device_type_id?: string | null;
	brand?: string | null;
	device_type?: string | null;
	created_at?: string | null;
};

function cleanText(value: string) {
	return String(value || "").trim();
}

function buildAparelhosSearchParams(params: {
	brand: string;
	deviceType: string;
	modelQuery: string;
}) {
	const sp = new URLSearchParams();
	if (params.brand) sp.set("brand", params.brand);
	if (params.deviceType) sp.set("deviceType", params.deviceType);
	if (params.modelQuery) sp.set("q", params.modelQuery);
	return sp.toString();
}

function BrandCollapsible({
	brand,
	deviceTypes,
	isLoadingDevices,
	onOpen,
	getModelsForDeviceType,
	onLoadModels,
	loadingModelIds,
	onAddDevice,
	onAddAparelho,
	onEditMarca,
	onDeleteMarca,
	onEditDisp,
	onDeleteDisp,
	onEditModel,
	onDeleteModel,
}: {
	brand: DeviceBrandRow;
	deviceTypes: DeviceTypeRow[] | undefined;
	isLoadingDevices: boolean;
	onOpen: (brandId: string) => void;
	getModelsForDeviceType: (
		deviceTypeId: string,
	) => DeviceModelRow[] | undefined;
	onLoadModels: (deviceTypeId: string) => void;
	loadingModelIds: Set<string>;
	onAddDevice: (brand: DeviceBrandRow) => void;
	onAddAparelho: (deviceType: DeviceTypeRow) => void;
	onEditMarca: () => void;
	onDeleteMarca: () => void;
	onEditDisp: (t: DeviceTypeRow) => void;
	onDeleteDisp: (t: DeviceTypeRow) => void;
	onEditModel: (r: DeviceModelRow) => void;
	onDeleteModel: (r: DeviceModelRow) => void;
}) {
	const [open, setOpen] = useState(false);
	const handleOpenChange = (next: boolean) => {
		if (next) onOpen(brand.id);
		setOpen(next);
	};
	return (
		<Collapsible open={open} onOpenChange={handleOpenChange}>
			<div className="flex items-center gap-1">
				<CollapsibleTrigger className="flex flex-1 min-w-0 items-center gap-2 px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/30 transition-colors rounded-md">
					{open ? (
						<ChevronDown className="h-4 w-4 shrink-0" />
					) : (
						<ChevronRight className="h-4 w-4 shrink-0" />
					)}
					<span className="truncate">{brand.name}</span>
				</CollapsibleTrigger>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 shrink-0"
					aria-label="Adicionar dispositivo"
					onClick={(e) => {
						e.stopPropagation();
						onAddDevice(brand);
					}}
				>
					<Plus className="h-4 w-4" />
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0"
							aria-label="Ações marca"
							onClick={(e) => e.stopPropagation()}
						>
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEditMarca}>
							<Pencil className="mr-2 h-4 w-4" /> Editar marca
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={onDeleteMarca}
						>
							<Trash2 className="mr-2 h-4 w-4" /> Excluir marca
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<CollapsibleContent>
				<div className="pl-4 pt-1 pb-1 space-y-1 border-l-2 border-border/40 ml-2">
					{isLoadingDevices ? (
						<p className="text-xs text-muted-foreground py-2">
							Carregando dispositivos...
						</p>
					) : !deviceTypes || deviceTypes.length === 0 ? (
						<p className="text-xs text-muted-foreground py-2">
							Nenhum dispositivo. Use &quot;Criar
							dispositivo&quot; e selecione esta marca.
						</p>
					) : (
						deviceTypes.map((dt) => (
							<DeviceTypeCollapsible
								key={dt.id}
								brandName={brand.name}
								deviceType={dt}
								models={getModelsForDeviceType(dt.id)}
								isLoadingModels={loadingModelIds.has(dt.id)}
								onOpen={onLoadModels}
								onAddAparelho={onAddAparelho}
								onEditDisp={() => onEditDisp(dt)}
								onDeleteDisp={() => onDeleteDisp(dt)}
								onEditModel={onEditModel}
								onDeleteModel={onDeleteModel}
							/>
						))
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

function DeviceTypeCollapsible({
	brandName,
	deviceType,
	models,
	isLoadingModels,
	onOpen,
	onAddAparelho,
	onEditDisp,
	onDeleteDisp,
	onEditModel,
	onDeleteModel,
}: {
	brandName: string;
	deviceType: DeviceTypeRow;
	models: DeviceModelRow[] | undefined;
	isLoadingModels: boolean;
	onOpen: (deviceTypeId: string) => void;
	onAddAparelho: (deviceType: DeviceTypeRow) => void;
	onEditDisp: () => void;
	onDeleteDisp: () => void;
	onEditModel: (r: DeviceModelRow) => void;
	onDeleteModel: (r: DeviceModelRow) => void;
}) {
	const [open, setOpen] = useState(false);
	const handleOpenChange = (next: boolean) => {
		if (next) onOpen(deviceType.id);
		setOpen(next);
	};
	return (
		<Collapsible open={open} onOpenChange={handleOpenChange}>
			<div className="flex items-center gap-1">
				<CollapsibleTrigger className="flex flex-1 min-w-0 items-center gap-2 px-2 py-1 text-left text-sm hover:bg-muted/30 transition-colors rounded-md">
					{open ? (
						<ChevronDown className="h-4 w-4 shrink-0" />
					) : (
						<ChevronRight className="h-4 w-4 shrink-0" />
					)}
					<span className="truncate">{deviceType.name}</span>
				</CollapsibleTrigger>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7 shrink-0"
					aria-label="Adicionar aparelho"
					onClick={(e) => {
						e.stopPropagation();
						onAddAparelho(deviceType);
					}}
				>
					<Plus className="h-3.5 w-3.5" />
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 shrink-0"
							aria-label="Ações dispositivo"
							onClick={(e) => e.stopPropagation()}
						>
							<MoreHorizontal className="h-3.5 w-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEditDisp}>
							<Pencil className="mr-2 h-4 w-4" /> Editar
							dispositivo
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={onDeleteDisp}
						>
							<Trash2 className="mr-2 h-4 w-4" /> Excluir
							dispositivo
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<CollapsibleContent>
				<div className="pl-4 pt-1 space-y-0 border-l-2 border-border/40 ml-2">
					{isLoadingModels ? (
						<p className="text-xs text-muted-foreground py-2">
							Carregando aparelhos...
						</p>
					) : !models || models.length === 0 ? (
						<p className="text-xs text-muted-foreground py-2">
							Nenhum modelo. Use &quot;Criar aparelho&quot; e
							selecione esta marca e dispositivo.
						</p>
					) : (
						<Table>
							<TableBody>
								{models.map((r) => (
									<TableRow
										key={r.id}
										className="hover:bg-muted/20"
									>
										<TableCell className="font-medium py-1 h-auto text-sm">
											{r.model}
										</TableCell>
										<TableCell className="text-right py-1 h-auto">
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7"
														aria-label="Ações"
													>
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() =>
															onEditModel(r)
														}
													>
														<Pencil className="mr-2 h-4 w-4" />{" "}
														Editar
													</DropdownMenuItem>
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onClick={() =>
															onDeleteModel(r)
														}
													>
														<Trash2 className="mr-2 h-4 w-4" />{" "}
														Excluir
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function AparelhosClient(props: {
	initialDeviceModels?: DeviceModelRow[];
	initialBrand?: string;
	initialDeviceType?: string;
	initialModelQuery?: string;
}) {
	const [deviceBrands, setDeviceBrands] = useState<DeviceBrandRow[]>([]);
	const [deviceTypesByBrand, setDeviceTypesByBrand] = useState<
		Record<string, DeviceTypeRow[]>
	>({});
	const [modelsByDeviceType, setModelsByDeviceType] = useState<
		Record<string, DeviceModelRow[]>
	>({});
	const [loadingBrandIds, setLoadingBrandIds] = useState<
		Record<string, boolean>
	>({});
	const [loadingModelIds, setLoadingModelIds] = useState<
		Record<string, boolean>
	>({});

	const loadBrands = useCallback(async () => {
		const res = await portalFetch("/api/portal/device-brands");
		const json = await res?.json().catch(() => null);
		if (json?.ok && Array.isArray(json.deviceBrands)) {
			setDeviceBrands(json.deviceBrands);
		}
	}, []);

	const loadDeviceTypesForBrand = useCallback(async (brandId: string) => {
		setLoadingBrandIds((prev) => ({ ...prev, [brandId]: true }));
		try {
			const res = await portalFetch(
				`/api/portal/device-types?brandId=${encodeURIComponent(brandId)}`,
			);
			const json = await res?.json().catch(() => null);
			if (json?.ok && Array.isArray(json.deviceTypes)) {
				const list = (json.deviceTypes as DeviceTypeRow[]).map((t) => ({
					...t,
					brand_name: t.brand_name ?? null,
				}));
				setDeviceTypesByBrand((prev) => ({ ...prev, [brandId]: list }));
			}
		} finally {
			setLoadingBrandIds((prev) => ({ ...prev, [brandId]: false }));
		}
	}, []);

	const loadModelsForDeviceType = useCallback(
		async (deviceTypeId: string) => {
			setLoadingModelIds((prev) => ({ ...prev, [deviceTypeId]: true }));
			try {
				const res = await portalFetch(
					`/api/portal/device-models?device_type_id=${encodeURIComponent(deviceTypeId)}`,
				);
				const json = await res?.json().catch(() => null);
				if (json?.ok && Array.isArray(json.deviceModels)) {
					setModelsByDeviceType((prev) => ({
						...prev,
						[deviceTypeId]: json.deviceModels as DeviceModelRow[],
					}));
				}
			} finally {
				setLoadingModelIds((prev) => ({
					...prev,
					[deviceTypeId]: false,
				}));
			}
		},
		[],
	);

	useEffect(() => {
		loadBrands();
	}, [loadBrands]);

	const onBrandOpen = useCallback(
		(brandId: string) => {
			if (
				deviceTypesByBrand[brandId] !== undefined ||
				loadingBrandIds[brandId]
			)
				return;
			loadDeviceTypesForBrand(brandId);
		},
		[deviceTypesByBrand, loadingBrandIds, loadDeviceTypesForBrand],
	);

	const onDeviceTypeOpen = useCallback(
		(deviceTypeId: string) => {
			if (
				modelsByDeviceType[deviceTypeId] !== undefined ||
				loadingModelIds[deviceTypeId]
			)
				return;
			loadModelsForDeviceType(deviceTypeId);
		},
		[modelsByDeviceType, loadingModelIds, loadModelsForDeviceType],
	);

	const getModelsForDeviceType = useCallback(
		(deviceTypeId: string) => modelsByDeviceType[deviceTypeId],
		[modelsByDeviceType],
	);

	const allDeviceTypes = useMemo(
		() => Object.values(deviceTypesByBrand).flat(),
		[deviceTypesByBrand],
	);
	const loadingBrandIdsSet = useMemo(
		() =>
			new Set(
				Object.entries(loadingBrandIds)
					.filter(([, v]) => v)
					.map(([k]) => k),
			),
		[loadingBrandIds],
	);
	const loadingModelIdsSet = useMemo(
		() =>
			new Set(
				Object.entries(loadingModelIds)
					.filter(([, v]) => v)
					.map(([k]) => k),
			),
		[loadingModelIds],
	);

	const [errorMessage, setErrorMessage] = useState("");

	// --- Marcas
	const [marcaCreateOpen, setMarcaCreateOpen] = useState(false);
	const [marcaEdit, setMarcaEdit] = useState<DeviceBrandRow | null>(null);
	const [marcaDelete, setMarcaDelete] = useState<DeviceBrandRow | null>(null);
	const [marcaName, setMarcaName] = useState("");
	const [marcaSaving, setMarcaSaving] = useState(false);
	const [marcaDeleting, setMarcaDeleting] = useState(false);

	async function handleMarcaCreate(e: React.FormEvent) {
		e.preventDefault();
		if (marcaSaving) return;
		setErrorMessage("");
		const name = cleanText(marcaName);
		if (!name) {
			setErrorMessage("Informe o nome da marca.");
			return;
		}
		setMarcaSaving(true);
		try {
			const res = await portalFetch("/api/portal/device-brands", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name }),
			});
			const json = await res.json().catch(() => null);
			if (!res.ok || !json?.ok) {
				setErrorMessage(
					json?.error === "db_error"
						? "Erro ao salvar."
						: "Nome já existe ou inválido.",
				);
				return;
			}
			const b = json.deviceBrand as DeviceBrandRow;
			if (b?.id)
				setDeviceBrands((prev) =>
					prev.some((x) => x.id === b.id)
						? prev
						: [...prev, b].sort((a, c) =>
								a.name.localeCompare(c.name),
							),
				);
			setMarcaCreateOpen(false);
			setMarcaName("");
			await loadBrands();
		} finally {
			setMarcaSaving(false);
		}
	}

	async function handleMarcaUpdate(e: React.FormEvent) {
		e.preventDefault();
		if (marcaSaving || !marcaEdit) return;
		setErrorMessage("");
		const name = cleanText(marcaName);
		if (!name) {
			setErrorMessage("Informe o nome da marca.");
			return;
		}
		setMarcaSaving(true);
		try {
			const res = await portalFetch(
				`/api/portal/device-brands/${marcaEdit.id}`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ name }),
				},
			);
			const json = await res.json().catch(() => null);
			if (!res.ok || !json?.ok) {
				setErrorMessage(
					json?.error === "duplicate_name"
						? "Já existe uma marca com esse nome."
						: "Erro ao salvar.",
				);
				return;
			}
			setDeviceBrands((prev) =>
				prev.map((x) => (x.id === marcaEdit.id ? { ...x, name } : x)),
			);
			setMarcaEdit(null);
			setMarcaName("");
			await loadBrands();
		} finally {
			setMarcaSaving(false);
		}
	}

	async function handleMarcaDelete() {
		if (!marcaDelete || marcaDeleting) return;
		setMarcaDeleting(true);
		setErrorMessage("");
		try {
			const res = await portalFetch(
				`/api/portal/device-brands/${marcaDelete.id}`,
				{ method: "DELETE" },
			);
			const json = await res.json().catch(() => null);
			if (!res.ok || !json?.ok) {
				setErrorMessage(
					json?.message ||
						"Não foi possível excluir. A marca pode estar em uso.",
				);
				return;
			}
			setDeviceBrands((prev) =>
				prev.filter((x) => x.id !== marcaDelete.id),
			);
			setMarcaDelete(null);
			await loadBrands();
		} finally {
			setMarcaDeleting(false);
		}
	}

	// --- Dispositivos
	const [dispCreateOpen, setDispCreateOpen] = useState(false);
	const [dispEdit, setDispEdit] = useState<DeviceTypeRow | null>(null);
	const [dispDelete, setDispDelete] = useState<DeviceTypeRow | null>(null);
	const [dispBrandId, setDispBrandId] = useState("");
	const [dispName, setDispName] = useState("");
	const [dispSaving, setDispSaving] = useState(false);
	const [dispDeleting, setDispDeleting] = useState(false);

	async function handleDispCreate(e: React.FormEvent) {
		e.preventDefault();
		if (dispSaving) return;
		setErrorMessage("");
		const name = cleanText(dispName);
		if (!dispBrandId || !name) {
			setErrorMessage(
				"Selecione a marca e informe o nome do dispositivo.",
			);
			return;
		}
		setDispSaving(true);
		try {
			const res = await portalFetch("/api/portal/device-types", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ brandId: dispBrandId, name }),
			});
			const json = await res.json().catch(() => null);
			if (!res.ok || !json?.ok) {
				setErrorMessage(
					json?.error === "invalid_brand"
						? "Marca inválida."
						: "Erro ao salvar ou já existe.",
				);
				return;
			}
			const t = json.deviceType as DeviceTypeRow;
			if (t?.id) {
				const brandName = deviceBrands.find(
					(b) => b.id === dispBrandId,
				)?.name;
				setDeviceTypesByBrand((prev) => ({
					...prev,
					[dispBrandId]: [
						...(prev[dispBrandId] || []),
						{ ...t, brand_name: brandName ?? null },
					].sort((a, c) => a.name.localeCompare(c.name)),
				}));
			}
			setDispCreateOpen(false);
			setDispBrandId("");
			setDispName("");
		} finally {
			setDispSaving(false);
		}
	}

	async function handleDispUpdate(e: React.FormEvent) {
		e.preventDefault();
		if (dispSaving || !dispEdit) return;
		setErrorMessage("");
		const name = cleanText(dispName);
		if (!dispBrandId || !name) {
			setErrorMessage(
				"Selecione a marca e informe o nome do dispositivo.",
			);
			return;
		}
		setDispSaving(true);
		try {
			const res = await portalFetch(
				`/api/portal/device-types/${dispEdit.id}`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ brandId: dispBrandId, name }),
				},
			);
			const json = await res.json().catch(() => null);
			if (!res.ok || !json?.ok) {
				setErrorMessage(
					"Erro ao salvar ou nome duplicado para esta marca.",
				);
				return;
			}
			const brandName = deviceBrands.find(
				(b) => b.id === dispBrandId,
			)?.name;
			const oldBrandId = dispEdit.brand_id;
			const updated = {
				...dispEdit,
				brand_id: dispBrandId,
				name,
				brand_name: brandName ?? null,
			};
			setDeviceTypesByBrand((prev) => {
				const next = { ...prev };
				next[oldBrandId] = (next[oldBrandId] || []).filter(
					(x) => x.id !== dispEdit.id,
				);
				next[dispBrandId] = [
					...(next[dispBrandId] || []),
					updated,
				].sort((a, c) => a.name.localeCompare(c.name));
				return next;
			});
			setDispEdit(null);
			setDispBrandId("");
			setDispName("");
		} finally {
			setDispSaving(false);
		}
	}

	async function handleDispDelete() {
		if (!dispDelete || dispDeleting) return;
		setDispDeleting(true);
		setErrorMessage("");
		try {
			const res = await portalFetch(
				`/api/portal/device-types/${dispDelete.id}`,
				{ method: "DELETE" },
			);
			const json = await res.json().catch(() => null);
			if (!res.ok || !json?.ok) {
				setErrorMessage(
					json?.message ||
						"Não foi possível excluir. O dispositivo pode estar em uso.",
				);
				return;
			}
			setDeviceTypesByBrand((prev) => ({
				...prev,
				[dispDelete.brand_id]: (prev[dispDelete.brand_id] || []).filter(
					(x) => x.id !== dispDelete.id,
				),
			}));
			setDispDelete(null);
		} finally {
			setDispDeleting(false);
		}
	}

	// --- Aparelhos (device_models)
	const [aparelhoCreateOpen, setAparelhoCreateOpen] = useState(false);
	const [aparelhoEdit, setAparelhoEdit] = useState<DeviceModelRow | null>(
		null,
	);
	const [aparelhoDelete, setAparelhoDelete] = useState<DeviceModelRow | null>(
		null,
	);
	const [aparelhoBrandId, setAparelhoBrandId] = useState("");
	const [aparelhoTypeId, setAparelhoTypeId] = useState("");
	const [aparelhoModel, setAparelhoModel] = useState("");
	const [aparelhoSaving, setAparelhoSaving] = useState(false);
	const [aparelhoDeleting, setAparelhoDeleting] = useState(false);

	const aparelhoTypeOptions = useMemo(
		() => deviceTypesByBrand[aparelhoBrandId] || [],
		[deviceTypesByBrand, aparelhoBrandId],
	);

	async function handleAparelhoCreate(e: React.FormEvent) {
		e.preventDefault();
		if (aparelhoSaving) return;
		setErrorMessage("");
		const model = cleanText(aparelhoModel);
		const typeObj = allDeviceTypes.find((t) => t.id === aparelhoTypeId);
		if (!typeObj || !model) {
			setErrorMessage(
				"Selecione marca, dispositivo e informe o modelo (aparelho).",
			);
			return;
		}
		setAparelhoSaving(true);
		try {
			const res = await portalFetch("/api/portal/device-models", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ device_type_id: aparelhoTypeId, model }),
			});
			const json = await res.json().catch(() => null);
			if (!res.ok || !json?.ok) {
				setErrorMessage("Não foi possível cadastrar. Tente novamente.");
				return;
			}
			const dm = json.deviceModel as DeviceModelRow;
			if (dm?.id)
				setModelsByDeviceType((prev) => ({
					...prev,
					[aparelhoTypeId]: [...(prev[aparelhoTypeId] || []), dm],
				}));
			setAparelhoCreateOpen(false);
			setAparelhoBrandId("");
			setAparelhoTypeId("");
			setAparelhoModel("");
		} finally {
			setAparelhoSaving(false);
		}
	}

	async function handleAparelhoUpdate(e: React.FormEvent) {
		e.preventDefault();
		if (aparelhoSaving || !aparelhoEdit) return;
		setErrorMessage("");
		const model = cleanText(aparelhoModel);
		const typeObj = allDeviceTypes.find((t) => t.id === aparelhoTypeId);
		if (!typeObj || !model) {
			setErrorMessage(
				"Selecione marca, dispositivo e informe o modelo (aparelho).",
			);
			return;
		}
		setAparelhoSaving(true);
		try {
			const res = await portalFetch(
				`/api/portal/device-models/${aparelhoEdit.id}`,
				{
					method: "PATCH",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						device_type_id: aparelhoTypeId,
						model,
					}),
				},
			);
			const json = await res.json().catch(() => null);
			if (!res.ok || !json?.ok) {
				setErrorMessage("Não foi possível atualizar.");
				return;
			}
			const updated = json.deviceModel as DeviceModelRow;
			const oldDeviceTypeId = aparelhoEdit.device_type_id;
			setModelsByDeviceType((prev) => {
				const next = { ...prev };
				if (oldDeviceTypeId)
					next[oldDeviceTypeId] = (
						next[oldDeviceTypeId] || []
					).filter((r) => r.id !== aparelhoEdit.id);
				next[aparelhoTypeId] = [
					...(next[aparelhoTypeId] || []).filter(
						(r) => r.id !== aparelhoEdit.id,
					),
					updated,
				];
				return next;
			});
			setAparelhoEdit(null);
			setAparelhoBrandId("");
			setAparelhoTypeId("");
			setAparelhoModel("");
		} finally {
			setAparelhoSaving(false);
		}
	}

	async function handleAparelhoDelete() {
		if (!aparelhoDelete || aparelhoDeleting) return;
		setAparelhoDeleting(true);
		setErrorMessage("");
		try {
			const res = await portalFetch(
				`/api/portal/device-models/${aparelhoDelete.id}`,
				{ method: "DELETE" },
			);
			const json = await res.json().catch(() => null);
			if (!res.ok || !json?.ok) {
				setErrorMessage(
					json?.message ||
						"Não foi possível excluir. Pode estar vinculado a ordens.",
				);
				return;
			}
			const deviceTypeId = aparelhoDelete.device_type_id;
			if (deviceTypeId)
				setModelsByDeviceType((prev) => ({
					...prev,
					[deviceTypeId]: (prev[deviceTypeId] || []).filter(
						(r) => r.id !== aparelhoDelete.id,
					),
				}));
			setAparelhoDelete(null);
		} finally {
			setAparelhoDeleting(false);
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-lg font-semibold">
					Marcas, dispositivos e aparelhos
				</h2>
				<p className="text-sm text-muted-foreground">
					Abra a lista de marcas abaixo; dentro de cada marca estão os
					dispositivos e, ao abrir um dispositivo, os modelos
					(aparelhos).
				</p>
			</div>

			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="default"
					onClick={() => {
						setErrorMessage("");
						setMarcaName("");
						setMarcaCreateOpen(true);
					}}
				>
					<Plus className="h-4 w-4 mr-2" />
					Criar marca
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						setErrorMessage("");
						setDispBrandId("");
						setDispName("");
						setDispCreateOpen(true);
					}}
					disabled={deviceBrands.length === 0}
				>
					<Plus className="h-4 w-4 mr-2" />
					Criar dispositivo
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => {
						setErrorMessage("");
						setAparelhoBrandId("");
						setAparelhoTypeId("");
						setAparelhoModel("");
						setAparelhoCreateOpen(true);
					}}
					disabled={deviceBrands.length === 0}
				>
					<Smartphone className="h-4 w-4 mr-2" />
					Criar aparelho
				</Button>
			</div>

			<div className="mt-4">
				<h2 className="text-sm font-medium text-muted-foreground mb-2">
					Marcas
				</h2>
				<div className="space-y-1">
					{deviceBrands.length === 0 ? (
						<p className="text-sm text-muted-foreground py-3 px-2">
							Nenhuma marca cadastrada. Use &quot;Criar
							marca&quot; acima.
						</p>
					) : (
						deviceBrands.map((b) => (
							<BrandCollapsible
								key={b.id}
								brand={b}
								deviceTypes={deviceTypesByBrand[b.id]}
								isLoadingDevices={loadingBrandIdsSet.has(b.id)}
								onOpen={onBrandOpen}
								getModelsForDeviceType={getModelsForDeviceType}
								onLoadModels={onDeviceTypeOpen}
								loadingModelIds={loadingModelIdsSet}
								onAddDevice={(brand) => {
									setDispBrandId(brand.id);
									setDispName("");
									setErrorMessage("");
									setDispCreateOpen(true);
								}}
								onAddAparelho={(dt) => {
									setAparelhoBrandId(dt.brand_id);
									setAparelhoTypeId(dt.id);
									setAparelhoModel("");
									setErrorMessage("");
									if (
										deviceTypesByBrand[dt.brand_id] ===
										undefined
									)
										loadDeviceTypesForBrand(dt.brand_id);
									setAparelhoCreateOpen(true);
								}}
								onEditMarca={() => {
									setMarcaEdit(b);
									setMarcaName(b.name);
									setErrorMessage("");
								}}
								onDeleteMarca={() => {
									setMarcaDelete(b);
									setErrorMessage("");
								}}
								onEditDisp={(t) => {
									setDispEdit(t);
									setDispBrandId(t.brand_id);
									setDispName(t.name);
									setErrorMessage("");
								}}
								onDeleteDisp={(t) => {
									setDispDelete(t);
									setErrorMessage("");
								}}
								onEditModel={(r) => {
									const dt = allDeviceTypes.find(
										(x) => x.id === r.device_type_id,
									);
									setAparelhoEdit(r);
									setAparelhoBrandId(dt?.brand_id ?? "");
									setAparelhoTypeId(r.device_type_id ?? "");
									setAparelhoModel(r.model);
									setErrorMessage("");
								}}
								onDeleteModel={(r) => {
									setAparelhoDelete(r);
									setErrorMessage("");
								}}
							/>
						))
					)}
				</div>
			</div>

			{/* Dialog Nova marca */}
			<Dialog open={marcaCreateOpen} onOpenChange={setMarcaCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Nova marca</DialogTitle>
						<DialogDescription>
							Informe o nome da marca.
						</DialogDescription>
					</DialogHeader>
					{errorMessage ? (
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					) : null}
					<form onSubmit={handleMarcaCreate} className="grid gap-4">
						<div className="space-y-2">
							<Label htmlFor="marcaName">Nome</Label>
							<Input
								id="marcaName"
								value={marcaName}
								onChange={(e) => setMarcaName(e.target.value)}
								placeholder="Ex: Apple"
								autoFocus
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setMarcaCreateOpen(false)}
								disabled={marcaSaving}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={marcaSaving}>
								{marcaSaving ? "Salvando..." : "Salvar"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Dialog Editar marca */}
			<Dialog
				open={!!marcaEdit}
				onOpenChange={(open) => !open && setMarcaEdit(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Editar marca</DialogTitle>
						<DialogDescription>
							Altere o nome da marca.
						</DialogDescription>
					</DialogHeader>
					{errorMessage ? (
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					) : null}
					<form onSubmit={handleMarcaUpdate} className="grid gap-4">
						<div className="space-y-2">
							<Label htmlFor="marcaNameEdit">Nome</Label>
							<Input
								id="marcaNameEdit"
								value={marcaName}
								onChange={(e) => setMarcaName(e.target.value)}
								placeholder="Ex: Apple"
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setMarcaEdit(null)}
								disabled={marcaSaving}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={marcaSaving}>
								{marcaSaving ? "Salvando..." : "Salvar"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!marcaDelete}
				onOpenChange={(open) => {
					if (!open) {
						setMarcaDelete(null);
						setErrorMessage("");
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir marca</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir a marca &quot;
							{marcaDelete?.name}&quot;? Ela não poderá ser usada
							em novos dispositivos ou aparelhos. Se estiver em
							uso, a exclusão será negada.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{errorMessage ? (
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={marcaDeleting}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleMarcaDelete}
							disabled={marcaDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{marcaDeleting ? "Excluindo..." : "Excluir"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Dialog Novo dispositivo */}
			<Dialog open={dispCreateOpen} onOpenChange={setDispCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Novo dispositivo</DialogTitle>
						<DialogDescription>
							Selecione a marca e informe o tipo de dispositivo.
						</DialogDescription>
					</DialogHeader>
					{errorMessage ? (
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					) : null}
					<form onSubmit={handleDispCreate} className="grid gap-4">
						<div className="space-y-2">
							<Label>Marca</Label>
							<Select
								value={dispBrandId}
								onValueChange={(v) => {
									setDispBrandId(v);
									setDispName("");
								}}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecione a marca" />
								</SelectTrigger>
								<SelectContent>
									{deviceBrands.map((b) => (
										<SelectItem key={b.id} value={b.id}>
											{b.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="dispName">Dispositivo</Label>
							<Input
								id="dispName"
								value={dispName}
								onChange={(e) => setDispName(e.target.value)}
								placeholder="Ex: Smartphone"
								autoFocus
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setDispCreateOpen(false)}
								disabled={dispSaving}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={dispSaving}>
								{dispSaving ? "Salvando..." : "Salvar"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Dialog Editar dispositivo */}
			<Dialog
				open={!!dispEdit}
				onOpenChange={(open) => !open && setDispEdit(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Editar dispositivo</DialogTitle>
						<DialogDescription>
							Altere a marca ou o nome do dispositivo.
						</DialogDescription>
					</DialogHeader>
					{errorMessage ? (
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					) : null}
					<form onSubmit={handleDispUpdate} className="grid gap-4">
						<div className="space-y-2">
							<Label>Marca</Label>
							<Select
								value={dispBrandId}
								onValueChange={setDispBrandId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecione a marca" />
								</SelectTrigger>
								<SelectContent>
									{deviceBrands.map((b) => (
										<SelectItem key={b.id} value={b.id}>
											{b.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="dispNameEdit">Dispositivo</Label>
							<Input
								id="dispNameEdit"
								value={dispName}
								onChange={(e) => setDispName(e.target.value)}
								placeholder="Ex: Smartphone"
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setDispEdit(null)}
								disabled={dispSaving}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={dispSaving}>
								{dispSaving ? "Salvando..." : "Salvar"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!dispDelete}
				onOpenChange={(open) => {
					if (!open) {
						setDispDelete(null);
						setErrorMessage("");
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir dispositivo</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir &quot;
							{dispDelete?.brand_name} – {dispDelete?.name}&quot;?
							Se estiver em uso em aparelhos, a exclusão será
							negada.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{errorMessage ? (
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={dispDeleting}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDispDelete}
							disabled={dispDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{dispDeleting ? "Excluindo..." : "Excluir"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Dialog Novo aparelho */}
			<Dialog
				open={aparelhoCreateOpen}
				onOpenChange={setAparelhoCreateOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Novo aparelho</DialogTitle>
						<DialogDescription>
							Selecione marca e dispositivo e informe o modelo
							(aparelho).
						</DialogDescription>
					</DialogHeader>
					{errorMessage ? (
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					) : null}
					<form
						onSubmit={handleAparelhoCreate}
						className="grid gap-4"
					>
						<div className="space-y-2">
							<Label>Marca</Label>
							<Select
								value={aparelhoBrandId}
								onValueChange={(v) => {
									setAparelhoBrandId(v);
									setAparelhoTypeId("");
									if (
										v &&
										deviceTypesByBrand[v] === undefined
									)
										loadDeviceTypesForBrand(v);
								}}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecione a marca" />
								</SelectTrigger>
								<SelectContent>
									{deviceBrands.map((b) => (
										<SelectItem key={b.id} value={b.id}>
											{b.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Dispositivo</Label>
							<Select
								value={aparelhoTypeId}
								onValueChange={setAparelhoTypeId}
								disabled={!aparelhoBrandId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecione o dispositivo" />
								</SelectTrigger>
								<SelectContent>
									{aparelhoTypeOptions.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="aparelhoModel">
								Modelo (aparelho)
							</Label>
							<Input
								id="aparelhoModel"
								value={aparelhoModel}
								onChange={(e) =>
									setAparelhoModel(e.target.value)
								}
								placeholder="Ex: iPhone 13 128GB"
								autoFocus
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setAparelhoCreateOpen(false)}
								disabled={aparelhoSaving}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={aparelhoSaving}>
								{aparelhoSaving ? "Salvando..." : "Salvar"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Dialog Editar aparelho */}
			<Dialog
				open={!!aparelhoEdit}
				onOpenChange={(open) => !open && setAparelhoEdit(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Editar aparelho</DialogTitle>
						<DialogDescription>
							Altere marca, dispositivo ou modelo.
						</DialogDescription>
					</DialogHeader>
					{errorMessage ? (
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					) : null}
					<form
						onSubmit={handleAparelhoUpdate}
						className="grid gap-4"
					>
						<div className="space-y-2">
							<Label>Marca</Label>
							<Select
								value={aparelhoBrandId}
								onValueChange={(v) => {
									setAparelhoBrandId(v);
									setAparelhoTypeId("");
									if (
										v &&
										deviceTypesByBrand[v] === undefined
									)
										loadDeviceTypesForBrand(v);
								}}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecione a marca" />
								</SelectTrigger>
								<SelectContent>
									{deviceBrands.map((b) => (
										<SelectItem key={b.id} value={b.id}>
											{b.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Dispositivo</Label>
							<Select
								value={aparelhoTypeId}
								onValueChange={setAparelhoTypeId}
								disabled={!aparelhoBrandId}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecione o dispositivo" />
								</SelectTrigger>
								<SelectContent>
									{aparelhoTypeOptions.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="aparelhoModelEdit">
								Modelo (aparelho)
							</Label>
							<Input
								id="aparelhoModelEdit"
								value={aparelhoModel}
								onChange={(e) =>
									setAparelhoModel(e.target.value)
								}
								placeholder="Ex: iPhone 13 128GB"
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setAparelhoEdit(null)}
								disabled={aparelhoSaving}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={aparelhoSaving}>
								{aparelhoSaving ? "Salvando..." : "Salvar"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={!!aparelhoDelete}
				onOpenChange={(open) => {
					if (!open) {
						setAparelhoDelete(null);
						setErrorMessage("");
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir aparelho</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir &quot;
							{[
								aparelhoDelete?.brand,
								aparelhoDelete?.device_type,
								aparelhoDelete?.model,
							]
								.filter(Boolean)
								.join(" ") || aparelhoDelete?.model}
							&quot;? Se estiver vinculado a ordens, a exclusão
							será negada.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{errorMessage ? (
						<Alert variant="destructive">
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={aparelhoDeleting}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleAparelhoDelete}
							disabled={aparelhoDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{aparelhoDeleting ? "Excluindo..." : "Excluir"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
