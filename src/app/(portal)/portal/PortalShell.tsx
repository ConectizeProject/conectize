'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, ChevronDown, ClipboardList, Home, LayoutDashboard, LogOut, Plug2, Settings, UserCheck, Smartphone, Users } from 'lucide-react'
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
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarSeparator,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

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

	const normalizedRole = props.role === 'customer' ? 'user' : props.role
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
				{ href: '/portal/clientes', label: 'Clientes', icon: Users },
				{ href: '/portal/aparelhos', label: 'Aparelhos', icon: Smartphone },
			]
			: [
				{ href: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
				{ href: '/portal/ordens', label: 'Ordens de serviço', icon: ClipboardList },
				{ href: '/portal/clientes', label: 'Clientes', icon: Users },
				{ href: '/portal/admin/usuarios', label: 'Usuários', icon: UserCheck },
				{ href: '/portal/hub', label: 'HUB', icon: Plug2 },
				{ href: '/portal/aparelhos', label: 'Aparelhos', icon: Smartphone },
			]

	return (
		<SidebarProvider defaultOpen>
			<Sidebar collapsible="icon" variant="inset">
				<SidebarHeader>
					<Link href="/portal" className="flex items-center gap-2 px-2 py-1">
						<img src="/logo_conectize.svg" alt="Conectize" className="h-6 w-auto" />
						<span className="font-semibold">Portal</span>
					</Link>
				</SidebarHeader>

				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Navegação</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{items.map((item) => {
									const Icon = item.icon
									const active = isActivePath(pathname, item.href)
									return (
										<SidebarMenuItem key={item.href}>
											<SidebarMenuButton asChild isActive={active} tooltip={item.label}>
												<Link href={item.href}>
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
										<Link href="/portal/complete-profile">
											<Settings />
											<span>Dados</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter>
					<SidebarSeparator />
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton asChild variant="outline" tooltip="Voltar para o site">
								<Link href="/">
									<Home />
									<span>Voltar para o site</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
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
											<span>Dados da empresa</span>
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
		</SidebarProvider>
	)
}

