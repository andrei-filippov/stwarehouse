-- Функция для принятия приглашения при входе
CREATE OR REPLACE FUNCTION accept_company_invitation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_invitation RECORD;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Получаем email пользователя
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Ищем приглашение по email
  SELECT * INTO v_invitation
  FROM company_members
  WHERE email = v_user_email
  AND user_id IS NULL
  AND status = 'pending'
  LIMIT 1;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Обновляем приглашение: привязываем user_id и меняем статус
  UPDATE company_members
  SET user_id = v_user_id,
      status = 'active',
      joined_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'found', true,
    'company_id', v_invitation.company_id,
    'role', v_invitation.role
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_company_invitation() TO authenticated;

COMMIT;
