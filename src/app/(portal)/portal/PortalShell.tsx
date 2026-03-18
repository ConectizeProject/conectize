'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Building2, ChevronDown, ClipboardList, DollarSign, Home, LayoutDashboard, LogOut, Moon, Plug2, Settings, Sun, UserCheck, Smartphone, Users, Package, Webhook } from 'lucide-react'
import { PortalDataChat } from './PortalDataChat'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
	useSidebar,
} from '@/components/ui/sidebar'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> }

function PortalSidebarNav ({ items, pathname }: { items: NavItem[]; pathname: string }) {
	const { isMobile, setOpenMobile } = useSidebar()
	const closeMobile = () => {
		if (isMobile) setOpenMobile(false)
	}
	return (
		<>
			{items.map((item) => {
				const Icon = item.icon
				const active = isActivePath(pathname, item.href)
				return (
					<SidebarMenuItem key={item.href}>
						<SidebarMenuButton asChild isActive={active} tooltip={item.label}>
							<Link href={item.href} onClick={closeMobile}>
								<Icon />
								<span>{item.label}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				)
			})}
			<SidebarMenuItem>
				<SidebarMenuButton
					asChild
					isActive={isActivePath(pathname, '/portal/complete-profile')}
					tooltip="Dados"
				>
					<Link href="/portal/complete-profile" onClick={closeMobile}>
						<Settings />
						<span>Dados</span>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</>
	)
}

type PortalShellProps = {
	children: React.ReactNode
	role: string
	userEmail: string
	userName: string
}

function getInitials(nameOrEmail: string) {
	const cleaned = String(nameOrEmail || '').trim()
	if (!cleaned) return 'U'

	const parts = cleaned.split(/\s+/).filter(Boolean)
	if (parts.length === 0) return 'U'
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
	return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
}

function isActivePath(pathname: string, href: string) {
	if (href === '/portal') return pathname === '/portal'
	if (href === '/portal/dashboard') return pathname === '/portal/dashboard'
	return pathname === href || pathname.startsWith(`${href}/`)
}

export function PortalShell(props: PortalShellProps) {
	const pathname = usePathname()
	const { setTheme, resolvedTheme } = useTheme()

	function toggleTheme() {
		setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
	}

	const normalizedRole = props.role === 'customer' ? 'user' : props.role
	const isAdmin = props.role === 'admin'
	const isBasicUser = normalizedRole === 'user' || !normalizedRole
	const isStaff = normalizedRole === 'staff'
	const displayName = props.userName || props.userEmail

	const items = isBasicUser
		? [
			{ href: '/portal/minhas-ordens', label: 'Minhas ordens', icon: ClipboardList },
		]
		: isStaff
			? [
				{ href: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
				{ href: '/portal/ordens', label: 'Ordens de serviço', icon: ClipboardList },
				{ href: '/portal/produtos', label: 'Produtos e serviços', icon: Package },
				{ href: '/portal/clientes', label: 'Clientes', icon: Users },
				{ href: '/portal/seminovos', label: 'Seminovos', icon: Smartphone },
			]
			: [
				{ href: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
				{ href: '/portal/ordens', label: 'Ordens de serviço', icon: ClipboardList },
				{ href: '/portal/produtos', label: 'Produtos e serviços', icon: Package },
				{ href: '/portal/clientes', label: 'Clientes', icon: Users },
				{ href: '/portal/admin/usuarios', label: 'Usuários', icon: UserCheck },
				{ href: '/portal/hub', label: 'HUB', icon: Plug2 },
				{ href: '/portal/seminovos', label: 'Seminovos', icon: Smartphone },
				...(isAdmin ? [
					{ href: '/portal/financeiro', label: 'Financeiro', icon: DollarSign },
					{ href: '/portal/relatorios/servicos', label: 'Relatórios', icon: BarChart3 },
					{ href: '/portal/admin/webhooks', label: 'Webhooks', icon: Webhook },
				] : []),
			]

	return (
		<SidebarProvider defaultOpen={false}>
			<Sidebar collapsible="icon" variant="inset">
				<SidebarHeader>
					<Link href="/portal" className="flex items-center gap-2 px-2 py-1">
						<img src="/logo_conectize.svg" alt="Conectize" className="h-6 w-auto shrink-0" />
						<span className="font-semibold truncate group-data-[collapsible=icon]:hidden">Portal</span>
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

			<SidebarInset>
				<header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur">
					<div className="flex items-center gap-2">
						<SidebarTrigger />
						<div className="text-sm text-muted-foreground hidden sm:block">
							{isBasicUser ? 'Área do cliente' : 'Área interna'}
						</div>
					</div>

					<div className="flex items-center gap-3">
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

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className={cn(
										'flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent',
										'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
									)}
								>
									<Avatar className="h-8 w-8">
										<AvatarFallback className="text-xs">
											{getInitials(displayName)}
										</AvatarFallback>
									</Avatar>
									<div className="hidden sm:block text-left leading-tight">
										<div className="text-sm font-medium">{props.userName || 'Usuário'}</div>
										<div className="text-xs text-muted-foreground">{props.userEmail}</div>
									</div>
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								</button>
							</DropdownMenuTrigger>

							<DropdownMenuContent align="end" className="min-w-56">
								<DropdownMenuItem asChild>
									<Link href="/portal/complete-profile" className="flex items-center gap-2">
										<Settings className="h-4 w-4" />
										<span>Alterar dados</span>
									</Link>
								</DropdownMenuItem>
								{props.role === 'admin' && (
									<DropdownMenuItem asChild>
										<Link href="/portal/admin/dados-empresa" className="flex items-center gap-2">
											<Building2 className="h-4 w-4" />
											<span>Configurações gerais</span>
										</Link>
									</DropdownMenuItem>
								)}
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link href="/portal/logout" className="flex items-center gap-2">
										<LogOut className="h-4 w-4" />
										<span>Sair</span>
									</Link>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</header>

				<div className="p-4 md:p-6">
					{props.children}
				</div>
			</SidebarInset>

			{!isBasicUser && <PortalDataChat role={props.role} />}
		</SidebarProvider>
	)
}

