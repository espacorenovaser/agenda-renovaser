-- Supabase Migration: Agenda Instituto RenovaSer
-- Replaces Firestore with PostgreSQL + RLS

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- ENUMs
-- ============================================

create type user_role as enum ('admin', 'terapeuta');
create type event_category as enum ('atendimento', 'reuniao', 'evento');
create type event_type as enum ('presencial', 'online');
create type message_sender as enum ('user', 'assistant');
create type room_id as enum ('sala_1', 'sala_2', 'sala_3', 'auditorio');

-- ============================================
-- TABLES
-- ============================================

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'terapeuta',
  phone text,
  created_at timestamptz default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  room_id text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  client_name text,
  client_email text,
  client_whatsapp text,
  category event_category,
  created_at timestamptz default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender message_sender not null,
  content text not null,
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_events_therapist_id on public.events(therapist_id);
create index idx_events_start_time on public.events(start_time);
create index idx_events_room_id on public.events(room_id);
create index idx_chat_messages_user_id on public.chat_messages(user_id);
create index idx_chat_messages_created_at on public.chat_messages(created_at);

-- ============================================
-- REALTIME
-- ============================================

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.chat_messages;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.chat_messages enable row level security;

-- Profiles policies
create policy "Users can read own profile or team profiles"
  on public.profiles for select
  using (auth.uid() = id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Owners or admins can update profiles"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can change role"
  on public.profiles for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Events policies
create policy "Authenticated users can read all events"
  on public.events for select
  using (auth.uid() is not null);

create policy "Therapists or admins can create events"
  on public.events for insert
  with check (
    auth.uid() = therapist_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Owners or admins can update events"
  on public.events for update
  using (auth.uid() = therapist_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ))
  with check (
    auth.uid() = therapist_id or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Owners or admins can delete events"
  on public.events for delete
  using (auth.uid() = therapist_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- Chat messages policies
create policy "Users can read own messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "Users can create own messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

create policy "Users can update own messages"
  on public.chat_messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own messages"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

-- ============================================
-- TRIGGER: auto-create profile on signup
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.email, 'terapeuta');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
