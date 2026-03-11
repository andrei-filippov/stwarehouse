-- Функция для получения списка приглашений пользователя
CREATE OR REPLACE FUNCTION get_user_invitations()
RETURNS TABLE(
  id uuid,
  company_id uuid,
  company_name text,
  role text,
  position text,
  invited_by_name text,
  invited_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email text;
BEGIN
  -- Получаем email текущего пользователя
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  RETURN QUERY
  SELECT 
    cm.id,
    cm.company_id,
    c.name as company_name,
    cm.role::text,
    cm.position,
    COALESCE(p.raw_user_meta_data->>'name', 'Неизвестно') as invited_by_name,
    cm.invited_at
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
