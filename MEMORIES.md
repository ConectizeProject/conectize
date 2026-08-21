# Bug hunt memories

- **inbound-nfe partial post retry duplicates stock/devices** — `postProductsInbound` / `postUsedDevicesInbound` re-inserted movements/devices after mid-loop failure because items already linked were not skipped and external refs were shared across items. PR: https://github.com/ConectizeProject/conectize/pull/147 — status: open — recorded: 2026-08-21
- **PDV change_cents undercounts finance and blocks NFC-e** — `netSalesOrderPaymentAmounts` always deducted troco and NFC-e required paid−change===total, but PDV stores net payment lines (sum===total) with change from cash received. PR: https://github.com/ConectizeProject/conectize/pull/148 — status: open — recorded: 2026-08-21
