# Guia de Configuração - Agenda Renovaser

Este documento explica como obter e configurar cada variável de ambiente necessária para executar o projeto.

## 1. APP_URL

**Descrição:** URL base da aplicação (usado em desenvolvimento e produção)

**Valor padrão:** `http://localhost:3000` (desenvolvimento)

**Como configurar:**
- Em desenvolvimento local, deixe como `http://localhost:3000`
- Em produção, altere para a URL do seu domínio (ex: `https://agenda.renovaser.com.br`)
- Adicione em `.env` ou `.env.local`

---

## 2. Firebase Configuration

O projeto utiliza Firebase para autenticação, banco de dados em tempo real (Firestore) e armazenamento de arquivos.

### 2.1 Obter Credenciais do Firebase

**Plataforma:** [Firebase Console](https://console.firebase.google.com/)

**Passos:**

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/)
2. Clique em **"Adicionar projeto"** ou selecione um projeto existente
3. No painel lateral, clique em **Configurações do Projeto** (ícone engrenagem)
4. Vá para a aba **"Seu Apps"** (ou **"Apps"**)
5. Localize sua aplicação web ou clique em **"Adicionar App"** → **"Web"** (`</>`))
6. Copie a configuração exibida (objeto com `apiKey`, `authDomain`, `projectId`, etc.)
7. Você terá algo assim:

```javascript
{
  "apiKey": "AIzaSy...",
  "authDomain": "seu-projeto.firebaseapp.com",
  "projectId": "seu-projeto",
  "storageBucket": "seu-projeto.appspot.com",
  "messagingSenderId": "1234567890",
  "appId": "1:1234567890:web:abc123def456"
}
```

### 2.2 Configurar Autenticação (OAuth com Google)

1. No Firebase Console, vá para **Authentication** (Autenticação)
2. Clique em **"Get Started"** (se for primeira vez)
3. Ative **Google** como método de login:
   - Clique em **Google**
   - Ative a opção
   - Configure o email de suporte (obrigatório)
4. Na aba **"Settings"** → **"Authorized domains"**, adicione:
   - `localhost` (desenvolvimento)
   - Seu domínio em produção (ex: `agenda.renovaser.com.br`)

### 2.3 Configurar Firestore (Banco de Dados)

1. No Firebase Console, vá para **Firestore Database**
2. Clique em **"Create Database"**
3. Selecione modo:
   - **Teste** (para desenvolvimento inicial, sem autenticação)
   - **Produção** (com regras de segurança obrigatórias)
4. Escolha a região (ex: `us-central1` ou `europe-west1`)
5. Clique em **"Enable"**

### 2.4 Obter OAuth Client ID para Google Calendar

Este ID é usado para acessar o Google Calendar do usuário.

**Passos:**

1. Vá para [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione seu projeto Firebase
3. No menu lateral, vá para **"APIs & Services"** → **"Credentials"**
4. Clique em **"Create Credentials"** → **"OAuth client ID"**
5. Se solicitado, configure a "OAuth consent screen":
   - Clique em **"Consent Screen"**
   - Escolha **"External"**
   - Preencha informações básicas (app name, email de suporte)
   - Salve
6. Retorne para **"Credentials"** e crie OAuth Client ID:
   - Tipo: **"Web application"**
   - Adicione em **"Authorized redirect URIs":**
     - `http://localhost:3000` (desenvolvimento)
     - Sua URL de produção
7. Clique em **"Create"** e copie o **Client ID**

---

## Configuração Completa do `.env`

Crie um arquivo `.env` (ou `.env.local` para desenvolvimento local) na raiz do projeto:

```
APP_URL=http://localhost:3000
```

**Importante:** As credenciais do Firebase estão em `firebase-applet-config.json`, que está versionado no repositório. Este arquivo contém a configuração pública do Firebase e é seguro commit-á-lo.

---

## Variáveis Não Utilizadas (Legado)

As seguintes variáveis foram removidas pois o projeto não utiliza IA generativa:

- ~~GEMINI_API_KEY~~
- ~~OPENAI_API_KEY~~
- ~~AI_PROVIDER~~
- ~~OPENAI_MODEL~~

O projeto usa **parsing de texto em tempo real** para interpretar comandos de agendamento, sem depender de APIs de IA.

---

## Validação

Para testar se tudo está configurado corretamente:

```bash
npm run build
npm run start
```

Acesse `http://localhost:3000` em seu navegador. Se ver a interface de login, a configuração está correta.

---

## Troubleshooting

### Erro: "FIREBASE_APP_ID is undefined"
- Verifique se `firebase-applet-config.json` existe e contém todos os campos necessários

### Erro: "Authentication not enabled"
- Ative Google Sign-In em Firebase Console → Authentication

### Erro ao conectar com Google Calendar
- Verifique se o OAuth Client ID está correto em `firebase-applet-config.json`
- Confirme que a URL atual está em "Authorized domains"

---

**Última atualização:** 2026-09-29
