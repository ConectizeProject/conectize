"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useFormikContext } from "formik";
import { Check, Minus, X } from "lucide-react";
import type { FormValues } from "./nova-ordem-form";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const ENTRY_CHECK_ITEMS: {
	key: string;
	label: string;
	requiresOn?: boolean;
}[] = [
	{ key: "rear_camera_main", label: "Câmera traseira (1x)", requiresOn: true },
	{ key: "rear_camera_2x", label: "Câmera traseira (2x)", requiresOn: true },
	{ key: "rear_camera_3x", label: "Câmera traseira (3x)", requiresOn: true },
	{ key: "front_camera", label: "Câmera frontal", requiresOn: true },
	{ key: "microphone", label: "Microfone", requiresOn: true },
	{ key: "earpiece_speaker", label: "Alto-falante de ouvido", requiresOn: true },
	{ key: "loudspeaker", label: "Alto-falante principal", requiresOn: true },
	{ key: "charging_port", label: "Carregamento (cabo)", requiresOn: true },
	{
		key: "wireless_charging",
		label: "Carregamento por indução",
		requiresOn: true,
	},
	{ key: "sim_signal", label: "Sinal de operadora", requiresOn: true },
	{ key: "wifi", label: "Wi‑Fi", requiresOn: true },
	{ key: "bluetooth", label: "Bluetooth", requiresOn: true },
	{ key: "face_touch_id", label: "Face ID / Touch ID", requiresOn: true },
	{ key: "volume_buttons", label: "Botões de volume", requiresOn: true },
	{ key: "power_button", label: "Botão power", requiresOn: true },
	{ key: "vibration", label: "Vibração", requiresOn: true },
	{
		key: "proximity_sensor",
		label: "Sensor de proximidade",
		requiresOn: true,
	},
	{ key: "display_touch", label: "Toque na tela", requiresOn: true },
	{ key: "display_colors", label: "Cores/brilho da tela", requiresOn: true },
];

export function NovaOrdemEntryChecksDialog(props: Props) {
	const formik = useFormikContext<FormValues>();

	let parsed: Record<string, unknown> | null = null;
	try {
		parsed = formik.values.deviceEntryChecksJson
			? (JSON.parse(formik.values.deviceEntryChecksJson) as Record<
					string,
					unknown
				>)
			: null;
	} catch {
		parsed = null;
	}
	const status: string = (parsed?.status as string) || "operante";
	const rawChecks =
		parsed?.checks && typeof parsed.checks === "object"
			? (parsed.checks as Record<string, unknown>)
			: {};
	const checks: Record<string, "ok" | "fail" | "na"> = {};
	Object.entries(rawChecks).forEach(([k, v]) => {
		if (v === true) checks[k] = "ok";
		else if (v === false) checks[k] = "fail";
		else if (v === "ok" || v === "fail" || v === "na") checks[k] = v;
	});
	const setStatus = (next: string) => {
		const nextChecks = next === "operante" ? { ...checks } : {};
		formik.setFieldValue(
			"deviceEntryChecksJson",
			JSON.stringify({ status: next, checks: nextChecks }),
		);
	};
	const setCheck = (key: string, value: "ok" | "fail" | "na") => {
		const nextChecks = { ...checks, [key]: value };
		formik.setFieldValue(
			"deviceEntryChecksJson",
			JSON.stringify({ status, checks: nextChecks }),
		);
	};
	const requiresDeviceOn = status === "operante";

	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Situação de entrada do aparelho</DialogTitle>
					<DialogDescription>
						Marque os testes realizados no momento da entrada do aparelho na
						assistência.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div className="space-y-1">
						<div className="text-sm font-medium">Estado na entrada</div>
						<RadioGroup
							value={status}
							onValueChange={(v) => setStatus(v)}
							className="flex flex-col gap-2"
						>
							<div className="flex items-center gap-2">
								<RadioGroupItem value="operante" id="entry-operante" />
								<Label htmlFor="entry-operante" className="cursor-pointer">
									Liga normalmente
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<RadioGroupItem
									value="display_apagado"
									id="entry-display-apagado"
								/>
								<Label
									htmlFor="entry-display-apagado"
									className="cursor-pointer"
								>
									Display apagado / danificado
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<RadioGroupItem value="nao_liga" id="entry-nao-liga" />
								<Label htmlFor="entry-nao-liga" className="cursor-pointer">
									Não liga
								</Label>
							</div>
						</RadioGroup>
					</div>
					<div className="space-y-2">
						<div className="text-sm font-medium">
							Testes realizados — ✓ funciona · ✗ não funciona · — não se aplica
						</div>
						<div className="grid grid-cols-1 gap-2 max-h-80 overflow-auto pr-1">
							{ENTRY_CHECK_ITEMS.map((item) => {
								const disabled = item.requiresOn && !requiresDeviceOn;
								const current = checks[item.key];
								return (
									<div
										key={item.key}
										className={cn(
											"flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm",
											disabled
												? "opacity-50 bg-muted/60 border-muted"
												: "bg-background",
										)}
									>
										<span className="min-w-0 truncate">{item.label}</span>
										<div className="flex items-center gap-1 shrink-0">
											<button
												type="button"
												title="Funciona"
												disabled={disabled}
												onClick={() =>
													!disabled && setCheck(item.key, "ok")
												}
												className={cn(
													"rounded p-1 transition-colors",
													disabled
														? "cursor-not-allowed text-muted-foreground"
														: "hover:bg-emerald-100 dark:hover:bg-emerald-900/50",
													current === "ok"
														? "bg-emerald-500 text-white hover:bg-emerald-600"
														: "text-muted-foreground",
												)}
											>
												<Check className="h-4 w-4" />
											</button>
											<button
												type="button"
												title="Não funciona"
												disabled={disabled}
												onClick={() =>
													!disabled && setCheck(item.key, "fail")
												}
												className={cn(
													"rounded p-1 transition-colors",
													disabled
														? "cursor-not-allowed text-muted-foreground"
														: "hover:bg-destructive/10",
													current === "fail"
														? "bg-destructive text-destructive-foreground"
														: "text-muted-foreground",
												)}
											>
												<X className="h-4 w-4" />
											</button>
											<button
												type="button"
												title="Não se aplica"
												disabled={disabled}
												onClick={() =>
													!disabled && setCheck(item.key, "na")
												}
												className={cn(
													"rounded p-1 transition-colors",
													disabled
														? "cursor-not-allowed text-muted-foreground"
														: "hover:bg-muted",
													current === "na"
														? "bg-muted text-muted-foreground"
														: "text-muted-foreground",
												)}
											>
												<Minus className="h-4 w-4" />
											</button>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => props.onOpenChange(false)}
					>
						Fechar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
