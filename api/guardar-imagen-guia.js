import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || '');
  const match = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1] || 'image/jpeg', base64: match[2] };
}

function extensionFromContentType(contentType) {
  const t = String(contentType || '').toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  return 'jpg';
}

function esErrorBucketNoExiste(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    Number(error?.code) === 404 ||
    msg.includes('no such bucket') ||
    msg.includes('bucket does not exist') ||
    msg.includes('specified bucket does not exist')
  );
}

function obtenerBuckets(projectId) {
  const explicit = String(process.env.FIREBASE_STORAGE_BUCKET || '').trim();
  return Array.from(new Set([
    explicit,
    projectId ? `${projectId}.firebasestorage.app` : '',
    projectId ? `${projectId}.appspot.com` : ''
  ].filter(Boolean)));
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const { dataUrl, especieId } = req.body || {};
  if (!dataUrl || !String(dataUrl).startsWith('data:image/')) {
    return json(res, 400, { error: 'dataUrl de imagen requerido.' });
  }
  if (!especieId) return json(res, 400, { error: 'especieId requerido.' });

  try {
    const { adminStorage } = getFirebaseAdmin();
    const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return json(res, 400, { error: 'dataUrl inválido.' });

    const buffer = Buffer.from(parsed.base64, 'base64');
    const ext = extensionFromContentType(parsed.contentType);
    const objectPath = `guia-personal/${String(especieId)}-${Date.now()}.${ext}`;
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let url = '';
    for (const bucketName of obtenerBuckets(projectId)) {
      try {
        const bucket = adminStorage.bucket(bucketName);
        const file = bucket.file(objectPath);
        await file.save(buffer, {
          resumable: false,
          contentType: parsed.contentType,
          metadata: { metadata: { firebaseStorageDownloadTokens: token } }
        });
        url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
        break;
      } catch (err) {
        if (!esErrorBucketNoExiste(err)) throw err;
      }
    }

    if (!url) return json(res, 500, { error: 'No se encontró un bucket de Storage configurado.' });
    return json(res, 200, { ok: true, url, storagePath: objectPath });
  } catch (error) {
    return json(res, 500, { error: String(error?.message || 'Error interno al guardar la imagen.') });
  }
}
