import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { redirectToPortalLogin } from "@/lib/auth/redirect-to-portal-login";
import { fetchPaymentMethodsCatalogForPortal } from "@/lib/portal/payment-methods-server";
import { getInstallmentRowForCount } from "@/lib/resale/credit-installment-max-fee";
import { getSeminovosColorEmoji } from "@/lib/seminovos/colors";
import { fetchSeminovosDevices } from "@/lib/seminovos/fetch-seminovos-data";
import { groupDevicesByModel } from "@/lib/seminovos/group-devices-by-model";
import { attachResaleDeviceDisplayImage } from "@/lib/seminovos/resale-device-display-image";
import {
	createSupabaseServerClient,
	getPortalAuth,
} from "@/lib/supabase/server";
import { maskedFromCents } from "@/lib/utils/money";
import { Smartphone } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SeminovosSubmenu } from "../SeminovosSubmenu";

type SearchParams = Promise<{ tipo?: string }>;

function formatStorageLabel(raw: string | null | undefined): string | null {
	if (!raw?.trim()) return null;
	const t = raw.trim();
	return /gb/i.test(t) ? t : `${t} GB`;
}

export default function SeminovosVarejoListPage({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	return (
		<Suspense
			fallback={
				<div className="p-4 text-sm text-muted-foreground">Carregando…</div>
			}
		>
			<SeminovosVarejoListInner searchParams={searchParams} />
		</Suspense>
	);
}

async function SeminovosVarejoListInner({
	searchParams,
}: {
	searchParams: SearchParams;
}) {
	const { user, role } = await getPortalAuth();
	if (!user) await redirectToPortalLogin();

	const normalizedRole = role === "customer" ? "user" : role;
	if (normalizedRole === "user") redirect("/portal/minhas-ordens");
	if (normalizedRole !== "staff" && normalizedRole !== "admin")
		redirect("/portal");

	const params = await searchParams;
	const tipoRaw = String(params?.tipo || "").toLowerCase();
	const stockType: "seminovo" | "lacrado" =
		tipoRaw === "lacrados" ? "lacrado" : "seminovo";

	const filters = {
		q: "",
		condition: "",
		storageGb: "",
		color: "",
		purchaseDateFrom: "",
		purchaseDateTo: "",
		stockType,
	};

	const supabase = await createSupabaseServerClient();
	const [devices, paymentMethods] = await Promise.all([
		fetchSeminovosDevices(supabase, filters),
		fetchPaymentMethodsCatalogForPortal(supabase),
	]);

	const orderedDevices = groupDevicesByModel(devices).flatMap((g) => g.devices);
	const devicesWithDisplay = await Promise.all(
		orderedDevices.map((d) => attachResaleDeviceDisplayImage(supabase, d)),
	);

	const operacionalHref =
		stockType === "lacrado"
			? "/portal/seminovos?tipo=lacrados"
			: "/portal/seminovos";

	return (
		<div className="space-y-4 px-1 pb-8 sm:px-0">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<h1 className="text-xl font-bold sm:text-2xl">Lista para varejo</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						Mesma ordem da listagem de seminovos (modelo e GB). Em cada card:
						valor à vista e{" "}
						<span className="font-medium text-foreground">
							parcelamento em 12×
						</span>{" "}
						no cartão. Toque para abrir a vitrine completa.
					</p>
				</div>
				<Button variant="outline" size="sm" className="shrink-0 w-fit" asChild>
					<Link href={operacionalHref}>Voltar à listagem operacional</Link>
				</Button>
			</div>

			<SeminovosSubmenu />

			{devicesWithDisplay.length === 0 ? (
				<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					Nenhum aparelho disponível nesta categoria.{" "}
					<Link href={operacionalHref} className="text-primary underline">
						Ver listagem operacional
					</Link>
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{devicesWithDisplay.map((d) => {
						const title =
							(d.device_name || d.model || "Aparelho").trim() || "Aparelho";
						const storageLabel = formatStorageLabel(d.storage_gb);
						const displayUrl = d.display_image_url;
						const imgOk = Boolean(displayUrl);
						const saleCents = d.sale_value_cents ?? null;
						const row12 =
							saleCents != null && saleCents > 0
								? getInstallmentRowForCount(saleCents, paymentMethods, 12)
								: null;

						const propertySegments: string[] = [];
						if (storageLabel) propertySegments.push(storageLabel);
						if (d.color) {
							propertySegments.push(
								`${getSeminovosColorEmoji(d.color)} ${d.color}`.trim(),
							);
						}
						if (d.battery) propertySegments.push(d.battery);
						if (d.condition) propertySegments.push(d.condition);

						return (
							<Link
								key={d.id}
								href={`/portal/seminovos/${d.id}/vitrine`}
								className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<Card className="h-full overflow-hidden border transition-shadow duration-200 hover:shadow-md hover:border-primary/30">
									<div className="relative aspect-square overflow-hidden bg-muted">
										{imgOk ? (
											<img
												src={displayUrl!}
												alt=""
												className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center text-muted-foreground">
												<Smartphone
													className="h-14 w-14 opacity-35"
													aria-hidden
												/>
											</div>
										)}
										{/* Blur só na base da foto — some suavemente para o degradê escuro */}
										<div
											className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[38%] backdrop-blur-[11px] sm:h-[34%]"
											style={{
												maskImage:
													"linear-gradient(to top, black 0%, black 35%, transparent 100%)",
												WebkitMaskImage:
													"linear-gradient(to top, black 0%, black 35%, transparent 100%)",
											}}
											aria-hidden
										/>
										{/* Degradê de opacidade em vários passos */}
										<div
											className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[52%] sm:h-[48%]"
											style={{
												background:
													"linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 12%, rgba(0,0,0,0.42) 32%, rgba(0,0,0,0.18) 58%, rgba(0,0,0,0.05) 82%, transparent 100%)",
											}}
											aria-hidden
										/>
										<div className="absolute inset-x-0 bottom-0 z-[1] p-3 pt-10 sm:p-3.5 sm:pt-12">
											<h2 className="text-lg font-bold leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] line-clamp-3 sm:text-xl">
												{title}
											</h2>
										</div>
									</div>
									<CardContent className="flex flex-col gap-3 p-4 pt-3">
										{propertySegments.length > 0 ? (
											<p className="text-xs leading-snug text-muted-foreground">
												{propertySegments.join(" · ")}
											</p>
										) : null}
										<div className="space-y-2 border-t border-border/80 pt-3">
											<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
												À vista
											</p>
											<p className="text-2xl font-bold tabular-nums tracking-tight sm:text-[1.75rem]">
												{saleCents != null && saleCents > 0
													? `R$ ${maskedFromCents(saleCents)}`
													: "Sob consulta"}
											</p>
											{row12 ? (
												<p className="mt-1 text-sm text-muted-foreground">
													ou 12x de{" "}
													<span className="font-semibold tabular-nums text-foreground">
														R$ {maskedFromCents(row12.installmentValueCents)}
													</span>
												</p>
											) : (
												<p className="text-sm text-muted-foreground">
													Cadastre valor de varejo
												</p>
											)}
										</div>
									</CardContent>
								</Card>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
