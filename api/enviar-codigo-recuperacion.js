import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';
import twilio from 'twilio';

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

function normalizarTelefono(input) {
  return String(input || '').replace(/\D/g, '');
}

function toE164(telefono) {
  if (!telefono) return '';
  if (telefono.startsWith('506')) return `+${telefono}`;
  if (telefono.length === 8) return `+506${telefono}`;
  if (telefono.startsWith('00')) return `+${telefono.slice(2)}`;
  return `+${telefono}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { contacto, codigo } = req.body || {};
    const contactoNormalizado = String(contacto || '').trim().toLowerCase();
    const codigoNormalizado = String(codigo || '').trim();

    if (!contactoNormalizado || !codigoNormalizado) {
      return json(res, 400, { error: 'Se requiere contacto y código.' });
    }

    const { adminAuth, adminDb } = getFirebaseAdmin();
    let emailDestino = '';
    let telefonoDestino = '';

    if (contactoNormalizado.includes('@')) {
      emailDestino = contactoNormalizado;
    } else {
      telefonoDestino = normalizarTelefono(contactoNormalizado);
      const snap = await adminDb
        .collection('usuarios')
        .where('telefono', '==', telefonoDestino)
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

    const actionCodeSettings = process.env.PASSWORD_RESET_CONTINUE_URL
      ? { url: process.env.PASSWORD_RESET_CONTINUE_URL }
      : undefined;

    const resetLink = await adminAuth.generatePasswordResetLink(emailDestino, actionCodeSettings);

    if (telefonoDestino) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        return json(res, 503, {
          error: 'SMS service is not configured yet. Missing Twilio environment variables.'
        });
      }

      const client = twilio(accountSid, authToken);
      const body = `HerpID Costa Rica: tu código de recuperación es ${codigoNormalizado}. También puedes usar este enlace: ${resetLink}`;
      await client.messages.create({
        from: fromNumber,
        to: toE164(telefonoDestino),
        body
      });
    }

    return json(res, 200, { ok: true, email: emailDestino });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unexpected error';
    return json(res, 500, { error: message });
  }
}
