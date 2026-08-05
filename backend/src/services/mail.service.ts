import nodemailer from 'nodemailer';
import { prisma } from '../config/database';

/**
 * Servicio de correo electrónico para el envío de facturas electrónicas.
 *
 * SOPORTA 3 PROVEEDORES (todos por API HTTPS 443 — funcionan desde Railway):
 *
 * 1) Brevo (antes Sendinblue) — RECOMENDADO, gratis 300 correos/día:
 *    - Crear cuenta en https://brevo.com y verificar el correo emisor (Senders)
 *    - Variables:
 *      MAIL_PROVIDER=brevo
 *      MAIL_API_KEY=xkeysib-... (API key de Brevo)
 *      MAIL_FROM="Casa Milks <milkslocal@gmail.com>"
 *    - No requiere dominio; el correo sale del email verificado
 *
 * 2) Resend API — gratis 100 correos/día, requiere dominio verificado:
 *    - Variables:
 *      MAIL_PROVIDER=resend
 *      MAIL_API_KEY=re_xxx
 *      MAIL_FROM="Casa Milks <ventas@tudominio.com>"
 *
 * 3) SMTP clásico (MAIL_HOST/MAIL_PORT/MAIL_USER/MAIL_PASS):
 *    - ⚠️ Railway bloquea los puertos SMTP (25/465/587) — NO usar con Railway
 */
function isBrevoConfigured(): boolean {
  return process.env.MAIL_PROVIDER === 'brevo' && !!process.env.MAIL_API_KEY;
}

function isResendConfigured(): boolean {
  return process.env.MAIL_PROVIDER === 'resend' && !!process.env.MAIL_API_KEY;
}

/** Envía vía API de Brevo (HTTPS 443 — funciona desde Railway). */
async function sendViaBrevo(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.MAIL_API_KEY || '',
    },
    body: JSON.stringify({
      sender: { email: params.from },
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo API ${res.status}: ${body.slice(0, 200)}`);
  }
}

/** Crea el transporte SMTP (si está configurado). */
function createTransporter() {
  const host = process.env.MAIL_HOST;
  if (!host) return null; // SMTP no configurado → no se envía correo

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER || '',
      pass: process.env.MAIL_PASS || '',
    },
  });
}

/** Envía vía API de Resend (HTTPS 443 — funciona desde Railway). */
async function sendViaResend(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.MAIL_API_KEY}`,
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API ${res.status}: ${body.slice(0, 200)}`);
  }
}

/** Genera el HTML del correo con los datos de la factura autorizada. */
function buildInvoiceHtml(params: {
  businessName: string;
  cliente: string;
  numeroAutorizacion: string;
  claveAcceso: string;
  sequential: string;
  total: string;
  fechaEmision: string;
}) {
  const { businessName, cliente, numeroAutorizacion, claveAcceso, sequential, total, fechaEmision } = params;
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#3b2416,#5a3a23);padding:24px;text-align:center;">
            <h1 style="color:#f3e0c3;margin:0;font-size:22px;">${businessName}</h1>
            <p style="color:#c9a87c;margin:8px 0 0;font-size:13px;">Factura Electrónica</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px;">
            <p style="margin:0 0 16px;font-size:15px;color:#333;">Hola <strong>${cliente}</strong>,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.5;">
              Te compartimos tu factura electrónica autorizada por el SRI. <br>
              Gracias por tu compra.
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf6ef;border:1px solid #e8dcc8;border-radius:8px;padding:16px;font-size:13px;color:#444;">
              <tr><td style="padding:6px 12px;color:#8a6f52;width:140px;">Número de autorización</td><td style="padding:6px 12px;font-weight:bold;color:#2e7d32;word-break:break-all;">${numeroAutorizacion}</td></tr>
              <tr><td style="padding:6px 12px;color:#8a6f52;">Clave de acceso</td><td style="padding:6px 12px;font-family:monospace;word-break:break-all;">${claveAcceso}</td></tr>
              <tr><td style="padding:6px 12px;color:#8a6f52;">Comprobante</td><td style="padding:6px 12px;">${sequential}</td></tr>
              <tr><td style="padding:6px 12px;color:#8a6f52;">Fecha de emisión</td><td style="padding:6px 12px;">${fechaEmision}</td></tr>
              <tr><td style="padding:6px 12px;color:#8a6f52;">Total</td><td style="padding:6px 12px;font-weight:bold;color:#3b2416;">${total}</td></tr>
            </table>
            <p style="margin:20px 0 0;font-size:12px;color:#999;line-height:1.5;">
              Puedes verificar la validez de esta factura en el portal del SRI usando la clave de acceso.<br>
              Este correo fue generado automáticamente por el sistema de facturación.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Envía el correo de factura electrónica autorizada al cliente.
 * No lanza errores (si el correo falla, no bloquea la venta).
 */
export async function enviarFacturaPorCorreo(params: {
  to: string;
  invoiceName: string;
  numeroAutorizacion: string;
  claveAcceso: string;
  sequential: string;
  total: string;
  fechaEmision: string;
  branchId: string;
}): Promise<{ enviado: boolean; error?: string }> {
  const branch = await prisma.branch.findUnique({ where: { id: params.branchId } });
  const businessName = branch?.name || 'Casa Milks';

  const html = buildInvoiceHtml({
    businessName,
    cliente: params.invoiceName,
    numeroAutorizacion: params.numeroAutorizacion,
    claveAcceso: params.claveAcceso,
    sequential: params.sequential,
    total: params.total,
    fechaEmision: params.fechaEmision,
  });
  const subject = `Factura Electrónica Autorizada — ${businessName}`;

  try {
    if (isBrevoConfigured()) {
      // 1) Brevo API (recomendado — HTTPS 443, gratis 300/día, sin dominio)
      await sendViaBrevo({
        from: process.env.MAIL_FROM || 'Casa Milks',
        to: params.to,
        subject,
        html,
      });
      return { enviado: true };
    }

    if (isResendConfigured()) {
      // 2) Resend API (HTTPS 443)
      await sendViaResend({
        from: process.env.MAIL_FROM || 'Casa Milks <onboarding@resend.dev>',
        to: params.to,
        subject,
        html,
      });
      return { enviado: true };
    }

    // 3) SMTP clásico
    const transporter = createTransporter();
    if (!transporter) return { enviado: false, error: 'Correo no configurado (faltan MAIL_API_KEY o MAIL_HOST)' };

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER || 'Facturación',
      to: params.to,
      subject,
      html,
    });
    return { enviado: true };
  } catch (err: any) {
    return { enviado: false, error: err?.message || 'Error al enviar correo' };
  }
}
