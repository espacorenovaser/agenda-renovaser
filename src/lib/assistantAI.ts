/**
 * OpenRouter AI Assistant Service
 * Communicates with the backend endpoint that forwards requests to OpenRouter
 * Keeps the API key secure on the server side
 */
import type { ParsedBookingItem } from './assistantParser';

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
  bookingItems?: ParsedBookingItem[];
  suggestedResponse?: string;
  requiresConfirmation?: boolean;
}

/**
 * Main function: Analyze user intent and extract booking information
 * @param message - User's raw message text
 * @param user - Current user context (optional)
 * @param context - Additional context like events, therapists (optional)
 * @returns Analysis result with detected intent and parsed items
 */
export async function analyzeIntent(
  message: string,
  user?: any,
  context?: any,
  history?: Array<{ sender: 'user' | 'assistant'; text: string }>
): Promise<AnalysisIntent> {
  const systemPrompt = `Você é o RenovaBot, assistente virtual do Instituto RenovaSer.
Responda SEMPRE em português brasileiro, de forma acolhedora e profissional.
Seu papel: ajudar com agendamentos, dúvidas sobre a agenda, informações sobre salas/terapeutas.

Regras:
- Responda naturalmente como o RenovaBot
- Para agendamentos: confirme o que foi entendido e peça confirmação se needed
- Para dúvidas: responda diretamente
- Seja caloroso, use emojis ocasionais
- Nome: RenovaBot`;

  // Build conversation history for context (last 10 messages)
  const historyMessages = (history || []).slice(-10).map(h => ({
    role: h.sender === 'user' ? 'user' : 'assistant',
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
        max_tokens: 500
      }
    );

    const assistantMessage = response.choices[0]?.message.content || '';

    // Detectar se é agendamento por palavras-chave
    const lower = message.toLowerCase();
    const isBooking = lower.includes('agendar') || lower.includes('marcar') || lower.includes('reservar') ||
                      lower.includes('atendimento') || lower.includes('reunião') || lower.includes('reuniao');

    return {
      type: isBooking ? 'booking' : 'query',
      confidence: isBooking ? 0.9 : 0.5,
      suggestedResponse: assistantMessage,
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

/**
 * Convenience function for booking-related AI assistance
 * @param userInput - Raw user text to parse
 * @returns Parsed booking items from the assistant
 */
export async function parseAssistantCommandAI(
  userInput: string
): Promise<{ isBooking: boolean; items: ParsedBookingItem[]; feedbackSummary?: string }> {
  // For now, we'll use the existing local parser and potentially enhance with AI later
  // This maintains backward compatibility while allowing future AI enhancement
  // TODO: Import events and therapists from appropriate stores/context
  // This would need integration with the app's state management
  return {
    isBooking: false,
    items: [],
    feedbackSummary: 'AI parsing not yet implemented - using local parser'
  };
}