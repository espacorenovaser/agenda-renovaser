-- ============================================
-- RenovaSer — Migração: Profissional + Presenças + Participantes
-- Roda DEPOIS do schema.sql: cola no Supabase SQL Editor > Run
-- ============================================

-- 1. Terapeuta -> Profissional (sem perder dados)
do $$
begin
  if exists (select 1 from information_schema.columns where table_name='appointments' and column_name='therapist_email') then
    alter table public.appointments rename column therapist_email to professional_email;
  end if;
end $$;

-- índice renomeado
drop index if exists idx_appointments_therapist;
create index if not exists idx_appointments_professional on public.appointments (professional_email, start_at);

-- 2. role terapeuta -> profissional
update public.users set role = 'profissional' where role = 'terapeuta';
do $$
begin
  if exists (select 1 from pg_constraint where conname='users_role_check') then
    alter table public.users drop constraint users_role_check;
  end if;
end $$;
alter table public.users add constraint users_role_check check (role in ('admin','profissional'));
alter table public.users alter column role set default 'profissional';

-- 3. Reunião em equipe: participantes (para convidar os 3 no Google)
alter table public.appointments add column if not exists participants text[] default '{}';
alter table public.appointments add column if not exists client_email text;

-- 4. Expediente presencial dia a dia (só informa, não bloqueia sala)
create table if not exists public.presencas (
  id uuid primary key default gen_random_uuid(),
  professional_email text not null references public.users(email) on delete cascade,
  date date not null,
  start_at time not null,
  end_at time not null check (end_at > start_at),
  observacao text,
  created_at timestamptz default now()
);
create index if not exists idx_presencas_date on public.presencas (date);
create index if not exists idx_presencas_prof on public.presencas (professional_email, date);

-- 5. Atualiza RPC create_appointment para usar professional_email
create or replace function public.create_appointment(
  p_title text,
  p_patient_name text,
  p_patient_whatsapp text,
  p_patient_email text,
  p_room_id text,
  p_modality text,
  p_category text,
  p_professional_email text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_created_by text
) returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.appointments;
  v_conflict public.appointments;
begin
  if p_modality not in ('presencial','online') then raise exception 'Modalidade inválida: %', p_modality; end if;
  if p_modality = 'presencial' and p_room_id is null then raise exception 'Agendamento presencial exige sala'; end if;

  if p_modality = 'online' then
    insert into public.appointments (title, patient_name, patient_whatsapp, client_email, room_id, modality, category, professional_email, start_at, end_at, created_by)
    values (p_title, p_patient_name, p_patient_whatsapp, p_patient_email, null, 'online', p_category, p_professional_email, p_start_at, p_end_at, p_created_by)
    returning * into v_row; return v_row;
  end if;

  if p_room_id = 'auditorio' then
    select * into v_conflict from public.appointments where modality='presencial' and start_at < p_end_at and end_at > p_start_at limit 1;
    if found then raise exception 'Conflito: já existe "%" em % das % às % — o auditório exige as 3 salas livres.', v_conflict.title, v_conflict.room_id, to_char(v_conflict.start_at at time zone 'America/Sao_Paulo','DD/MM HH24:MI'), to_char(v_conflict.end_at at time zone 'America/Sao_Paulo','HH24:MI'); end if;
  else
    select * into v_conflict from public.appointments where modality='presencial' and (room_id='auditorio' or room_id=p_room_id) and start_at < p_end_at and end_at > p_start_at limit 1;
    if found then raise exception 'Conflito: sala % ocupada por "%" das % às %.', coalesce(v_conflict.room_id,'?'), v_conflict.title, to_char(v_conflict.start_at at time zone 'America/Sao_Paulo','HH24:MI'), to_char(v_conflict.end_at at time zone 'America/Sao_Paulo','HH24:MI'); end if;
  end if;

  insert into public.appointments (title, patient_name, patient_whatsapp, client_email, room_id, modality, category, professional_email, start_at, end_at, created_by)
  values (p_title, p_patient_name, p_patient_whatsapp, p_patient_email, p_room_id, 'presencial', p_category, p_professional_email, p_start_at, p_end_at, p_created_by)
  returning * into v_row; return v_row;
end; $$;

create or replace function public.update_appointment(
  p_id uuid, p_title text, p_patient_name text, p_patient_whatsapp text, p_patient_email text,
  p_room_id text, p_modality text, p_category text, p_professional_email text, p_start_at timestamptz, p_end_at timestamptz
) returns public.appointments
language plpgsql security definer set search_path=public as $$
declare v_row public.appointments; v_conflict public.appointments;
begin
  if p_modality='online' then
    update public.appointments set title=p_title, patient_name=p_patient_name, patient_whatsapp=p_patient_whatsapp, client_email=p_patient_email, room_id=null, modality='online', category=p_category, professional_email=p_professional_email, start_at=p_start_at, end_at=p_end_at where id=p_id returning * into v_row; return v_row;
  end if;
  if p_room_id='auditorio' then
    select * into v_conflict from public.appointments where id<>p_id and modality='presencial' and start_at < p_end_at and end_at > p_start_at limit 1;
    if found then raise exception 'Conflito: já existe "%" em % das % às % — o auditório exige as 3 salas livres.', v_conflict.title, v_conflict.room_id, to_char(v_conflict.start_at at time zone 'America/Sao_Paulo','DD/MM HH24:MI'), to_char(v_conflict.end_at at time zone 'America/Sao_Paulo','HH24:MI'); end if;
  else
    select * into v_conflict from public.appointments where id<>p_id and modality='presencial' and (room_id='auditorio' or room_id=p_room_id) and start_at < p_end_at and end_at > p_start_at limit 1;
    if found then raise exception 'Conflito: sala % ocupada por "%" das % às %.', coalesce(v_conflict.room_id,'?'), v_conflict.title, to_char(v_conflict.start_at at time zone 'America/Sao_Paulo','HH24:MI'), to_char(v_conflict.end_at at time zone 'America/Sao_Paulo','HH24:MI'); end if;
  end if;
  update public.appointments set title=p_title, patient_name=p_patient_name, patient_whatsapp=p_patient_whatsapp, client_email=p_patient_email, room_id=p_room_id, modality=p_modality, category=p_category, professional_email=p_professional_email, start_at=p_start_at, end_at=p_end_at where id=p_id returning * into v_row; return v_row;
end; $$;
