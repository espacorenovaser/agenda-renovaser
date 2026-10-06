import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Prefere a service_role (bypassa o RLS no servidor); cai para a anon se não configurada.
  // Para ativar: Supabase Dashboard > Settings > API > service_role key > SUPABASE_SERVICE_ROLE_KEY no .env.local
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}
