'use client'

import { useState } from 'react'
import Link from 'next/link'
import { History, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EditCustomerDialog, type CustomerHit } from '@/components/customers'
import { CustomerOrderHistoryModal } from '@/components/orders'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'

type CustomerRow = {
	id: string
	cpf?: string | null
	cnpj?: string | null
	is_company?: boolean | null
	full_name?: string | null
	company_name?: string | null
	trade_name?: string | null
	email?: string | null
	mobile_phone?: string | null
	contact_phone?: string | null
	contact_notes?: string | null
	address_full?: string | null
	zip_code?: string | null
	state?: string | null
	city?: string | null
	neighborhood?: string | null
	street?: string | null
	street_number?: string | null
	street_complement?: string | null
	birth_date?: string | null
	referral_source?: string | null
	referral_source_other?: string | null
	auth_user_id?: string | null
}

function toCustomerHit(row: CustomerRow): CustomerHit {
	return {
		id: String(row.id),
		cpf: row.cpf ? String(row.cpf) : null,
		cnpj: row.cnpj ? String(row.cnpj) : null,
		is_company: Boolean(row.is_company),
		full_name: row.full_name ? String(row.full_name) : null,
		company_name: row.company_name ? String(row.company_name) : null,
		trade_name: row.trade_name ? String(row.trade_name) : null,
		email: row.email ? String(row.email) : null,
		mobile_phone: row.mobile_phone ? String(row.mobile_phone) : null,
		contact_phone: row.contact_phone ? String(row.contact_phone) : null,
		contact_notes: row.contact_notes ? String(row.contact_notes) : null,
		address_full: row.address_full ? String(row.address_full) : null,
		zip_code: row.zip_code ? String(row.zip_code) : null,
		state: row.state ? String(row.state) : null,
		city: row.city ? String(row.city) : null,
		neighborhood: row.neighborhood ? String(row.neighborhood) : null,
		street: row.street ? String(row.street) : null,
		street_number: row.street_number ? String(row.street_number) : null,
		street_complement: row.street_complement ? String(row.street_complement) : null,
		birth_date: row.birth_date ? String(row.birth_date) : null,
		referral_source: row.referral_source ? String(row.referral_source) : null,
		referral_source_other: row.referral_source_other ? String(row.referral_source_other) : null,
	}
}

function mergeEditedRow(prev: CustomerRow, edited: CustomerHit): CustomerRow {
	return {
		...prev,
		cpf: edited.cpf,
		cnpj: edited.cnpj,
		is_company: edited.is_company,
		full_name: edited.full_name,
		company_name: edited.company_name,
		trade_name: edited.trade_name,
		email: edited.email,
		mobile_phone: edited.mobile_phone,
		contact_phone: edited.contact_phone,
		contact_notes: edited.contact_notes,
		address_full: edited.address_full,
		zip_code: edited.zip_code,
		state: edited.state,
		city: edited.city,
		neighborhood: edited.neighborhood,
		street: edited.street,
		street_number: edited.street_number,
		street_complement: edited.street_complement,
		birth_date: edited.birth_date,
		referral_source: edited.referral_source,
		referral_source_other: edited.referral_source_other,
	}
}

export function ClientesTableClient(props: { customers: CustomerRow[] }) {
	const [rows, setRows] = useState<CustomerRow[]>(props.customers || [])
	const [isEditOpen, setIsEditOpen] = useState(false)
	const [customerToEdit, setCustomerToEdit] = useState<CustomerHit | null>(null)
	const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null)
	const [isHistoryOpen, setIsHistoryOpen] = useState(false)

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Nome</TableHead>
						<TableHead>CPF/CNPJ</TableHead>
						<TableHead>E-mail</TableHead>
						<TableHead>Vinculado</TableHead>
						<TableHead className="text-right">Ações</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((c) => (
						<TableRow key={c.id} className="hover:bg-muted/50">
							<TableCell className="font-medium">
								<Link href={`/portal/clientes/${c.id}`} className="block hover:underline focus:underline outline-none">
									{c.is_company ? (c.company_name || '-') : (c.full_name || '-')}
								</Link>
							</TableCell>
							<TableCell>{formatCpfCnpj(String(c.cnpj || c.cpf))}</TableCell>
							<TableCell>{c.email || '-'}</TableCell>
							<TableCell>{c.auth_user_id ? 'Sim' : 'Não'}</TableCell>
							<TableCell className="text-right">
								<div className="flex items-center justify-end gap-2">
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => {
											setHistoryCustomerId(c.id)
											setIsHistoryOpen(true)
										}}
										aria-label="Ver histórico de ordens do cliente"
									>
										<History className="h-4 w-4" />
									</Button>
									<Button variant="outline" size="sm" asChild>
										<Link href={`/portal/clientes/${c.id}`} aria-label="Ver e editar aparelhos do cliente">
											<Smartphone className="h-4 w-4" />
										</Link>
									</Button>
									<Button
										type="button"
										size="sm"
										variant="outline"
										onClick={() => {
											setCustomerToEdit(toCustomerHit(c))
											setIsEditOpen(true)
										}}
									>
										Editar
									</Button>
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			{customerToEdit ? (
				<EditCustomerDialog
					open={isEditOpen}
					onOpenChange={setIsEditOpen}
					customer={customerToEdit}
					onSaved={(edited) => {
						setRows((prev) => prev.map((r) => (r.id === edited.id ? mergeEditedRow(r, edited) : r)))
					}}
				/>
			) : null}

			{historyCustomerId ? (
				<CustomerOrderHistoryModal
					open={isHistoryOpen}
					onOpenChange={(open) => {
						setIsHistoryOpen(open)
						if (!open) setHistoryCustomerId(null)
					}}
					customerId={historyCustomerId}
					isCreationPage={false}
				/>
			) : null}
		</>
	)
}

