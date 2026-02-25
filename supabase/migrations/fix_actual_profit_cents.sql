-- Corrige o lucro real (actual_profit_cents) dos aparelhos já vendidos.
-- Fórmula: sold_for_cents - purchase_value_cents - soma dos custos
UPDATE public.resale_devices rd
SET actual_profit_cents = rd.sold_for_cents
  - COALESCE(rd.purchase_value_cents, 0)
  - COALESCE((
    SELECT SUM(value_cents)
    FROM public.resale_device_costs
    WHERE resale_device_id = rd.id
  ), 0)
WHERE rd.sold = true
  AND rd.sold_for_cents IS NOT NULL;
