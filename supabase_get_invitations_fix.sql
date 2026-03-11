-- Исправленная функция для получения приглашений
-- Убрана неоднозначность колонок

DROP FUNCTION IF EXISTS get_user_invitations();

CREATE OR REPLACE FUNCTION get_user_invitations()
RETURNS TABLE(
  invitation_id uuid,
  company_id uuid,
  company_name text,
  member_role text,
  member_position text,
  inviter_name text,
  invited_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email text;
BEGIN
  -- Получаем email текущего пользователя
  SELECT u.email INTO v_user_email
  FROM auth.users u
  WHERE u.id = auth.uid();

  RETURN QUERY
  SELECT 
    cm.id as invitation_id,
    cm.company_id as company_id,
    c.name as company_name,
    cm.role::text as member_role,
    cm.position as member_position,
    COALESCE(p.raw_user_meta_data->>'name', 'Неизвестно') as inviter_name,
    cm.invited_at as invited_at
  FROM company_members cm
  JOIN companies c ON c.id = cm.company_id
  LEFT JOIN auth.users p ON p.id = cm.invited_by
  WHERE cm.email = v_user_email
  AND cm.user_id IS NULL
  AND cm.status = 'pending'
  ORDER BY cm.invited_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_invitations() TO authenticated;

COMMIT;
