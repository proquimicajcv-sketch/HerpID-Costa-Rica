import twilio from 'twilio';
import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';

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

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const telefonoPlano = normalizarTelefono(req.body?.phone);
    if (!telefonoPlano || telefonoPlano.length < 8) {
      return json(res, 400, { error: 'Phone is required and must be valid' });
    }

    const { adminAuth, adminDb } = getFirebaseAdmin();

    const usuariosSnap = await adminDb
      .collection('usuarios')
      .where('telefono', '==', telefonoPlano)
      .limit(1)
      .get();

    if (usuariosSnap.empty) {
      return json(res, 404, { error: 'No account associated with this phone number' });
    }

    const userData = usuariosSnap.docs[0].data() || {};
    const email = String(userData.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return json(res, 422, { error: 'Account does not have a valid recovery email' });
    }

    const actionCodeSettings = process.env.PASSWORD_RESET_CONTINUE_URL
      ? { url: process.env.PASSWORD_RESET_CONTINUE_URL }
      : undefined;

    const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return json(res, 503, {
        error: 'SMS service is not configured yet. Missing Twilio environment variables.'
      });
    }

    const client = twilio(accountSid, authToken);
    const numeroDestino = toE164(telefonoPlano);
    const body = `HerpID Costa Rica: recupera tu contraseña aquí: ${resetLink}`;

    await client.messages.create({
      from: fromNumber,
      to: numeroDestino,
      body
    });

    return json(res, 200, { ok: true });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unexpected error';
    return json(res, 500, { error: message });
  }
}
