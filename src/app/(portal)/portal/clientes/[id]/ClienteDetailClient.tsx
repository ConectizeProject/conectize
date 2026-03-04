"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { portalFetch } from "@/lib/portal/portal-fetch";
import { Pencil, Plus, Smartphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Device = {
	id: string;
	customer_id: string;
	device_model_id: string | null;
	brand: string | null;
	model: string | null;
	device_type: string | null;
	imei: string | null;
	color: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
};

type Props = {
	customerId: string;
	customerName: string;
};

const emptyForm = {
	brand: "",
	model: "",
	device_type: "",
	imei: "",
	color: "",
	notes: "",
};

function deviceLabel(d: Device) {
	const parts = [d.device_type, d.brand, d.model].filter(Boolean);
	return parts.length ? parts.join(" • ") : "Aparelho";
}

function splitDeviceNotes(notes: string | null) {
	if (!notes) return { passcode: "", rest: "" };
	const lines = notes.split("\n");
	const [first, ...rest] = lines;
	if (first && first.startsWith("Senha (")) {
		return {
			passcode: first,
			rest: rest.join("\n").trim(),
		};
	}
	return { passcode: "", rest: notes };
}

export function ClienteDetailClient({ customerId, customerName }: Props) {
	const [devices, setDevices] = useState<Device[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingDevice, setEditingDevice] = useState<Device | null>(null);
	const [form, setForm] = useState(emptyForm);
	const [saving, setSaving] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const loadDevices = useCallback(() => {
		setError(null);
		portalFetch(`/api/portal/customers/${customerId}/devices`)
			.then((res) => res?.json())
			.then((data) => {
				if (data?.ok && Array.isArray(data.devices))
					setDevices(data.devices);
				else setError("Não foi possível carregar os aparelhos.");
			})
			.catch(() => setError("Erro ao carregar aparelhos."))
			.finally(() => setIsLoading(false));
	}, [customerId]);

	useEffect(() => {
		loadDevices();
	}, [loadDevices]);

	function openAdd() {
		setEditingDevice(null);
		setForm(emptyForm);
		setIsDialogOpen(true);
	}

	function openEdit(d: Device) {
		setEditingDevice(d);
		setForm({
			brand: d.brand ?? "",
			model: d.model ?? "",
			device_type: d.device_type ?? "",
			imei: d.imei ?? "",
			color: d.color ?? "",
			notes: d.notes ?? "",
		});
		setIsDialogOpen(true);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		const url = editingDevice
			? `/api/portal/customers/${customerId}/devices/${editingDevice.id}`
			: `/api/portal/customers/${customerId}/devices`;
		const method = editingDevice ? "PATCH" : "POST";
		const body = editingDevice
			? {
					brand: form.brand || null,
					model: form.model || null,
					device_type: form.device_type || null,
					imei: form.imei || null,
					color: form.color || null,
					notes: form.notes || null,
				}
			: {
					device_model_id: null,
					brand: form.brand || null,
					model: form.model || null,
					device_type: form.device_type || null,
					imei: form.imei || null,
					color: form.color || null,
					notes: form.notes || null,
				};

		portalFetch(url, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
			.then((res) => res?.json())
			.then((data) => {
				if (data?.ok) {
					setIsDialogOpen(false);
					loadDevices();
				} else
					setError(
						data?.error === "db_error"
							? "Erro ao salvar."
							: "Não foi possível salvar.",
					);
			})
			.catch(() => setError("Erro ao salvar."))
			.finally(() => setSaving(false));
	}

	function handleDelete(deviceId: string) {
		if (!confirm("Remover este aparelho do cliente?")) return;
		setDeleteId(deviceId);
		portalFetch(`/api/portal/customers/${customerId}/devices/${deviceId}`, {
			method: "DELETE",
		})
			.then((res) => res?.json())
			.then((data) => {
				if (data?.ok) loadDevices();
			})
			.finally(() => setDeleteId(null));
	}

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-3 flex-wrap">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Smartphone className="h-5 w-5" />
								Aparelhos vinculados
							</CardTitle>
							<CardDescription>
								Aparelhos associados a {customerName}. Novos
								aparelhos são adicionados automaticamente ao
								criar uma OS com modelo diferente.
							</CardDescription>
						</div>
						<Button type="button" onClick={openAdd}>
							<Plus className="h-4 w-4 mr-2" />
							Adicionar aparelho
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<p className="text-sm text-muted-foreground">
							Carregando…
						</p>
					) : error ? (
						<p className="text-sm text-destructive">{error}</p>
					) : devices.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Nenhum aparelho vinculado. Adicione manualmente ou
							crie uma ordem de serviço para este cliente.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Aparelho</TableHead>
									<TableHead>IMEI</TableHead>
									<TableHead>Cor</TableHead>
									<TableHead>Senha</TableHead>
									<TableHead>Observações</TableHead>
									<TableHead className="w-[100px] text-right">
										Ações
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{devices.map((d) => (
									<TableRow key={d.id}>
										{(() => {
											const { passcode, rest } =
												splitDeviceNotes(d.notes);
											return (
												<>
													<TableCell className="font-medium">
														{deviceLabel(d)}
													</TableCell>
													<TableCell className="text-muted-foreground">
														{d.imei || "-"}
													</TableCell>
													<TableCell>
														{d.color || "-"}
													</TableCell>
													<TableCell
														className="max-w-[200px] truncate"
														title={
															passcode ||
															undefined
														}
													>
														{passcode || "-"}
													</TableCell>
													<TableCell
														className="max-w-[220px] truncate"
														title={
															rest || undefined
														}
													>
														{rest || "-"}
													</TableCell>
												</>
											);
										})()}
										<TableCell className="text-right">
											<div className="flex items-center justify-end gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8"
													onClick={() => openEdit(d)}
													aria-label="Editar aparelho"
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8 text-destructive hover:text-destructive"
													onClick={() =>
														handleDelete(d.id)
													}
													disabled={deleteId === d.id}
													aria-label="Remover aparelho"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>
							{editingDevice
								? "Editar aparelho"
								: "Adicionar aparelho"}
						</DialogTitle>
						<DialogDescription>
							{editingDevice
								? "Altere os dados do aparelho vinculado ao cliente."
								: "Cadastre um aparelho para este cliente."}
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="device_brand">Marca</Label>
								<Input
									id="device_brand"
									value={form.brand}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											brand: e.target.value,
										}))
									}
									placeholder="Ex: Apple, Samsung"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="device_model">Modelo</Label>
								<Input
									id="device_model"
									value={form.model}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											model: e.target.value,
										}))
									}
									placeholder="Ex: iPhone 15, Galaxy S24"
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="device_type">Tipo</Label>
							<Input
								id="device_type"
								value={form.device_type}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										device_type: e.target.value,
									}))
								}
								placeholder="Ex: Smartphone, tablet"
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="device_imei">IMEI</Label>
								<Input
									id="device_imei"
									value={form.imei}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											imei: e.target.value,
										}))
									}
									placeholder="Opcional"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="device_color">Cor</Label>
								<Input
									id="device_color"
									value={form.color}
									onChange={(e) =>
										setForm((f) => ({
											...f,
											color: e.target.value,
										}))
									}
									placeholder="Opcional"
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="device_notes">Observações</Label>
							<Textarea
								id="device_notes"
								value={form.notes}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										notes: e.target.value,
									}))
								}
								placeholder="Opcional"
								rows={2}
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsDialogOpen(false)}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={saving}>
								{saving
									? "Salvando…"
									: editingDevice
										? "Salvar"
										: "Adicionar"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
