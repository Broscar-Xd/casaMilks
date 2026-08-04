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

/** Extrae llave privada y certificado del .p12 */
function extractKeyAndCert(p12Buffer: Buffer, password: string): { privateKey: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate } {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString('binary')));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

  // Llave privada (puede venir en keyBag o shroudedKeyBag)
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ];
  if (!keyBags.length) throw new Error('No se encontró una llave privada en el archivo .p12');
  const privateKey = keyBags[0].key as forge.pki.rsa.PrivateKey;

  // Certificado
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (!certBags.length) throw new Error('No se encontró un certificado en el archivo .p12');
  const cert = certBags[0].cert as forge.pki.Certificate;

  return { privateKey, cert };
}

/** Obtiene información del certificado para mostrarla en admin */
export function getCertInfo(p12Base64: string, password: string): CertInfo {
  const buffer = Buffer.from(p12Base64, 'base64');
  const { cert } = extractKeyAndCert(buffer, password);

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
  const { privateKey, cert } = extractKeyAndCert(buffer, password);

  // La llave privada y el certificado en formato PEM para xml-crypto
  const pem = forge.pki.privateKeyToPem(privateKey);
  const certPem = forge.pki.certificateToPem(cert);

  const sig = new SignedXml();
  sig.privateKey = pem;
  sig.publicCert = certPem;
  sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

  // Transformaciones: enveloped-signature + C14N (estándar SRI)
  sig.addReference({
    xpath: "//*[local-name(.)='factura']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    uri: '',
    isEmptyUri: true,
  });

  sig.computeSignature(xml, {
    prefix: 'ds',
    location: { reference: "//*[local-name(.)='factura']", action: 'append' },
  });

  return sig.getSignedXml();
}
