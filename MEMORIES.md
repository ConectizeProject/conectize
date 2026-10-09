# Tracked bugs

- **replaceSalesOrderItems/Payments wipe:** delete-then-insert sem snapshot; insert falho deixava pedido sem itens/pagamentos. PR: https://github.com/ConectizeProject/conectize/pull/207 — status: open — recorded: 2026-10-07
- **finance sync wipe:** delete-then-insert em syncSalesOrder/OS/resale sem restore; insert falho (ou revenda sem carteira) apagava receitas. PR: https://github.com/ConectizeProject/conectize/pull/208 — status: open — recorded: 2026-10-08
