'use client'

import { Check, Copy, KeyRound, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { appConfirm } from '@/lib/ui/app-dialogs'
import { cn } from '@/lib/utils'

type McpKeyRow = {
	id: string
	label: string
	created_at: string
	last_used_at: string | null
	revoked_at: string | null
	user_id: string
}

function formatWhen(value: string | null) {
	if (!value) return 'nunca'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'data desconhecida'
	return date.toLocaleString('pt-BR', {
		dateStyle: 'short',
		timeStyle: 'short',
	})
}

export function McpCursorCard() {
	const [open, setOpen] = useState(false)
	const [keys, setKeys] = useState<McpKeyRow[]>([])
	const [actorUserId, setActorUserId] = useState('')
	const [isLoading, setIsLoading] = useState(true)
	const [label, setLabel] = useState('')
	const [isSaving, setIsSaving] = useState(false)
	const [revealedToken, setRevealedToken] = useState<string | null>(null)
	const [origin, setOrigin] = useState('')

	const loadKeys = useCallback(async () => {
		setIsLoading(true)
		try {
			const res = await fetch('/api/portal/mcp-keys')
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok) {
				setKeys([])
				return
			}
			setKeys(Array.isArray(data.keys) ? data.keys : [])
			setActorUserId(String(data.actorUserId || ''))
		} catch {
			setKeys([])
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void loadKeys()
		setOrigin(window.location.origin)
	}, [loadKeys])

	const hasActiveKey = keys.some((key) => !key.revoked_at)
	const mcpUrl = `${origin}/api/mcp`

	async function handleCreate() {
		const trimmed = label.trim()
		if (trimmed.length < 1 || trimmed.length > 80) {
			toast({
				title: 'Informe um rótulo de até 80 caracteres.',
				variant: 'destructive',
			})
			return
		}
		setIsSaving(true)
		try {
			const res = await fetch('/api/portal/mcp-keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: trimmed }),
			})
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok || !data?.token) {
				toast({
					title: 'Não foi possível gerar a chave.',
					variant: 'destructive',
				})
				return
			}
			setRevealedToken(String(data.token))
			setLabel('')
			await loadKeys()
		} catch {
			toast({
				title: 'Não foi possível gerar a chave.',
				variant: 'destructive',
			})
		} finally {
			setIsSaving(false)
		}
	}

	async function handleCopy(value: string) {
		try {
			await navigator.clipboard.writeText(value)
			toast({ variant: 'success', title: 'Copiado' })
		} catch {
			toast({ title: 'Não foi possível copiar.', variant: 'destructive' })
		}
	}

	async function handleRevoke(key: McpKeyRow) {
		const confirmed = await appConfirm({
			title: 'Revogar chave MCP?',
			description: `A chave "${key.label}" deixa de funcionar no Cursor.`,
			confirmLabel: 'Revogar',
			destructive: true,
		})
		if (!confirmed) return

		const res = await fetch(`/api/portal/mcp-keys/${key.id}`, {
			method: 'DELETE',
		})
		const data = await res.json().catch(() => null)
		if (!res.ok || !data?.ok) {
			toast({
				title: 'Não foi possível revogar a chave.',
				variant: 'destructive',
			})
			return
		}
		toast({ variant: 'success', title: 'Chave revogada' })
		await loadKeys()
	}

	const cursorConfig = revealedToken
		? JSON.stringify(
				{
					mcpServers: {
						conectize: {
							url: mcpUrl,
							headers: { Authorization: `Bearer ${revealedToken}` },
						},
					},
				},
				null,
				2,
			)
		: ''

	return (
		<>
			<Card
				className={cn(
					'overflow-hidden transition-colors border-2 cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					hasActiveKey
						? 'border-green-300 dark:border-green-700/60'
						: 'border-gray-200 dark:border-gray-700',
				)}
				role="button"
				tabIndex={0}
				onClick={() => setOpen(true)}
				onKeyDown={(event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault()
						setOpen(true)
					}
				}}
			>
				<CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
					<div className="rounded-lg p-3 shrink-0 bg-sky-500/10 text-sky-600 dark:text-sky-400">
						<KeyRound className="h-6 w-6" />
					</div>
					<div className="min-w-0 flex-1 space-y-1.5">
						<CardTitle className="text-base leading-tight truncate">
							MCP Cursor
						</CardTitle>
						<div>
							{hasActiveKey ? (
								<Badge
									variant="default"
									className="bg-green-600 hover:bg-green-600"
								>
									<Check className="h-3 w-3 mr-1" />
									Conectado
								</Badge>
							) : (
								<Badge variant="secondary">Sem chave</Badge>
							)}
						</div>
					</div>
				</CardHeader>
			</Card>

			<Dialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next)
					if (!next) setRevealedToken(null)
				}}
			>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>MCP Cursor</DialogTitle>
						<DialogDescription>
							Gere uma chave para pedir atualizações de OS, clientes e produtos
							a partir do Cursor. A chave fica presa à organização ativa e só
							aparece uma vez.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-1">
							<Label>URL</Label>
							<p className="text-sm break-all font-mono">{mcpUrl}</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="mcp-key-label">Rótulo da nova chave</Label>
							<div className="flex gap-2">
								<Input
									id="mcp-key-label"
									value={label}
									maxLength={80}
									placeholder="Ex.: notebook da loja"
									onChange={(event) => setLabel(event.target.value)}
								/>
								<Button
									type="button"
									onClick={() => void handleCreate()}
									disabled={isSaving}
								>
									{isSaving ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										'Gerar'
									)}
								</Button>
							</div>
						</div>

						{revealedToken ? (
							<div className="space-y-2 rounded-md border bg-muted/40 p-3">
								<p className="text-sm">
									Copie agora. Esta chave não será mostrada de novo.
								</p>
								<pre className="max-h-48 overflow-auto text-xs whitespace-pre-wrap break-all">
									{cursorConfig}
								</pre>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => void handleCopy(cursorConfig)}
								>
									<Copy className="h-4 w-4 mr-1" />
									Copiar configuração
								</Button>
							</div>
						) : null}

						<div className="space-y-2">
							<p className="text-sm font-medium">Chaves</p>
							{isLoading ? (
								<p className="text-sm text-muted-foreground">Carregando...</p>
							) : keys.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									Nenhuma chave nesta organização.
								</p>
							) : (
								<ul className="space-y-2">
									{keys.map((key) => (
										<li
											key={key.id}
											className="flex items-start justify-between gap-3 rounded-md border p-2"
										>
											<div className="min-w-0">
												<p className="text-sm font-medium truncate">
													{key.label}
												</p>
												<p className="text-xs text-muted-foreground">
													{key.user_id === actorUserId
														? 'Sua chave'
														: 'Outro usuário'}
													{' · último uso '}
													{formatWhen(key.last_used_at)}
													{key.revoked_at
														? ` · revogada em ${formatWhen(key.revoked_at)}`
														: ''}
												</p>
											</div>
											{key.revoked_at ? (
												<Badge variant="secondary">Revogada</Badge>
											) : (
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => void handleRevoke(key)}
												>
													Revogar
												</Button>
											)}
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							Fechar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
