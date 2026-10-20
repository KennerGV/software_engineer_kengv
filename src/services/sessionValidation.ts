export interface BookingData {
  bookingSlot?: string;
  googleAccessToken?: string;
  clientEmail?: string;
  clientName?: string;
}

export function validateUserSession(
  bookingSlot: string | undefined,
  sessionCookie: string | undefined
): { isValid: boolean; bookingData: BookingData } {
  let bookingData: BookingData = {};

  if (bookingSlot) {
    if (sessionCookie) {
      try {
        const parsed = JSON.parse(sessionCookie);
        if (parsed?.googleAccessToken) {
          bookingData = {
            bookingSlot: bookingSlot,
            googleAccessToken: parsed.googleAccessToken,
            clientEmail: parsed.clientEmail,
            clientName: parsed.clientName,
          };
        }
      } catch (e) {
        console.warn('No se pudo parsear user_session cookie:', e);
      }
    }

    if (!bookingData.googleAccessToken) {
      return { isValid: false, bookingData: {} };
    }
  }

  return { isValid: true, bookingData };
}
