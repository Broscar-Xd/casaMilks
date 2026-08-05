import forge from 'node-forge';
import crypto from 'crypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { setNodeDependencies } from 'xml-core';
import { Application } from 'xmldsigjs';
import {
  SignedXml,
} from 'xadesjs';
import {
  KeyInfo,
  KeyInfoX509Data,
  Reference,
  XmlDsigEnvelopedSignatureTransform,
  XmlDsigC14NTransform,
} from 'xmldsigjs';

// Configuración única del entorno para xadesjs (WebCrypto + DOM)
Application.setEngine('node-webcrypto', crypto.webcrypto as any);
setNodeDependencies({ DOMParser, XMLSerializer } as any);

/**
 * Módulo de firma electrónica XAdES-EPES (estándar SRI).
 * Usa xadesjs (implementación oficial de XAdES en JS, interoperable con
 * Apache Santuario — el validador del SRI) para generar la firma con:
 * - <xades:SigningTime>: fecha/hora de la firma (hoy)
 * - <xades:SigningCertificate>: digest del certificado + issuer/serial
 * - Referencia firmada a las SignedProperties
 * El .p12 se parsea con node-forge (llave + certificado).
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

/** Base64 de un certificado en una sola línea (sin cabeceras ni CR/LF). */
function certBase64(cert: forge.pki.Certificate): string {
  return forge.pki
    .certificateToPem(cert)
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/[\r\n]/g, '');
}

/**
 * Firma el XML del comprobante con XAdES-EPES (estándar SRI).
 * Genera la firma con SigningTime (hoy) y SigningCertificate,
 * exactamente como la espera Apache Santuario y el validador FirmaEC.
 */
export async function firmarXML(xml: string, p12Base64: string, password: string): Promise<string> {
  const buffer = Buffer.from(p12Base64, 'base64');
  const { privateKey, cert } = extractP12(buffer, password);

  // Llave privada en JWK (desde los BigIntegers de forge) para WebCrypto
  const hexToB64 = (hex: string) => Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex').toString('base64');
  const k = privateKey;
  const jwk = {
    kty: 'RSA',
    n: hexToB64(k.n.toString(16)),
    e: hexToB64(k.e.toString(16)),
    d: hexToB64(k.d.toString(16)),
    p: hexToB64(k.p.toString(16)),
    q: hexToB64(k.q.toString(16)),
    dp: hexToB64(k.dP.toString(16)),
    dq: hexToB64(k.dQ.toString(16)),
    qi: hexToB64(k.qInv.toString(16)),
    alg: 'RS1',
    ext: true,
  };
  const key = await crypto.webcrypto.subtle.importKey(
    'jwk',
    jwk as any,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    false,
    ['sign']
  );

  // Certificado (DER para el KeyInfo)
  const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary');
  const x509b64 = certBase64(cert);

  const signed = new SignedXml();
  // C14N estándar + RSA-SHA1 (compatibilidad SRI)
  signed.XmlSignature.SignedInfo.CanonicalizationMethod.Algorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  signed.XmlSignature.SignedInfo.SignatureMethod.Algorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';

  // Referencia al documento (enveloped + C14N)
  const ref = new Reference();
  ref.Uri = '';
  ref.Transforms.Add(new XmlDsigEnvelopedSignatureTransform());
  ref.Transforms.Add(new XmlDsigC14NTransform());
  ref.DigestMethod.Algorithm = 'http://www.w3.org/2000/09/xmldsig#sha1';
  signed.XmlSignature.SignedInfo.References.Add(ref);

  // KeyInfo con el certificado del firmante
  signed.XmlSignature.KeyInfo = new KeyInfo();
  signed.XmlSignature.KeyInfo.Add(new KeyInfoX509Data(new Uint8Array(certDer)));

  // Firmar (XAdES agrega automáticamente SignedProperties con SigningTime HOY
  // y SigningCertificate con digest SHA-1)
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  await signed.Sign({ name: 'RSASSA-PKCS1-v1_5' }, key, doc.documentElement as any, {
    location: { reference: "//*[local-name(.)='factura']", action: 'append' } as any,
    signingCertificate: { certificate: x509b64, digestAlgorithm: 'SHA-1' },
  } as any);

  // Serializar la firma e insertarla antes del cierre del elemento raíz
  const firmaXml = new XMLSerializer().serializeToString(signed.XmlSignature.GetXml());
  return xml.replace(/<\/factura>/, `${firmaXml}</factura>`);
}
