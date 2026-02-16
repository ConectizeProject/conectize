import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return { ok: false as const, error: 'not_authenticated' }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') return { ok: false as const, error: 'forbidden' }

  return { ok: true as const, supabase }
}

function formatStatus(s: string) {
  const m: Record<string, string> = {
    orcamento: 'Orçamento', aprovado: 'Aprovado', aguardando_pecas: 'Aguardando peças',
    em_manutencao: 'Em manutenção', aguardando_retirada: 'Aguardando retirada',
    finalizada: 'Finalizada', finalizada_sem_conserto: 'Finalizada sem conserto',
    finalizada_sem_aprovacao: 'Finalizada sem aprovação', cancelada: 'Cancelada',
  }
  return m[s] || s
}

function formatDoc(value: string | null, isCompany: boolean) {
  if (!value) return '-'
  const d = value.replace(/\D/g, '')
  if (isCompany && d.length >= 14) return `CNPJ ${d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}`
  if (d.length >= 11) return `CPF ${d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}`
  return isCompany ? `CNPJ ${value}` : `CPF ${value}`
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatCompanyCnpj(value: string | null) {
  if (!value) return ''
  const d = value.replace(/\D/g, '')
  return d.length >= 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : value
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await params
  if (!id) return new NextResponse('Not Found', { status: 404 })

  const [{ data: order }, { data: company }] = await Promise.all([
    auth.supabase
      .from('service_orders')
      .select('id, display_number, status, title, imei, is_warranty, estimated_ready_at, customer_description, internal_description, receiving_notes, assistance_info, created_at, updated_at, brand, model, customers ( cpf, cnpj, is_company, full_name, company_name, email, mobile_phone, contact_phone, contact_notes, address_full ), device_models ( brand, device_type, model )')
      .eq('id', id)
      .maybeSingle(),
    auth.supabase.from('company_settings').select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url').eq('id', 1).maybeSingle(),
  ])

  if (!order) return new NextResponse('Ordem não encontrada', { status: 404 })

  const c = order.customers as any
  const cust = Array.isArray(c) ? c[0] : c
  const dm = order.device_models as any
  const devModel = Array.isArray(dm) ? dm[0] : dm
  const device = devModel ? `${devModel.brand || ''} ${devModel.device_type || ''} ${devModel.model || ''}`.trim() : (order.brand || order.model ? `${order.brand || ''} ${order.model || ''}`.trim() : '-')
  const customerName = cust?.is_company ? (cust?.company_name || cust?.full_name || '-') : (cust?.full_name || '-')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  const baseUrl = siteUrl || 'http://localhost:3000'
  const logoUrl = company?.logo_url
    ? (company.logo_url.startsWith('http') ? company.logo_url : `${baseUrl}${company.logo_url.startsWith('/') ? company.logo_url : '/' + company.logo_url}`)
    : ''
  const companyAddr = [company?.address, company?.complement, [company?.city, company?.state].filter(Boolean).join(' - '), company?.zip_code ? `CEP ${company.zip_code}` : ''].filter(Boolean).join(', ')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>OS #${order.display_number ?? order.id} - Conectize</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;font-size:12px;line-height:1.4;color:#111;padding:20px;max-width:800px;margin:0 auto}h1{font-size:18px;margin-bottom:8px;border-bottom:2px solid #0ea5e9;padding-bottom:8px}h2{font-size:13px;margin:16px 0 6px;color:#555}.section{margin-bottom:16px}.row{display:flex;margin-bottom:4px}.label{min-width:140px;color:#666}.value{flex:1}.block{margin-top:8px;white-space:pre-wrap}.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#888;text-align:center}</style>
</head>
<body>
${company && (company.name || company.logo_url || company.address) ? `
<div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #0ea5e9">
${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="height:48px" onerror="this.style.display='none'" />` : ''}
<div style="flex:1">
${company.name ? `<div style="font-size:16px;font-weight:700;margin-bottom:4px">${company.name}</div>` : ''}
${company.cnpj ? `<div style="font-size:11px;color:#555">CNPJ ${formatCompanyCnpj(company.cnpj)}</div>` : ''}
${companyAddr ? `<div style="font-size:11px;color:#555;margin-top:4px">${companyAddr}</div>` : ''}
${company.phone || company.email ? `<div style="font-size:11px;color:#555;margin-top:2px">${[company.phone, company.email].filter(Boolean).join(' • ')}</div>` : ''}
</div></div>` : ''}
<h1>Ordem de Serviço #${order.display_number ?? '-'} — ${company?.name || 'Conectize'}</h1>
<p style="margin-bottom:12px">${order.title}</p>
<p><strong>Status:</strong> ${formatStatus(order.status)} | <strong>Data:</strong> ${formatDate(order.created_at)}</p>
<div class="section"><h2>Cliente</h2>
<div class="row"><span class="label">Nome:</span><span class="value">${customerName}</span></div>
<div class="row"><span class="label">Documento:</span><span class="value">${formatDoc(cust?.is_company ? cust?.cnpj : cust?.cpf, !!cust?.is_company)}</span></div>
<div class="row"><span class="label">E-mail:</span><span class="value">${cust?.email || '-'}</span></div>
<div class="row"><span class="label">Celular:</span><span class="value">${cust?.mobile_phone || '-'}</span></div>
<div class="row"><span class="label">Contato:</span><span class="value">${cust?.contact_phone || '-'}${cust?.contact_notes ? ` — ${cust.contact_notes}` : ''}</span></div>
<div class="row"><span class="label">Endereço:</span><span class="value">${cust?.address_full || '-'}</span></div>
</div>
<div class="section"><h2>Equipamento</h2>
<div class="row"><span class="label">Dispositivo:</span><span class="value">${device || '-'}</span></div>
<div class="row"><span class="label">IMEI/Série:</span><span class="value">${order.imei || '-'}</span></div>
<div class="row"><span class="label">Garantia:</span><span class="value">${order.is_warranty ? 'Sim' : 'Não'}</span></div>
<div class="row"><span class="label">Previsão:</span><span class="value">${formatDate(order.estimated_ready_at)}</span></div>
</div>
${order.customer_description ? `<div class="section"><h2>Descrição</h2><div class="block">${order.customer_description}</div></div>` : ''}
${order.receiving_notes ? `<div class="section"><h2>Observações do recebimento</h2><div class="block">${order.receiving_notes}</div></div>` : ''}
${order.assistance_info ? `<div class="section"><h2>Informações sobre a assistência</h2><div class="block">${order.assistance_info}</div></div>` : ''}
<div class="footer">Impresso em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — ${company?.name || 'Conectize'}</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
