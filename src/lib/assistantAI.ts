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
  context?: any
): Promise<AnalysisIntent> {
  const systemPrompt = `Você é o RenovaBot, assistente virtual do Instituto RenovaSer.
Responda SEMPRE em português brasileiro, de forma acolhedora e profissional.
Seu papel: ajudar com agendamentos, dúvidas sobre a agenda, informações sobre salas/terapeutas.

Analise a mensagem do usuário e retorne JSON válido com:
{
  "type": "booking" | "query" | "clarification" | "other",
  "confidence": 0-1,
  "suggestedResponse": "sua resposta natural e completa como RenovaBot",
  "requiresConfirmation": true/false,
  "bookingItems": [] // se for agendamento, itens extraídos
}

Regras:
- SEMPRE inclua "suggestedResponse" com sua fala completa
- Para agendamentos: confirme o que foi entendido e peça confirmação se needed
- Para dúvidas: responda diretamente
- Seja caloroso, use emojis ocasionais
- Nome: RenovaBot`;

  try {
    const response = await fetchAssistantCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      {
        model: 'openrouter/auto',
        temperature: 0.3,
        max_tokens: 500
      }
    );

    const assistantMessage = response.choices[0]?.message.content || '';

    try {
      const parsed = JSON.parse(assistantMessage);
      let response = parsed.suggestedResponse || '';
      // Se o modelo colocou JSON inteiro no suggestedResponse, extrair o campo real
      if (response.trim().startsWith('{')) {
        try {
          const inner = JSON.parse(response);
          response = inner.suggestedResponse || response;
        } catch {}
      }
      // Se ainda vier JSON como string (ex: com code fences), tentar extrair
      if (response.trim().startsWith('{') || response.trim().startsWith('```')) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const inner = JSON.parse(jsonMatch[0]);
            response = inner.suggestedResponse || response;
          } catch {}
        }
      }
      console.debug('[analyzeIntent] extracted response:', response.substring(0, 100));
      return {
        type: parsed.type || 'other',
        confidence: parsed.confidence || 0,
        suggestedResponse: response,
        requiresConfirmation: parsed.requiresConfirmation
      };
    } catch {
      return {
        type: 'other',
        confidence: 0,
        suggestedResponse: assistantMessage
      };
    }
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