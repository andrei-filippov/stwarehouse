-- RPC функция для удаления сотрудника
CREATE OR REPLACE FUNCTION delete_company_member(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_is_owner boolean;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Получаем company_id из записи которую удаляем
  SELECT company_id INTO v_company_id
  FROM company_members
  WHERE id = p_member_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Member not found');
  END IF;

  -- Проверяем что удаляющий - owner компании
  SELECT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = v_company_id
    AND user_id = v_user_id
    AND role = 'owner'
    AND status = 'active'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('error', 'Only owner can delete members');
  END IF;

  -- Удаляем запись
  DELETE FROM company_members WHERE id = p_member_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION delete_company_member(uuid) TO authenticated;

COMMIT;
