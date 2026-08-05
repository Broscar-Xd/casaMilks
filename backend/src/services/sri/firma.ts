import forge from 'node-forge';
import crypto from 'crypto';

/**
 * Módulo de firma electrónica XMLDSig (estándar SRI).
 * - Parsea certificado .p12 (PKCS#12) con su clave.
 * - Firma el XML de comprobante con firma enveloped.
 * - Algoritmo: RSA-SHA1 + canonicalización C14N 1.0 aplicada DIRECTAMENTE
 *   al string del XML (sin DOM intermedio).
 *
 * NOTA IMPORTANTE: no se usa xml-crypto porque su parser (xmldom) re-serializa
 * el documento al canonicalizar (cambiando espacios/auto-cierre), generando un
 * DigestValue distinto al que calcula el validador del SRI (Apache Santuario)
 * → "El nodo [comprobante] no se encuentra firmado". La firma manual con C14N
 * sobre el string exacto es el mismo enfoque del jFirmador del SRI y de la
 * librería ecuatoriana firma-ec, probada en producción.
 */

export interface CertInfo {
  subject: string;
  serial: string;
  notBefore: Date;
  notAfter: Date;
  ruc?: string;
}

interface P12Data {
  privateKey: forge.pki.rsa.PrivateKey;
  cert: forge.pki.Certificate;
  chain: forge.pki.Certificate[]; // todos los certificados del .p12 (titular + CA intermedia + raíz)
}

/** Extrae llave privada y TODOS los certificados del .p12 */
function extractP12(p12Buffer: Buffer, password: string): P12Data {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString('binary')));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  // Llave privada (puede venir en keyBag o shroudedKeyBag)
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  if (!keyBags.length) throw new Error('No se encontró una llave privada en el archivo .p12');
  const privateKey = keyBags[0].key as forge.pki.rsa.PrivateKey;

  // TODOS los certificados (el primero es el del titular; los demás son la cadena)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (!certBags.length) throw new Error('No se encontró un certificado en el archivo .p12');
  const chain = certBags.map((b) => b.cert as forge.pki.Certificate);
  const cert = chain[0];

  return { privateKey, cert, chain };
}

/** Obtiene información del certificado para mostrarla en admin */
export function getCertInfo(p12Base64: string, password: string): CertInfo {
  const buffer = Buffer.from(p12Base64, 'base64');
  const { cert } = extractP12(buffer, password);

  const subjectParts = cert.subject.attributes
    .map((a: any) => (a.name === 'commonName' || a.name === 'organizationName' ? a.value : null))
    .filter(Boolean);

  // El RUC normalmente viene en el commonName o en el serial del certificado
  const cn = cert.subject.getField('CN')?.value as string | undefined;
  const serial = cert.serialNumber;

  // RUC del certificado: 13 dígitos en CN, o cédula (10 dígitos) + "001" desde el serial
  const cnRuc = cn?.match(/\d{13}/)?.[0];
  const serialDigits = serial?.replace(/\D/g, '');
  const cedulaEnSerial = serialDigits?.match(/\d{10}/)?.[0];
  const ruc = cnRuc || (cedulaEnSerial ? cedulaEnSerial + '001' : undefined);

  return {
    subject: cn || subjectParts.join(', ') || 'Certificado',
    serial,
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
    ruc,
  };
}

/**
 * Canonicalización C14N 1.0 aplicada al string del XML.
 * Para documentos generados por nuestro módulo (sin comentarios, sin CDATA,
 * sin PIs, sin DOCTYPE, atributos ya ordenados, texto ya escapado):
 * 1. Quitar el prólogo XML
 * 2. Normalizar CRLF → LF
 * 3. CR en el contenido → &#13;
 * IMPORTANTE: NO se eliminan los espacios en blanco entre etiquetas:
 * son nodos de texto significativos en C14N y el SRI los preserva.
 */
function canonicalize(xml: string): string {
  return xml
    .replace(/<\?xml[^>]*\?>/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '&#13;');
}

/** Base64 de un certificado en una sola línea (sin cabeceras ni CR/LF). */
function certBase64(cert: forge.pki.Certificate): string {
  return forge.pki
    .certificateToPem(cert)
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/[\r\n]/g, '');
}

/** Firma el XML del comprobante (firma enveloped, estándar SRI) */
export function firmarXML(xml: string, p12Base64: string, password: string): string {
  const buffer = Buffer.from(p12Base64, 'base64');
  const { privateKey, chain } = extractP12(buffer, password);
  const pem = forge.pki.privateKeyToPem(privateKey);

  // 1. Canonicalizar el documento: quitar el prólogo. El XML ya viene
  // MINIFICADO (sin espacios entre etiquetas), así que su forma canónica
  // es idéntica para cualquier parser (la calcula igual el SRI).
  const canonDoc = canonicalize(xml);
  const digestValue = crypto.createHash('sha1').update(canonDoc, 'utf8').digest('base64');

  // 2. SignedInfo MINIFICADO (URI="" → firma de todo el documento, como el jFirmador).
  // IMPORTANTE: C14N NO usa self-closing tags (<x/> se representa como <x></x>);
  // por eso los elementos vacíos van con etiqueta de cierre explícita.
  const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></ds:SignatureMethod><ds:Reference URI=""><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></ds:Transform><ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></ds:DigestMethod><ds:DigestValue>${digestValue}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;

  // 3. Firmar el SignedInfo canonicalizado con RSA-SHA1 estándar
  // (crypto.createSign genera PKCS#1 v1.5 con DigestInfo, el formato exacto
  // que verifica Apache Santuario en el SRI; node-forge no lo hace).
  const canonSignedInfo = canonicalize(signedInfo);
  const signer = crypto.createSign('RSA-SHA1');
  signer.update(canonSignedInfo, 'utf8');
  const signatureValue = signer.sign(pem, 'base64');

  // 4. KeyInfo con la CADENA COMPLETA de certificados (un elemento por cert)
  const cadenaX509 = chain.map((c) => `<ds:X509Certificate>${certBase64(c)}</ds:X509Certificate>`).join('');

  // 5. Ensamblar la firma y añadirla ANTES del cierre del elemento raíz,
  // SIN saltos de línea alrededor: el transform enveloped del SRI elimina la
  // firma y el documento debe quedar EXACTAMENTE como se calculó el digest.
  const signatureBlock = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="Signature1">${signedInfo}<ds:SignatureValue>${signatureValue}</ds:SignatureValue><ds:KeyInfo><ds:X509Data>${cadenaX509}</ds:X509Data></ds:KeyInfo></ds:Signature>`;

  return xml.replace(/<\/factura>/, `${signatureBlock}</factura>`);
}
