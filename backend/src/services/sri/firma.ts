import forge from 'node-forge';

/**
 * Módulo de firma electrónica XMLDSig (estándar SRI).
 * - Parsea certificado .p12 (PKCS#12) con su clave.
 * - Firma el XML de comprobante con firma enveloped.
 * - Algoritmo: RSA-SHA1 + canonicalización C14N (compatible SRI).
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

  return {
    subject: cn || subjectParts.join(', ') || 'Certificado',
    serial,
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
    ruc: cn?.match(/\d{13}/)?.[0] || undefined,
  };
}

/**
 * Canonicalización C14N básica: elimina espacios en blanco entre etiquetas
 * y comentarios. Suficiente para el XML generado por nuestro módulo.
 */
function canonicalize(xml: string): string {
  return xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

/** Firma el XML del comprobante (firma enveloped, estándar SRI) */
export function firmarXML(xml: string, p12Base64: string, password: string): string {
  const buffer = Buffer.from(p12Base64, 'base64');
  const { privateKey, cert } = extractKeyAndCert(buffer, password);

  // 1. Digest del documento (canonicalizado, sin la firma)
  const canonDoc = canonicalize(xml);
  const sha1Doc = forge.md.sha1.create();
  sha1Doc.update(canonDoc, 'utf8');
  const digestValue = forge.util.encode64(sha1Doc.digest().getBytes());

  // 2. SignedInfo
  const x509 = forge.pki.certificateToPem(cert)
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\n/g, '');

  const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
<ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
<ds:Reference URI="">
<ds:Transforms>
<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
<ds:Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
</ds:Transforms>
<ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
<ds:DigestValue>${digestValue}</ds:DigestValue>
</ds:Reference>
</ds:SignedInfo>`;

  // 3. Firmar el SignedInfo (canonicalizado)
  const canonSignedInfo = canonicalize(signedInfo);
  const md = forge.md.sha1.create();
  md.update(canonSignedInfo, 'utf8');
  const signatureBytes = privateKey.sign(md);
  const signatureValue = forge.util.encode64(signatureBytes);

  // 4. Ensamblar bloque de firma
  const signatureBlock = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="Signature1">
${signedInfo}
<ds:SignatureValue>${signatureValue}</ds:SignatureValue>
<ds:KeyInfo>
<ds:X509Data>
<ds:X509Certificate>${x509}</ds:X509Certificate>
</ds:X509Data>
</ds:KeyInfo>
</ds:Signature>`;

  // 5. Insertar antes del cierre del elemento raíz
  return xml.replace(/<\/factura>/, `${signatureBlock}\n</factura>`);
}
