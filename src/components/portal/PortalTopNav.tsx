'use client'

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from '@/components/ui/sheet'
import {
	type PortalNavConfig,
	type PortalNavGroup,
	type PortalNavItem,
	isPortalNavGroupActive,
	isPortalNavItemActive,
} from '@/lib/portal/portal-nav-config'
import { cn } from '@/lib/utils'
import { ChevronDown, Menu } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

type Props = {
	config: PortalNavConfig
	pathname: string
	logoAlt: string
}

function NavDirectLink ({
	item,
	pathname,
	onNavigate,
	className,
}: {
	item: PortalNavItem
	pathname: string
	onNavigate?: () => void
	className?: string
}) {
	const active = isPortalNavItemActive(pathname, item.href)
	return (
		<Link
			href={item.href}
			onClick={onNavigate}
			transitionTypes={['nav-forward']}
			className={cn(
				'inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
				'hover:bg-accent/60 hover:text-foreground',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				active ? 'text-foreground' : 'text-muted-foreground',
				className,
			)}
		>
			{item.label}
		</Link>
	)
}

function NavGroupDropdown ({
	group,
	pathname,
}: {
	group: PortalNavGroup
	pathname: string
}) {
	const active = isPortalNavGroupActive(pathname, group.items)

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					'inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
					'hover:bg-accent/60 hover:text-foreground',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					'data-[state=open]:bg-accent/60 data-[state=open]:text-foreground',
					active ? 'text-foreground' : 'text-muted-foreground',
				)}
			>
				{group.label}
				<ChevronDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-48">
				{group.items.map((item) => {
					const itemActive = isPortalNavItemActive(pathname, item.href)
					return (
						<DropdownMenuItem key={item.href} asChild>
							<Link
								href={item.href}
								transitionTypes={['nav-forward']}
								className={cn(
									'cursor-pointer',
									itemActive && 'bg-accent/50 font-medium',
								)}
							>
								{item.label}
							</Link>
						</DropdownMenuItem>
					)
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function MobileNav ({
	config,
	pathname,
	logoAlt,
}: Props) {
	const [open, setOpen] = useState(false)
	const close = () => setOpen(false)

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger
				className={cn(
					'inline-flex items-center justify-center rounded-md p-2 lg:hidden',
					'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				)}
				aria-label="Abrir menu"
			>
				<Menu className="h-5 w-5" strokeWidth={1.75} />
			</SheetTrigger>
			<SheetContent side="left" className="w-[min(100vw-2rem,20rem)]">
				<SheetHeader className="text-left">
					<SheetTitle className="flex items-center gap-2">
						<img
							src="/logo_conectize.svg"
							alt={logoAlt}
							className="h-6 w-auto shrink-0"
						/>
						<span className="font-semibold">Portal</span>
					</SheetTitle>
					<SheetDescription className="sr-only">
						Menu de navegação do portal
					</SheetDescription>
				</SheetHeader>
				<nav className="mt-6 flex flex-col gap-6" aria-label="Navegação do portal">
					{config.directLinks.map((item) => (
						<NavDirectLink
							key={item.href}
							item={item}
							pathname={pathname}
							onNavigate={close}
							className="px-0 hover:bg-transparent"
						/>
					))}
					{config.groups.map((group) => (
						<div key={group.label}>
							<p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
								{group.label}
							</p>
							<ul className="flex flex-col gap-1">
								{group.items.map((item) => {
									const active = isPortalNavItemActive(pathname, item.href)
									return (
										<li key={item.href}>
											<Link
												href={item.href}
												onClick={close}
												transitionTypes={['nav-forward']}
												className={cn(
													'block rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent/60',
													active
														? 'font-medium text-foreground'
														: 'text-muted-foreground',
												)}
											>
												{item.label}
											</Link>
										</li>
									)
								})}
							</ul>
						</div>
					))}
				</nav>
			</SheetContent>
		</Sheet>
	)
}

export function PortalTopNav ({ config, pathname, logoAlt }: Props) {
	return (
		<div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-8">
			<MobileNav config={config} pathname={pathname} logoAlt={logoAlt} />

			<Link
				href="/portal"
				className="flex shrink-0 items-center"
				aria-label="Ir para início do portal"
			>
				<img
					src="/logo_conectize.svg"
					alt={logoAlt}
					className="h-6 w-auto"
				/>
			</Link>

			<nav
				className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex"
				aria-label="Navegação principal"
			>
				{config.directLinks.map((item) => (
					<NavDirectLink key={item.href} item={item} pathname={pathname} />
				))}
				{config.groups.map((group) => (
					<NavGroupDropdown key={group.label} group={group} pathname={pathname} />
				))}
			</nav>
		</div>
	)
}
