import { XMLParser } from 'fast-xml-parser';

/**
 * Cliente de Web Services del SRI (SOAP 1.2).
 * - Recepción: envía el comprobante firmado.
 * - Autorización: consulta el estado por clave de acceso.
 *
 * URLs (WSDL):
 *   Ambiente 1 (pruebas):    https://celcer.sri.gob.ec/comprobantes-electronicos-ws/...
 *   Ambiente 2 (producción): https://cel.sri.gob.ec/comprobantes-electronicos-ws/...
 */

export const SRI_URLS: Record<string, { recepcion: string; autorizacion: string }> = {
  '1': {
    recepcion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
    autorizacion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
  },
  '2': {
    recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
    autorizacion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
  },
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

async function soapRequest(url: string, action: string, body: string): Promise<any> {
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: action,
    },
    body: envelope,
  });

  const text = await res.text();
  if (!res.ok) {
    // Extraer el faultstring del SOAP Fault para un mensaje legible
    let msg = `SRI HTTP ${res.status}`;
    try {
      const fault = parser.parse(text);
      const faultstring = fault?.['Envelope']?.['Body']?.['Fault']?.faultstring;
      if (faultstring) msg += `: ${faultstring}`;
      else msg += `: ${text.slice(0, 300)}`;
    } catch {
      msg += `: ${text.slice(0, 300)}`;
    }
    throw new Error(msg);
  }
  return parser.parse(text);
}

export interface SriRecepcionResult {
  estado: string; // RECIBIDA | DEVUELTA
  mensajes: Array<{ identificador: string; mensaje: string; informacionAdicional?: string; tipo?: string }>;
}

/** Envía el XML firmado al SRI (recepción). Devuelve estado RECIBIDA/DEVUELTA + mensajes. */
export async function enviarRecepcion(ambiente: string, xmlFirmado: string): Promise<SriRecepcionResult> {
  const url = SRI_URLS[ambiente]?.recepcion;
  if (!url) throw new Error(`Ambiente SRI inválido: ${ambiente}`);

  const xmlBase64 = Buffer.from(xmlFirmado, 'utf8').toString('base64');
  // IMPORTANTE: el WSDL del SRI define el elemento interno <xml> SIN namespace ({}xml),
  // por lo que NO debe llevar prefijo (enviar <rece:xml> provoca Unmarshalling Error).
  const body = `
    <rece:validarComprobante xmlns:rece="http://ec.gob.sri.ws.recepcion">
      <xml>${xmlBase64}</xml>
    </rece:validarComprobante>`;

  const parsed = await soapRequest(url, 'validarComprobante', body);

  const resp =
    parsed?.['Envelope']?.['Body']?.['validarComprobanteResponse']?.['RespuestaRecepcionComprobante'] ??
    parsed?.['Envelope']?.['Body']?.['respuestaRecepcionComprobante'] ??
    {};

  const estado = String(resp?.estado || 'DEVUELTA');

  // Mensajes (puede ser objeto o arreglo)
  let mensajes: any[] = [];
  const comp = resp?.comprobantes?.comprobante;
  const msgNode = comp?.mensajes?.mensaje ?? comp?.comprobantes?.mensajes?.mensaje;
  if (msgNode) mensajes = Array.isArray(msgNode) ? msgNode : [msgNode];

  return {
    estado,
    mensajes: mensajes.map((m) => ({
      identificador: String(m?.identificador || ''),
      mensaje: String(m?.mensaje || ''),
      informacionAdicional: m?.informacionAdicional ? String(m.informacionAdicional) : undefined,
      tipo: m?.tipo ? String(m.tipo) : undefined,
    })),
  };
}

export interface SriAutorizacionResult {
  estado: string; // AUTORIZADO | NO AUTORIZADO | EN_PROCESO
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  xmlAutorizado?: string;
  mensajes: Array<{ identificador: string; mensaje: string; informacionAdicional?: string; tipo?: string }>;
}

/** Consulta la autorización de un comprobante por clave de acceso. */
export async function consultarAutorizacion(ambiente: string, claveAcceso: string): Promise<SriAutorizacionResult> {
  const url = SRI_URLS[ambiente]?.autorizacion;
  if (!url) throw new Error(`Ambiente SRI inválido: ${ambiente}`);

  // IMPORTANTE: igual que en recepción, el elemento interno <claveAccesoConsultada>
  // debe ir SIN namespace según el WSDL del SRI.
  const body = `
    <aut:autorizacionComprobante xmlns:aut="http://ec.gob.sri.ws.autorizacion">
      <claveAccesoConsultada>${claveAcceso}</claveAccesoConsultada>
    </aut:autorizacionComprobante>`;

  const parsed = await soapRequest(url, 'autorizacionComprobante', body);

  const resp =
    parsed?.['Envelope']?.['Body']?.['autorizacionComprobanteResponse']?.['RespuestaAutorizacionComprobante'] ??
    parsed?.['Envelope']?.['Body']?.['respuestaAutorizacionComprobante'] ??
    {};

  const autorizacion = resp?.autorizaciones?.autorizacion;
  if (!autorizacion) {
    // Sin autorización aún (EN_PROCESO)
    const msgs = autorizacion?.mensajes?.mensaje ? [autorizacion.mensajes.mensaje] : [];
    return {
      estado: 'EN_PROCESO',
      mensajes: Array.isArray(msgs) ? msgs.map((m: any) => ({ identificador: String(m?.identificador || ''), mensaje: String(m?.mensaje || '') })) : [],
    };
  }

  const msgs = autorizacion.mensajes?.mensaje;
  const mensajes = msgs ? (Array.isArray(msgs) ? msgs : [msgs]) : [];

  return {
    estado: String(autorizacion.estado || 'NO AUTORIZADO'),
    numeroAutorizacion: autorizacion.numeroAutorizacion ? String(autorizacion.numeroAutorizacion) : undefined,
    fechaAutorizacion: autorizacion.fechaAutorizacion ? String(autorizacion.fechaAutorizacion) : undefined,
    xmlAutorizado: autorizacion.comprobante ? String(autorizacion.comprobante) : undefined,
    mensajes: mensajes.map((m: any) => ({
      identificador: String(m?.identificador || ''),
      mensaje: String(m?.mensaje || ''),
      informacionAdicional: m?.informacionAdicional ? String(m.informacionAdicional) : undefined,
      tipo: m?.tipo ? String(m.tipo) : undefined,
    })),
  };
}

/** Espera la autorización consultando hasta N veces con espera entre intentos. */
export async function esperarAutorizacion(
  ambiente: string,
  claveAcceso: string,
  maxIntentos = 5,
  esperaMs = 2000
): Promise<SriAutorizacionResult> {
  for (let i = 0; i < maxIntentos; i++) {
    const result = await consultarAutorizacion(ambiente, claveAcceso);
    if (result.estado === 'AUTORIZADO' || result.estado === 'NO AUTORIZADO') {
      return result;
    }
    if (i < maxIntentos - 1) {
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
  return { estado: 'EN_PROCESO', mensajes: [] };
}
