-- Создаём функцию для создания компании и владельца в одной транзакции
CREATE OR REPLACE FUNCTION create_company_with_owner(
  p_name text,
  p_slug text,
  p_email text,
  p_plan text DEFAULT 'free'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Выполняется с правами владельца БД
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
BEGIN
  -- Получаем ID текущего пользователя
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Создаём компанию
  INSERT INTO companies (slug, name, email, plan)
  VALUES (p_slug, p_name, p_email, p_plan)
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

-- Разрешаем вызов функции authenticated пользователям
GRANT EXECUTE ON FUNCTION create_company_with_owner(text, text, text, text) TO authenticated;

COMMIT;
