/* Prueba de envío de correo desde el contenedor.
 * Ejecutar en el contenedor: node test-mail.js
 * Envía un correo de prueba desde el proveedor configurado a sí mismo.
 */
const nodemailer = require('./backend/node_modules/nodemailer');

(async () => {
  // Modo Brevo (API HTTPS 443)
  if (process.env.MAIL_PROVIDER === 'brevo' && process.env.MAIL_API_KEY) {
    console.log('Modo: BREVO API');
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.MAIL_API_KEY,
      },
      body: JSON.stringify({
        sender: { email: process.env.MAIL_FROM || 'milkslocal@gmail.com', name: 'Casa Milks' },
        to: [{ email: process.env.MAIL_TO || 'milkslocal@gmail.com' }],
        subject: '✅ Prueba de correo — Casa Milks POS (Brevo)',
        htmlContent: '<h2>¡Correo configurado correctamente!</h2><p>Este es un correo de prueba del sistema de facturación electrónica de Casa Milks.</p>',
      }),
    });
    const body = await res.text();
    if (res.ok) {
      console.log('✅ CORREO ENVIADO vía Brevo:', body.slice(0, 200));
      process.exit(0);
    } else {
      console.error('❌ ERROR Brevo:', res.status, body.slice(0, 300));
      process.exit(1);
    }
  }

  // Modo Resend (API HTTPS 443)
  if (process.env.MAIL_PROVIDER === 'resend' && process.env.MAIL_API_KEY) {
    console.log('Modo: RESEND API');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MAIL_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || 'Casa Milks <onboarding@resend.dev>',
        to: [process.env.MAIL_TO || 'milkslocal@gmail.com'],
        subject: '✅ Prueba de correo — Casa Milks POS (Resend)',
        html: '<h2>¡Correo configurado correctamente!</h2><p>Este es un correo de prueba del sistema de facturación electrónica de Casa Milks.</p>',
      }),
    });
    const body = await res.text();
    if (res.ok) {
      console.log('✅ CORREO ENVIADO vía Resend:', body.slice(0, 200));
      process.exit(0);
    } else {
      console.error('❌ ERROR Resend:', res.status, body.slice(0, 300));
      process.exit(1);
    }
  }

  // Modo SMTP
  const host = process.env.MAIL_HOST;
  if (!host) { console.log('MAIL_HOST no configurado'); process.exit(1); }

  console.log('Enviando correo de prueba con:');
  console.log('  host:', host, '| port:', process.env.MAIL_PORT, '| user:', process.env.MAIL_USER);

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to: process.env.MAIL_TO || process.env.MAIL_USER,
      subject: '✅ Prueba de correo — Casa Milks POS',
      html: '<h2>¡Correo configurado correctamente!</h2><p>Este es un correo de prueba del sistema de facturación electrónica de Casa Milks.</p>',
    });
    console.log('✅ CORREO ENVIADO:', info.messageId);
    console.log('Respuesta:', info.response);
    process.exit(0);
  } catch (e) {
    console.error('❌ ERROR AL ENVIAR:', e.message);
    console.error('Código:', e.code || 'N/A');
    if (e.message.includes('Username and Password not accepted') || e.message.includes('535')) {
      console.error('\n>>> Gmail rechazó las credenciales. Necesitas una CONTRASEÑA DE APLICACIÓN:');
      console.error('>>> Google Account → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones');
    }
    if (e.message.includes('ETIMEDOUT') || e.message.includes('timeout')) {
      console.error('\n>>> TIMEOUT: Railway bloquea los puertos SMTP (25/465/587).');
      console.error('>>> Usa Resend API: MAIL_PROVIDER=resend + MAIL_API_KEY=re_... (https://resend.com)');
    }
    process.exit(1);
  }
})();
