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
  const systemPrompt = `You are an expert assistant for a therapeutic center scheduling system.
Analyze the user's message and determine:
1. Is this a booking request? (reply with JSON: { "type": "booking", "confidence": 0-1 })
2. Extract booking details if present
3. Provide a friendly confirmation message

Always respond with valid JSON.`;

  try {
    const response = await fetchAssistantCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      {
        model: 'google/gemini-2.0-flash-lite-001:free',
        temperature: 0.3,
        max_tokens: 500
      }
    );

    const assistantMessage = response.choices[0]?.message.content || '';

    try {
      const parsed = JSON.parse(assistantMessage);
      return {
        type: parsed.type || 'other',
        confidence: parsed.confidence || 0,
        suggestedResponse: parsed.suggestedResponse,
        requiresConfirmation: parsed.requiresConfirmation
      };
    } catch {
      return {
        type: 'other',
        confidence: 0,
        suggestedResponse: assistantMessage
      };
    }
  } catch (error) {
    console.error('Error analyzing intent:', error);
    return {
      type: 'query',
      confidence: 0,
      suggestedResponse: 'Desculpe, houve um erro ao processar sua mensagem.'
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
      model: options.model || 'google/gemini-2.0-flash-lite-001:free',
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      top_p: options.top_p,
      tools: options.tools,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error || `OpenRouter API error: ${response.status}`
    );
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