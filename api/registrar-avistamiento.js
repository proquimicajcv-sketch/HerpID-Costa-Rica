import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1] || 'application/octet-stream',
    base64: match[2]
  };
}

function extensionFromContentType(contentType) {
  const tipo = String(contentType || '').toLowerCase();
  if (tipo.includes('png')) return 'png';
  if (tipo.includes('webp')) return 'webp';
  if (tipo.includes('gif')) return 'gif';
  return 'jpg';
}

async function subirFotoDesdeDataUrl({ adminStorage, dataUrl, userId, index }) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return '';

  const buffer = Buffer.from(parsed.base64, 'base64');
  if (!buffer.length) return '';

  const ext = extensionFromContentType(parsed.contentType);
  const safeUserId = String(userId || 'anonimo').replace(/[^a-zA-Z0-9_-]/g, '_');
  const objectPath = `avistamientos/${safeUserId}/${Date.now()}-${index}.${ext}`;
  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const bucket = adminStorage.bucket();
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    resumable: false,
    contentType: parsed.contentType,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    }
  });

  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

async function normalizarFotosRegistro({ adminStorage, fotos, userId }) {
  const salida = [];

  for (let i = 0; i < (Array.isArray(fotos) ? fotos.length : 0); i += 1) {
    const foto = fotos[i];
    const raw = String(foto || '').trim();
    if (!raw) continue;

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      salida.push(raw);
      continue;
    }

    if (raw.startsWith('data:image/')) {
      const subida = await subirFotoDesdeDataUrl({ adminStorage, dataUrl: raw, userId, index: i });
      if (subida) salida.push(subida);
    }
  }

  return salida;
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
    const payload = req.body || {};
    const { adminDb, adminStorage } = getFirebaseAdmin();

    const fotosNormalizadas = await normalizarFotosRegistro({
      adminStorage,
      fotos: payload.fotos,
      userId: payload.userId
    });

    const fotoAutorizadaRaw = String(payload.fotoAutorizada || payload.img || '').trim();
    const fotoAutorizadaEsDataUrl = fotoAutorizadaRaw.startsWith('data:image/');
    const fotoAutorizada = fotoAutorizadaEsDataUrl
      ? (fotosNormalizadas[0] || '')
      : fotoAutorizadaRaw;

    const registro = {
      ...payload,
      fotos: fotosNormalizadas,
      fotoAutorizada: fotoAutorizada || null,
      img: (fotoAutorizada || fotosNormalizadas[0] || null),
      createdAt: payload.createdAt || Date.now(),
      estado: payload.estado || 'EN REVISIÓN EXPERTA'
    };

    if (!Array.isArray(registro.fotos) || registro.fotos.length === 0) {
      return json(res, 400, { error: 'Faltan fotos para el avistamiento.' });
    }

    const ref = await adminDb.collection('avistamientos').add(registro);

    return json(res, 200, { ok: true, id: ref.id });
  } catch (error) {
    const message = error && error.message ? error.message : 'Unexpected error';
    return json(res, 500, { error: message });
  }
}
