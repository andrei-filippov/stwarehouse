-- Тестовый запрос как делает фронтенд
-- Проверим видит ли пользователь оборудование

-- 1. Проверим текущего пользователя (должен быть аутентифицирован)
SELECT auth.uid() as current_user_id;

-- 2. Проверим есть ли у него членство
SELECT * FROM company_members 
WHERE user_id = auth.uid() 
AND status = 'active';

-- 3. Попробуем запрос как делает фронтенд
SELECT e.*
FROM equipment e
WHERE e.company_id = '8ed7be07-4954-4d11-a829-0becf3d2a8ba'
AND EXISTS (
  SELECT 1 FROM company_members cm
  WHERE cm.company_id = e.company_id
  AND cm.user_id = auth.uid()
  AND cm.status = 'active'
)
LIMIT 5;

-- 4. Если пусто - проверим без RLS
SET LOCAL row_security = off;
SELECT * FROM equipment WHERE company_id = '8ed7be07-4954-4d11-a829-0becf3d2a8ba' LIMIT 5;
