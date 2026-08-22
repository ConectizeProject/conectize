"use client";

import { RadixAfterHydration } from "@/components/radix-after-hydration";
import { PortalNotificationsMenu } from "@/components/portal/PortalNotificationsMenu";
import { PortalTopNav } from "@/components/portal/PortalTopNav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OrdemPrintPreviewHost } from "@/app/(portal)/portal/ordens/OrdemPrintPreview";
import { SalesOrderCupomPrintHost } from "@/app/(portal)/portal/vendas/SalesOrderCupomPrint";
import {
	PORTAL_FULL_WIDTH_CONTAINER,
	PORTAL_LAYOUT_CONTAINER,
	isPortalFullWidthPath,
} from "@/lib/portal/portal-layout";
import { buildPortalNavConfig } from "@/lib/portal/portal-nav-config";
import { PortalBrandingProvider } from "@/lib/portal/portal-branding-context";
import type { SupabasePlatformStatusBanner } from "@/lib/supabase/platform-status";
import { cn } from "@/lib/utils";
import {
	Bell,
	Building2,
	ChevronDown,
	Home,
	LogOut,
	Moon,
	Settings,
	Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlatformOrgSwitcher } from "./PlatformOrgSwitcher";
import { PortalRoleSwitcher } from "./PortalRoleSwitcher";

export type PlatformOrganizationOption = {
	id: string;
	slug: string;
	name: string | null;
	is_host: boolean;
};

type PortalShellProps = {
	children: React.ReactNode;
	role: string;
	realRole?: string;
	simulatedRole?: string | null;
	userEmail: string;
	userName: string;
	/** Nome da organização ativa (`organizations.name`). */
	organizationName?: string | null;
	/** Exibe menu WhatsApp apenas quando a integração existir na empresa ativa. */
	hasWhatsappIntegration?: boolean;
	supabasePlatformStatus?: SupabasePlatformStatusBanner | null;
	platformOrganizations?: PlatformOrganizationOption[] | null;
	activeOrganizationId?: string | null;
};

function getInitials(nameOrEmail: string) {
	const cleaned = String(nameOrEmail || "").trim();
	if (!cleaned) return "U";

	const parts = cleaned.split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "U";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function PortalShell(props: PortalShellProps) {
	const pathname = usePathname();
	const { setTheme, resolvedTheme } = useTheme();

	function toggleTheme() {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}

	const isPlatformMaster =
		props.realRole === "platform_admin" || props.role === "platform_admin";
	const isAdmin = props.role === "admin" || props.role === "platform_admin";
	const displayName = props.userName || props.userEmail;
	const orgLabel = String(props.organizationName || "").trim();
	const logoAlt = orgLabel || "Portal";
	const isFullWidth = isPortalFullWidthPath(pathname);

	const navConfig = buildPortalNavConfig({
		role: props.role,
		isAdmin,
		hasWhatsappIntegration: props.hasWhatsappIntegration ?? false,
	});

	return (
		<PortalBrandingProvider organizationName={orgLabel || null}>
			<div className="flex h-svh max-h-svh min-h-0 flex-col overflow-hidden">
				<header
					className="relative z-40 shrink-0 border-b border-border/60 bg-white dark:bg-background"
					style={{ viewTransitionName: "portal-top-nav" }}
				>
					<div
						className={cn(
							PORTAL_LAYOUT_CONTAINER,
							"flex h-14 min-h-14 items-center gap-4",
						)}
					>
						<PortalTopNav
							config={navConfig}
							pathname={pathname}
							logoAlt={logoAlt}
						/>

						<div className="flex shrink-0 items-center gap-1 sm:gap-2">
							<RadixAfterHydration
								fallback={
									<>
										{isPlatformMaster ? (
											<div
												className="hidden h-9 w-[180px] shrink-0 rounded-md bg-muted/50 animate-pulse sm:block sm:w-[220px]"
												aria-hidden
											/>
										) : null}
										{isPlatformMaster && props.platformOrganizations?.length ? (
											<div
												className="hidden h-9 w-48 shrink-0 rounded-md bg-muted/50 animate-pulse sm:block"
												aria-hidden
											/>
										) : null}
									</>
								}
							>
								{isPlatformMaster ? (
									<PortalRoleSwitcher
										role={props.realRole || props.role}
										simulatedRole={props.simulatedRole ?? null}
									/>
								) : null}
								{isPlatformMaster && props.platformOrganizations?.length ? (
									<PlatformOrgSwitcher
										organizations={props.platformOrganizations}
										activeOrganizationId={props.activeOrganizationId ?? null}
									/>
								) : null}
							</RadixAfterHydration>

							<Link
								href="/"
								className="hidden rounded-md p-2 text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
								aria-label="Voltar para o site"
								title="Voltar para o site"
							>
								<Home className="h-4 w-4" strokeWidth={1.75} />
							</Link>

							<button
								type="button"
								onClick={toggleTheme}
								className="relative rounded-md p-2 text-muted-foreground hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								aria-label="Alternar tema"
							>
								<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" strokeWidth={1.75} />
								<Moon className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" strokeWidth={1.75} />
								<span className="sr-only">Alternar tema</span>
							</button>

							<RadixAfterHydration
								fallback={
									<button
										type="button"
										className="relative rounded-md p-2 text-muted-foreground"
										aria-label="Notificações"
										disabled
									>
										<Bell className="h-4 w-4" strokeWidth={1.75} />
										{props.supabasePlatformStatus ? (
											<span
												className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background"
												aria-hidden
											/>
										) : null}
									</button>
								}
							>
								<PortalNotificationsMenu
									supabasePlatformStatus={props.supabasePlatformStatus ?? null}
								/>
							</RadixAfterHydration>

							<RadixAfterHydration
								fallback={
									<div
										className="flex items-center gap-2 rounded-md px-2 py-1.5"
										aria-hidden
									>
										<div className="h-8 w-8 shrink-0 rounded-full bg-muted/50 animate-pulse" />
									</div>
								}
							>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											className={cn(
												"flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											)}
										>
											<Avatar className="h-8 w-8">
												<AvatarFallback className="text-xs">
													{getInitials(displayName)}
												</AvatarFallback>
											</Avatar>
											<span className="hidden max-w-[8rem] truncate text-sm font-medium uppercase tracking-wide lg:block">
												{props.userName || "Usuário"}
											</span>
											<ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
										</button>
									</DropdownMenuTrigger>

									<DropdownMenuContent align="end" className="min-w-56">
										<div className="px-2 py-1.5 lg:hidden">
											<p className="text-sm font-medium">{props.userName || "Usuário"}</p>
											<p className="text-xs text-muted-foreground">{props.userEmail}</p>
										</div>
										<DropdownMenuSeparator className="lg:hidden" />
										<DropdownMenuItem asChild>
											<Link
												href="/portal/complete-profile"
												className="flex items-center gap-2"
											>
												<Settings className="h-4 w-4" strokeWidth={1.75} />
												<span>Alterar dados</span>
											</Link>
										</DropdownMenuItem>
										{isAdmin && (
											<DropdownMenuItem asChild>
												<Link
													href="/portal/admin/dados-empresa"
													className="flex items-center gap-2"
												>
													<Building2 className="h-4 w-4" strokeWidth={1.75} />
													<span>Configurações gerais</span>
												</Link>
											</DropdownMenuItem>
										)}
										<DropdownMenuItem asChild className="md:hidden">
											<Link href="/" className="flex items-center gap-2">
												<Home className="h-4 w-4" strokeWidth={1.75} />
												<span>Voltar para o site</span>
											</Link>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem asChild>
											<Link
												href="/portal/logout"
												className="flex items-center gap-2"
											>
												<LogOut className="h-4 w-4" strokeWidth={1.75} />
												<span>Sair</span>
											</Link>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</RadixAfterHydration>
						</div>
					</div>
				</header>

				<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
					<div
						className={cn(
							isFullWidth
								? PORTAL_FULL_WIDTH_CONTAINER
								: cn(PORTAL_LAYOUT_CONTAINER, "flex min-h-0 flex-1 flex-col pb-8 pt-6"),
						)}
					>
						{props.children}
					</div>
				</main>
			</div>
			<SalesOrderCupomPrintHost />
			<OrdemPrintPreviewHost />
		</PortalBrandingProvider>
	);
}
