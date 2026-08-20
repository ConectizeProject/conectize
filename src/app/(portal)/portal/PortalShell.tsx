"use client";

import { RadixAfterHydration } from "@/components/radix-after-hydration";
import { PortalNotificationsMenu } from "@/components/portal/PortalNotificationsMenu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/use-sidebar";
import { SalesOrderCupomPrintHost } from "@/app/(portal)/portal/vendas/SalesOrderCupomPrint";
import { PortalBrandingProvider } from "@/lib/portal/portal-branding-context";
import type { SupabasePlatformStatusBanner } from "@/lib/supabase/platform-status";
import { cn } from "@/lib/utils";
import {
	BarChart3,
	Bell,
	Building2,
	ChevronDown,
	ClipboardList,
	DollarSign,
	Home,
	LayoutDashboard,
	LayoutGrid,
	LogOut,
	MessageCircle,
	Moon,
	Package,
	Percent,
	Plug2,
	Settings,
	Smartphone,
	Sun,
	UserCheck,
	Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlatformOrgSwitcher } from "./PlatformOrgSwitcher";
import { PortalRoleSwitcher } from "./PortalRoleSwitcher";

type NavItem = {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
};

export type PlatformOrganizationOption = {
	id: string;
	slug: string;
	name: string | null;
	is_host: boolean;
};

function PortalSidebarNav({
	items,
	pathname,
}: {
	items: NavItem[];
	pathname: string;
}) {
	const { isMobile, setOpenMobile } = useSidebar();
	const closeMobile = () => {
		if (isMobile) setOpenMobile(false);
	};
	return (
		<>
			{items.map((item) => {
				const Icon = item.icon;
				const active = isActivePath(pathname, item.href);
				return (
					<SidebarMenuItem key={item.href}>
						<SidebarMenuButton asChild isActive={active} tooltip={item.label}>
							<Link href={item.href} onClick={closeMobile} transitionTypes={["nav-lateral"]}>
								<Icon />
								<span>{item.label}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				);
			})}
		</>
	);
}

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

function isActivePath(pathname: string, href: string) {
	if (href === "/portal") return pathname === "/portal";
	if (href === "/portal/dashboard") return pathname === "/portal/dashboard";
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalShell(props: PortalShellProps) {
	const pathname = usePathname();
	const { setTheme, resolvedTheme } = useTheme();

	function toggleTheme() {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}

	const normalizedRole = props.role === "customer" ? "user" : props.role;
	const isPlatformMaster =
		props.realRole === "platform_admin" || props.role === "platform_admin";
	const isAdmin = props.role === "admin" || props.role === "platform_admin";
	const isBasicUser = normalizedRole === "user" || !normalizedRole;
	const isRetailer = normalizedRole === "retailer";
	const isStaff = normalizedRole === "staff";
	const displayName = props.userName || props.userEmail;
	const orgLabel = String(props.organizationName || "").trim();
	const logoAlt = orgLabel || "Portal";

	const items = isBasicUser
		? [
				{
					href: "/portal/minhas-ordens",
					label: "Minhas ordens",
					icon: ClipboardList,
				},
			]
		: isRetailer
			? [
					{
						href: "/portal/minhas-ordens",
						label: "Minhas ordens",
						icon: ClipboardList,
					},
					{
						href: "/portal/tabela-de-precos",
						label: "Tabela de preços",
						icon: Percent,
					},
					{
						href: "/portal/revendaaparelhos",
						label: "Aparelhos à venda",
						icon: LayoutGrid,
					},
					{
						href: "/portal/financeiro-lojista",
						label: "Financeiro",
						icon: DollarSign,
					},
				]
			: isStaff
				? [
						{
							href: "/portal/dashboard",
							label: "Dashboard",
							icon: LayoutDashboard,
						},
						{
							href: "/portal/ordens",
							label: "Ordens de serviço",
							icon: ClipboardList,
						},
						...(props.hasWhatsappIntegration
							? [
									{
										href: "/portal/whatsapp",
										label: "WhatsApp",
										icon: MessageCircle,
									},
								]
							: []),
						{
							href: "/portal/produtos",
							label: "Produtos e serviços",
							icon: Package,
						},
						{ href: "/portal/pdv", label: "Frente de Caixa", icon: DollarSign },
						{ href: "/portal/vendas", label: "Vendas", icon: ClipboardList },
						{ href: "/portal/clientes", label: "Clientes", icon: Users },
						{
							href: "/portal/revendaaparelhos",
							label: "Aparelhos à venda",
							icon: Smartphone,
						},
					]
				: [
						{
							href: "/portal/dashboard",
							label: "Dashboard",
							icon: LayoutDashboard,
						},
						{
							href: "/portal/ordens",
							label: "Ordens de serviço",
							icon: ClipboardList,
						},
						...(props.hasWhatsappIntegration
							? [
									{
										href: "/portal/whatsapp",
										label: "WhatsApp",
										icon: MessageCircle,
									},
								]
							: []),
						{
							href: "/portal/produtos",
							label: "Produtos e serviços",
							icon: Package,
						},
						{ href: "/portal/pdv", label: "Frente de Caixa", icon: DollarSign },
						{ href: "/portal/vendas", label: "Vendas", icon: ClipboardList },
						{ href: "/portal/clientes", label: "Clientes", icon: Users },
						{
							href: "/portal/admin/usuarios",
							label: "Usuários",
							icon: UserCheck,
						},
						{ href: "/portal/hub", label: "HUB", icon: Plug2 },
						{
							href: "/portal/revendaaparelhos",
							label: "Aparelhos à venda",
							icon: Smartphone,
						},
						...(isAdmin
							? [
									{
										href: "/portal/financeiro",
										label: "Financeiro",
										icon: DollarSign,
									},
									{
										href: "/portal/admin/financeiro-lojas",
										label: "Financeiro lojas",
										icon: Building2,
									},
									{
										href: "/portal/relatorios/servicos",
										label: "Relatórios",
										icon: BarChart3,
									},
								]
							: []),
					];

	return (
		<PortalBrandingProvider organizationName={orgLabel || null}>
			<SidebarProvider
				defaultOpen={false}
				className="h-svh max-h-svh min-h-0 overflow-hidden"
			>
				<Sidebar
					collapsible="icon"
					variant="inset"
					style={{ viewTransitionName: 'portal-sidebar' }}
				>
					<SidebarHeader>
						<Link href="/portal" className="flex items-center gap-2 px-2 py-1">
							<img
								src="/logo_conectize.svg"
								alt={logoAlt}
								className="h-6 w-auto shrink-0"
							/>
							<span className="font-semibold truncate group-data-[collapsible=icon]:hidden">
								Portal
							</span>
						</Link>
					</SidebarHeader>

					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>Navegação</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									<PortalSidebarNav items={items} pathname={pathname} />
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>

					<SidebarRail />
				</Sidebar>

				<SidebarInset className="flex min-h-0 h-full max-h-full min-w-0 flex-1 flex-col overflow-hidden md:max-h-svh">
					<header
						className="relative z-40 flex h-14 min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85"
						style={{ viewTransitionName: 'portal-header' }}
					>
						<div className="flex items-center gap-2">
							<SidebarTrigger />
							<div className="text-sm text-muted-foreground hidden sm:block">
								{isBasicUser ? "Área do cliente" : "Área interna"}
							</div>
						</div>

						<div className="flex items-center gap-3 min-w-0">
							<RadixAfterHydration
								fallback={
									<>
										{isPlatformMaster ? (
											<div
												className="h-9 w-[180px] sm:w-[220px] shrink-0 rounded-md bg-muted/50 animate-pulse"
												aria-hidden
											/>
										) : null}
										{isPlatformMaster && props.platformOrganizations?.length ? (
											<div
												className="h-9 w-[220px] sm:w-48 shrink-0 rounded-md bg-muted/50 animate-pulse"
												aria-hidden
											/>
										) : null}
										<div
											className="hidden sm:block h-8 w-28 shrink-0 rounded-md bg-muted/50 animate-pulse"
											aria-hidden
										/>
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
								className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<Home className="h-4 w-4" />
								<span className="hidden sm:inline">Voltar para o site</span>
							</Link>
							<button
								type="button"
								onClick={toggleTheme}
								className="relative rounded-md p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								aria-label="Alternar tema"
							>
								<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
								<Moon className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
								<span className="sr-only">Alternar tema</span>
							</button>

							<RadixAfterHydration
								fallback={
									<button
										type="button"
										className="relative rounded-md p-2"
										aria-label="Notificações"
										disabled
									>
										<Bell className="h-4 w-4" />
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
										<div className="hidden sm:flex flex-col gap-1">
											<div className="h-3.5 w-24 rounded bg-muted/50 animate-pulse" />
											<div className="h-3 w-32 rounded bg-muted/50 animate-pulse" />
										</div>
									</div>
								}
							>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											className={cn(
												"flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent",
												"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											)}
										>
											<Avatar className="h-8 w-8">
												<AvatarFallback className="text-xs">
													{getInitials(displayName)}
												</AvatarFallback>
											</Avatar>
											<div className="hidden sm:block text-left leading-tight">
												<div className="text-sm font-medium">
													{props.userName || "Usuário"}
												</div>
												<div className="text-xs text-muted-foreground">
													{props.userEmail}
												</div>
											</div>
											<ChevronDown className="h-4 w-4 text-muted-foreground" />
										</button>
									</DropdownMenuTrigger>

									<DropdownMenuContent align="end" className="min-w-56">
										<DropdownMenuItem asChild>
											<Link
												href="/portal/complete-profile"
												className="flex items-center gap-2"
											>
												<Settings className="h-4 w-4" />
												<span>Alterar dados</span>
											</Link>
										</DropdownMenuItem>
										{isAdmin && (
											<DropdownMenuItem asChild>
												<Link
													href="/portal/admin/dados-empresa"
													className="flex items-center gap-2"
												>
													<Building2 className="h-4 w-4" />
													<span>Configurações gerais</span>
												</Link>
											</DropdownMenuItem>
										)}
										<DropdownMenuSeparator />
										<DropdownMenuItem asChild>
											<Link
												href="/portal/logout"
												className="flex items-center gap-2"
											>
												<LogOut className="h-4 w-4" />
												<span>Sair</span>
											</Link>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</RadixAfterHydration>
						</div>
					</header>

					<div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto px-4 pb-8 pt-6 [scrollbar-gutter:stable]">
						{props.children}
					</div>
				</SidebarInset>
			</SidebarProvider>
			<SalesOrderCupomPrintHost />
		</PortalBrandingProvider>
	);
}
