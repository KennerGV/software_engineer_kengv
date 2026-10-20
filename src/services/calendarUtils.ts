export function obtenerOffsetIso(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset'
  }).formatToParts(date);

  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-03:00';
  if (tzPart === 'GMT' || tzPart === 'UTC') return '+00:00';
  return tzPart.replace(/^GMT/, '');
}

export function generarSlotsDisponibles(
  busyList: any[],
  timeZone: string,
  ahora: Date,
  diasAFuturo: number,
  duracionReunionMinutos: number,
  configuracionHorarios: Record<number, { inicio: { h: number, m: number }, fin: { h: number, m: number } } | null>
) {
  const slots: string[] = [];
  const pad = (num: number) => String(num).padStart(2, '0');

  for (let i = 0; i < diasAFuturo; i++) {
      const fechaBase = new Date(ahora.getTime());
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

      const horarioDelDia = configuracionHorarios[diaSemanaLocal];
      if (!horarioDelDia) continue;

      const horaInicioStr = `${pad(horarioDelDia.inicio.h)}:${pad(horarioDelDia.inicio.m)}:00`;
      const horaFinStr = `${pad(horarioDelDia.fin.h)}:${pad(horarioDelDia.fin.m)}:00`;

      const inicioLaboral = new Date(`${fechaStr}T${horaInicioStr}${offsetIso}`);
      const finLaboral = new Date(`${fechaStr}T${horaFinStr}${offsetIso}`);

      let cursorTiempo = new Date(inicioLaboral);

      while (cursorTiempo < finLaboral) {
          const slotInicio = new Date(cursorTiempo);
          const slotFin = new Date(cursorTiempo.getTime() + duracionReunionMinutos * 60000);

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
          cursorTiempo.setTime(cursorTiempo.getTime() + duracionReunionMinutos * 60000);
      }
  }
  return slots;
}
