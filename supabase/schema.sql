-- ============================================
-- RenovaSer Agenda — Schema Supabase
-- Aplica em: Supabase Dashboard > SQL Editor
-- ============================================

-- Salas (4 registros fixos)
create table if not exists public.rooms (
  id text primary key,
  nome text not null,
  cor text not null,
  badge text not null,
  tipo text not null check (tipo in ('individual','auditorio'))
);

insert into public.rooms (id, nome, cor, badge, tipo) values
  ('sala_1',    'Sala 1 · Harmonia',                         '#059669', 'bg-emerald-100 text-emerald-800 border-emerald-200', 'individual'),
  ('sala_2',    'Sala 2 · Serenidade',                       '#0d9488', 'bg-teal-100 text-teal-800 border-teal-200',       'individual'),
  ('sala_3',    'Sala 3 · Vitalidade',                       '#d97706', 'bg-amber-100 text-amber-800 border-amber-200',     'individual'),
  ('auditorio', 'Auditório Conexão & Expansão (Salas 1+2+3)', '#4f46e5', 'bg-indigo-100 text-indigo-800 border-indigo-200', 'auditorio')
on conflict (id) do nothing;

-- Agendamentos
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  patient_name text,
  patient_whatsapp text,
  patient_email text,
  room_id text references public.rooms(id) on delete set null,
  modality text not null check (modality in ('presencial','online')),
  category text not null check (category in ('atendimento','reuniao','evento')),
  therapist_email text not null,
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  google_event_id text,
  created_by text not null,
  created_at timestamptz default now()
);

create index if not exists idx_appointments_start on public.appointments (start_at);
create index if not exists idx_appointments_room on public.appointments (room_id, start_at);
create index if not exists idx_appointments_therapist on public.appointments (therapist_email, start_at);

-- Usuários (espelha o OAuth callback existente)
create table if not exists public.users (
  email text primary key,
  name text,
  role text not null default 'terapeuta' check (role in ('admin','terapeuta')),
  google_account_id text,
  google_access_token text,
  google_refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Marca os 4 admins iniciais (idempotente)
insert into public.users (email, name, role) values
  ('espacorenovaser@gmail.com', 'Espaço RenovaSer', 'admin'),
  ('claudirisrael@gmail.com',   'Claudir Israel',    'admin'),
  ('mmgorete00@gmail.com',      'Maria Gorete',      'admin'),
  ('clecimarchioro@gmail.com',  'Cleci Marchioro',   'admin')
on conflict (email) do update set role = 'admin', updated_at = now();

-- ============================================
-- Trava atômica — função RPC
-- ============================================
-- Regras:
--  online → não bloqueia nada, insere direto
--  auditorio → bloqueia se existe QUALQUER presencial com overlap
--  sala_1/2/3 → bloqueia se existe auditório com overlap OU mesma sala com overlap
-- Overlap: start_at < new_end AND end_at > new_start (intervalo aberto)

create or replace function public.create_appointment(
  p_title text,
  p_patient_name text,
  p_patient_whatsapp text,
  p_patient_email text,
  p_room_id text,
  p_modality text,
  p_category text,
  p_therapist_email text,
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
  if p_modality not in ('presencial','online') then
    raise exception 'Modalidade inválida: %', p_modality;
  end if;

  if p_modality = 'presencial' and p_room_id is null then
    raise exception 'Agendamento presencial exige sala';
  end if;

  if p_modality = 'online' then
    insert into public.appointments
      (title, patient_name, patient_whatsapp, patient_email, room_id, modality, category, therapist_email, start_at, end_at, created_by)
    values
      (p_title, p_patient_name, p_patient_whatsapp, p_patient_email, null, 'online', p_category, p_therapist_email, p_start_at, p_end_at, p_created_by)
    returning * into v_row;
    return v_row;
  end if;

  -- Presencial — trava

  -- Se for auditório: qualquer presencial no intervalo bloqueia
  if p_room_id = 'auditorio' then
    select * into v_conflict from public.appointments
    where modality = 'presencial'
      and start_at < p_end_at and end_at > p_start_at
    limit 1;
    if found then
      raise exception 'Conflito: já existe "%" em % das % às % — o auditório exige as 3 salas livres.',
        v_conflict.title, v_conflict.room_id,
        to_char(v_conflict.start_at at time zone 'America/Sao_Paulo','DD/MM HH24:MI'),
        to_char(v_conflict.end_at   at time zone 'America/Sao_Paulo','HH24:MI');
    end if;
  else
    -- Sala individual: bloqueia se auditório no intervalo OU mesma sala no intervalo
    select * into v_conflict from public.appointments
    where modality = 'presencial'
      and (room_id = 'auditorio' or room_id = p_room_id)
      and start_at < p_end_at and end_at > p_start_at
    limit 1;
    if found then
      raise exception 'Conflito: sala % ocupada por "%" das % às %.',
        coalesce(v_conflict.room_id,'?'),
        v_conflict.title,
        to_char(v_conflict.start_at at time zone 'America/Sao_Paulo','HH24:MI'),
        to_char(v_conflict.end_at   at time zone 'America/Sao_Paulo','HH24:MI');
    end if;
  end if;

  insert into public.appointments
    (title, patient_name, patient_whatsapp, patient_email, room_id, modality, category, therapist_email, start_at, end_at, created_by)
  values
    (p_title, p_patient_name, p_patient_whatsapp, p_patient_email, p_room_id, 'presencial', p_category, p_therapist_email, p_start_at, p_end_at, p_created_by)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_appointment(
  p_id uuid,
  p_title text,
  p_patient_name text,
  p_patient_whatsapp text,
  p_patient_email text,
  p_room_id text,
  p_modality text,
  p_category text,
  p_therapist_email text,
  p_start_at timestamptz,
  p_end_at timestamptz
) returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.appointments;
  v_conflict public.appointments;
begin
  if p_modality = 'online' then
    update public.appointments set
      title = p_title, patient_name = p_patient_name, patient_whatsapp = p_patient_whatsapp,
      patient_email = p_patient_email, room_id = null, modality = 'online',
      category = p_category, therapist_email = p_therapist_email,
      start_at = p_start_at, end_at = p_end_at
    where id = p_id returning * into v_row;
    return v_row;
  end if;

  if p_room_id = 'auditorio' then
    select * into v_conflict from public.appointments
    where id <> p_id and modality = 'presencial'
      and start_at < p_end_at and end_at > p_start_at
    limit 1;
    if found then
      raise exception 'Conflito: já existe "%" em % das % às % — o auditório exige as 3 salas livres.',
        v_conflict.title, v_conflict.room_id,
        to_char(v_conflict.start_at at time zone 'America/Sao_Paulo','DD/MM HH24:MI'),
        to_char(v_conflict.end_at   at time zone 'America/Sao_Paulo','HH24:MI');
    end if;
  else
    select * into v_conflict from public.appointments
    where id <> p_id and modality = 'presencial'
      and (room_id = 'auditorio' or room_id = p_room_id)
      and start_at < p_end_at and end_at > p_start_at
    limit 1;
    if found then
      raise exception 'Conflito: sala % ocupada por "%" das % às %.',
        coalesce(v_conflict.room_id,'?'), v_conflict.title,
        to_char(v_conflict.start_at at time zone 'America/Sao_Paulo','HH24:MI'),
        to_char(v_conflict.end_at   at time zone 'America/Sao_Paulo','HH24:MI');
    end if;
  end if;

  update public.appointments set
    title = p_title, patient_name = p_patient_name, patient_whatsapp = p_patient_whatsapp,
    patient_email = p_patient_email, room_id = p_room_id, modality = p_modality,
    category = p_category, therapist_email = p_therapist_email,
    start_at = p_start_at, end_at = p_end_at
  where id = p_id returning * into v_row;
  return v_row;
end;
$$;

-- Garante updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_users_updated on public.users;
create trigger trg_users_updated before update on public.users
for each row execute function public.touch_updated_at();
