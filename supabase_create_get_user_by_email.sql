-- Функция для поиска пользователя по email
CREATE OR REPLACE FUNCTION get_user_by_email(email_input text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'email', email,
    'name', raw_user_meta_data->>'name'
  )
  INTO result
  FROM auth.users
  WHERE email = email_input
  LIMIT 1;

  RETURN result;
END;
$$;

-- Разрешаем вызов authenticated пользователям
GRANT EXECUTE ON FUNCTION get_user_by_email(text) TO authenticated;

COMMIT;
