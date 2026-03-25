"use client";

import {
	OrderDeviceSelector,
	type DeviceModel,
} from "@/components/orders";
import { PatternLockInput } from "@/components/pattern-lock/PatternLockInput";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, useFormikContext } from "formik";
import type { FormValues } from "./nova-ordem-form";

export type NovaOrdemCustomerDevice = {
	id: string;
	device_model_id: string | null;
	brand: string | null;
	model: string | null;
	device_type: string | null;
	imei: string | null;
	color: string | null;
};

type Props = {
	deviceModels?: DeviceModel[];
	customerDevices: NovaOrdemCustomerDevice[];
	isLoadingCustomerDevices: boolean;
	isDevicesDialogOpen: boolean;
	onDevicesDialogOpenChange: (open: boolean) => void;
};

export function NovaOrdemAparelhoCard(props: Props) {
	const formik = useFormikContext<FormValues>();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Informações do Aparelho</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				<OrderDeviceSelector
					formik={{
						values: {
							brand: formik.values.brand,
							deviceType: formik.values.deviceType,
							deviceModelId: formik.values.deviceModelId,
							model: formik.values.model,
						},
						setFieldValue: formik.setFieldValue,
					}}
					initialDeviceModels={props.deviceModels}
					hasExistingDevices={props.customerDevices.length > 0}
					onOpenExistingDevices={() =>
						props.onDevicesDialogOpenChange(true)
					}
				/>

				<Dialog
					open={props.isDevicesDialogOpen}
					onOpenChange={props.onDevicesDialogOpenChange}
				>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Selecionar aparelho do cliente</DialogTitle>
							<DialogDescription>
								Escolha um aparelho já cadastrado para preencher os dados da
								OS.
							</DialogDescription>
						</DialogHeader>
						<div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
							{props.isLoadingCustomerDevices ? (
								<p className="text-sm text-muted-foreground">
									Carregando aparelhos…
								</p>
							) : props.customerDevices.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									Este cliente ainda não possui aparelhos cadastrados.
								</p>
							) : (
								props.customerDevices.map((d) => {
									const labelParts = [
										d.device_type,
										d.brand,
										d.model,
									].filter(Boolean);
									const label = labelParts.length
										? labelParts.join(" • ")
										: "Aparelho";
									const secondaryParts = [d.imei, d.color].filter(Boolean);
									const secondary = secondaryParts.length
										? secondaryParts.join(" • ")
										: null;
									return (
										<button
											key={d.id}
											type="button"
											className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
											onClick={() => {
												formik.setFieldValue("brand", d.brand ?? "");
												formik.setFieldValue("deviceType", d.device_type ?? "");
												formik.setFieldValue(
													"deviceModelId",
													d.device_model_id ?? "",
												);
												formik.setFieldValue("model", d.model ?? "");
												formik.setFieldValue("imei", d.imei ?? "");
												formik.setFieldValue("color", d.color ?? "");
												props.onDevicesDialogOpenChange(false);
											}}
										>
											<div className="font-medium truncate">{label}</div>
											{secondary ? (
												<div className="text-xs text-muted-foreground truncate">
													{secondary}
												</div>
											) : null}
										</button>
									);
								})
							)}
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => props.onDevicesDialogOpenChange(false)}
							>
								Fechar
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				<div className="rounded-md border p-4 space-y-3">
					<div className="flex items-center justify-between gap-3 flex-wrap">
						<div>
							<div className="text-sm font-medium">Senha do aparelho</div>
						</div>
					</div>
					<RadioGroup
						value={formik.values.passcodeType}
						onValueChange={(v) => {
							const next =
								v === "pattern"
									? "pattern"
									: v === "text"
										? "text"
										: "none";
							formik.setFieldValue("passcodeType", next);
							if (next === "none") {
								formik.setFieldValue("passcodeText", "");
								formik.setFieldValue("passcodePattern", "");
							}
						}}
						className="flex flex-wrap items-center gap-4"
					>
						<div className="flex items-center gap-2">
							<RadioGroupItem value="text" id="passcode-text" />
							<Label htmlFor="passcode-text" className="cursor-pointer">
								Texto
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<RadioGroupItem value="pattern" id="passcode-pattern" />
							<Label htmlFor="passcode-pattern" className="cursor-pointer">
								Padrão
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<RadioGroupItem value="none" id="passcode-none" />
							<Label htmlFor="passcode-none" className="cursor-pointer">
								Não informar
							</Label>
						</div>
					</RadioGroup>
					{formik.values.passcodeType === "text" ? (
						<div className="space-y-2">
							<Label htmlFor="passcodeText">Senha (texto)</Label>
							<Field
								as={Input}
								id="passcodeText"
								name="passcodeText"
								placeholder="Ex: 1234, senha do iCloud, etc."
							/>
						</div>
					) : formik.values.passcodeType === "pattern" ? (
						<div className="space-y-2">
							<Label htmlFor="passcodePattern">Senha (padrão)</Label>
							<PatternLockInput
								id="passcodePattern"
								value={formik.values.passcodePattern}
								onChange={(v: string) =>
									formik.setFieldValue("passcodePattern", v)
								}
							/>
						</div>
					) : (
						<div className="text-sm text-muted-foreground">
							O cliente optou por não informar a senha.
						</div>
					)}
				</div>

				<div className="grid md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="imei">Número de série / IMEI</Label>
						<Field
							as={Input}
							id="imei"
							name="imei"
							placeholder="Digite o número"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="color">Cor</Label>
						<Field
							as={Input}
							id="color"
							name="color"
							placeholder="Ex: Preto, Prateado"
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
