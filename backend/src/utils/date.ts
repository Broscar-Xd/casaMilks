/**
 * Utilidades de fecha con zona horaria de Ecuador.
 *
 * Ecuador continental usa UTC-5 FIJO (no hay horario de verano).
 * Los servidores (Railway) corren en UTC, así que al parsear "YYYY-MM-DD"
 * sin offset el día queda corrido 5 horas (empieza a las 19:00 del día
 * anterior en Ecuador). Con el offset -05:00 el día va de 00:00 a
 * 23:59:59.999 en Ecuador, que es lo que el usuario espera.
 */

export const ECUADOR_OFFSET = '-05:00';
export const ECUADOR_TZ = 'America/Guayaquil';

/** Inicio del día (00:00:00.000) en Ecuador para una fecha "YYYY-MM-DD". */
export function startOfEcuadorDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000${ECUADOR_OFFSET}`);
}

/** Fin del día (23:59:59.999) en Ecuador para una fecha "YYYY-MM-DD". */
export function endOfEcuadorDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999${ECUADOR_OFFSET}`);
}

/** Fecha "YYYY-MM-DD" en Ecuador para un instante dado (por defecto: ahora). */
export function ecuadorDateStr(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: ECUADOR_TZ });
}
