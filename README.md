# Agenda Renovaser

Aplicação para gestão e organização da agenda do time do Instituto Renovaser.

O projeto combina frontend em React + TypeScript, backend/servidor Express, integração com Supabase e suporte a autenticação e sincronização com Google Agenda.

## Visão geral

- Agenda compartilhada para o time
- Integração com Supabase para persistência e autenticação
- Login com Google OAuth
- Sincronização com Google Calendar
- Uso de IA via OpenRouter para apoio no fluxo de agenda
- Interface moderna com Vite + React

## Stack

- React 19
- TypeScript
- Vite
- Express
- Supabase
- Tailwind CSS
- Recharts
- OpenRouter

## Estrutura do projeto

```text
.
├── api/
├── public/
├── src/
├── supabase/
├── .env.example
├── .gitignore
├── index.html
├── metadata.json
├── package.json
├── PASSOAPASSO.md
├── server.ts
├── supabase_schema.sql
├── tsconfig.json
├── vercel.json
├── vite.config.ts
└── README.md
```

- `src/`: código do frontend em React
- `api/`: backend/API da aplicação
- `supabase/`: configuração e assets relacionados ao Supabase
- `supabase_schema.sql`: schema do banco
- `PASSOAPASSO.md`: guia de configuração das chaves e integrações

## Pré-requisitos

- Node.js 18+
- npm ou bun
- Conta no Supabase
- Conta no OpenRouter
- Conta Google Cloud com Google Calendar API habilitada

## Instalação

1. Clone o repositório:

```bash
git clone https://github.com/lorenzobisrael/agenda-renovaser.git
cd agenda-renovaser
```

2. Instale as dependências:

```bash
npm install
```

3. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

4. Preencha as variáveis de ambiente no arquivo `.env`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
OPENROUTER_API_KEY=sua_chave_openrouter
VITE_APP_URL=http://localhost:5173
```

> Consulte também o arquivo `PASSOAPASSO.md` para instruções detalhadas de configuração do Supabase, Google OAuth e Google Agenda.

## Executando localmente

### Desenvolvimento

```bash
npm run dev
```

A aplicação será iniciada em modo de desenvolvimento usando o servidor Express + Vite.

### Build para produção

```bash
npm run build
```

### Iniciar build em produção

```bash
npm start
```

## Scripts disponíveis

```json
{
  "dev": "tsx server.ts",
  "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
  "start": "node dist/server.cjs",
  "preview": "vite preview",
  "lint": "tsc --noEmit"
}
```

## Configurações importantes

### Supabase

- Configure o projeto no Supabase
- Ative o provedor Google para login OAuth
- Adicione as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Verifique o schema em `supabase_schema.sql`

### Google OAuth / Google Agenda

Para habilitar login e sincronização com a Agenda Google:

- Crie um projeto no Google Cloud Console
- Ative a Google Calendar API
- Configure a tela de consentimento OAuth
- Adicione os escopos de calendário
- Configure o Redirect URI no Supabase

## Contribuição

Contribuições são bem-vindas. Para mudanças importantes, abra uma discussão ou solicitação de alteração antes de enviar um PR.

## Licença

Este projeto não informa uma licença explícita no repositório. Verifique os arquivos do projeto antes de reutilizar o código em produção.

## Contato / Contexto

Projeto voltado para organização da agenda do time do Instituto Renovaser, com foco em produtividade, sincronização e apoio operacional.
