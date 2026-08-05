/**
 * Componentes de fecha en la zona horaria de Ecuador (America/Guayaquil, UTC-5).
 * El SRI valida la fecha de emisión contra su propia fecha local; si el servidor
 * corre en otra zona (ej. UTC en Railway), la fecha puede salir adelantada/atrasada
 * y el SRI la rechaza como "FECHA EMISIÓN EXTEMPORANEA".
 */
export function fechaEcuador(date: Date): { dia: string; mes: string; anio: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { dia: get('day'), mes: get('month'), anio: get('year') };
}
