import type { APIRoute } from 'astro';
import { sanitizeInput } from '../../utils/sanitizer';
import { validateUserSession } from '../../services/sessionValidation';

interface IncomingRequest {
  message: string;
  bookingSlot?: string;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no'
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body: IncomingRequest = await request.json();

    const referer = request.headers.get('referer') || '';
    const currentLang = referer.includes('/es/') ? 'es' : 'en';

    if (!body || !body.message) {
      return new Response(JSON.stringify({ error: 'Mensaje requerido.' }), { status: 400 });
    }

    const sanitizedMessage = sanitizeInput(body.message);

    let sessionId = cookies.get('agent_session_id')?.value;

    if (!sessionId) {
      sessionId = `session_${crypto.randomUUID()}`;
      cookies.set('agent_session_id', sessionId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true,
        secure: true
      });
    }

    const azureUrl = (import.meta.env.AZURE_FUNCTION_ENDPOINT || import.meta.env.PUBLIC_AZURE_FUNCTION_ENDPOINT) as string;
    const azureKey = (import.meta.env.AZURE_FUNCTION_KEY || import.meta.env.PUBLIC_AZURE_FUNCTION_KEY) as string;

    const incomingCookie = request.headers.get('cookie') || '';
    const cookieToSend = incomingCookie.includes('agent_session_id')
      ? incomingCookie
      : `agent_session_id=${sessionId}${incomingCookie ? '; ' + incomingCookie : ''}`;

    const sessionCookie = cookies.get('user_session')?.value;
    const { isValid, bookingData } = validateUserSession(body.bookingSlot, sessionCookie);

    if (!isValid) {
      const promptEvent = `data: {"action":"SHOW_APPOINTMENT_PROMPT"}\n\ndata: [DONE]\n\n`;
      return new Response(promptEvent, {
        status: 200,
        headers: SSE_HEADERS
      });
    }

    const azureResponse = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-functions-key': azureKey,
        'Cookie': cookieToSend
      },
      body: JSON.stringify({
        message: sanitizedMessage,
        language: currentLang,
        ...bookingData
      })
    });

    return new Response(azureResponse.body, {
      status: 200,
      headers: SSE_HEADERS
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error interno.' }), { status: 500 });
  }
};