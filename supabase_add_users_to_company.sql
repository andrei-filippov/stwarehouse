-- Добавление пользователей в компанию "ООО Технология звука"

DO $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
BEGIN
  -- Находим ID компании по названию
  SELECT id INTO v_company_id
  FROM companies
  WHERE name = 'ООО Технология звука'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Компания "ООО Технология звука" не найдена';
  END IF;

  RAISE NOTICE 'Найдена компания с ID: %', v_company_id;

  -- Добавляем пользователей
  
  -- Пользователь 1
  v_user_id := 'e0c08b7d-4716-40e1-b1f1-c01628a2994c'::uuid;
  INSERT INTO company_members (company_id, user_id, role, status, invited_by)
  VALUES (v_company_id, v_user_id, 'manager', 'active', auth.uid())
  ON CONFLICT (company_id, user_id) 
  DO UPDATE SET role = 'manager', status = 'active';
  RAISE NOTICE 'Добавлен пользователь 1: %', v_user_id;

  -- Пользователь 2
  v_user_id := '9bed243a-7449-43b8-88a2-484dba380c81'::uuid;
  INSERT INTO company_members (company_id, user_id, role, status, invited_by)
  VALUES (v_company_id, v_user_id, 'manager', 'active', auth.uid())
  ON CONFLICT (company_id, user_id) 
  DO UPDATE SET role = 'manager', status = 'active';
  RAISE NOTICE 'Добавлен пользователь 2: %', v_user_id;

  -- Пользователь 3
  v_user_id := 'b99a53ef-decb-41d0-8232-2ea262b30bc1'::uuid;
  INSERT INTO company_members (company_id, user_id, role, status, invited_by)
  VALUES (v_company_id, v_user_id, 'manager', 'active', auth.uid())
  ON CONFLICT (company_id, user_id) 
  DO UPDATE SET role = 'manager', status = 'active';
  RAISE NOTICE 'Добавлен пользователь 3: %', v_user_id;

  -- Пользователь 4
  v_user_id := 'b286640e-cf7f-40eb-8b85-bfeca109cd92'::uuid;
  INSERT INTO company_members (company_id, user_id, role, status, invited_by)
  VALUES (v_company_id, v_user_id, 'manager', 'active', auth.uid())
  ON CONFLICT (company_id, user_id) 
  DO UPDATE SET role = 'manager', status = 'active';
  RAISE NOTICE 'Добавлен пользователь 4: %', v_user_id;

  RAISE NOTICE 'Все пользователи успешно добавлены в компанию "ООО Технология звука"';
END $$;

COMMIT;
