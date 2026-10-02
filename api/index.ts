import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(express.json());

// Health check endpoint (handles /api/health, /health, /api and /api/index)
app.get(['/api/health', '/health', '/api', '/api/index'], (_req, res) => {
  res.json({
    status: 'ok',
    timeZone: 'America/Sao_Paulo',
  });
});

// Direct Calendar Listing Proxy
app.get(['/api/calendar/events', '/calendar/events'], async (req, res) => {
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

/**
 * Endpoint OpenRouter — recebe a mensagem do usuário,
 * contexto (eventos + terapeutas) e devolve uma intenção.
 * A chave OPENROUTER_API_KEY fica só aqui no server (Vercel edge / node).
 */
const FREE_MODEL = 'google/gemini-2.0-flash-lite-001:free';

app.post('/api/assistant', async (req, res) => {
  try {
    const { message, user, context } = req.body || {};

    if (!message || !user || !context) {
      return res.status(400).json({ error: 'Parâmetros ausentes: message, user, context' });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      console.error('[OpenRouter] OPENROUTER_API_KEY não definida');
      return res.status(500).json({ error: 'Configuração de IA não disponível' });
    }

    const systemPrompt = `Você é o assistente IA do Instituto RenovaSer.
Sua função é interpretar comandos de texto para agendamento de compromissos.
Responda SEMPRE com JSON válido nas seguintes chaves:
- intent: "book_appointment" | "list_events" | "info" | "other"
- params: objeto com { title, date, time, roomId?, type?, therapistId?, category?, notes? }
- confidence: número entre 0 e 1

Considere os eventos existentes: ${JSON.stringify(context.events)}
Considere os terapeutas: ${JSON.stringify(context.therapists.map((t: any) => ({ id: t.id, name: t.name })))}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: FREE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[OpenRouter] Erro da API:', errBody);
      return res.status(500).json({ error: 'Erro ao processar com OpenRouter' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Tenta extrair JSON da resposta
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Fallback: tentar encontrar JSON no texto
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {}
      }
    }

    if (!parsed || !parsed.intent) {
      return res.status(200).json({
        intent: 'other',
        params: { notes: content },
        confidence: 0.1,
      });
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('[OpenRouter] Exception:', err);
    res.status(500).json({ error: err.message || 'Erro interno' });
  }
});

// Confirmation-gated Execute Delete
app.post(['/api/calendar/execute-delete', '/calendar/execute-delete'], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token de autorização ausente.' });
    }
    const { eventId } = req.body;
    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({ error: 'Parâmetros insuficientes para cancelamento: eventId ausente.' });
    }

    // Local/mock events still require authentication (checked above)
    if (eventId.startsWith('rnv-')) {
      return res.json({ success: true, eventId, note: 'Evento local removido.' });
    }

    const googleRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      }
    );

    // 404 (Not Found) or 410 (Gone) mean the event is already deleted on Google Calendar
    if (!googleRes.ok && googleRes.status !== 410 && googleRes.status !== 404) {
      const err = await googleRes.text();
      return res.status(googleRes.status).json({ error: err || 'Erro retornado pela API do Google Calendar.' });
    }

    return res.json({ success: true, eventId });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ error: error.message || 'Falha ao cancelar evento.' });
  }
});

// Confirmation-gated Execute Update
app.post(['/api/calendar/execute-update', '/calendar/execute-update'], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token de autorização ausente.' });
    }
    const { eventId, updates } = req.body;
    if (!eventId || typeof eventId !== 'string' || !updates) {
      return res.status(400).json({ error: 'Parâmetros insuficientes para atualização: eventId ou updates ausentes.' });
    }

    // Local/mock events still require authentication (checked above)
    if (eventId.startsWith('rnv-')) {
      return res.json({ success: true, event: { id: eventId, ...updates }, note: 'Evento local atualizado.' });
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

// Explicit catch-all for any unhandled /api route so it always returns JSON and NEVER falls through to Vite HTML
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint da API não encontrado.' });
});


export { app };

export default function handler(req: any, res: any) {
  try {
    const originalUrl = (req.headers["x-matched-path"] as string) || (req.headers["x-forwarded-uri"] as string) || req.url || "";
    if (originalUrl && originalUrl.startsWith("/api") && req.url === "/") {
      req.url = originalUrl;
    }
    return app(req, res);
  } catch (err: any) {
    console.error("Serverless invocation error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro interno no servidor.", details: err?.message });
    }
  }
}
