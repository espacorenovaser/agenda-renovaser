# RenovaSer Agenda — Instruções

## ⚠️ Corrija o .env.local antes de rodar

O arquivo `C:\Users\cisra\agenda-internnpx\.env.local` estava corrompido (comandos colados no GOOGLE_CLIENT_SECRET).
Agora ele tem um placeholder em `GOOGLE_CLIENT_SECRET=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`.

Pegue o valor correto em:
https://console.cloud.google.com/apis/credentials?project=159785533478
> OAuth client "159785533478-1gluf6pedbkoiqqg06jpg43pn1c5fr22" > Client secret

Ou rode:
```bash
git show HEAD:.env.local
```
se o valor anterior ainda estiver no histórico git (arquivo está gitignored, então veja direto no Console).

---

## Banco — aplicar o schema

1. Abra https://supabase.com/dashboard/project/xsqhkazkhphvjmeeuacv/sql
2. Copie e execute o conteúdo de `supabase/schema.sql`
3. Verifique que `rooms` tem 4 linhas e `users` tem os 4 admins.

## O que já foi feito nesta entrega

- [x] `supabase/schema.sql` — tabelas rooms/appointments/users + funções RPC `create_appointment` / `update_appointment` com trava atômica (online não bloqueia, auditório bloqueia salas e vice-versa)
- [x] `.env.local` limpo (precisa completar o SECRET)
- [x] `src/lib/rooms.ts` — ROOMS, tipos, cores
- [x] `src/lib/whatsapp.ts` — helper wa.me
- [x] `src/lib/auth.ts` — isAdmin + getSession via cookies

## Próximos passos (na ordem)

1. Completar GOOGLE_CLIENT_SECRET e testar `npm run dev` + login Google
2. Ajustar `src/app/api/auth/callback/google/route.ts` para setar cookies `rs_session_email` / `rs_session_name` e popular `users.role`
3. Criar `middleware.ts` e `@supabase/ssr` se quiser RLS por auth
4. Criar `/api/appointments` (via RPC) + `/api/availability` + `/api/google/sync`
5. UI: DayScheduleView, WeekScheduleView, RoomsOccupancyBar, AppointmentModal
6. `firebase.json` + deploy em agenda.institutorenovaser.com.br

Ver plano completo em: `C:\Users\cisra\.claude\plans\woolly-weaving-rivest.md`
