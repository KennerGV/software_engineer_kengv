import { describe, it, expect } from 'vitest';
import { validateUserSession } from '../services/sessionValidation';

describe('validateUserSession', () => {
  it('should return valid and empty bookingData if bookingSlot is undefined', () => {
    const { isValid, bookingData } = validateUserSession(undefined, undefined);
    expect(isValid).toBe(true);
    expect(bookingData).toEqual({});
  });

  it('should return invalid if bookingSlot is provided but sessionCookie is missing', () => {
    const { isValid, bookingData } = validateUserSession('2023-10-25T10:00:00Z', undefined);
    expect(isValid).toBe(false);
    expect(bookingData).toEqual({});
  });

  it('should return invalid if sessionCookie cannot be parsed', () => {
    const { isValid, bookingData } = validateUserSession('2023-10-25T10:00:00Z', 'invalid-json');
    expect(isValid).toBe(false);
    expect(bookingData).toEqual({});
  });

  it('should return invalid if sessionCookie is missing googleAccessToken', () => {
    const sessionCookie = JSON.stringify({ clientEmail: 'test@example.com' });
    const { isValid, bookingData } = validateUserSession('2023-10-25T10:00:00Z', sessionCookie);
    expect(isValid).toBe(false);
    expect(bookingData).toEqual({});
  });

  it('should return valid and populated bookingData if bookingSlot and valid sessionCookie are provided', () => {
    const sessionCookie = JSON.stringify({
      googleAccessToken: 'fake-token',
      clientEmail: 'test@example.com',
      clientName: 'Test User'
    });
    const { isValid, bookingData } = validateUserSession('2023-10-25T10:00:00Z', sessionCookie);
    expect(isValid).toBe(true);
    expect(bookingData).toEqual({
      bookingSlot: '2023-10-25T10:00:00Z',
      googleAccessToken: 'fake-token',
      clientEmail: 'test@example.com',
      clientName: 'Test User'
    });
  });
});
