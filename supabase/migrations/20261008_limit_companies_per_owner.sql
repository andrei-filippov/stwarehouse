-- Ограничение: один пользователь может быть владельцем не более 3 компаний
-- Защищает оба пути создания (регистрация и "Создать компанию" из меню),
-- т.к. RPC create_company_with_owner вставляет owner-членство в company_members

create or replace function public.enforce_company_owner_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owned_count int;
  max_companies constant int := 3;
begin
  if new.role = 'owner' then
    select count(*) into owned_count
    from company_members cm
    join companies c on c.id = cm.company_id
    where cm.user_id = new.user_id
      and cm.role = 'owner'
      and cm.status = 'active'
      and c.deleted_at is null;

    if owned_count >= max_companies then
      raise exception 'Достигнут лимит: один пользователь может создать не более % компаний', max_companies;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_company_owner_limit on public.company_members;
create trigger trg_company_owner_limit
  before insert on public.company_members
  for each row
  execute function public.enforce_company_owner_limit();
