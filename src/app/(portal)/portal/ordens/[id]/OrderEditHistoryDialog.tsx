"use client";

import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	formatOrderServicesForHistoryDisplay,
	formatWarrantyTemplateHistoryDisplay,
	ORDER_EDIT_FIELD_LABELS,
} from "@/lib/orders/order-edit-history";
import { getOrderStatusLabel } from "@/lib/orders/order-status";
import { formatDateTimeBr } from "@/lib/utils/format-date";
import { formatCentsBr } from "@/lib/utils/format-money";
import { History, Loader2, Trash2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

type Entry = {
	id: string;
	edited_at: string;
	edited_by: string;
	editor_display_name: string;
	field_key: string;
	old_value: string | null;
	new_value: string | null;
};

function formatDisplayValue(
	fieldKey: string,
	raw: string | null | undefined,
): string {
	const v = raw ?? "";
	if (fieldKey === "status")
		return (v ? getOrderStatusLabel(v) : "") || "(vazio)";
	if (fieldKey === "is_warranty") {
		if (v === "true") return "Sim";
		if (v === "false") return "Não";
		return v || "(vazio)";
	}
	if (fieldKey === "estimated_ready_at" || fieldKey === "closed_at") {
		if (!v) return "(vazio)";
		const d = new Date(v);
		if (Number.isNaN(d.getTime())) return v;
		return formatDateTimeBr(d.toISOString());
	}
	if (
		fieldKey === "services_total_cents" ||
		fieldKey === "services_cost_total_cents"
	) {
		if (!v) return "(vazio)";
		const n = Number.parseInt(v, 10);
		if (!Number.isFinite(n)) return v;
		return formatCentsBr(n);
	}
	if (fieldKey === "passcode_type") {
		if (!v) return "(nenhuma)";
		if (v === "text") return "Texto";
		if (v === "pattern") return "Padrão";
		return v;
	}
	if (fieldKey === "warranty_template_id") {
		return formatWarrantyTemplateHistoryDisplay(raw);
	}
	if (!v) return "(vazio)";
	if (fieldKey === "services") {
		return formatOrderServicesForHistoryDisplay(v);
	}
	if (fieldKey === "payment_methods" || fieldKey === "device_entry_checks") {
		try {
			const parsed = JSON.parse(v);
			return JSON.stringify(parsed, null, 2);
		} catch {
			return v;
		}
	}
	return v;
}

type Props = {
	orderId: string;
	/** Se true, permite excluir linhas do histórico (admin) */
	isAdmin?: boolean;
	/** Com `onOpenChange`, abre o diálogo sem botão (ex.: item do menu da OS). */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export function OrderEditHistoryDialog({
	orderId,
	isAdmin = false,
	open: openControlled,
	onOpenChange,
}: Props) {
	const [openInternal, setOpenInternal] = useState(false);
	const isMenuMode =
		openControlled !== undefined && typeof onOpenChange === "function";
	const open = isMenuMode ? openControlled : openInternal;
	const setOpen = isMenuMode ? onOpenChange : setOpenInternal;
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [entries, setEntries] = useState<Entry[]>([]);
	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [deleteActionError, setDeleteActionError] = useState<string | null>(
		null,
	);
	const pendingDeleteRef = useRef<string | null>(null);
	pendingDeleteRef.current = pendingDeleteId;

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/portal/ordens/${orderId}/edit-history`);
			const data = await res.json();
			if (!res.ok || !data?.ok) {
				setError("Não foi possível carregar o histórico.");
				setEntries([]);
				return;
			}
			setEntries(Array.isArray(data.entries) ? data.entries : []);
		} catch {
			setError("Não foi possível carregar o histórico.");
			setEntries([]);
		} finally {
			setLoading(false);
		}
	}, [orderId]);

	useEffect(() => {
		if (!open) return;
		void load();
	}, [open, load]);

	function handleOpenChange(next: boolean) {
		if (!next && pendingDeleteRef.current !== null) {
			return;
		}
		setOpen(next);
	}

	const showTrigger = !isMenuMode;

	const confirmDelete = useCallback(async () => {
		if (!pendingDeleteId) return;
		const idToRemove = pendingDeleteId;
		setDeletingId(idToRemove);
		setDeleteActionError(null);
		try {
			const res = await fetch(
				`/api/portal/ordens/${orderId}/edit-history/${idToRemove}`,
				{ method: "DELETE" },
			);
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data?.ok) {
				setDeleteActionError(
					"Não foi possível excluir este registro do histórico.",
				);
				return;
			}
			setEntries((prev) => prev.filter((e) => e.id !== idToRemove));
			setPendingDeleteId(null);
		} catch {
			setDeleteActionError(
				"Não foi possível excluir este registro do histórico.",
			);
		} finally {
			setDeletingId(null);
		}
	}, [orderId, pendingDeleteId]);

	const groups = new Map<string, Entry[]>();
	for (const e of entries) {
		const key = `${e.edited_at}|${e.edited_by}`;
		const prev = groups.get(key) ?? [];
		prev.push(e);
		groups.set(key, prev);
	}

	const groupKeys = [...groups.keys()].sort((a, b) => {
		const ta = new Date(a.split("|")[0] || "").getTime();
		const tb = new Date(b.split("|")[0] || "").getTime();
		return tb - ta;
	});

	return (
		<>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				{showTrigger ? (
					<DialogTrigger asChild>
						<Button
							type="button"
							variant="outline"
							size="sm"
							title="Histórico de edições"
						>
							<History className="h-4 w-4" />
							<span className="ml-1.5 hidden sm:inline">Histórico</span>
						</Button>
					</DialogTrigger>
				) : null}
				<DialogContent
					className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden gap-4"
					onInteractOutside={(e) => {
						if (pendingDeleteRef.current !== null) e.preventDefault();
					}}
					onPointerDownOutside={(e) => {
						if (pendingDeleteRef.current !== null) e.preventDefault();
					}}
					onFocusOutside={(e) => {
						if (pendingDeleteRef.current !== null) e.preventDefault();
					}}
				>
					<DialogHeader className="shrink-0">
						<DialogTitle>Histórico de edições</DialogTitle>
					</DialogHeader>
					<ScrollArea className="h-[min(60vh,calc(90vh-11rem))] w-full min-h-[12rem] pr-3">
						{loading ? (
							<p className="text-sm text-muted-foreground">Carregando…</p>
						) : error ? (
							<p className="text-sm text-destructive">{error}</p>
						) : entries.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Nenhuma edição registrada ainda.
							</p>
						) : (
							<div className="space-y-3 text-sm">
								{groupKeys.map((key) => {
									const block = groups.get(key) ?? [];
									const first = block[0];
									if (!first) return null;
									return (
										<div
											key={key}
											className="rounded-md border bg-muted/30 p-2.5 last:border-0"
										>
											<div className="grid grid-cols-[minmax(5rem,6.75rem)_1fr] gap-x-2 gap-y-2 sm:gap-x-3 sm:grid-cols-[minmax(5.5rem,7.25rem)_1fr]">
												{block.map((row) => {
													const label =
														ORDER_EDIT_FIELD_LABELS[row.field_key] ??
														row.field_key;
													const isDeletingRow = deletingId === row.id;
													return (
														<Fragment key={row.id}>
															<div className="flex flex-col justify-center">
																<p className="text-[10px] font-medium leading-snug text-foreground sm:text-[11px]">
																	{label}
																</p>
															</div>
															<div className="flex min-w-0 flex-row items-center gap-1.5">
																<div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
																	<pre className="whitespace-pre-wrap break-words text-xs rounded-md bg-red-50 px-2 py-1 text-foreground line-through decoration-foreground/40 dark:bg-red-950/25">
																		{formatDisplayValue(
																			row.field_key,
																			row.old_value,
																		)}
																	</pre>
																	<pre className="whitespace-pre-wrap break-words text-xs rounded-md bg-emerald-50 px-2 py-1 text-foreground dark:bg-emerald-950/25">
																		{formatDisplayValue(
																			row.field_key,
																			row.new_value,
																		)}
																	</pre>
																</div>
																{isAdmin ? (
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
																		title="Excluir este registro do histórico"
																		disabled={isDeletingRow}
																		onClick={() => {
																			setDeleteActionError(null);
																			setPendingDeleteId(row.id);
																		}}
																	>
																		{isDeletingRow ? (
																			<Loader2 className="h-4 w-4 animate-spin" />
																		) : (
																			<Trash2 className="h-4 w-4" />
																		)}
																	</Button>
																) : null}
															</div>
														</Fragment>
													);
												})}
											</div>
											<p className="border-t border-border/50 mt-1.5 pt-1.5 text-center text-[10px] font-bold leading-snug">
												{first.editor_display_name}
												{" - "}
												{formatDateTimeBr(first.edited_at)}
											</p>
										</div>
									);
								})}
							</div>
						)}
					</ScrollArea>
					<AlertDialog
						open={pendingDeleteId !== null}
						onOpenChange={(next) => {
							if (!next) {
								setPendingDeleteId(null);
								setDeleteActionError(null);
							}
						}}
					>
						<AlertDialogContent className="z-[130]">
							<AlertDialogHeader>
								<AlertDialogTitle>
									Excluir registro do histórico?
								</AlertDialogTitle>
								<AlertDialogDescription>
									Esta ação remove permanentemente esta linha do histórico de
									alterações. Não é possível desfazer.
								</AlertDialogDescription>
								{deleteActionError ? (
									<p className="text-sm text-destructive pt-2">
										{deleteActionError}
									</p>
								) : null}
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel disabled={deletingId !== null}>
									Cancelar
								</AlertDialogCancel>
								<Button
									type="button"
									variant="destructive"
									disabled={deletingId !== null}
									onClick={() => void confirmDelete()}
								>
									{deletingId ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
											Excluindo…
										</>
									) : (
										"Excluir"
									)}
								</Button>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</DialogContent>
			</Dialog>
		</>
	);
}
