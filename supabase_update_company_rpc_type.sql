-- Обновляем функцию создания компании для поддержки типа
CREATE OR REPLACE FUNCTION create_company_with_owner(
  p_name text,
  p_slug text,
  p_email text,
  p_plan text DEFAULT 'free',
  p_type text DEFAULT 'company'  -- Новый параметр с дефолтом
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Проверяем валидность типа
  IF p_type NOT IN ('company', 'ip', 'individual') THEN
    p_type := 'company';
  END IF;

  -- Создаём компанию с типом
  INSERT INTO companies (slug, name, email, plan, type)
  VALUES (p_slug, p_name, p_email, p_plan, p_type)
  RETURNING id INTO v_company_id;

  -- Добавляем пользователя как владельца
  INSERT INTO company_members (company_id, user_id, role, status)
  VALUES (v_company_id, v_user_id, 'owner', 'active');

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_company_id,
    'slug', p_slug
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Company slug already exists');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Обновляем grants
GRANT EXECUTE ON FUNCTION create_company_with_owner(text, text, text, text, text) TO authenticated;

COMMIT;
