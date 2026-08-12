# Prompt para recriar trabalho perdido (após último push)

**Contexto:** Projeto em `C:\dev\conectize`, branch `94-pdv`, último commit remoto: `4f991eb`. Todo o trabalho abaixo foi feito **localmente e não commitado** — precisa ser recriado do zero seguindo este escopo.

**Stack:** Next.js App Router, Supabase, Shadcn/Radix, Tailwind, Standard.js (sem ponto e vírgula, aspas simples).

**Regras:** Não alterar o arquivo de plano se existir. Seguir convenções do repo. Rodar `npx supabase db push` após criar a migration.

---

## Prompt (copie tudo abaixo para um novo chat do Cursor)

```
Implemente no projeto Conectize (branch 94-pdv, pasta C:\dev\conectize) o módulo completo de **Frente de Caixa** e **Pedidos de venda**, conforme especificação abaixo. O estado atual do repo ainda tem PDV antigo (PdvClient simples com Cards, pos_sales). Recrie tudo que está descrito.

### 1. Decisões de arquitetura

- **Pedidos de venda:** módulo/tabelas novas (`sales_orders`, `sales_order_items`, `sales_order_payments`), NÃO evoluir só `pos_sales`.
- **Caixa:** manter `pos_cash_sessions` e `pos_cash_movements`; APIs `/api/portal/pdv/cash/*`.
- **Rotas técnicas** `/portal/pdv` mantidas; labels visíveis = **Frente de Caixa**.
- Finalizar pedido: baixa estoque (`product_stock_movements` com `source = 'sales_order'`), sync financeiro (`financial_transactions.sales_order_id`).
- Vendedor = usuário logado no portal.

### 2. Banco (migration)

Criar `supabase/migrations/20260527201000_sales_orders_module.sql`:

- `sales_orders`: org, cash_session_id, order_number (identity), status (`in_progress`|`paid`|`canceled`), seller_user_id, customer_name/type/document, subtotal/discount/total/paid/change em centavos, canceled_at/by/reason, timestamps.
- `sales_order_items`: product_id, qty, unit_price, unit_cost, discount, subtotal.
- `sales_order_payments`: payment_method_id, type, amount_cents, status.
- `financial_transactions.sales_order_id` (FK nullable).
- Atualizar check de `product_stock_movements.source` para incluir `sales_order`.
- RLS staff/admin com `current_organization_id()`.

### 3. Backend

**`src/lib/sales-orders/service.ts`**
- createSalesOrder, updateSalesOrderDraft, replaceSalesOrderItems, replaceSalesOrderPayments
- finalizeSalesOrder (estoque + status paid)
- cancelSalesOrder
- loadSalesOrder, calcSalesOrderTotals
- Exige caixa aberto para criar pedido

**`src/lib/finance/service-order-financial-sync.ts`**
- Adicionar `syncSalesOrderFinancialTransactions` (espelhar padrão do PDV/OS)

**APIs** em `src/app/api/portal/sales-orders/`:
- `GET/POST route.ts` — listar (filtros from/to/status/seller, `current_cash=1` filtra sessão aberta) e criar
- `GET/PATCH [id]/route.ts`
- `POST [id]/payments/route.ts`
- `POST [id]/finalize/route.ts`
- `POST [id]/cancel/route.ts`

**Ajustes PDV auxiliares:**
- `pdv/catalog/route.ts`: incluir `image_url`, limite 10 na busca
- `pdv/top-products/route.ts` (novo): top 5 produtos vendidos
- `pdv/cash/close/route.ts`: fechamento considera `sales_orders` pagos + movimentos
- `pdv/reports/daily-summary/route.ts`: incluir pedidos novos se aplicável

### 4. UI — Frente de Caixa (`PdvClient.tsx` + `pdv/layout.tsx`)

**Layout geral**
- Container full height (`pdv/layout.tsx`: `flex-1`, `min-h-[calc(100dvh-7rem)]`, `overflow-hidden`).
- **`PdvClient`**: card com `rounded-xl`, `border`, `bg-card`, `shadow-sm`; header `rounded-t-xl`, footer `rounded-b-xl`.
- Altura encadeada via `flex-1` / `min-h-0` — **sem scroll vertical na página** no desktop; scroll só em listas internas (carrinho, pedidos, dropdown).
- **3 colunas (grid 12):** esquerda abas `col-span-3`, carrinho `col-span-6`, pedidos da sessão `col-span-3` (coluna direita compacta).
- Header primary-accessible: título "Frente de Caixa", vendedor logado, botões Nova venda, link Pedidos, menu ⋮ (DropdownMenu).
- Painel esquerdo com **padding `p-4`** (textos não colados no menu).

**Modal abrir caixa** se caixa fechado ao entrar (não dismissable).

**Menu ⋮ (caixa aberto):** Sangria, Suprimento, Fechar caixa — cada um em Dialog próprio (valor, motivo; fechamento = valor contado). Remover essas ações do footer. `aria-describedby={undefined}` nos DialogContent.

**Aba Produto**
- Label **"Mais vendidos"** + grid top 5 (`/api/portal/pdv/top-products`), cards com foto/placeholder.
- **Busca estilo select/combobox:** ícone de lupa **integrado ao input** (mesma borda, sem botão separado); dropdown abaixo (`debounce ~280ms`, **máx 10 itens**, `max-h-60`, fecha ao clicar fora / Escape); mensagem "Nenhum produto encontrado".
- **`ProductPreview`:** layout flex `flex-1` sem scroll na aba.
  - **Esquerda (2/3):** `rounded-xl`, `bg-muted`, foto `object-contain` ou placeholder.
  - **Direita (1/3):** `rounded-xl`, fundo branco: **nome** + ícone estoque com **tooltip** ("Estoque atual: X", vermelho se ≤0), **preço R$**, blocos **SKU** e **código de barras** (`Hash` / `Barcode`) com borda arredondada e valor à direita.
- **Linha horizontal (shrink-0):** Quantidade (**stepper − | input | + integrados** na mesma borda), Desconto (**input + toggle R$/% integrado** na mesma borda; limpa ao trocar; % sobre qty×valor), Valor e Subtotal readonly, botão Inserir.
- Ao **Inserir:** atualiza carrinho e **cria/atualiza pedido na API** automaticamente (`syncCurrentOrder`); primeiro item = POST pedido, demais = PATCH; exige caixa aberto.

**Aba Cliente:** nome (padrão Consumidor Final), tipo PF/PJ, CPF/CNPJ com máscara.

**Aba Pagamento:** subtotal/total, desconto na compra, recebido em dinheiro, linhas de pagamento, pago/troco.

**Centro:** itens do carrinho editáveis (qtd, unit, desconto, remover); header mostra Pedido #N se houver; sync silencioso com pedido ao editar carrinho se `currentOrderId` existir.

**Direita — só lista de pedidos da sessão**
- Ordenar: `in_progress` primeiro, depois paid/canceled; dentro do grupo, **mais recentes primeiro**.
- Card: #order_number, badge status (Ativo/Finalizado/Cancelado), cliente, total.
- Destaque pedido selecionado; só `in_progress` é clicável para carregar no carrinho.

**Footer:** Salvar, Cancelar, Finalizar (F6), total grande. Finalizar: valida pagamento, PATCH pedido, POST payments, POST finalize.

**Atalhos:** Alt+Z/C/B abas, F2 foco busca, F6 finalizar, Escape limpa busca, Ctrl+Backspace cancela pedido.

**`pdv/page.tsx`:** passar `sellerName` do usuário logado para PdvClient.

### 5. Módulo Pedidos de venda

- `src/app/(portal)/portal/pedidos-venda/page.tsx` — lista com filtros
- `src/app/(portal)/portal/pedidos-venda/[id]/page.tsx` — detalhe
- **PortalShell:** menu "Frente de Caixa" (href `/portal/pdv`) + "Pedidos de venda"
- Renomear labels "PDV" → "Frente de Caixa" em `pdv/relatorios`, `pdv/vendas`, financeiro onde couber

### 6. package.json (opcional)

Script dev com mais memória: `node --max-old-space-size=6144 ./node_modules/next/dist/bin/next dev`

### 7. Validação

- [ ] `supabase db push` aplica migration sem erro
- [ ] Abrir `/portal/pdv` com caixa fechado → modal abrir caixa
- [ ] Inserir produto → pedido #1 aparece à direita (in_progress)
- [ ] Finalizar com pagamento → estoque baixa, status paid, financeiro
- [ ] Sangria/suprimento/fechar caixa pelo menu ⋮
- [ ] GET `/api/portal/sales-orders?current_cash=1` retorna 200

Implemente em etapas: migration → service → APIs → PdvClient → pedidos-venda → labels. Não pare até completar o escopo.
```

---

## Arquivos que devem existir ao final (checklist)

### Novos
- [ ] `supabase/migrations/20260527201000_sales_orders_module.sql`
- [ ] `src/lib/sales-orders/service.ts`
- [ ] `src/app/api/portal/sales-orders/route.ts`
- [ ] `src/app/api/portal/sales-orders/[id]/route.ts`
- [ ] `src/app/api/portal/sales-orders/[id]/payments/route.ts`
- [ ] `src/app/api/portal/sales-orders/[id]/finalize/route.ts`
- [ ] `src/app/api/portal/sales-orders/[id]/cancel/route.ts`
- [ ] `src/app/api/portal/pdv/top-products/route.ts`
- [ ] `src/app/(portal)/portal/pdv/layout.tsx`
- [ ] `src/app/(portal)/portal/pedidos-venda/page.tsx`
- [ ] `src/app/(portal)/portal/pedidos-venda/[id]/page.tsx`

### Principais alterações
- [ ] `src/app/(portal)/portal/pdv/PdvClient.tsx` (~1400 linhas, layout 3 colunas)
- [ ] `src/app/(portal)/portal/pdv/page.tsx` (sellerName)
- [ ] `src/lib/finance/service-order-financial-sync.ts`
- [ ] `src/app/api/portal/pdv/cash/close/route.ts`
- [ ] `src/app/api/portal/pdv/catalog/route.ts`
- [ ] `src/app/(portal)/portal/PortalShell.tsx`

---

## Após recriar

1. Copiar `.env` e `.env.local` para `C:\dev\conectize` se ainda não existirem.
2. `npx supabase db push`
3. `npm run dev`
4. **Commitar** o trabalho: `git add -A && git commit -m "feat: Frente de Caixa e módulo Pedidos de venda"`
