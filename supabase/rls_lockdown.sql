-- ============================================
-- RenovaSer — Travar o acesso direto ao banco (RLS)
-- Roda por ÚLTIMO (depois de todos os migrate_*):
-- cola no Supabase SQL Editor > Run
--
-- Por quê: hoje a chave anon (que vai pública dentro do JS do site) lê
-- appointments, users e presencas direto pela API do Supabase.
-- O app fala com o banco só pelo servidor, com a service_role, que ignora RLS —
-- por isso as tabelas ficam SEM policy nenhuma: ninguém além do servidor passa.
-- ============================================

alter table public.appointments enable row level security;
alter table public.users        enable row level security;
alter table public.presencas    enable row level security;
alter table public.rooms        enable row level security;

-- Sem CREATE POLICY de propósito: com RLS ligado e nenhuma policy,
-- anon/authenticated não leem nem escrevem nada.

-- As RPCs são SECURITY DEFINER: rodam como o dono e passam por cima do RLS.
-- Sem revogar, a chave anon continuaria criando agendamento por fora.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_appointment','update_appointment')
  loop
    execute format('revoke execute on function %s from public', f.sig);
    execute format('revoke execute on function %s from anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
