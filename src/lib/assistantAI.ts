export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'terapeuta';
}

export interface AssistantContext {
  events: Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    roomId?: string;
    type?: string;
  }>;
  therapists: Array<{ id: string; name: string; email: string }>;
}

export interface IntentResult {
  intent: string;
  params: Record<string, any>;
  confidence: number;
}

/**
 * Chama o endpoint /api/assistant (server-side) que por sua vez
 * consulta OpenRouter com a chave OPENROUTER_API_KEY.
 * A chave nunca toca o bundle do frontend.
 */
export async function analyzeIntent(
  message: string,
  user: User,
  context: AssistantContext
): Promise<IntentResult> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, user, context }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Assistant API ${res.status}: ${err}`);
  }

  return res.json();
}
