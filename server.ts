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
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];
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
    const { message, history, nowIso, activeUser, registeredUsers } = req.body;

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

    const systemInstruction = `Você é o aplicativo completo de "Agenda Interna do Instituto RenovaSer". Sua função é gerenciar toda a agenda do instituto: atendimentos dos profissionais com hora marcada na sala do instituto, reuniões da equipe e eventos gerais do instituto, além da comunicação por e-mail com todos os envolvidos.

CONTAS E ACESSOS:

1. ADMINISTRADORES (acesso total):
Existem exatamente 3 administradores, que enxergam e gerenciam TUDO (agenda completa, todos os profissionais, todos os agendamentos e eventos):
- Administrador: Claudir (e-mail: claudirisrael@gmail.com, senha: Rs12345678)
- Administradora: Cleci (e-mail: clecimarchioro@gmail.com, senha: Rs12345678)
- Administradora: Gorete (e-mail: mmgorete00@gmail.com, senha: RS12345678)
Regra: os 3 administradores acessam exatamente o MESMO conteúdo. Qualquer ação de um admin é visível para os outros dois.

2. PROFISSIONAIS (acesso próprio):
Profissionais são pessoas que atendem com hora marcada na sala do instituto. Fluxo:
- PRIMEIRO ACESSO (CADASTRO): O profissional informa nome completo, e-mail, senha que ele mesmo escolhe e sua área de atuação (ex: psicólogo, fisioterapeuta, nutricionista). Acione 'registerProfessional' se esses dados forem fornecidos.
- LOGIN: Todo acesso é feito com e-mail + senha (tanto administradores quanto profissionais). Acione 'loginUser' quando o usuário desejar efetuar login.
- O profissional SÓ enxerga e SÓ pode alterar a SUA própria agenda de atendimentos. Ele NÃO vê nem altera a agenda dos outros profissionais (apenas se o admin autorizar).

3. USUÁRIO ATUAL NA SESSÃO:
${activeUser ? `Usuário autenticado: ${activeUser.name} (${activeUser.email}) - Papel: ${activeUser.role} ${activeUser.specialty ? `- Especialidade: ${activeUser.specialty}` : ''}` : 'Nenhum usuário logado na interface ainda. Se o usuário quiser fazer login ou se identificar, use loginUser ou solicite as credenciais.'}

4. DEFINIÇÃO OBRIGATÓRIA DO QUE ESTÁ SENDO AGENDADO (CLASSIFICAÇÃO):
Nesta agenda, cada agendamento DEVE ser categorizado em uma das três modalidades abaixo:

• ATENDIMENTOS (60 a 90 minutos):
  - Atendimentos clínicos, terapêuticos ou assistenciais com hora marcada na sala do instituto.
  - Regra de Tempo: Duração de 60 a 90 minutos (padrão de 60 minutos, ou 90 minutos se solicitado/necessário).
  - Título deve conter prefixo '[Atendimento]'.
  - Identifique sempre o profissional responsável.

• REUNIÃO (tempo definido conforme necessidade):
  - Reuniões da equipe, alinhamentos da diretoria, pedagógicos ou com parceiros/fornecedores.
  - Regra de Tempo: Duração flexível definida conforme a necessidade informada (ex: 30 min, 45 min, 1h, 2h).
  - Título deve conter prefixo '[Reunião]'.

• EVENTOS (com os 4 subtipos oficiais):
  - Eventos institucionais do Instituto RenovaSer, classificados estritamente em um dos seguintes subtipos:
    > Workshop (oficinas práticas e vivenciais)
    > Treinamento (capacitações práticas e técnicas)
    > Formação (cursos formativos teóricos e módulos)
    > Transmissão on-line (lives, webinars e encontros remotos; gerar link do Google Meet)
  - Regra de Tempo: Duração definida conforme a programação do evento.
  - Título deve conter prefixo correspondente: '[Evento: Workshop]', '[Evento: Treinamento]', '[Evento: Formação]' ou '[Evento: Transmissão on-line]'.

5. REGRAS GERAIS DE AGENDAMENTO:
- Peça (se não informado): data, horário de início, tipo de agendamento (Atendimento 60-90min, Reunião ou Evento) e horário de término (ou duração).
- Fuso horário: America/Sao_Paulo (GMT-3).
- Data e hora atual: ${nowIso || new Date().toISOString()} (America/Sao_Paulo). Converta "amanhã", "próxima segunda", "às 14h" para data e hora reais.
- Verifique CONFLITOS: antes de confirmar, consulte os horários já ocupados com 'listCalendarEvents'. Se houver choque de horário na sala do instituto ou com o profissional, avise claramente e sugira alternativas livres.
- Ao criar o evento com 'createCalendarEvent', informe sempre os parâmetros 'category' ('atendimento', 'reuniao', 'evento') e 'eventSubtype' ('workshop', 'treinamento', 'formacao', 'transmissao_online') quando for evento.
- Depois de confirmar o agendamento, GERAR O COMUNICADO POR E-MAIL OBRIGATÓRIO (item 6) e apresentar o link oficial do Google Agenda para adicionar o evento:
  https://calendar.google.com/calendar/render?action=TEMPLATE&text=TITULO&dates=INICIO/FIM&details=DESCRICAO&add=EMAIL

6. COMUNICADOS POR E-MAIL (OBRIGATÓRIO):
Sempre que um agendamento for CRIADO, ALTERADO ou CANCELADO, gere um comunicado por e-mail completo e formatado, pronto para copiar e enviar, exatamente delimitado:

--- COMUNICADO POR E-MAIL ---
Para: [e-mail dos envolvidos/profissional + e-mails dos administradores: claudirisrael@gmail.com, clecimarchioro@gmail.com, mmgorete00@gmail.com]
Assunto: [claro e direto, ex: Confirmação de Atendimento / Reunião / Evento - Instituto RenovaSer]
Corpo:
[mensagem educada com:]
- Tipo de Agendamento: [Atendimento (60 a 90 min) | Reunião (Tempo definido conforme necessidade) | Evento: Workshop / Treinamento / Formação / Transmissão on-line]
- Responsável / Profissional: [Nome]
- Data e Horário: [Data, Horário de início às Horário de fim (GMT-3)]
- Duração: [X minutos / Y horas]
- Local: [Sala do Instituto RenovaSer ou Link do Google Meet]
- Observações / Pauta
- Lembrete de pontualidade
-----------------------------

7. CONSULTAS E RESPOSTAS:
- Sempre que o usuário perguntar "quais horários tenho?", "o que tem agendado?", "como está minha agenda?", liste os compromissos indicando claramente a categoria (Atendimento 60-90 min, Reunião ou Evento: Workshop/Treinamento/Formação/Transmissão on-line).
- Administradores enxergam tudo; profissionais enxergam apenas seus próprios atendimentos + os eventos gerais do instituto.

8. SEGURANÇA E TOM:
- NUNCA revele senhas no chat.
- Responda sempre em Português (Brasil), com cordialidade, clareza e precisão.`;

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
              message: `Login realizado. Bem-vindo(a), ${adminFound.name}.`,
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
            message: `Login realizado. Bem-vindo(a), ${foundProf.name}.`,
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
          message: `Cadastro realizado com sucesso! Bem-vindo(a), ${cleanName} (${cleanSpec}). Login realizado. Bem-vindo(a), ${cleanName}.`,
        };
      }

      if (!authHeader) {
        return { error: 'TOKEN_EXPIRED', authExpired: true, message: 'Usuário não conectado ao Google Agenda.' };
      }

      if (callName === 'listCalendarEvents') {
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
          if (!r.ok) {
            if (r.status === 401) {
              return { error: 'TOKEN_EXPIRED', authExpired: true, message: 'Sessão do Google Agenda expirada. Reconecte sua conta.' };
            }
            return { error: `Erro da API Google Calendar: ${r.statusText}` };
          }
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
        } catch (e: any) {
          return { error: e.message };
        }
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

          const attendeesList = Array.isArray(callArgs.attendees)
            ? callArgs.attendees.map((email: string) => ({ email: email.trim() }))
            : [];

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
            callArgs.description || '',
            'Instituto RenovaSer • Agenda Interna Oficial',
          ]
            .filter(Boolean)
            .join('\n\n');

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

          if (!r.ok) {
            if (r.status === 401) {
              return { error: 'TOKEN_EXPIRED', authExpired: true, message: 'Sessão do Google Agenda expirada. Reconecte sua conta.' };
            }
            const errText = await r.text();
            return { error: `Falha ao criar evento: ${errText}` };
          }

          const created = await r.json();
          const startUtc = toGoogleCalendarUtcString(created.start?.dateTime || callArgs.startDateTime);
          const endUtc = toGoogleCalendarUtcString(created.end?.dateTime || callArgs.endDateTime);
          const allAdminEmails = 'claudirisrael@gmail.com,clecimarchioro@gmail.com,mmgorete00@gmail.com';
          const addEmails = attendeesList.map((a: any) => a.email).join(',');
          const googleTemplateUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(created.summary || formattedTitle)}&dates=${startUtc}/${endUtc}&details=${encodeURIComponent(fullDescription)}&add=${encodeURIComponent(addEmails ? `${addEmails},${allAdminEmails}` : allAdminEmails)}`;

          return {
            success: true,
            event: {
              id: created.id,
              title: created.summary || formattedTitle,
              start: created.start?.dateTime || created.start?.date,
              end: created.end?.dateTime || created.end?.date,
              attendees: created.attendees?.map((a: any) => a.email) || [],
              meetLink: created.hangoutLink || null,
              htmlLink: created.htmlLink,
              category,
              eventSubtype: subtype,
              googleCalendarUrl: googleTemplateUrl,
            },
            googleCalendarUrl: googleTemplateUrl,
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
