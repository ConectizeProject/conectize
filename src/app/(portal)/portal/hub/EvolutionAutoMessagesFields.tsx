'use client'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
	DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES,
	EVOLUTION_AUTO_MESSAGE_MAX_LENGTH,
} from '@/lib/whatsapp/evolution-auto-messages'

type Props = {
	enabled: boolean
	osOpened: string
	readyForPickup: string
	onEnabledChange: (enabled: boolean) => void
	onOsOpenedChange: (value: string) => void
	onReadyForPickupChange: (value: string) => void
}

export function EvolutionAutoMessagesFields({
	enabled,
	osOpened,
	readyForPickup,
	onEnabledChange,
	onOsOpenedChange,
	onReadyForPickupChange,
}: Props) {
	function handleEnabledChange(next: boolean) {
		onEnabledChange(next)
		if (!next) return
		if (!osOpened.trim()) {
			onOsOpenedChange(DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_opened)
		}
		if (!readyForPickup.trim()) {
			onReadyForPickupChange(
				DEFAULT_EVOLUTION_AUTO_MESSAGE_TEMPLATES.os_ready_for_pickup,
			)
		}
	}

	return (
		<div className="space-y-3 rounded-lg border px-3 py-2">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-sm font-medium">Mensagens automáticas</p>
					<p className="text-xs text-muted-foreground">
						Quando ativo, esta instância envia WhatsApp ao cliente na abertura
						da OS e quando ela fica pronta para retirada. Deixe um modelo em
						branco para não enviar naquele evento.
					</p>
				</div>
				<Switch checked={enabled} onCheckedChange={handleEnabledChange} />
			</div>

			{enabled ? (
				<div className="space-y-3">
					<p className="text-xs text-muted-foreground">
						Variáveis:{' '}
						<code className="rounded bg-muted px-1">{'{{nome}}'}</code>{' '}
						<code className="rounded bg-muted px-1">{'{{nome_completo}}'}</code>{' '}
						<code className="rounded bg-muted px-1">{'{{os}}'}</code>{' '}
						<code className="rounded bg-muted px-1">{'{{titulo}}'}</code>{' '}
						<code className="rounded bg-muted px-1">{'{{aparelho}}'}</code>{' '}
						<code className="rounded bg-muted px-1">{'{{status}}'}</code>{' '}
						<code className="rounded bg-muted px-1">{'{{previsao}}'}</code>{' '}
						<code className="rounded bg-muted px-1">
							{'{{previsao_linha}}'}
						</code>{' '}
						<code className="rounded bg-muted px-1">{'{{link}}'}</code>{' '}
						<code className="rounded bg-muted px-1">{'{{valor_total}}'}</code>{' '}
						<code className="rounded bg-muted px-1">{'{{empresa}}'}</code>{' '}
						<code className="rounded bg-muted px-1">
							{'{{empresa_sufixo}}'}
						</code>
					</p>

					<div className="space-y-2">
						<Label htmlFor="evo-tpl-os-opened">Abertura de OS</Label>
						<Textarea
							id="evo-tpl-os-opened"
							value={osOpened}
							onChange={(e) => onOsOpenedChange(e.target.value)}
							rows={8}
							maxLength={EVOLUTION_AUTO_MESSAGE_MAX_LENGTH}
							autoComplete="off"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="evo-tpl-ready">Pronta para retirada</Label>
						<p className="text-xs text-muted-foreground">
							Enviada quando o status da OS passa a Aguardando retirada.
						</p>
						<Textarea
							id="evo-tpl-ready"
							value={readyForPickup}
							onChange={(e) => onReadyForPickupChange(e.target.value)}
							rows={8}
							maxLength={EVOLUTION_AUTO_MESSAGE_MAX_LENGTH}
							autoComplete="off"
						/>
					</div>
				</div>
			) : null}
		</div>
	)
}
