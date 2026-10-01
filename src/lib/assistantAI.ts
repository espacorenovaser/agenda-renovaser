/**
 * OpenRouter AI Assistant Service
 * Communicates with the backend endpoint that forwards requests to OpenRouter
 * Keeps the API key secure on the server side
 */

export interface AssistantMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AssistantResponse {
  choices: Array<{
    message: AssistantMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AnalysisIntent {
  type: 'booking' | 'query' | 'clarification' | 'other';
  confidence: number;
  bookingItems?: Array<{ date: string; time: string; roomId?: string }>
  suggestedResponse?: string;
  requiresConfirmation?: boolean;
}

/**
 * Main function: Analyze user intent and extract booking information
 * @param message - User's raw message text
 * @param user - Current user context (optional)
 * @param context - Additional context like events, therapists (optional)
 * @param history - Chat history for context (last 10 messages)
 * @returns Analysis result with detected intent and parsed items
 */
export async function analyzeIntent(
  message: string,
  user?: any,
  context?: any,
  history?: Array<{ sender: 'user' | 'assistant'; text: string }>
): Promise<AnalysisIntent> {
  const systemPrompt = `Você é o RenovaBot, assistente virtual do Instituto RenovaSer.
Responda SEMPRE em português brasileiro, de forma acolhedora, profissional e calorosa.
Use emojis ocasionais. Seja claro e direto.

🚫 **NÃO USE MARKDOWN**: Responda em texto puro, sem formatação (sem #, *, _, \`, ~, [], (), etc.). O chat não renderiza markdown - aparece os caracteres literais.

=== CONHECIMENTO COMPLETO DO SISTEMA ===

🏢 **INSTITUTO RENOVASER - ESPAÇOS FÍSICOS (REGRA CRÍTICA)**
O instituto tem 4 espaços que funcionam com paredes móveis:
- **Sala 1 • Harmonia** - Acolhimento, Psicoterapia e Consultas Individuais (até 3 pessoas)
- **Sala 2 • Serenidade** - Terapias Holísticas, Tarô Terapêutico e Florais (até 3 pessoas)
- **Sala 3 • Vitalidade** - Práticas Integrativas, Reiki e Alinhamento Energético (até 3 pessoas com maca/poltrona)
- **Auditório Conexão & Expansão** - Workshops, Rodas de Conversa, Vivências e Cursos Coletivos (Salão Integrado Modular)

⚠️ **REGRA DE OURO - EXCLUSÃO MÚTUA:**
- Quando o **Auditório** está reservado → **NENHUMA** das 3 salas individuais pode ser usada (paredes abertas formam o auditório)
- Quando **QUALQUER** Sala (1, 2 ou 3) está reservada → o **Auditório NÃO pode ser usado**
- Salas 1, 2 e 3 podem funcionar **em paralelo** se o Auditório estiver livre
- Eventos online não ocupam espaço físico

👥 **ROLES E PERMISSÕES (RBAC):**
- **Admin**: Vê toda a agenda, gerencia usuários, cria eventos para qualquer terapeuta
- **Terapeuta**: Vê apenas seus próprios eventos + eventos de equipe (reunião/evento com "equipe", "instituto", "geral" no título)

📅 **CATEGORIAS DE EVENTOS:**
1. **atendimento** - Sessões terapêuticas individuais
2. **reuniao** - Reuniões de equipe, alinhamentos
3. **evento** - Workshops, cursos, vivências coletivas

🔄 **FLUXO DE AGENDAMENTO (COMO EU FUNCIONO):**
1. Usuário envia mensagem natural (ex: "agendar amanhã 14h sala 1")
2. Eu (IA) analiso a intenção e respondo confirmando o que entendi
3. Parser local extrai dados estruturados (data, hora, sala, terapeuta)
4. Sistema verifica disponibilidade em tempo real (com regra auditório/salas)
5. Se disponível → cria evento no Supabase + sincroniza com Google Calendar (se conectado)
6. Respondo confirmando criação + notificação WhatsApp/email do cliente

🗣️ **PARSING DE LINGUAGEM NATURAL QUE EU ENTENDO:**
- **Datas**: "hoje", "amanhã", "dia 25", "25/09", "25.09.26", "25 de setembro", "dia 25 de setembro"
- **Horários**: "14h", "14:00", "14h30", "14:30", "das 14 às 16", "das 14h às 16h", "14 horas"
- **Salas**: "sala 1", "harmonia", "sala 2", "serenidade", "sala 3", "vitalidade", "auditório", "auditorio"
- **Online**: "online", "on-line", "meet", "google meet", "zoom", "remoto", "vídeo", "virtual"
- **Múltiplas salas**: "sala 1 e sala 2", "todas as salas", "auditório completo"

👤 **TERAPEUTAS E ESPECIALIDADES:**
O sistema tem terapeutas cadastrados com técnicas (Psicoterapia, Tarô, Reiki, Constelação, Florais, Barras de Access, Quick Massagem, etc.)
Ao agendar, o sistema associa ao terapeuta logado ou permite escolher (se admin).

📱 **NOTIFICAÇÃO DE CLIENTES (OBRIGATÓRIA AO CRIAR):**
- **WhatsApp** e/ou **E-mail** do cliente
- Usados para confirmação e lembrete antecipado da sessão
- Preenchidos no formulário de criação de evento

📊 **VISUALIZAÇÕES DISPONÍVEIS:**
- **Dia**: 2 colunas (Manhã/Tarde) com slots horários
- **Semana**: Grade Segunda a Sábado
- **Mês**: Calendário com indicadores de ocupação
- **Todos**: Lista cronológica com filtros

🔍 **FILTROS:**
- Categoria: Todos / Atendimentos / Reuniões / Eventos
- Terapeuta: Todos ou específico (admin) / Só seu (terapeuta)
- Sala: Todas / Sala 1 / Sala 2 / Sala 3 / Auditório

📈 **RECURSOS EXTRAS:**
- **Resumo Semanal**: Gráfico de atendimentos por categoria/terapeuta
- **Barra de Ocupação**: Status tempo real das 4 salas
- **Sincronização Google Calendar**: Bidirecional (criar/excluir/sincronizar)
- **Modalidades**: Presencial (ocupa sala) ou Online (Google Meet)

=== MINHAS RESPOSTAS ===
- **Para agendamentos**: Confirmo o que entendi (data, hora, sala, tipo) e peço confirmação se needed
- **Para dúvidas**: Respondo diretamente com informação útil
- **Para conflitos**: Explico a regra (auditório vs salas) e sugiro alternativas
- **Sempre**: Tom acolhedor, português brasileiro, emojis ocasionais
- **Nome**: RenovaBot`;

  // Build conversation history for context (last 10 messages)
  const historyMessages: AssistantMessage[] = (history || []).slice(-10).map(h => ({
    role: (h.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: h.text
  }));

  try {
    const response = await fetchAssistantCompletion(
      [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message }
      ],
      {
        model: 'openrouter/auto',
        temperature: 0.3,
        max_tokens: 800
      }
    );

    const assistantMessage = response.choices[0]?.message.content || '';

    // Strip markdown if model still outputs it
    const cleanMessage = assistantMessage
      .replace(/#{1,6}\s*/g, '')        // headers
      .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
      .replace(/\*(.+?)\*/g, '$1')      // italic
      .replace(/`(.+?)`/g, '$1')        // inline code
      .replace(/```[\s\S]*?```/g, '')   // code blocks
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
      .replace(/^[\s]*[-*+]\s+/gm, '')  // list items
      .replace(/^\s*>\s+/gm, '')        // blockquotes
      .trim();

    // Detectar se é agendamento por palavras-chave
    const lower = message.toLowerCase();
    const isBooking = lower.includes('agendar') || lower.includes('marcar') || lower.includes('reservar') ||
                      lower.includes('atendimento') || lower.includes('reunião') || lower.includes('reuniao');

    return {
      type: isBooking ? 'booking' : 'query',
      confidence: isBooking ? 0.9 : 0.5,
      suggestedResponse: cleanMessage,
      requiresConfirmation: isBooking
    };
  } catch (error: any) {
    console.error('Error analyzing intent:', error);
    // Se for erro de auth (401/403), não logar como erro crítico
    if (error?.isAuthError) {
      console.warn('OpenRouter auth error (401/403) - falling back to local response');
    }
    return {
      type: 'query',
      confidence: 0,
      suggestedResponse: 'Desculpe, o serviço de IA está indisponível no momento. Para agendar, diga algo como "Agendar atendimento amanhã às 14h na Sala 1".'
    };
  }
}

/**
 * Sends a chat completion request to the OpenRouter API via our backend endpoint
 * @param messages - Array of message objects
 * @param options - Optional parameters (model, temperature, etc.)
 * @returns Promise resolving to the assistant's response
 */
export async function fetchAssistantCompletion(
  messages: AssistantMessage[],
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    tools?: any[];
  } = {}
): Promise<AssistantResponse> {
  const response = await fetch('/api/assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || 'openrouter/auto',
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      top_p: options.top_p,
      tools: options.tools,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(
      errorData.error || errorData.message || `OpenRouter API error: ${response.status}`
    ) as Error & { status?: number; isAuthError?: boolean };
    err.status = response.status;
    err.isAuthError = response.status === 401 || response.status === 403;
    throw err;
  }

  return response.json();
}

