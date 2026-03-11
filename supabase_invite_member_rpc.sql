-- RPC функция для приглашения сотрудника
CREATE OR REPLACE FUNCTION invite_company_member(
  p_company_id uuid,
  p_role text,
  p_email text,
  p_position text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inviter_id uuid;
  v_has_access boolean;
BEGIN
  v_inviter_id := auth.uid();
  
  IF v_inviter_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Проверяем что приглашающий имеет права (owner или admin)
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = p_company_id
    AND user_id = v_inviter_id
    AND role IN ('owner', 'admin')
    AND status = 'active'
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('error', 'No permission to invite');
  END IF;

  -- Создаём приглашение с email, user_id = null
  INSERT INTO company_members (company_id, user_id, email, role, position, invited_by, status)
  VALUES (p_company_id, null, p_email, p_role, p_position, v_inviter_id, 'pending');

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Invitation already exists for this email');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION invite_company_member(uuid, text, text, text) TO authenticated;

COMMIT;
