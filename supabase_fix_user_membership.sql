-- Добавляем пользователей в компанию с их данными

DO $$
DECLARE
  user_record RECORD;
  default_company_id UUID;
  user_company_id UUID;
BEGIN
  -- Находим компанию по умолчанию
  SELECT id INTO default_company_id 
  FROM companies 
  WHERE email = 'default@example.com' 
  LIMIT 1;
  
  IF default_company_id IS NULL THEN
    RAISE EXCEPTION 'Компания по умолчанию не найдена';
  END IF;
  
  -- Для каждого пользователя, у которого есть данные в equipment
  FOR user_record IN 
    SELECT DISTINCT user_id 
    FROM equipment 
    WHERE user_id IS NOT NULL
  LOOP
    -- Проверяем, есть ли уже членство
    SELECT company_id INTO user_company_id
    FROM company_members
    WHERE user_id = user_record.user_id
    AND status = 'active'
    LIMIT 1;
    
    -- Если нет членства - добавляем в компанию по умолчанию
    IF user_company_id IS NULL THEN
      INSERT INTO company_members (company_id, user_id, role, status)
      VALUES (default_company_id, user_record.user_id, 'owner', 'active')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
END $$;

-- Проверяем результат
SELECT 
  c.id as company_id,
  c.name as company_name,
  cm.user_id,
  cm.role,
  cm.status
FROM companies c
JOIN company_members cm ON cm.company_id = c.id
WHERE c.email = 'default@example.com'
LIMIT 10;
