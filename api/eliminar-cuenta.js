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
    const { uid, email } = req.body || {};
    const uidLimpio = String(uid || '').trim();
    const emailLimpio = String(email || '').trim().toLowerCase();

    if (!uidLimpio && !emailLimpio) {
      return json(res, 400, { error: 'Se requiere un uid o un correo para eliminar la cuenta.' });
    }

    const { adminAuth, adminDb } = getFirebaseAdmin();
    let targetUid = uidLimpio;

    if (!targetUid && emailLimpio) {
      try {
        const userRecord = await adminAuth.getUserByEmail(emailLimpio);
        targetUid = userRecord?.uid || '';
      } catch (error) {
        if (error?.code !== 'auth/user-not-found') {
          throw error;
        }
      }
    }

    if (!targetUid) {
      return json(res, 404, { error: 'No se encontró una cuenta de autenticación asociada.' });
    }

    try {
      await adminAuth.deleteUser(targetUid);
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    try {
      await adminDb.collection('usuarios').doc(targetUid).delete();
    } catch (error) {
      if (error?.code !== 5) {
        throw error;
      }
    }

    return json(res, 200, {
      ok: true,
      uid: targetUid,
      email: emailLimpio || undefined
    });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unexpected error';
    return json(res, 500, { error: message });
  }
}
