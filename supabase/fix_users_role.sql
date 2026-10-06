-- Cola isso no SQL Editor e clica Run — corrige a tabela users antiga que não tem role/updated_at
alter table public.users add column if not exists role text default 'terapeuta';
alter table public.users add column if not exists updated_at timestamptz default now();
update public.users set role = 'terapeuta' where role is null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_role_check') then
    alter table public.users add constraint users_role_check check (role in ('admin','terapeuta'));
  end if;
end $$;
alter table public.users alter column role set not null;
alter table public.users alter column role set default 'terapeuta';
