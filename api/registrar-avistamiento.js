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
    const payload = req.body || {};
    const registro = {
      ...payload,
      createdAt: payload.createdAt || Date.now(),
      estado: payload.estado || 'EN REVISIÓN EXPERTA'
    };

    if (!Array.isArray(registro.fotos) || registro.fotos.length === 0) {
      return json(res, 400, { error: 'Faltan fotos para el avistamiento.' });
    }

    const { adminDb } = getFirebaseAdmin();
    const ref = await adminDb.collection('avistamientos').add(registro);

    return json(res, 200, { ok: true, id: ref.id });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unexpected error';
    return json(res, 500, { error: message });
  }
}
