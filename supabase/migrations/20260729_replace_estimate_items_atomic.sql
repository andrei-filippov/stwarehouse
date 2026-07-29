-- ============================================
-- Атомарная замена позиций сметы (estimate_items)
-- ============================================
-- Проблема: в коде фронтенда использовался паттерн
-- DELETE -> INSERT в двух отдельных HTTP-запросах.
-- При нестабильном соединении между DELETE и INSERT
-- позиции сметы удалялись, но не восстанавливались.
--
-- Решение: RPC-функция, которая выполняет DELETE и INSERT
-- в одной транзакции. Если INSERT падает, откатывается и DELETE,
-- и старые позиции остаются на месте.
-- ============================================

CREATE OR REPLACE FUNCTION public.replace_estimate_items(
  p_estimate_id uuid,
  p_company_id uuid,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Проверяем, что пользователь является членом компании
  IF NOT public.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'Access denied: not a company member';
  END IF;

  -- Проверяем, что смета принадлежит этой компании
  IF NOT EXISTS (
    SELECT 1 FROM public.estimates
    WHERE id = p_estimate_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Estimate not found or does not belong to the company';
  END IF;

  -- Удаляем старые позиции
  DELETE FROM public.estimate_items
  WHERE estimate_id = p_estimate_id;

  -- Вставляем новые позиции
  INSERT INTO public.estimate_items (
    estimate_id,
    company_id,
    equipment_id,
    name,
    description,
    category,
    unit,
    quantity,
    price,
    coefficient,
    order_index,
    section_id
  )
  SELECT
    p_estimate_id,
    p_company_id,
    (x->>'equipment_id')::uuid,
    x->>'name',
    x->>'description',
    x->>'category',
    x->>'unit',
    COALESCE((x->>'quantity')::int, 1),
    COALESCE((x->>'price')::numeric, 0),
    COALESCE((x->>'coefficient')::numeric, 1),
    COALESCE((x->>'order_index')::int, 0),
    x->>'section_id'
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS x
  WHERE x->>'name' IS NOT NULL OR x->>'equipment_id' IS NOT NULL;
END;
$$;

-- Комментарий для документации
COMMENT ON FUNCTION public.replace_estimate_items(uuid, uuid, jsonb) IS
  'Atomically replaces all estimate_items for a given estimate. Runs under caller RLS policies.';
