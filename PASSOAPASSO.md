PASSOAPASSO.md
Passo a Passo: Configuração das Chaves de API para Renovaser Agenda

Este guia orienta como obter as chaves necessárias para usar a aplicação em desenvolvimento e produção.

1. Configurar Supabase (Banco de Dados e Autenticação)

Acesse o Dashboard do Supabase:
- Visite https://supabase.com/dashboard
- Faça login com sua conta Google, GitHub ou E-mail
- Clique em "New Project" para criar um novo projeto

Obtenha as Credenciais:
- Na página do projeto, vá em Settings > API
- Copie a URL do projeto (Project URL)
- Copie a chave anonínima (Anon key)
- Crie um arquivo .env na raiz do projeto com:

VITE_SUPABASE_URL=sua_url_aqui
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui

Substitua "sua_url_aqui" e "sua_chave_anonima_aqui" pelos valores reais copiados.

2. Obter Chave da OpenRouter (IA Gratuita)

Acesse o site da OpenRouter:
- Visite https://openrouter.ai
- Clique em "Sign up" para criar uma conta
- Após registrar-se, acesse https://openrouter.ai/keys

Gere uma Chave de API:
- Na página de chaves, clique em "Create Key"
- Copie a chave gerada
- Adicione ao arquivo .env:

OPENROUTER_API_KEY=sua_chave_openrouter_aqui

A chave gratuita permite usar modelos como google/gemini-2.0-flash-lite-001:free e meta-llama/llama-3.3-70b-instruct:free sem custos.

3. Configurar a URL da Aplicação

Configure o APP_URL no .env para refletir o ambiente:

Para desenvolvimento local:
VITE_APP_URL=http://localhost:5173

Para produção (Vercel):
VITE_APP_URL=https://seu-dominio-aqui.com

4. Checklist Final

Antes de executar a aplicação:
- Verifique que todos os 4 valores estão no .env
- Confirme que as chaves foram copiadas corretamente
- Não commite o arquivo .env (use .env.example como template)
- Teste a conexão executando npm run dev

Para produção no Vercel:
- Adicione as variáveis de ambiente no dashboard do Vercel
- Configure Settings > Environment Variables
- Cada chave deve ser adicionada como uma variável separada

5. Troubleshooting

Se receber erro "OPENROUTER_API_KEY not configured":
- Reinicie o servidor (npm run dev)
- Verifique que a chave está no .env (não no .env.example)
- Confirme que não há espaços extras na chave

Se receber erro de autenticação no Supabase:
- Verifique a URL do projeto (deve ser https://...)
- Confirme que a chave anonínima está correta
- Na seção SQL do Supabase, crie as tabelas necessárias

Para modelos IA gratuitos que funcionam:
- google/gemini-2.0-flash-lite-001:free (recomendado, mais rápido)
- meta-llama/llama-3.3-70b-instruct:free (mais poderoso, mais lento)

Mais informações:
- Documentação Supabase: https://supabase.com/docs
- Documentação OpenRouter: https://openrouter.ai/docs
- Guia de Modelos Gratuitos: https://openrouter.ai/models?filter=free