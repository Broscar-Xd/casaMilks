/**
 * Fecha de HOY en la zona horaria local del dispositivo (YYYY-MM-DD).
 *
 * NO usar `new Date().toISOString().split('T')[0]`: eso devuelve la fecha en
 * UTC, que en Ecuador (UTC-5) después de las 19:00 ya es "mañana".
 */
export function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
