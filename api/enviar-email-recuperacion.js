import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { contacto, codigo, resetLink } = req.body || {};
    const contactoNormalizado = String(contacto || '').trim().toLowerCase();
    const codigoNormalizado = String(codigo || '').trim();

    if (!contactoNormalizado || !codigoNormalizado || !resetLink) {
      return json(res, 400, { error: 'Se requiere contacto, código y enlace.' });
    }

    const { adminDb } = getFirebaseAdmin();
    let emailDestino = contactoNormalizado;

    if (!emailDestino.includes('@')) {
      const snap = await adminDb
        .collection('usuarios')
        .where('telefono', '==', contactoNormalizado.replace(/\D/g, ''))
        .limit(1)
        .get();

      if (snap.empty) {
        return json(res, 404, { error: 'No encontramos una cuenta asociada a ese celular.' });
      }

      const data = snap.docs[0].data() || {};
      emailDestino = String(data.email || '').trim().toLowerCase();
    }

    if (!emailDestino || !emailDestino.includes('@')) {
      return json(res, 422, { error: 'No encontramos un correo válido para recuperar la cuenta.' });
    }

    const provider = process.env.EMAIL_PROVIDER || 'resend';
    if (provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return json(res, 503, { error: 'Email provider is not configured yet.' });
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'HerpID <onboarding@resend.dev>',
          to: [emailDestino],
          subject: 'HerpID Costa Rica - Recuperación de contraseña',
          html: `<p>Tu código de recuperación es <strong>${codigoNormalizado}</strong>.</p><p>También puedes usar este enlace para continuar: <a href="${resetLink}">${resetLink}</a></p>`
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'No fue posible enviar el correo.');
      }

      return json(res, 200, { ok: true, email: emailDestino });
    }

    return json(res, 501, { error: 'Unsupported email provider' });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unexpected error';
    return json(res, 500, { error: message });
  }
}
