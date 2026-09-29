import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: 'public',
  },
});

export type UserRole = 'admin' | 'terapeuta';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  created_at?: string;
  technique?: string;
}

export interface Event {
  id?: string;
  therapist_id: string;
  title: string;
  description?: string;
  room_id: string;
  start_time: string;
  end_time: string;
  client_name?: string;
  client_email?: string;
  client_whatsapp?: string;
  category?: 'atendimento' | 'reuniao' | 'evento';
  created_at?: string;
}

export interface ChatMessage {
  id?: string;
  user_id?: string;
  sender: 'user' | 'assistant';
  content: string;
  created_at?: string;
}