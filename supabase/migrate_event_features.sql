-- Eventos: equipe facilitadora, inscritos e séries de vários dias.
-- Execute depois de migrate_meeting_features.sql no SQL Editor do Supabase.

alter table public.appointments
  add column if not exists event_professionals text[] not null default '{}',
  add column if not exists event_attendees jsonb not null default '[]'::jsonb,
  add column if not exists event_description text,
  add column if not exists event_care_type text,
  add column if not exists event_capacity integer;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'appointments_recurrence_frequency_check') then
    alter table public.appointments drop constraint appointments_recurrence_frequency_check;
  end if;
  alter table public.appointments
    add constraint appointments_recurrence_frequency_check
    check (recurrence_frequency is null or recurrence_frequency in ('daily', 'weekly', 'monthly'));

  if exists (select 1 from pg_constraint where conname = 'appointments_recurrence_count_check') then
    alter table public.appointments drop constraint appointments_recurrence_count_check;
  end if;
  alter table public.appointments
    add constraint appointments_recurrence_count_check
    check (recurrence_count is null or recurrence_count between 2 and 30);

  if not exists (select 1 from pg_constraint where conname = 'appointments_event_attendees_array_check') then
    alter table public.appointments add constraint appointments_event_attendees_array_check
      check (jsonb_typeof(event_attendees) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_event_capacity_check') then
    alter table public.appointments add constraint appointments_event_capacity_check
      check (event_capacity is null or event_capacity > 0);
  end if;
end $$;

create or replace function public.update_appointment_series(
  p_series_id uuid,
  p_start_shift_seconds double precision,
  p_duration_seconds double precision,
  p_title text,
  p_patient_name text,
  p_patient_whatsapp text,
  p_patient_email text,
  p_room_id text,
  p_modality text,
  p_category text,
  p_professional_email text,
  p_meeting_metadata jsonb
) returns setof public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment public.appointments;
  v_updated public.appointments;
  v_start timestamptz;
  v_end timestamptz;
  v_participants text[];
  v_participants_to_check text[];
  v_event_professionals text[];
begin
  if p_modality not in ('presencial','online','externo') then
    raise exception 'Modalidade inválida';
  end if;
  if p_modality = 'presencial' and p_room_id is null then
    raise exception 'Agendamento presencial exige sala';
  end if;

  select coalesce(array_agg(value), '{}') into v_participants
  from jsonb_array_elements_text(coalesce(p_meeting_metadata->'participants', '[]'::jsonb)) as participant(value);
  select coalesce(array_agg(value), '{}') into v_event_professionals
  from jsonb_array_elements_text(coalesce(p_meeting_metadata->'event_professionals', '[]'::jsonb)) as event_professional(value);
  v_participants_to_check := v_participants || v_event_professionals;
  if p_professional_email is not null and not (p_professional_email = any(v_participants_to_check)) then
    v_participants_to_check := array_append(v_participants_to_check, p_professional_email);
  end if;

  for v_appointment in
    select * from public.appointments
    where series_id = p_series_id
    order by recurrence_index
    for update
  loop
    v_start := v_appointment.start_at + make_interval(secs => p_start_shift_seconds);
    v_end := v_start + make_interval(secs => p_duration_seconds);

    if exists (
      select 1 from public.appointments a
      where a.id <> v_appointment.id
        and a.series_id is distinct from p_series_id
        and a.start_at < v_end and a.end_at > v_start
        and (
          (p_modality = 'presencial' and a.modality = 'presencial' and
            (p_room_id = 'auditorio' or a.room_id = 'auditorio' or a.room_id = p_room_id))
          or a.professional_email = any(v_participants_to_check)
          or a.participants && v_participants_to_check
          or a.event_professionals && v_participants_to_check
        )
    ) then
      raise exception 'Conflito: sala ou profissional indisponível em %', to_char(v_start at time zone 'America/Sao_Paulo','DD/MM HH24:MI');
    end if;

    update public.appointments set
      title = p_title,
      patient_name = p_patient_name,
      patient_whatsapp = p_patient_whatsapp,
      patient_email = p_patient_email,
      room_id = case when p_modality = 'presencial' then p_room_id else null end,
      modality = p_modality,
      category = p_category,
      professional_email = p_professional_email,
      start_at = v_start,
      end_at = v_end,
      evento_tipo = nullif(p_meeting_metadata->>'evento_tipo',''),
      participants = v_participants,
      guest_emails = coalesce(array(select guest.email from jsonb_array_elements_text(coalesce(p_meeting_metadata->'guest_emails','[]'::jsonb)) as guest(email)), '{}'),
      meeting_type = nullif(p_meeting_metadata->>'meeting_type',''),
      meeting_objective = nullif(p_meeting_metadata->>'meeting_objective',''),
      meeting_agenda = nullif(p_meeting_metadata->>'meeting_agenda',''),
      private_notes = nullif(p_meeting_metadata->>'private_notes',''),
      meeting_minutes = nullif(p_meeting_metadata->>'meeting_minutes',''),
      action_items = coalesce(p_meeting_metadata->'action_items','[]'::jsonb),
      reminder_minutes = coalesce(array(select reminder.value::integer from jsonb_array_elements_text(coalesce(p_meeting_metadata->'reminder_minutes','[60,30]'::jsonb)) as reminder(value)), '{60,30}'),
      event_professionals = v_event_professionals,
      event_attendees = coalesce(p_meeting_metadata->'event_attendees','[]'::jsonb),
      event_description = nullif(p_meeting_metadata->>'event_description',''),
      event_care_type = nullif(p_meeting_metadata->>'event_care_type',''),
      event_capacity = nullif(p_meeting_metadata->>'event_capacity','')::integer
    where id = v_appointment.id
    returning * into v_updated;
    return next v_updated;
  end loop;
  return;
end;
$$;

revoke all on function public.update_appointment_series(uuid,double precision,double precision,text,text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.update_appointment_series(uuid,double precision,double precision,text,text,text,text,text,text,text,text,jsonb) to service_role;