-- Функция для принятия приглашения по ID
CREATE OR REPLACE FUNCTION accept_invitation_by_id(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_invitation RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Получаем email пользователя
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Ищем приглашение
  SELECT * INTO v_invitation
  FROM company_members
  WHERE id = p_invitation_id
  AND email = v_user_email
  AND user_id IS NULL
  AND status = 'pending';

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('error', 'Invitation not found or already accepted');
  END IF;

  -- Обновляем приглашение
  UPDATE company_members
  SET user_id = v_user_id,
      status = 'active',
      joined_at = NOW()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_invitation.company_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invitation_by_id(uuid) TO authenticated;

COMMIT;
