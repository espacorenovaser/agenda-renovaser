-- ============================================
-- RenovaSer — Migração: modalidade "externo" (evento no local do cliente)
-- Roda DEPOIS de schema.sql e migrate_profissional_presencas.sql:
-- cola no Supabase SQL Editor > Run
--
-- Regra: 'externo' se comporta como 'online' — não ocupa sala e não bloqueia nada.
-- ============================================

-- 1. Libera 'externo' no CHECK da tabela (o nome do constraint pode variar)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%modality%'
  loop
    execute format('alter table public.appointments drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.appointments
  add constraint appointments_modality_check
  check (modality in ('presencial','online','externo'));

-- 2. Recria as RPCs com 'externo'.
--    DROP antes do CREATE porque a assinatura antiga pode ter o parâmetro
--    p_therapist_email (renomear parâmetro não é permitido em CREATE OR REPLACE).
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
    execute format('drop function %s', f.sig);
  end loop;
end $$;

create function public.create_appointment(
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
  if p_modality not in ('presencial','online','externo') then
    raise exception 'Modalidade inválida: %', p_modality;
  end if;

  if p_modality = 'presencial' and p_room_id is null then
    raise exception 'Agendamento presencial exige sala';
  end if;

  -- Online e externo: sem sala, sem trava
  if p_modality <> 'presencial' then
    insert into public.appointments
      (title, patient_name, patient_whatsapp, client_email, room_id, modality, category, professional_email, start_at, end_at, created_by)
    values
      (p_title, p_patient_name, p_patient_whatsapp, p_patient_email, null, p_modality, p_category, p_professional_email, p_start_at, p_end_at, p_created_by)
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
    (title, patient_name, patient_whatsapp, client_email, room_id, modality, category, professional_email, start_at, end_at, created_by)
  values
    (p_title, p_patient_name, p_patient_whatsapp, p_patient_email, p_room_id, 'presencial', p_category, p_professional_email, p_start_at, p_end_at, p_created_by)
  returning * into v_row;
  return v_row;
end;
$$;

create function public.update_appointment(
  p_id uuid,
  p_title text,
  p_patient_name text,
  p_patient_whatsapp text,
  p_patient_email text,
  p_room_id text,
  p_modality text,
  p_category text,
  p_professional_email text,
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
  if p_modality not in ('presencial','online','externo') then
    raise exception 'Modalidade inválida: %', p_modality;
  end if;

  if p_modality = 'presencial' and p_room_id is null then
    raise exception 'Agendamento presencial exige sala';
  end if;

  -- Online e externo: sem sala, sem trava
  if p_modality <> 'presencial' then
    update public.appointments set
      title = p_title, patient_name = p_patient_name, patient_whatsapp = p_patient_whatsapp,
      client_email = p_patient_email, room_id = null, modality = p_modality,
      category = p_category, professional_email = p_professional_email,
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
    client_email = p_patient_email, room_id = p_room_id, modality = p_modality,
    category = p_category, professional_email = p_professional_email,
    start_at = p_start_at, end_at = p_end_at
  where id = p_id returning * into v_row;
  return v_row;
end;
$$;
