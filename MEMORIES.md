# Tracked bugs

- **replaceSalesOrderItems/Payments wipe:** delete-then-insert sem snapshot; insert falho deixava pedido sem itens/pagamentos. PR: https://github.com/ConectizeProject/conectize/pull/207 — status: merged — recorded: 2026-10-07
- **finance sync wipe:** delete-then-insert em syncSalesOrder/OS/resale sem restore; insert falho (ou revenda sem carteira) apagava receitas. PR: https://github.com/ConectizeProject/conectize/pull/208 — status: merged — recorded: 2026-10-08
- **hub_connections staff token SELECT:** policy `hub_connections_staff_select` liberava SELECT de `access_token`/`refresh_token`/`api_key` via PostgREST apesar do Hub ser admin-only. PR: https://github.com/ConectizeProject/conectize/pull/212, status: merged, recorded: 2026-10-09
- **public booking CPF bind:** `createBatteryAppointment` reutilizava cliente da org host só pelo CPF e devolvia `share_token`. PR: https://github.com/ConectizeProject/conectize/pull/222, status: open, recorded: 2026-10-10

