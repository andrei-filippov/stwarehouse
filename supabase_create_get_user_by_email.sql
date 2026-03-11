-- Функция для поиска пользователя по email
-- Важно: должна быть в схеме public

DROP FUNCTION IF EXISTS public.get_user_by_email(text);

CREATE OR REPLACE FUNCTION public.get_user_by_email(email_input text)
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, email::text
  FROM auth.users
  WHERE email = email_input
  LIMIT 1;
$$;

-- Разрешаем вызов authenticated пользователям
GRANT EXECUTE ON FUNCTION public.get_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_by_email(text) TO anon;

COMMIT;
