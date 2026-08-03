import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

function normalizarTelefono(input) {
  return String(input || '').replace(/\D/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { contacto, motivo, uid } = req.body || {};
    const contactoNormalizado = String(contacto || '').trim().toLowerCase();

    if (!contactoNormalizado) {
      return json(res, 400, { error: 'Se requiere un contacto para notificar.' });
    }

    const { adminDb } = getFirebaseAdmin();
    let emailDestino = contactoNormalizado;

    if (!emailDestino.includes('@')) {
      const telefono = normalizarTelefono(contactoNormalizado);
      const snap = await adminDb.collection('usuarios').where('telefono', '==', telefono).limit(1).get();
      if (snap.empty) {
        return json(res, 404, { error: 'No encontramos una cuenta asociada a ese contacto.' });
      }

      const data = snap.docs[0].data() || {};
      emailDestino = String(data.email || '').trim().toLowerCase();
    }

    if (!emailDestino || !emailDestino.includes('@')) {
      return json(res, 422, { error: 'No encontramos un correo válido para notificar.' });
    }

    const provider = process.env.EMAIL_PROVIDER || 'resend';
    if (provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return json(res, 503, { error: 'Email provider is not configured yet.' });
      }

      const motivoTexto = String(motivo || 'Violación de las reglas de la comunidad').trim();
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'HerpID <onboarding@resend.dev>',
          to: [emailDestino],
          subject: 'HerpID Costa Rica - Cuenta suspendida',
          html: `<p>Tu cuenta en HerpID Costa Rica ha sido suspendida.</p><p>Motivo: <strong>${motivoTexto}</strong>.</p><p>Si crees que esto es un error, contacta a un administrador.</p>`
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'No fue posible enviar el correo.');
      }

      if (uid) {
        await adminDb.collection('usuarios').doc(uid).set({ ultimoAcceso: new Date().toISOString() }, { merge: true });
      }

      return json(res, 200, { ok: true, email: emailDestino });
    }

    return json(res, 501, { error: 'Unsupported email provider' });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unexpected error';
    return json(res, 500, { error: message });
  }
}
