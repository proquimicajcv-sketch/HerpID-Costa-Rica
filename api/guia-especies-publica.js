import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(payload));
}

function normalizarEspecie(id, data) {
  return {
    id: String(id || ''),
    nombreComun: String(data?.nombreComun || data?.nombre || 'Sin nombre'),
    imagenUrl: String(data?.imagenUrl || data?.img || ''),
    descripcionHtml: String(data?.descripcionHtml || data?.desc || ''),
  };
}

async function leerColeccion(adminDb, nombreColeccion) {
  const snap = await adminDb.collection(nombreColeccion).get();
  return snap.docs.map((item) => normalizarEspecie(item.id, item.data()));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const { adminDb } = getFirebaseAdmin();

    let especies = [];
    try {
      especies = await leerColeccion(adminDb, 'guia_especies_manual');
    } catch {
      especies = [];
    }

    if (!Array.isArray(especies) || especies.length === 0) {
      especies = await leerColeccion(adminDb, 'especies_guia');
    }

    return json(res, 200, { ok: true, especies });
  } catch (error) {
    return json(res, 500, { ok: false, error: String(error?.message || 'Error obteniendo guía pública.') });
  }
}
