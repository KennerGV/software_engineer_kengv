import type { APIRoute } from 'astro';

interface IncomingRequest {
  message: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body: IncomingRequest = await request.json();

    const referer = request.headers.get('referer') || '';
    
    const currentLang = referer.includes('/es/') ? 'es' : 'en';

    if (!body || !body.message) {
      return new Response(JSON.stringify({ error: 'Mensaje requerido.' }), { status: 400 });
    }

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

    const azureUrl = import.meta.env.PUBLIC_AZURE_FUNCTION_ENDPOINT as string;
    const azureKey = import.meta.env.PUBLIC_AZURE_FUNCTION_KEY as string;

    const azureResponse = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-functions-key': azureKey,
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        message: body.message,
        language: currentLang
      })
    });
    return new Response(azureResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error interno.' }), { status: 500 });
  }
};