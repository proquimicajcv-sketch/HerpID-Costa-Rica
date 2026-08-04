import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';

const MAX_PREVIEW_DATA_URL_CHARS = 220000;

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

function esDataUrlImagen(value) {
  return String(value || '').trim().startsWith('data:image/');
}

function esDataUrlLiviano(value) {
  const raw = String(value || '').trim();
  return esDataUrlImagen(raw) && raw.length <= MAX_PREVIEW_DATA_URL_CHARS;
}

function esErrorBucketNoExiste(error) {
  const msg = String(error?.message || '').toLowerCase();
  const code = Number(error?.code || 0);
  return (
    code === 404 ||
    msg.includes('no such bucket') ||
    (msg.includes('bucket') && msg.includes('not found')) ||
    msg.includes('bucket does not exist') ||
    msg.includes('specified bucket does not exist')
  );
}

function obtenerBucketsCandidatos() {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const explicit = String(process.env.FIREBASE_STORAGE_BUCKET || '').trim();
  const fromFirebasestorage = projectId ? `${projectId}.firebasestorage.app` : '';
  const fromAppspot = projectId ? `${projectId}.appspot.com` : '';

  return Array.from(new Set([explicit, fromFirebasestorage, fromAppspot].filter(Boolean)));
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

  const bucketsCandidatos = obtenerBucketsCandidatos();
  let ultimoError = null;

  for (const bucketName of bucketsCandidatos) {
    try {
      const bucket = adminStorage.bucket(bucketName);
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
    } catch (error) {
      ultimoError = error;
      if (!esErrorBucketNoExiste(error)) {
        throw error;
      }
    }
  }

  if (ultimoError) {
    throw ultimoError;
  }

  throw new Error('No hay buckets configurados para Firebase Storage.');
}

async function normalizarFotosRegistro({ adminStorage, fotos, userId }) {
  const salida = [];
  let fotosPendientesStorage = 0;

  for (let i = 0; i < (Array.isArray(fotos) ? fotos.length : 0); i += 1) {
    const foto = fotos[i];
    const raw = String(foto || '').trim();
    if (!raw) continue;

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      salida.push(raw);
      continue;
    }

    if (raw.startsWith('data:image/')) {
      try {
        const subida = await subirFotoDesdeDataUrl({ adminStorage, dataUrl: raw, userId, index: i });
        if (subida) salida.push(subida);
        else fotosPendientesStorage += 1;
      } catch (error) {
        if (esErrorBucketNoExiste(error)) {
          fotosPendientesStorage += 1;
          continue;
        }
        throw error;
      }
    }
  }

  return { fotosNormalizadas: salida, fotosPendientesStorage };
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

    const { fotosNormalizadas, fotosPendientesStorage } = await normalizarFotosRegistro({
      adminStorage,
      fotos: payload.fotos,
      userId: payload.userId
    });

    const fotosEntrada = Array.isArray(payload.fotos) ? payload.fotos : [];
    const conteniaDataUrl = fotosEntrada.some((foto) => String(foto || '').trim().startsWith('data:image/'));

    const fotoAutorizadaRaw = String(payload.fotoAutorizada || payload.img || '').trim();
    const fotoAutorizadaEsDataUrl = fotoAutorizadaRaw.startsWith('data:image/');
    const previewLocal = [payload.fotoMiniaturaLocal, payload.fotoAutorizada, payload.img]
      .map((value) => String(value || '').trim())
      .find((value) => esDataUrlLiviano(value)) || '';

    const fotosPersistidas = fotosNormalizadas.length > 0
      ? fotosNormalizadas
      : (previewLocal ? [previewLocal] : []);

    const fotoAutorizada = fotoAutorizadaEsDataUrl
      ? (fotosNormalizadas[0] || previewLocal || '')
      : fotoAutorizadaRaw;

    const fotosStoragePendiente = Boolean(
      payload.fotosStoragePendiente ||
      fotosPendientesStorage > 0 ||
      (conteniaDataUrl && fotosNormalizadas.length === 0)
    );

    const registro = {
      ...payload,
      fotos: fotosPersistidas,
      fotoAutorizada: fotoAutorizada || null,
      img: (fotoAutorizada || fotosPersistidas[0] || null),
      createdAt: payload.createdAt || Date.now(),
      estado: payload.estado || 'EN REVISIÓN EXPERTA',
      fotosStoragePendiente,
      fotoSubidaAFirebase: !fotosStoragePendiente && fotosPersistidas.length > 0
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
