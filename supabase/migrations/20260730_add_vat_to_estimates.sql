-- ============================================
-- Добавление НДС в сметы (estimates)
-- ============================================
-- Задача: дать возможность указывать ставку НДС в смете
-- и считать конечную сумму с учётом НДС.
-- По умолчанию НДС выключен, ставка 20%.
-- ============================================

ALTER TABLE public.estimates
ADD COLUMN IF NOT EXISTS vat_included boolean DEFAULT false;

ALTER TABLE public.estimates
ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) DEFAULT 5;

COMMENT ON COLUMN public.estimates.vat_included IS 'Whether VAT is included in the estimate total';
COMMENT ON COLUMN public.estimates.vat_rate IS 'VAT rate in percent (e.g. 20 for 20%)';
