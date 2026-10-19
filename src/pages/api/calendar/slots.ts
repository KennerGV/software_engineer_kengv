import type { APIRoute } from 'astro';
import { google } from 'googleapis';

const DURACION_REUNION_MINUTOS = 30;
const DIAS_A_FUTURO = 9;
const DEFAULT_OWNER_TIMEZONE = 'America/Montevideo';

const CONFIGURACION_HORARIOS: Record<number, { inicio: { h: number, m: number }, fin: { h: number, m: number } } | null> = {
    1: { inicio: { h: 9, m: 0 }, fin: { h: 19, m: 30 } }, // Lunes
    2: { inicio: { h: 9, m: 0 }, fin: { h: 19, m: 30 } }, // Martes
    3: { inicio: { h: 9, m: 0 }, fin: { h: 19, m: 30 } }, // Miércoles
    4: { inicio: { h: 9, m: 0 }, fin: { h: 19, m: 30 } }, // Jueves
    5: { inicio: { h: 9, m: 0 }, fin: { h: 19, m: 30 } }, // Viernes
    6: { inicio: { h: 10, m: 0 }, fin: { h: 14, m: 0 } }, // Sábado
    0: null // Domingo
};

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const { code } = await request.json();
        if (!code) {
            return new Response(JSON.stringify({ error: 'Código de autorización faltante.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const now = new Date();
        const timeMin = now.toISOString();

        const maxDate = new Date();
        maxDate.setDate(now.getDate() + DIAS_A_FUTURO);
        const timeMax = maxDate.toISOString();

        const clientEmail = import.meta.env.GOOGLE_CLIENT_EMAIL;
        const privateKey = import.meta.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const googleCalendarId = import.meta.env.GOOGLE_CALENDAR_ID;
        const clientId = import.meta.env.GOOGLE_CLIENT_ID;
        const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
        const ownerTimeZone = import.meta.env.OWNER_TIMEZONE || DEFAULT_OWNER_TIMEZONE;

        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'postmessage');
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const clientUserEmail = userInfo.data.email;
        const clientUserName = userInfo.data.name;

        if (clientUserEmail && clientUserName) {
            const sessionData = JSON.stringify({
                clientEmail: clientUserEmail,
                clientName: clientUserName,
                googleAccessToken: tokens.access_token
            });

            cookies.set('user_session', sessionData, {
                path: '/',
                maxAge: 60 * 60,
                httpOnly: true,
                secure: true,
                sameSite: 'strict'
            });
        }

        const serviceAuth = new google.auth.JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/calendar.readonly']
        });

        const calendarOwner = google.calendar({ version: 'v3', auth: serviceAuth });

        const ownerResponse = await calendarOwner.freebusy.query({
            requestBody: {
                timeMin: timeMin,
                timeMax: timeMax,
                timeZone: ownerTimeZone,
                items: [{ id: googleCalendarId }],
            },
        });

        const ownerBusy = ownerResponse.data.calendars?.[googleCalendarId || '']?.busy || [];
        const availableSlots = generarSlotsDisponibles(ownerBusy, ownerTimeZone);

        return new Response(JSON.stringify({
            success: true,
            availableSlots
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error: any) {
        console.error('Error al procesar el calendario del dueño:', error);
        return new Response(JSON.stringify({ error: 'No se pudo recuperar la disponibilidad del calendario.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

function obtenerOffsetIso(date: Date, timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'longOffset'
    }).formatToParts(date);

    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-03:00';
    if (tzPart === 'GMT' || tzPart === 'UTC') return '+00:00';
    return tzPart.replace(/^GMT/, '');
}

function generarSlotsDisponibles(busyList: any[], timeZone: string) {
    const slots: string[] = [];
    const ahora = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');

    for (let i = 0; i < DIAS_A_FUTURO; i++) {
        const fechaBase = new Date();
        fechaBase.setDate(ahora.getDate() + i);

        const partesFecha = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(fechaBase);

        const year = partesFecha.find(p => p.type === 'year')?.value;
        const month = partesFecha.find(p => p.type === 'month')?.value;
        const day = partesFecha.find(p => p.type === 'day')?.value;
        const fechaStr = `${year}-${month}-${day}`;

        const offsetIso = obtenerOffsetIso(fechaBase, timeZone);
        const diaSemanaLocal = new Date(`${fechaStr}T00:00:00${offsetIso}`).getDay();

        const horarioDelDia = CONFIGURACION_HORARIOS[diaSemanaLocal];
        if (!horarioDelDia) continue;

        const horaInicioStr = `${pad(horarioDelDia.inicio.h)}:${pad(horarioDelDia.inicio.m)}:00`;
        const horaFinStr = `${pad(horarioDelDia.fin.h)}:${pad(horarioDelDia.fin.m)}:00`;

        const inicioLaboral = new Date(`${fechaStr}T${horaInicioStr}${offsetIso}`);
        const finLaboral = new Date(`${fechaStr}T${horaFinStr}${offsetIso}`);

        let cursorTiempo = new Date(inicioLaboral);

        while (cursorTiempo < finLaboral) {
            const slotInicio = new Date(cursorTiempo);
            const slotFin = new Date(cursorTiempo.getTime() + DURACION_REUNION_MINUTOS * 60000);

            if (slotInicio > ahora) {
                const estaOcupado = busyList.some(busy => {
                    const eventoInicio = new Date(busy.start);
                    const eventoFin = new Date(busy.end);
                    return slotInicio < eventoFin && slotFin > eventoInicio;
                });

                if (!estaOcupado) {
                    slots.push(slotInicio.toISOString());
                }
            }
            cursorTiempo.setTime(cursorTiempo.getTime() + DURACION_REUNION_MINUTOS * 60000);
        }
    }
    return slots;
}