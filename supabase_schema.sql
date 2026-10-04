-- =============================================================
-- supabase_schema.sql — Agenda RenovaSer (pronto p/ SQL Editor)
-- Tabelas reais usadas no código: profiles, events, chat_messages.
-- Não existe tabela `rooms`: salas são constantes no front
-- (RoomId em src/types.ts: sala_1, sala_2, sala_3, auditorio).
-- Idempotente: pode rodar 2x sem erro.
-- =============================================================

-- Extensões
create extension if not exists "pgcrypto";

-- =============================================================
-- TABLES
-- =============================================================

-- profiles: id TEXT (auth.uid() uuid-string + ids legados
-- 'admin1', 'usr-...' gerados em saveTherapist/syncUserProfile).
create table if not exists public.profiles (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null default 'terapeuta'
    check (role in ('admin', 'terapeuta')),
  phone text,
  technique text,
  created_at timestamptz default now()
);

-- events: id TEXT (código gera 'evt-<ts>-<rand>', não uuid).
-- Colunas snake_case = interface Event (src/lib/supabase.ts).
-- Colunas camelCase/Google = objeto Evento que App.tsx/saveEvent
-- faz upsert hoje; sem elas o upsert falha. start_time/end_time
-- ficam NULL até o código mandar snake_case (fetchEvents ordena
-- por start_time, NULLS LAST abaixo evita quebrar).
create table if not exists public.events (
  id text primary key default ('evt-' || gen_random_uuid()::text),
  therapist_id text,
  title text not null,
  description text,
  room_id text,
  start_time timestamptz,
  end_time timestamptz,
  client_name text,
  client_email text,
  client_whatsapp text,
  category text,
  created_at timestamptz default now(),
  "therapistId" text,
  "roomId" text,
  "roomName" text,
  "clientEmail" text,
  "clientWhatsApp" text,
  "badgeColor" text,
  "createdAt" timestamptz,
  "googleEventId" text,
  "googleHtmlLink" text,
  "syncedWithGoogle" boolean default false,
  time text,
  date text,
  location text,
  type text
);

-- chat_messages: sem FK p/ profiles de propósito — insert de chat
-- nunca pode falhar por profile ainda não sincronizado.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  sender text not null check (sender in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- Colunas novas se a tabela já existia (schema antigo uuid/enum)
do $$
begin
  alter table public.profiles  add column if not exists phone text;
  alter table public.profiles  add column if not exists technique text;
  alter table public.events    add column if not exists "therapistId" text;
  alter table public.events    add column if not exists "roomId" text;
  alter table public.events    add column if not exists "roomName" text;
  alter table public.events    add column if not exists "clientEmail" text;
  alter table public.events    add column if not exists "clientWhatsApp" text;
  alter table public.events    add column if not exists "badgeColor" text;
  alter table public.events    add column if not exists "createdAt" timestamptz;
  alter table public.events    add column if not exists "googleEventId" text;
  alter table public.events    add column if not exists "googleHtmlLink" text;
  alter table public.events    add column if not exists "syncedWithGoogle" boolean default false;
  alter table public.events    add column if not exists time text;
  alter table public.events    add column if not exists date text;
  alter table public.events    add column if not exists location text;
  alter table public.events    add column if not exists type text;
  alter table public.events    add column if not exists description text;
exception when duplicate_column then null;
end $$;

-- =============================================================
-- INDEXES
-- =============================================================
create index if not exists idx_events_start_time on public.events (start_time nulls last);
create index if not exists idx_events_therapist on public.events (therapist_id);
create index if not exists idx_events_therapistId on public.events ("therapistId");
create index if not exists idx_events_room on public.events (room_id);
create index if not exists idx_chat_messages_user on public.chat_messages (user_id);
create index if not exists idx_chat_messages_created on public.chat_messages (created_at);

-- =============================================================
-- REALTIME (cobre os 3 channels do código)
-- =============================================================
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

-- =============================================================
-- RLS — autenticados leem/criam/atualizam (+delete, pois o
-- código chama deleteEvent/deleteTherapist/clearChatMessages)
-- =============================================================
alter table public.profiles      enable row level security;
alter table public.events        enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles_select_auth"   on public.profiles;
drop policy if exists "profiles_insert_auth"   on public.profiles;
drop policy if exists "profiles_update_auth"   on public.profiles;
drop policy if exists "profiles_delete_auth"   on public.profiles;
drop policy if exists "events_select_auth"     on public.events;
drop policy if exists "events_insert_auth"     on public.events;
drop policy if exists "events_update_auth"     on public.events;
drop policy if exists "events_delete_auth"     on public.events;
drop policy if exists "chat_select_auth"       on public.chat_messages;
drop policy if exists "chat_insert_auth"       on public.chat_messages;
drop policy if exists "chat_update_auth"       on public.chat_messages;
drop policy if exists "chat_delete_auth"       on public.chat_messages;

create policy "profiles_select_auth" on public.profiles for select to authenticated using (true);
create policy "profiles_insert_auth" on public.profiles for insert to authenticated with check (true);
create policy "profiles_update_auth" on public.profiles for update to authenticated using (true) with check (true);
create policy "profiles_delete_auth" on public.profiles for delete to authenticated using (true);

create policy "events_select_auth" on public.events for select to authenticated using (true);
create policy "events_insert_auth" on public.events for insert to authenticated with check (true);
create policy "events_update_auth" on public.events for update to authenticated using (true) with check (true);
create policy "events_delete_auth" on public.events for delete to authenticated using (true);

create policy "chat_select_auth" on public.chat_messages for select to authenticated using (true);
create policy "chat_insert_auth" on public.chat_messages for insert to authenticated with check (true);
create policy "chat_update_auth" on public.chat_messages for update to authenticated using (true) with check (true);
create policy "chat_delete_auth" on public.chat_messages for delete to authenticated using (true);

-- =============================================================
-- TRIGGER: cria profile automaticamente no signup
-- (complementa syncUserProfile; security definer p/ passar RLS)
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id::text, coalesce(new.raw_user_meta_data->>'name', new.email), new.email, 'terapeuta')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
