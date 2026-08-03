import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload));
}

function normalizarContacto(contacto) {
  const valor = String(contacto || '').trim().toLowerCase();
  if (!valor) return '';
  if (valor.includes('@')) return valor;
  return valor.replace(/\D/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { contacto } = req.body || {};
    const contactoNormalizado = normalizarContacto(contacto);

    if (!contactoNormalizado) {
      return json(res, 400, { error: 'Se requiere un correo o un celular válido.' });
    }

    const { adminAuth, adminDb } = getFirebaseAdmin();
    const { nuevaContrasena } = req.body || {};
    let emailDestino = '';

    if (contactoNormalizado.includes('@')) {
      emailDestino = contactoNormalizado;
    } else {
      const snap = await adminDb
        .collection('usuarios')
        .where('telefono', '==', contactoNormalizado)
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

    if (typeof nuevaContrasena === 'string' && nuevaContrasena.trim().length >= 6) {
      const userRecord = await adminAuth.getUserByEmail(emailDestino);
      await adminAuth.updateUser(userRecord.uid, { password: nuevaContrasena.trim() });
      return json(res, 200, { ok: true, email: emailDestino, changed: true });
    }

    const resetLink = await adminAuth.generatePasswordResetLink(emailDestino);
    return json(res, 200, { ok: true, email: emailDestino, resetLink });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unexpected error';
    return json(res, 500, { error: message });
  }
}
