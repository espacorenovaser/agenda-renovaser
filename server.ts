import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini AI client
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function toGoogleCalendarUtcString(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  } catch {
    return '';
  }
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timeZone: 'America/Sao_Paulo' });
});

// Direct Calendar Listing Proxy
app.get('/api/calendar/events', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token de autorização ausente.' });
    }

    const { timeMin, timeMax } = req.query;
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeZone', 'America/Sao_Paulo');
    if (timeMin && typeof timeMin === 'string') {
      url.searchParams.set('timeMin', timeMin);
    }
    if (timeMax && typeof timeMax === 'string') {
      url.searchParams.set('timeMax', timeMax);
    }

    const googleRes = await fetch(url.toString(), {
      headers: { Authorization: authHeader },
    });

    if (!googleRes.ok) {
      if (googleRes.status === 401) {
        return res.status(401).json({ error: 'TOKEN_EXPIRED', authExpired: true, message: 'Token de acesso expirado.' });
      }
      const errBody = await googleRes.text();
      return res.status(googleRes.status).json({ error: errBody });
    }

    const data = await googleRes.json();
    return res.json(data);
  } catch (error: any) {
    console.error('Error fetching calendar events:', error);
    return res.status(500).json({ error: error.message || 'Erro ao consultar agenda' });
  }
});

// Confirmation-gated Execute Delete
app.post('/api/calendar/execute-delete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { eventId } = req.body;
    if (!authHeader || !eventId) {
      return res.status(400).json({ error: 'Parâmetros insuficientes para cancelamento.' });
    }

    const googleRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      }
    );

    if (!googleRes.ok && googleRes.status !== 410) {
      const err = await googleRes.text();
      return res.status(googleRes.status).json({ error: err });
    }

    return res.json({ success: true, eventId });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ error: error.message || 'Falha ao cancelar evento.' });
  }
});

// Confirmation-gated Execute Update
app.post('/api/calendar/execute-update', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { eventId, updates } = req.body;
    if (!authHeader || !eventId || !updates) {
      return res.status(400).json({ error: 'Parâmetros insuficientes para atualização.' });
    }

    const googleRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!googleRes.ok) {
      const err = await googleRes.text();
      return res.status(googleRes.status).json({ error: err });
    }

    const updatedEvent = await googleRes.json();
    return res.json({ success: true, event: updatedEvent });
  } catch (error: any) {
    console.error('Error updating event:', error);
    return res.status(500).json({ error: error.message || 'Falha ao atualizar evento.' });
  }
});

// Helper: generateContent with retry, exponential backoff, and model fallback for 503 / UNAVAILABLE spikes
async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: {
    contents: any[];
    systemInstruction: string;
    tools: any[];
    temperature?: number;
  }
) {
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: {
            systemInstruction: params.systemInstruction,
            tools: params.tools,
            temperature: params.temperature ?? 0.2,
          },
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        const isTransient =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('fetch failed');

        if (!isTransient) {
          throw err;
        }

        console.warn(`[Gemini API] Model ${model} attempt ${attempt + 1} transient error: ${msg}. Retrying...`);
        const delay = (attempt + 1) * 1200;
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  throw lastError;
}

// Assistant Chat Endpoint powered by Gemini 3.8 Flash & Google Calendar Tools
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { message, history, nowIso, activeUser, registeredUsers, currentEvents } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensagem vazia.' });
    }

    const ai = getGenAI();

    // Tool declarations
    const listCalendarEventsDecl: FunctionDeclaration = {
      name: 'listCalendarEvents',
      description: 'Consulta eventos e compromissos na agenda do Google Calendar para verificar horários, compromissos existentes e conflitos.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          timeMin: {
            type: Type.STRING,
            description: 'Data e hora mínima no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss-03:00)',
          },
          timeMax: {
            type: Type.STRING,
            description: 'Data e hora máxima no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss-03:00)',
          },
          query: {
            type: Type.STRING,
            description: 'Termo de busca opcional (ex: título ou participante)',
          },
        },
        required: ['timeMin'],
      },
    };

    const createCalendarEventDecl: FunctionDeclaration = {
      name: 'createCalendarEvent',
      description: 'Cria um novo agendamento (Atendimento, Reunião ou Evento) na agenda do Google Calendar do Instituto RenovaSer.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Título ou assunto do agendamento',
          },
          category: {
            type: Type.STRING,
            description: 'Categoria do que está sendo agendado: "atendimento" (60 a 90 minutos), "reuniao" (tempo definido conforme necessidade) ou "evento" (Workshops, Treinamentos, Formações, Transmissões on-line)',
            enum: ['atendimento', 'reuniao', 'evento'],
          },
          eventSubtype: {
            type: Type.STRING,
            description: 'Se a categoria for "evento", especifique obrigatoriamente o subtipo: "workshop", "treinamento", "formacao" ou "transmissao_online"',
            enum: ['workshop', 'treinamento', 'formacao', 'transmissao_online'],
          },
          startDateTime: {
            type: Type.STRING,
            description: 'Data e hora de início no formato ISO 8601 completo com fuso -03:00 (YYYY-MM-DDTHH:mm:ss-03:00)',
          },
          endDateTime: {
            type: Type.STRING,
            description: 'Data e hora de término no formato ISO 8601 completo com fuso -03:00 (YYYY-MM-DDTHH:mm:ss-03:00). Atendimentos: 60 a 90 minutos. Reunião: tempo flexível conforme necessidade. Eventos: conforme programação.',
          },
          attendees: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Lista de e-mails dos participantes ou envolvidos',
          },
          description: {
            type: Type.STRING,
            description: 'Pauta, detalhes ou observações do agendamento',
          },
          createMeetLink: {
            type: Type.BOOLEAN,
            description: 'Define se deve gerar automaticamente um link de videoconferência do Google Meet (recomendado para Transmissões on-line e reuniões remotas)',
          },
        },
        required: ['title', 'startDateTime', 'endDateTime'],
      },
    };

    const requestEventCancellationDecl: FunctionDeclaration = {
      name: 'requestEventCancellation',
      description: 'Solicita a confirmação do usuário para cancelar/excluir uma reunião existente identificada na agenda.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          eventId: {
            type: Type.STRING,
            description: 'ID do evento no Google Calendar',
          },
          eventTitle: {
            type: Type.STRING,
            description: 'Título do evento a ser cancelado',
          },
          startDateTime: {
            type: Type.STRING,
            description: 'Horário do evento',
          },
        },
        required: ['eventId', 'eventTitle'],
      },
    };

    const requestEventUpdateDecl: FunctionDeclaration = {
      name: 'requestEventUpdate',
      description: 'Solicita a confirmação do usuário para atualizar ou reagendar uma reunião existente na agenda.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          eventId: {
            type: Type.STRING,
            description: 'ID do evento no Google Calendar',
          },
          eventTitle: {
            type: Type.STRING,
            description: 'Título atual do evento',
          },
          newTitle: {
            type: Type.STRING,
            description: 'Novo título se houver alteração',
          },
          newStartDateTime: {
            type: Type.STRING,
            description: 'Novo início ISO 8601 (-03:00)',
          },
          newEndDateTime: {
            type: Type.STRING,
            description: 'Novo fim ISO 8601 (-03:00)',
          },
          newAttendees: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Nova lista de e-mails de participantes',
          },
        },
        required: ['eventId', 'eventTitle'],
      },
    };

    const loginUserDecl: FunctionDeclaration = {
      name: 'loginUser',
      description: 'Efetua login do usuário com e-mail e senha no sistema do Instituto RenovaSer.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          email: {
            type: Type.STRING,
            description: 'E-mail do administrador ou profissional',
          },
          password: {
            type: Type.STRING,
            description: 'Senha informada pelo usuário',
          },
        },
        required: ['email', 'password'],
      },
    };

    const registerProfessionalDecl: FunctionDeclaration = {
      name: 'registerProfessional',
      description: 'Cadastra um novo profissional com hora marcada no Instituto RenovaSer.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: 'Nome completo do profissional',
          },
          email: {
            type: Type.STRING,
            description: 'E-mail do profissional',
          },
          password: {
            type: Type.STRING,
            description: 'Senha escolhida pelo profissional',
          },
          specialty: {
            type: Type.STRING,
            description: 'Área de atuação (ex: Psicólogo, Fisioterapeuta, Nutricionista)',
          },
        },
        required: ['name', 'email', 'password', 'specialty'],
      },
    };

    const systemInstruction = `Você é o aplicativo completo de "Agenda Interna do Instituto RenovaSer". Sua função é gerenciar toda a agenda do instituto: atendimentos dos profissionais com hora marcada, eventos gerais e comunicação por e-mail.

CONTAS E ACESSOS:

1. ADMINISTRADORES (acesso total e idêntico):
Existem 3 administradores que enxergam e gerenciam TUDO (agenda completa, todos os profissionais, todos os agendamentos e eventos). Os 3 acessam exatamente o MESMO conteúdo — qualquer ação de um aparece para os outros:
- Claudir (e-mail: claudirisrael@gmail.com, senha: Rs12345678)
- Cleci (e-mail: clecimarchioro@gmail.com, senha: Rs12345678)
- Gorete (e-mail: mmgorete00@gmail.com, senha: RS12345678)

2. PROFISSIONAIS (acesso restrito à própria agenda):
- CADASTRO: o profissional informa nome completo, e-mail, senha escolhida por ele e área de atuação (ex: psicólogo, fisioterapeuta, nutricionista). Após cadastrar com 'registerProfessional', já pode fazer login.
- LOGIN: todo acesso é por e-mail + senha (admins e profissionais) usando 'loginUser'.
- O profissional SÓ vê e SÓ altera a PRÓPRIA agenda de atendimentos. Ele NÃO vê a agenda dos outros profissionais.
- O profissional PODE ver a agenda geral de eventos do instituto (avisos, datas, eventos), mas NÃO os atendimentos de colegas.

FLUXO DE LOGIN (OBRIGATÓRIO):
- Ao receber e-mail e senha, chame 'loginUser' para verificar se o usuário existe e se a senha coincide.
- Se correto: 'Login realizado. Bem-vindo(a), [nome]. Acesso: [Administrador/Profissional].'
- Se errado: 'E-mail ou senha incorretos. Tente novamente.'
- NUNCA revele senha de um usuário para outro.
- Se o usuário não tiver cadastro e for profissional, ofereça o fluxo de cadastro antes:
  "Não encontrei seu cadastro. Para se cadastrar como profissional, por favor informe: nome completo, e-mail, área de atuação (ex: psicólogo, fisioterapeuta, nutricionista) e a senha desejada."

USUÁRIO ATUAL NA SESSÃO:
${activeUser ? `Usuário ativo: ${activeUser.name} (${activeUser.email}) — Acesso: ${activeUser.role === 'admin' ? 'Administrador' : `Profissional (${activeUser.specialty || 'Área da Saúde'})`}` : 'Nenhum usuário logado na interface ainda. Solicite e-mail e senha para login quando necessário.'}

FUNCIONALIDADES DO ADMINISTRADOR:
- Ver agenda completa (todos os atendimentos + eventos).
- Ver o agendamento individual de cada profissional.
- Criar, alterar e cancelar qualquer agendamento ou evento.
- Cadastrar e remover profissionais.
- Consultar horários ocupados e livres de qualquer profissional.

FUNCIONALIDADES DO PROFISSIONAL:
- Ver eventos gerais do instituto.
- Ver a própria agenda de atendimentos (horários marcados).
- Agendar os próprios horários de atendimento na sala.
- Alterar ou cancelar SOMENTE os próprios agendamentos.
- Ver os horários livres da semana.

REGRAS DE AGENDAMENTO:
- Duração padrão: 60 minutos (ou 90 se informado). Fuso: America/Sao_Paulo (GMT-3).
- Data e hora de referência atual: ${nowIso || new Date().toISOString()} (America/Sao_Paulo).
- ANTES de confirmar qualquer agendamento, verifique CONFLITOS:
  * Se o profissional já tem outro atendimento no mesmo horário → AVISE e sugira alternativas.
  * Se a sala do instituto já está ocupada naquele horário → AVISE e sugira alternativas.
  * Se a ferramenta retornar conflito ('conflict: true'), NUNCA confirme — explique o conflito detalhadamente e proponha outros horários.
- Após confirmar, apresente o link oficial do Google Agenda:
  https://calendar.google.com/calendar/render?action=TEMPLATE&text=TITULO&dates=INICIO/FIM&details=DESCRICAO&add=EMAIL
  (datas em UTC, formato YYYYMMDDTHHMMSSZ)

COMUNICADOS POR E-MAIL (OBRIGATÓRIO):
Sempre que um atendimento for AGENDADO, ALTERADO ou CANCELADO, gere o comunicado completo formatado:
- AGENDADO → e-mail de CONFIRMAÇÃO para o profissional e para os 3 administradores.
- ALTERADO → e-mail de AVISO com os novos horários.
- CANCELADO → e-mail de CANCELAMENTO informando que o horário está livre.
- Evento institucional → e-mail de CONVITE para todos os profissionais.

Modelo do comunicado (sempre apresente em bloco delimitado exatamente como abaixo):
--- COMUNICADO POR E-MAIL ---
Para: [e-mail do profissional; claudirisrael@gmail.com; clecimarchioro@gmail.com; mmgorete00@gmail.com]
Assunto: [ex: "Atendimento agendado - Instituto RenovaSer"]
Corpo: Olá, [nome]! Informamos que seu atendimento foi [agendado/alterado/cancelado]:
- Data: [data]
- Horário: [início] às [término]
- Duração: [min]
- Local: Sala do Instituto RenovaSer
- Observações: [se houver]
Por favor, compareça com antecedência. Atenciosamente, Instituto RenovaSer.
-----------------------------

CONEXÃO COM GOOGLE AGENDA:
- Se o usuário clicar em "Conectar Google Agenda", ou perguntar sobre a conexão, explique que a conexão real exige configuração do OAuth no Google Cloud Console (Client ID + Redirect URI apontando para o domínio da Vercel).
- Se a conexão falhar ou "piscar" sem conectar, oriente:
  "A conexão com o Google Agenda ainda não está ativa neste modo. Para ativar, configure o Client ID e a URL de redirecionamento no Google Cloud Console e ajuste o app. Enquanto isso, você pode usar o link oficial do Google Agenda que eu gero em cada agendamento."

TOM:
- Responda sempre em Português (Brasil), direto, educado e profissional.
- Liste compromissos em tópicos organizados por data e horário.
- Para admins, identifique de quem é cada atendimento.`;

    const ADMIN_CREDENTIALS = [
      { name: 'Claudir', email: 'claudirisrael@gmail.com', pass: 'Rs12345678', role: 'admin' },
      { name: 'Cleci', email: 'clecimarchioro@gmail.com', pass: 'Rs12345678', role: 'admin' },
      { name: 'Gorete', email: 'mmgorete00@gmail.com', pass: 'RS12345678', role: 'admin' },
    ];

    let sessionAuthUser: any = null;
    let sessionNewRegisteredUser: any = null;

    // Tool execution helper
    async function executeCalendarTool(callName: string, callArgs: any) {
      if (callName === 'loginUser') {
        const emailClean = (callArgs.email || '').trim().toLowerCase();
        const passClean = (callArgs.password || '').trim();

        const adminFound = ADMIN_CREDENTIALS.find((a) => a.email.toLowerCase() === emailClean);
        if (adminFound) {
          if (adminFound.pass === passClean) {
            sessionAuthUser = {
              id: 'admin-' + adminFound.name.toLowerCase(),
              name: adminFound.name,
              email: adminFound.email,
              role: 'admin',
            };
            return {
              success: true,
              user: sessionAuthUser,
              message: `Login realizado. Bem-vindo(a), ${adminFound.name}. Acesso: Administrador.`,
            };
          } else {
            return {
              success: false,
              message: 'E-mail ou senha incorretos. Tente novamente.',
            };
          }
        }

        const usersList = Array.isArray(registeredUsers) ? registeredUsers : [];
        const foundProf = usersList.find((u: any) => u.email?.toLowerCase() === emailClean);
        if (foundProf && (foundProf.passwordHash === passClean || foundProf.password === passClean)) {
          sessionAuthUser = {
            id: foundProf.id,
            name: foundProf.name,
            email: foundProf.email,
            role: 'professional',
            specialty: foundProf.specialty,
          };
          return {
            success: true,
            user: sessionAuthUser,
            message: `Login realizado. Bem-vindo(a), ${foundProf.name}. Acesso: Profissional.`,
          };
        }

        return {
          success: false,
          message: 'E-mail ou senha incorretos. Tente novamente.',
        };
      }

      if (callName === 'registerProfessional') {
        const cleanEmail = (callArgs.email || '').trim().toLowerCase();
        const cleanName = (callArgs.name || '').trim();
        const cleanPass = (callArgs.password || '').trim();
        const cleanSpec = (callArgs.specialty || '').trim();

        const newUser = {
          id: 'prof-' + Date.now(),
          name: cleanName,
          email: cleanEmail,
          role: 'professional',
          specialty: cleanSpec,
          passwordHash: cleanPass,
          createdAt: new Date().toISOString(),
        };

        sessionNewRegisteredUser = newUser;
        sessionAuthUser = {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: 'professional',
          specialty: newUser.specialty,
          createdAt: newUser.createdAt,
        };

        return {
          success: true,
          user: sessionAuthUser,
          message: `Cadastro realizado com sucesso! Login realizado. Bem-vindo(a), ${cleanName}. Acesso: Profissional.`,
        };
      }

      if (callName === 'listCalendarEvents') {
        // Check live Google Calendar API if authHeader is available
        if (authHeader) {
          try {
            const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
            url.searchParams.set('singleEvents', 'true');
            url.searchParams.set('orderBy', 'startTime');
            url.searchParams.set('timeZone', 'America/Sao_Paulo');
            if (callArgs.timeMin) url.searchParams.set('timeMin', callArgs.timeMin);
            if (callArgs.timeMax) url.searchParams.set('timeMax', callArgs.timeMax);
            if (callArgs.query) url.searchParams.set('q', callArgs.query);

            const r = await fetch(url.toString(), {
              headers: { Authorization: authHeader },
            });
            if (r.ok) {
              const d = await r.json();
              const items = (d.items || []).map((ev: any) => ({
                id: ev.id,
                title: ev.summary || '(Sem título)',
                start: ev.start?.dateTime || ev.start?.date,
                end: ev.end?.dateTime || ev.end?.date,
                attendees: ev.attendees?.map((a: any) => a.email) || [],
                meetLink: ev.hangoutLink || null,
                status: ev.status,
                description: ev.description || '',
              }));
              return { count: items.length, events: items };
            }
          } catch {
            // Fallback to internal events
          }
        }

        // Query internal events list passed from frontend
        const internalEvents = Array.isArray(currentEvents) ? currentEvents : [];
        let filtered = [...internalEvents];
        if (callArgs.timeMin) {
          const minMs = new Date(callArgs.timeMin).getTime();
          filtered = filtered.filter((e) => new Date(e.start).getTime() >= minMs);
        }
        if (callArgs.timeMax) {
          const maxMs = new Date(callArgs.timeMax).getTime();
          filtered = filtered.filter((e) => new Date(e.start).getTime() <= maxMs);
        }
        if (callArgs.query) {
          const q = callArgs.query.toLowerCase();
          filtered = filtered.filter(
            (e) =>
              (e.title && e.title.toLowerCase().includes(q)) ||
              (e.description && e.description.toLowerCase().includes(q)) ||
              (e.professionalName && e.professionalName.toLowerCase().includes(q))
          );
        }

        return { count: filtered.length, events: filtered, source: 'agenda_interna_renovaser' };
      }

      if (callName === 'createCalendarEvent') {
        try {
          const category = (callArgs.category || (callArgs.eventSubtype ? 'evento' : 'atendimento')).toLowerCase();
          const subtype = callArgs.eventSubtype ? callArgs.eventSubtype.toLowerCase() : undefined;

          let formattedTitle = (callArgs.title || 'Agendamento').trim();
          if (category === 'atendimento') {
            if (!formattedTitle.toLowerCase().includes('atendimento')) {
              formattedTitle = `[Atendimento] ${formattedTitle}`;
            }
          } else if (category === 'reuniao') {
            if (!formattedTitle.toLowerCase().includes('reunião') && !formattedTitle.toLowerCase().includes('reuniao')) {
              formattedTitle = `[Reunião] ${formattedTitle}`;
            }
          } else if (category === 'evento') {
            const subName =
              subtype === 'workshop'
                ? 'Workshop'
                : subtype === 'treinamento'
                ? 'Treinamento'
                : subtype === 'formacao'
                ? 'Formação'
                : subtype === 'transmissao_online'
                ? 'Transmissão on-line'
                : 'Geral';
            if (!formattedTitle.toLowerCase().includes(subName.toLowerCase())) {
              formattedTitle = `[Evento: ${subName}] ${formattedTitle}`;
            }
          }

          const reqStartMs = new Date(callArgs.startDateTime).getTime();
          const reqEndMs = new Date(callArgs.endDateTime).getTime();

          // 1. CONFLICT CHECKING:
          // Overlap condition: (reqStartMs < evEndMs && reqEndMs > evStartMs)
          const allKnownEvents: any[] = Array.isArray(currentEvents) ? [...currentEvents] : [];
          const conflicting = allKnownEvents.filter((ev) => {
            if (!ev.start || !ev.end) return false;
            const evStartMs = new Date(ev.start).getTime();
            const evEndMs = new Date(ev.end).getTime();
            return reqStartMs < evEndMs && reqEndMs > evStartMs;
          });

          if (conflicting.length > 0) {
            const conflictEvent = conflicting[0];
            return {
              success: false,
              conflict: true,
              message: `CONFLITO DETECTADO: A sala do Instituto RenovaSer já está ocupada no horário solicitado com o compromisso "${conflictEvent.title}" (${conflictEvent.start} às ${conflictEvent.end}). REGRA: NUNCA confirme em horário ocupado! Explique claramente o conflito e sugira horários alternativos como 09:00, 11:00 ou 16:00.`,
              conflictingEvent: conflictEvent,
              suggestedSlots: ['09:00 às 10:00', '11:00 às 12:00', '14:00 às 15:00', '16:00 às 17:00'],
            };
          }

          // Format attendees list (include professional and all 3 admins)
          const attendeesList = Array.isArray(callArgs.attendees)
            ? [...callArgs.attendees.map((email: string) => ({ email: email.trim() }))]
            : [];
          
          if (callArgs.professionalEmail && !attendeesList.some((a) => a.email.toLowerCase() === callArgs.professionalEmail.toLowerCase())) {
            attendeesList.unshift({ email: callArgs.professionalEmail.trim() });
          }

          const adminEmails = [
            'claudirisrael@gmail.com',
            'clecimarchioro@gmail.com',
            'mmgorete00@gmail.com',
          ];
          for (const adm of adminEmails) {
            if (!attendeesList.some((a) => a.email.toLowerCase() === adm.toLowerCase())) {
              attendeesList.push({ email: adm });
            }
          }

          const categoryHeader =
            category === 'atendimento'
              ? 'Modalidade: Atendimento (60 a 90 minutos)'
              : category === 'reuniao'
              ? 'Modalidade: Reunião (Tempo definido conforme necessidade)'
              : `Modalidade: Evento - ${
                  subtype === 'workshop'
                    ? 'Workshop'
                    : subtype === 'treinamento'
                    ? 'Treinamento'
                    : subtype === 'formacao'
                    ? 'Formação'
                    : subtype === 'transmissao_online'
                    ? 'Transmissão on-line'
                    : 'Evento Institucional'
                }`;

          const fullDescription = [
            categoryHeader,
            callArgs.professionalName ? `Profissional Responsável: ${callArgs.professionalName}` : '',
            callArgs.description || '',
            'Local: Sala do Instituto RenovaSer',
            'Instituto RenovaSer • Agenda Interna Oficial',
          ]
            .filter(Boolean)
            .join('\n\n');

          const startUtc = toGoogleCalendarUtcString(callArgs.startDateTime);
          const endUtc = toGoogleCalendarUtcString(callArgs.endDateTime);
          const addEmailsStr = attendeesList.map((a: any) => a.email).join(',');
          const googleTemplateUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
            formattedTitle
          )}&dates=${startUtc}/${endUtc}&details=${encodeURIComponent(
            fullDescription
          )}&add=${encodeURIComponent(addEmailsStr)}`;

          let createdEvent: any = {
            id: 'rnv-' + Date.now(),
            title: formattedTitle,
            start: callArgs.startDateTime,
            end: callArgs.endDateTime,
            attendees: attendeesList.map((a: any) => a.email),
            meetLink: callArgs.createMeetLink || subtype === 'transmissao_online' ? 'https://meet.google.com/rnv-sala-ofc' : null,
            category,
            eventSubtype: subtype,
            description: fullDescription,
            location: 'Sala do Instituto RenovaSer',
            professionalName: callArgs.professionalName,
            professionalEmail: callArgs.professionalEmail,
            googleCalendarUrl: googleTemplateUrl,
          };

          // If Google Calendar OAuth token is available, also insert into Google Calendar
          if (authHeader) {
            try {
              const eventBody: any = {
                summary: formattedTitle,
                description: fullDescription,
                start: {
                  dateTime: callArgs.startDateTime,
                  timeZone: 'America/Sao_Paulo',
                },
                end: {
                  dateTime: callArgs.endDateTime,
                  timeZone: 'America/Sao_Paulo',
                },
                attendees: attendeesList,
              };

              const wantMeet = callArgs.createMeetLink === true || subtype === 'transmissao_online';
              let url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

              if (wantMeet) {
                url += '?conferenceDataVersion=1';
                eventBody.conferenceData = {
                  createRequest: {
                    requestId: 'meet-' + Date.now(),
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                  },
                };
              }

              const r = await fetch(url, {
                method: 'POST',
                headers: {
                  Authorization: authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventBody),
              });

              if (r.ok) {
                const gCreated = await r.json();
                createdEvent.id = gCreated.id || createdEvent.id;
                createdEvent.meetLink = gCreated.hangoutLink || createdEvent.meetLink;
                createdEvent.htmlLink = gCreated.htmlLink;
              }
            } catch {
              // Ignore and keep createdEvent
            }
          }

          return {
            success: true,
            event: createdEvent,
            googleCalendarUrl: googleTemplateUrl,
            message: 'Atendimento confirmado com sucesso na agenda interna do Instituto RenovaSer.',
          };
        } catch (e: any) {
          return { error: e.message };
        }
      }

      if (callName === 'requestEventCancellation' || callName === 'requestEventUpdate') {
        return {
          status: 'pending_user_confirmation',
          action: callName,
          payload: callArgs,
        };
      }

      return { error: `Ferramenta desconhecida: ${callName}` };
    }

    // Build chat contents from history
    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'model') {
          contents.push({
            role: h.role,
            parts: [{ text: h.text }],
          });
        }
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const toolsConfig = [
      {
        functionDeclarations: [
          listCalendarEventsDecl,
          createCalendarEventDecl,
          requestEventCancellationDecl,
          requestEventUpdateDecl,
          loginUserDecl,
          registerProfessionalDecl,
        ],
      },
    ];

    // Multi-turn tool execution loop
    let currentContents = [...contents];
    let finalAnswer = '';
    let pendingActions: any[] = [];
    let executedEvents: any[] = [];
    let isAuthExpired = false;
    let maxIterations = 5;

    while (maxIterations > 0) {
      maxIterations--;
      const response = await generateContentWithRetry(ai, {
        contents: currentContents,
        systemInstruction,
        tools: toolsConfig,
        temperature: 0.2,
      });

      const candidate = response.candidates?.[0];
      const modelContent = candidate?.content;
      const functionCalls = response.functionCalls;

      if (!functionCalls || functionCalls.length === 0) {
        finalAnswer = response.text || '';
        break;
      }

      // Add model's turn with tool calls to conversation history
      currentContents.push(modelContent);

      // Execute each tool call and append responses
      const functionResponseParts: any[] = [];
      for (const call of functionCalls) {
        const result = await executeCalendarTool(call.name, call.args);

        if ((result as any)?.authExpired || (result as any)?.error === 'TOKEN_EXPIRED') {
          isAuthExpired = true;
        }

        if (call.name === 'createCalendarEvent' && (result as any).event) {
          executedEvents.push((result as any).event);
        }
        if (call.name === 'requestEventCancellation' || call.name === 'requestEventUpdate') {
          pendingActions.push({
            type: call.name,
            args: call.args,
          });
        }

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: result,
          },
        });
      }

      currentContents.push({
        role: 'user',
        parts: functionResponseParts,
      });
    }

    return res.json({
      text: finalAnswer,
      pendingActions,
      executedEvents,
      authExpired: isAuthExpired,
      authenticatedUser: sessionAuthUser,
      newRegisteredUser: sessionNewRegisteredUser,
    });
  } catch (error: any) {
    console.error('Error in chat assistant:', error);
    const msg = String(error?.message || error);
    const isOverloaded =
      msg.includes('503') ||
      msg.includes('high demand') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('RESOURCE_EXHAUSTED');

    const friendlyError = isOverloaded
      ? 'O modelo de inteligência artificial está com alta demanda momentânea nos servidores da Google. Por favor, aguarde alguns instantes e tente novamente.'
      : (error.message || 'Erro no assistente inteligente.');

    return res.status(isOverloaded ? 503 : 500).json({
      error: friendlyError,
    });
  }
});

// Explicit catch-all for any unhandled /api route so it always returns JSON and NEVER falls through to Vite HTML
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado.' });
});

// Vite Middleware & static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Assistente de Agenda rodando na porta ${PORT}`);
  });
}

// In standard environments (local / Cloud Run container), start the HTTP listener.
// In serverless environments (e.g. Vercel), export the Express app directly.
if (!process.env.VERCEL) {
  startServer();
}

export { app };
export default app;
