"use client";

import {
	OsAssistAiIconButton,
} from "@/components/orders";
import { PrevisaoInput } from "@/components/previsao-input";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, useFormikContext } from "formik";
import type { FormValues } from "./nova-ordem-form";
import { novaOrdemStatusOptions } from "./nova-ordem-form";

type SellerOption = {
	id: string;
	full_name: string | null;
	email: string | null;
};

type Props = {
	isAdmin: boolean;
	sellerName: string;
	currentUserId: string;
	sellerOptions: SellerOption[];
	minPrevisao: string;
	onOpenEntryChecksDialog: () => void;
};

export function NovaOrdemAssistenciaCard(props: Props) {
	const formik = useFormikContext<FormValues>();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Informações da assistência</CardTitle>
				<CardDescription>
					Do título até a situação de entrada do aparelho.
				</CardDescription>
			</CardHeader>
			<CardContent className="relative space-y-6">
				<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="title">
							Título<span className="text-destructive"> *</span>
						</Label>
						<Field
							as={Input}
							id="title"
							name="title"
							placeholder="Ex: Troca de tela iPhone 13"
							className={
								formik.touched.title && formik.errors.title
									? "border-destructive"
									: ""
							}
						/>
						{formik.touched.title && formik.errors.title ? (
							<p className="text-sm text-destructive">
								{formik.errors.title}
							</p>
						) : null}
					</div>
					<div className="space-y-2">
						<Label
							htmlFor={props.isAdmin ? "sellerUserId" : "sellerName"}
						>
							Vendedor
						</Label>
						{props.isAdmin ? (
							<Select
								value={
									formik.values.sellerUserId || props.currentUserId
								}
								onValueChange={(v) =>
									formik.setFieldValue("sellerUserId", v)
								}
							>
								<SelectTrigger id="sellerUserId">
									<SelectValue placeholder="Selecione o vendedor" />
								</SelectTrigger>
								<SelectContent>
									{props.sellerOptions.map((u) => (
										<SelectItem key={u.id} value={u.id}>
											{String(
												u.full_name || u.email || u.id,
											).trim() || "(Sem nome)"}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : (
							<Input
								id="sellerName"
								value={props.sellerName}
								readOnly
							/>
						)}
					</div>
					<div className="space-y-2">
						<Label htmlFor="estimatedReadyAt">
							Previsão (data e hora)
						</Label>
						<PrevisaoInput
							id="estimatedReadyAt"
							name="estimatedReadyAt"
							min={props.minPrevisao}
							value={formik.values.estimatedReadyAt}
							onChange={formik.handleChange}
						/>
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="status">Status</Label>
						<Field
							as="select"
							id="status"
							name="status"
							className="w-full h-10 rounded-md border border-input px-3 text-sm"
						>
							{novaOrdemStatusOptions.map((s) => (
								<option key={s.value} value={s.value}>
									{s.label}
								</option>
							))}
						</Field>
					</div>
					<div className="flex items-center gap-2 rounded-md border p-3">
						<Checkbox
							id="isWarranty"
							checked={formik.values.isWarranty}
							onCheckedChange={(v) =>
								formik.setFieldValue("isWarranty", !!v)
							}
						/>
						<Label htmlFor="isWarranty" className="cursor-pointer">
							Serviço em garantia
						</Label>
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<Label htmlFor="customerDescription">Descrição</Label>
						<OsAssistAiIconButton
							value={formik.values.customerDescription}
							onImproved={(text) =>
								formik.setFieldValue("customerDescription", text)
							}
							device={[
								formik.values.brand,
								formik.values.deviceType,
								formik.values.model,
							]
								.filter(Boolean)
								.join(" ")}
						/>
					</div>
					<Field
						as={Textarea}
						id="customerDescription"
						name="customerDescription"
						placeholder="Texto que o cliente vê"
					/>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<Label htmlFor="receivingNotes">
							Observações do recebimento
						</Label>
						<OsAssistAiIconButton
							value={formik.values.receivingNotes}
							onImproved={(text) =>
								formik.setFieldValue("receivingNotes", text)
							}
							device={[
								formik.values.brand,
								formik.values.deviceType,
								formik.values.model,
							]
								.filter(Boolean)
								.join(" ")}
						/>
					</div>
					<Field
						as={Textarea}
						id="receivingNotes"
						name="receivingNotes"
						placeholder="Checklist, avarias, acessórios, etc."
					/>
				</div>

				<div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="text-sm font-medium">
							Situação de entrada do aparelho
						</span>
						<div className="flex flex-wrap items-center gap-2">
							{(() => {
								let parsed: Record<string, unknown> | null = null;
								try {
									parsed = formik.values.deviceEntryChecksJson
										? (JSON.parse(
												formik.values.deviceEntryChecksJson,
											) as Record<string, unknown>)
										: null;
								} catch {
									parsed = null;
								}
								const status = String(parsed?.status ?? "operante");
								const rawCh =
									parsed?.checks &&
									typeof parsed.checks === "object"
										? (parsed.checks as Record<string, unknown>)
										: {};
								const ch: Record<string, string> = {};
								Object.entries(rawCh).forEach(([k, v]) => {
									if (v === true) ch[k] = "ok";
									else if (v === false) ch[k] = "fail";
									else if (v === "ok" || v === "fail" || v === "na")
										ch[k] = v;
								});
								const notTested = status !== "operante";
								const passed = Object.values(ch).filter(
									(v) => v === "ok",
								).length;
								const failed = Object.values(ch).filter(
									(v) => v === "fail",
								).length;
								const na = Object.values(ch).filter(
									(v) => v === "na",
								).length;
								return (
									<>
										{notTested ? (
											<span className="text-xs text-amber-600 dark:text-amber-400">
												Não foi possível testar
											</span>
										) : (
											<>
												{passed > 0 && (
													<span className="text-xs text-emerald-600 dark:text-emerald-400">
														{passed} passaram
													</span>
												)}
												{failed > 0 && (
													<span className="text-xs text-destructive">
														{failed} não passaram
													</span>
												)}
												{na > 0 && (
													<span className="text-xs text-muted-foreground">
														{na} não se aplicam
													</span>
												)}
												{passed === 0 &&
													failed === 0 &&
													na === 0 && (
														<span className="text-xs text-muted-foreground">
															Nenhum teste registrado
														</span>
													)}
											</>
										)}
									</>
								);
							})()}
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={props.onOpenEntryChecksDialog}
							>
								Abrir checklist
							</Button>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
