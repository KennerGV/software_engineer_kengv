import { describe, it, expect } from 'vitest';
import { obtenerOffsetIso, generarSlotsDisponibles } from '../services/calendarUtils';

describe('calendarUtils', () => {
  describe('obtenerOffsetIso', () => {
    it('should return correct offset for America/Montevideo', () => {
      // Testing in a deterministic date (e.g., standard time, no DST)
      const date = new Date('2023-07-01T12:00:00Z');
      const offset = obtenerOffsetIso(date, 'America/Montevideo');
      expect(offset).toMatch(/^-03:00$/);
    });
  });

  describe('generarSlotsDisponibles', () => {
    it('should generate available slots when there are no busy events', () => {
      const busyList: any[] = [];
      const timeZone = 'America/Montevideo';
      // Mock "ahora" to be a Monday at 8:00 AM local time
      // 2023-10-23 is a Monday
      const ahora = new Date('2023-10-23T11:00:00Z'); // 11:00 UTC = 08:00 UYT (-03:00)
      const diasAFuturo = 1; // Only check today
      const duracionReunionMinutos = 30;
      const configuracionHorarios = {
        1: { inicio: { h: 9, m: 0 }, fin: { h: 10, m: 0 } }, // Lunes: 9am - 10am
      };

      const slots = generarSlotsDisponibles(
        busyList,
        timeZone,
        ahora,
        diasAFuturo,
        duracionReunionMinutos,
        configuracionHorarios as any
      );

      expect(slots).toHaveLength(2); // 9:00 - 9:30, 9:30 - 10:00
      expect(slots[0]).toMatch(/T12:00:00\.000Z/); // 9:00 AM UYT -> 12:00 PM UTC
      expect(slots[1]).toMatch(/T12:30:00\.000Z/); // 9:30 AM UYT -> 12:30 PM UTC
    });

    it('should not generate slots that overlap with busy events', () => {
      const timeZone = 'America/Montevideo';
      const ahora = new Date('2023-10-23T11:00:00Z'); // Monday 8:00 AM local
      const diasAFuturo = 1;
      const duracionReunionMinutos = 30;
      const configuracionHorarios = {
        1: { inicio: { h: 9, m: 0 }, fin: { h: 10, m: 0 } }, // Lunes: 9am - 10am
      };

      const busyList = [
        {
          start: '2023-10-23T12:15:00Z', // 9:15 AM UYT
          end: '2023-10-23T12:45:00Z'    // 9:45 AM UYT
        }
      ];

      const slots = generarSlotsDisponibles(
        busyList,
        timeZone,
        ahora,
        diasAFuturo,
        duracionReunionMinutos,
        configuracionHorarios as any
      );

      // Both 9:00-9:30 and 9:30-10:00 overlap with the busy event 9:15-9:45
      expect(slots).toHaveLength(0);
    });
  });
});
