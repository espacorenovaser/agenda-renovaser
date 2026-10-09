-- ============================================
-- RenovaSer — Migração: tipo do evento
-- Roda DEPOIS de schema.sql e migrate_profissional_presencas.sql:
-- cola no Supabase SQL Editor > Run
--
-- Usada só quando category = 'evento'. Quando a categoria é outra, fica null.
-- ============================================

alter table public.appointments add column if not exists evento_tipo text;

-- (o nome do constraint pode variar se já existir um parecido)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%evento_tipo%'
  loop
    execute format('alter table public.appointments drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.appointments
  add constraint appointments_evento_tipo_check
  check (
    evento_tipo is null
    or evento_tipo in ('curso','treinamento','formacao','workshop','atendimento_grupo')
  );
