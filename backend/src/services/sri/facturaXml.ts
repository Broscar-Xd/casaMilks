/**
 * Genera el XML de factura electrónica según el esquema SRI factura_1.1.0
 * (formato verificado con ejemplos reales autorizados por el SRI).
 * Incluye info tributaria, info del comprador, detalle con impuestos IVA
 * (0%, 5% o 15% según taxRate del producto), pagos e info adicional.
 */

export interface FacturaParams {
  ambiente: string; // 1 pruebas | 2 producción
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  claveAcceso: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial: number;
  dirMatriz: string;
  dirEstablecimiento: string;
  obligadoContabilidad?: 'SI' | 'NO';
  contribuyenteRimpe?: string;
  telefono?: string;
  email?: string;

  // Comprador
  identificacionComprador: string;
  razonSocialComprador: string;
  direccionComprador?: string;
  emailComprador?: string;
  telefonoComprador?: string;

  fechaEmision: Date;
  items: Array<{
    codigoPrincipal: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number; // sin impuesto
    taxRate: number; // 0 | 5 | 15
  }>;
  // Formas de pago: [{ codigo: '01', total }]
  pagos?: Array<{ codigo: string; total: number }>;
}

/** Mapeo de métodos de pago del sistema a códigos SRI */
export function mapPaymentMethodToSri(method: string): string {
  switch (method) {
    case 'CASH': return '01';      // Efectivo
    case 'CARD': return '19';      // Tarjeta de crédito
    case 'TRANSFER': return '20';  // Transferencia
    case 'DEUNA': return '16';     // Otros (medios electrónicos)
    case 'PANAPAY': return '16';   // Otros
    default: return '16';
  }
}

function fmt(n: number): string {
  return n.toFixed(2);
}

/** Determina el tipo de identificación SRI: 04=RUC, 05=Cédula, 06=Pasaporte */
function tipoIdentificacion(doc: string): string {
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 13) return '04';
  if (clean.length === 10) return '05';
  return '06';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Genera un código corto válido para codigoPrincipal/codigoAuxiliar.
 * El XSD del SRI (factura 1.1.0) exige: [0-9A-Za-zÑñ ]{1,25}
 * (máx 25 caracteres, sin guiones). Los UUID de productos no cumplen,
 * así que se convierten a hex sin guiones y se truncan a 25.
 */
function codigoCorto(id: string): string {
  return id.replace(/[^0-9A-Za-zÑñ ]/g, '').slice(0, 25);
}

/**
 * Valores permitidos por el XSD del SRI (factura 1.1.0) para
 * contribuyenteRimpe: el texto debe coincidir EXACTAMENTE con el patrón
 * 'CONTRIBUYENTE RÉGIMEN RIMPE|CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE'.
 */
const RIMPE_VALIDOS = [
  'CONTRIBUYENTE RÉGIMEN RIMPE',
  'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE',
] as const;

function normalizarRimpe(legend: string | undefined): string | undefined {
  if (!legend) return undefined;
  const upper = legend.trim().toUpperCase().replace(/\s+/g, ' ');
  if (RIMPE_VALIDOS.includes(upper as (typeof RIMPE_VALIDOS)[number])) return upper;
  // Normalizaciones amigables: si el usuario escribió algo parecido, usar el régimen general
  if (upper.includes('NEGOCIO POPULAR')) return 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE';
  return 'CONTRIBUYENTE RÉGIMEN RIMPE';
}

export function generarFacturaXML(p: FacturaParams): string {
  const fecha = `${String(p.fechaEmision.getDate()).padStart(2, '0')}/${String(p.fechaEmision.getMonth() + 1).padStart(2, '0')}/${p.fechaEmision.getFullYear()}`;

  // Agrupar impuestos
  const taxGroups = new Map<number, { base: number; valor: number }>();
  let totalSinImpuestos = 0;

  for (const item of p.items) {
    const subtotal = item.cantidad * item.precioUnitario;
    totalSinImpuestos += subtotal;
    const rate = item.taxRate;
    const grupo = taxGroups.get(rate) || { base: 0, valor: 0 };
    grupo.base += subtotal;
    grupo.valor += (subtotal * rate) / 100;
    taxGroups.set(rate, grupo);
  }

  const codigoPorcentaje = (rate: number) => (rate === 15 ? 4 : rate === 5 ? 5 : 0);

  const totalImpuestosHtml = Array.from(taxGroups.entries())
    .map(([rate, g]) => `
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${codigoPorcentaje(rate)}</codigoPorcentaje>
        <descuentoAdicional>0.00</descuentoAdicional>
        <baseImponible>${fmt(g.base)}</baseImponible>
        <valor>${fmt(g.valor)}</valor>
      </totalImpuesto>`)
    .join('');

  const detallesHtml = p.items
    .map((item) => {
      const subtotal = item.cantidad * item.precioUnitario;
      const valorIVA = (subtotal * item.taxRate) / 100;
      return `
      <detalle>
        <codigoPrincipal>${codigoCorto(item.codigoPrincipal)}</codigoPrincipal>
        <codigoAuxiliar>${codigoCorto(item.codigoPrincipal)}</codigoAuxiliar>
        <descripcion>${escapeXml(item.descripcion)}</descripcion>
        <cantidad>${item.cantidad}</cantidad>
        <precioUnitario>${fmt(item.precioUnitario)}</precioUnitario>
        <descuento>0.00</descuento>
        <precioTotalSinImpuesto>${fmt(subtotal)}</precioTotalSinImpuesto>
        <impuestos>
          <impuesto>
            <codigo>2</codigo>
            <codigoPorcentaje>${codigoPorcentaje(item.taxRate)}</codigoPorcentaje>
            <tarifa>${fmt(item.taxRate)}</tarifa>
            <baseImponible>${fmt(subtotal)}</baseImponible>
            <valor>${fmt(valorIVA)}</valor>
          </impuesto>
        </impuestos>
      </detalle>`;
    })
    .join('');

  const pagosHtml = (p.pagos && p.pagos.length > 0 ? p.pagos : [{ codigo: '01', total: totalSinImpuestos + Array.from(taxGroups.values()).reduce((s, g) => s + g.valor, 0) }])
    .map((pg) => `
      <pago>
        <formaPago>${pg.codigo}</formaPago>
        <total>${fmt(pg.total)}</total>
        <plazo>0</plazo>
        <unidadTiempo>dias</unidadTiempo>
      </pago>`)
    .join('');

  const infoAdicional = `
      <infoAdicional>
        <campoAdicional nombre="Teléfono">${escapeXml(p.telefonoComprador || '')}</campoAdicional>
        <campoAdicional nombre="Email">${escapeXml(p.emailComprador || '')}</campoAdicional>
        ${p.direccionComprador ? `<campoAdicional nombre="Dirección">${escapeXml(p.direccionComprador)}</campoAdicional>` : ''}
      </infoAdicional>`;

  const importeTotal = totalSinImpuestos + Array.from(taxGroups.values()).reduce((s, g) => s + g.valor, 0);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${p.ambiente}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${escapeXml(p.razonSocial)}</razonSocial>
    ${p.nombreComercial ? `<nombreComercial>${escapeXml(p.nombreComercial)}</nombreComercial>` : ''}
    <ruc>${p.ruc}</ruc>
    <claveAcceso>${p.claveAcceso}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${p.establecimiento}</estab>
    <ptoEmi>${p.puntoEmision}</ptoEmi>
    <secuencial>${String(p.secuencial).padStart(9, '0')}</secuencial>
    <dirMatriz>${escapeXml(p.dirMatriz)}</dirMatriz>
    ${p.contribuyenteRimpe ? `<contribuyenteRimpe>${escapeXml(normalizarRimpe(p.contribuyenteRimpe)!)}</contribuyenteRimpe>` : ''}
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${fecha}</fechaEmision>
    <dirEstablecimiento>${escapeXml(p.dirEstablecimiento)}</dirEstablecimiento>
    <obligadoContabilidad>${p.obligadoContabilidad || 'NO'}</obligadoContabilidad>
    <tipoIdentificacionComprador>${tipoIdentificacion(p.identificacionComprador)}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(p.razonSocialComprador)}</razonSocialComprador>
    <identificacionComprador>${escapeXml(p.identificacionComprador)}</identificacionComprador>
    ${p.direccionComprador ? `<direccionComprador>${escapeXml(p.direccionComprador)}</direccionComprador>` : ''}
    <totalSinImpuestos>${fmt(totalSinImpuestos)}</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>${totalImpuestosHtml}
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${fmt(importeTotal)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>${pagosHtml}
    </pagos>
  </infoFactura>
  <detalles>${detallesHtml}
  </detalles>${infoAdicional}
</factura>`;

  return xml;
}
