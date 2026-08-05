import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

/**
 * Módulo de firma electrónica XMLDSig (estándar SRI).
 * - Parsea certificado .p12 (PKCS#12) con su clave.
 * - Firma el XML de comprobante con firma enveloped.
 * - Algoritmo: RSA-SHA1 + canonicalización C14N real (xml-crypto),
 *   el mismo comportamiento que exige el SRI.
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

/** Firma el XML del comprobante (firma enveloped, estándar SRI) */
export function firmarXML(xml: string, p12Base64: string, password: string): string {
  const buffer = Buffer.from(p12Base64, 'base64');
  const { privateKey, chain } = extractP12(buffer, password);

  // La llave privada en formato PEM para xml-crypto
  const pem = forge.pki.privateKeyToPem(privateKey);

  const sig = new SignedXml();
  sig.signingKey = pem;
  sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  // C14N ESTÁNDAR (el SRI rechaza el exclusive-c14n que xml-crypto usa por defecto)
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

  // Transformaciones: enveloped-signature + C14N (estándar SRI), URI vacía
  // (URI="" firma TODO el documento; es lo que genera el jFirmador oficial del SRI)
  sig.addReference(
    "//*[local-name(.)='factura']",
    ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    'http://www.w3.org/2000/09/xmldsig#sha1',
    '',
    '',
    '',
    true // isEmptyUri → genera URI=""
  );

  sig.computeSignature(xml, {
    prefix: 'ds',
    attrs: { Id: 'Signature1' },
    location: { reference: "//*[local-name(.)='factura']", action: 'append' },
  });

  const signed = sig.getSignedXml();

  // REEMPLAZAR el KeyInfo generado por xml-crypto por uno correcto con la
  // CADENA COMPLETA de certificados: un elemento <ds:X509Certificate> por
  // certificado (titular + CA intermedia + raíz), como genera el jFirmador.
  // El SRI necesita la cadena para validar la confianza del certificado.
  // El KeyInfo no forma parte de la firma, así que modificarlo NO invalida el SignatureValue.
  // IMPORTANTE: el PEM de node-forge usa CRLF; hay que eliminar \r Y \n del
  // base64 (un \r residual corrompe el certificado al decodificarlo y el SRI
  // rechaza la firma con "No tiene Cadena de Confianza Valida").
  const cadenaX509 = chain
    .map(
      (c) =>
        `<ds:X509Certificate>${forge.pki
          .certificateToPem(c)
          .replace(/-----BEGIN CERTIFICATE-----/, '')
          .replace(/-----END CERTIFICATE-----/, '')
          .replace(/[\r\n]/g, '')}</ds:X509Certificate>`
    )
    .join('');
  const keyInfoCorrecto = `<ds:KeyInfo><ds:X509Data>${cadenaX509}</ds:X509Data></ds:KeyInfo>`;

  let finalXml: string;
  if (signed.includes('<ds:KeyInfo>')) {
    finalXml = signed.replace(/<ds:KeyInfo>[\s\S]*?<\/ds:KeyInfo>/, keyInfoCorrecto);
  } else {
    finalXml = signed.replace('</ds:Signature>', `${keyInfoCorrecto}</ds:Signature>`);
  }
  return finalXml;
}
