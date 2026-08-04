const STORAGE_KEY_REPORTES_PENDIENTES = 'herpid_reportes_pendientes_v1';
const INDEXED_DB_NAME = 'herpid-reportes-local';
const INDEXED_DB_STORE = 'reportesPendientes';
const MEMORY_QUEUE_KEY = '__herpidReportesPendientesMemoria';
const ERROR_SUBIDA_SERVIDOR_REQUERIDA = 'subida-servidor-requerida';
const ERROR_CONFIG_REPORTE_SERVIDOR = 'La configuracion del servidor para enviar reportes no esta completa. El reporte puede guardarse localmente hasta que Firebase Admin quede configurado.';

function esErrorSubidaServidorRequerida(error) {
  return String(error?.message || '').trim() === ERROR_SUBIDA_SERVIDOR_REQUERIDA;
}

function esErrorConfiguracionServidor(error) {
  const message = String(error?.message || '').trim();
  return message === 'La configuracion de Firebase Admin no esta completa en el servidor.' || /^Missing environment variable: FIREBASE_/i.test(message);
}

function normalizarErrorReporte(error) {
  if (esErrorSubidaServidorRequerida(error)) {
    return new Error('No fue posible completar la subida de fotos del reporte. Intenta nuevamente en unos minutos.');
  }

  if (esErrorConfiguracionServidor(error)) {
    return new Error(ERROR_CONFIG_REPORTE_SERVIDOR);
  }

  return error;
}

function obtenerAlmacenLocal() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function obtenerAlmacenSesion() {
  if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) {
    return globalThis.sessionStorage;
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }

  return null;
}

function crearPendiente(payload) {
  return {
    ...payload,
    guardadoLocalAt: Date.now(),
    guardadoLocal: true
  };
}

function guardarPendienteEnStorage(almacen, payload) {
  if (!almacen) return null;

  const pendientes = (() => {
    try {
      const leer = almacen.getItem || almacen.getltem;
      if (typeof leer !== 'function') return [];
      const raw = leer.call(almacen, STORAGE_KEY_REPORTES_PENDIENTES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  })();

  const pendiente = crearPendiente(payload);
  pendientes.push(pendiente);

  const guardar = almacen.setItem || almacen.setltem;
  if (typeof guardar !== 'function') {
    return null;
  }

  try {
    guardar.call(almacen, STORAGE_KEY_REPORTES_PENDIENTES, JSON.stringify(pendientes));
    return pendiente;
  } catch {
    return null;
  }
}

function guardarPendienteEnMemoria(payload) {
  try {
    if (typeof globalThis === 'undefined') return null;
    const listaActual = Array.isArray(globalThis[MEMORY_QUEUE_KEY]) ? globalThis[MEMORY_QUEUE_KEY] : [];
    const pendiente = crearPendiente(payload);
    globalThis[MEMORY_QUEUE_KEY] = [...listaActual, pendiente];
    return pendiente;
  } catch {
    return null;
  }
}

function obtenerIndexedDb() {
  if (typeof globalThis !== 'undefined' && globalThis.indexedDB) {
    return globalThis.indexedDB;
  }

  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }

  return null;
}

function guardarPendienteEnIndexedDb(payload) {
  const indexedDb = obtenerIndexedDb();
  if (!indexedDb || typeof indexedDb.open !== 'function') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finalizar = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      const request = indexedDb.open(INDEXED_DB_NAME, 1);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(INDEXED_DB_STORE)) {
          database.createObjectStore(INDEXED_DB_STORE, { keyPath: 'id' });
        }
      };

      request.onerror = () => finalizar(null);

      request.onsuccess = () => {
        try {
          const database = request.result;
          const transaction = database.transaction(INDEXED_DB_STORE, 'readwrite');
          const objectStore = transaction.objectStore(INDEXED_DB_STORE);
          const pendiente = {
            id: payload.id || `pendiente-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            ...payload,
            guardadoLocalAt: Date.now(),
            guardadoLocal: true
          };

          const saveRequest = objectStore.put(pendiente);
          saveRequest.onsuccess = () => finalizar(pendiente);
          saveRequest.onerror = () => finalizar(null);

          transaction.onabort = () => finalizar(null);
          transaction.onerror = () => finalizar(null);
        } catch {
          finalizar(null);
        }
      };
    } catch {
      finalizar(null);
    }
  });
}

async function guardarPendienteLocal(payload) {
  const pendienteLocal = guardarPendienteEnStorage(obtenerAlmacenLocal(), payload);
  if (pendienteLocal) {
    return pendienteLocal;
  }

  const pendienteSesion = guardarPendienteEnStorage(obtenerAlmacenSesion(), payload);
  if (pendienteSesion) {
    return pendienteSesion;
  }

  const pendienteIndexedDb = await guardarPendienteEnIndexedDb(payload);
  if (pendienteIndexedDb) {
    return pendienteIndexedDb;
  }

  return guardarPendienteEnMemoria(payload);
}

export async function prepararPayloadAvistamientoConFotosRemotas({
  payload,
  storage,
  ref: refFn,
  uploadString: uploadStringFn,
  getDownloadURL: getDownloadURLFn,
  userId
}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('El payload del avistamiento es inválido.');
  }

  const fotos = Array.isArray(payload?.fotos) ? payload.fotos : [];
  const fotosNormalizadas = [];

  for (let index = 0; index < fotos.length; index += 1) {
    const foto = String(fotos[index] || '').trim();
    if (!foto) continue;

    if (foto.startsWith('http://') || foto.startsWith('https://')) {
      fotosNormalizadas.push(foto);
      continue;
    }

    if (foto.startsWith('data:image/')) {
      const ruta = `avistamientos/${String(userId || 'anonimo').replace(/[^a-zA-Z0-9_-]/g, '_')}/${Date.now()}-${index}`;
      const referencia = typeof refFn === 'function' ? refFn(storage, ruta) : null;
      if (!referencia || typeof uploadStringFn !== 'function') {
        fotosNormalizadas.push(foto);
        continue;
      }

      try {
        await uploadStringFn(referencia, foto, 'data_url');
        const url = typeof getDownloadURLFn === 'function' ? await getDownloadURLFn(referencia) : '';
        if (url) {
          fotosNormalizadas.push(url);
        } else {
          fotosNormalizadas.push(foto);
        }
      } catch {
        fotosNormalizadas.push(foto);
      }
    }
  }

  const fotoAutorizadaRaw = String(payload?.fotoAutorizada || payload?.img || '').trim();
  const fotoAutorizada = (() => {
    if (!fotoAutorizadaRaw && fotosNormalizadas[0]) {
      return fotosNormalizadas[0];
    }

    if (fotoAutorizadaRaw.startsWith('data:image/') && fotosNormalizadas[0]) {
      return fotosNormalizadas[0];
    }

    return fotoAutorizadaRaw || null;
  })();

  return {
    ...payload,
    fotos: fotosNormalizadas,
    fotoAutorizada: fotoAutorizada || null,
    img: fotoAutorizada || fotosNormalizadas[0] || null,
    createdAt: payload.createdAt || Date.now(),
    estado: payload.estado || 'EN REVISIÓN EXPERTA'
  };
}

export async function guardarAvistamientoDirectoCliente({
  payload,
  db,
  storage,
  collection: collectionFn,
  addDoc: addDocFn,
  ref: refFn,
  uploadString: uploadStringFn,
  getDownloadURL: getDownloadURLFn,
  userId
}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('El payload del avistamiento es inválido.');
  }

  const registro = await prepararPayloadAvistamientoConFotosRemotas({
    payload,
    storage,
    ref: refFn,
    uploadString: uploadStringFn,
    getDownloadURL: getDownloadURLFn,
    userId
  });

  const collectionRef = typeof collectionFn === 'function' ? collectionFn(db, 'avistamientos') : null;
  if (!collectionRef || typeof addDocFn !== 'function') {
    throw new Error('No se pudo preparar la colección de Firestore para guardar el reporte.');
  }

  const docRef = await addDocFn(collectionRef, registro);
  return { ok: true, id: docRef?.id || null };
}

export async function persistirAvistamientoConFallback({ payload, guardarRemoto, guardarDirecto }) {
  try {
    const resultado = await guardarRemoto(payload);
    return resultado;
  } catch (error) {
    let errorDirecto = null;

    try {
      if (typeof guardarDirecto === 'function') {
        return await guardarDirecto(payload);
      }
    } catch (directError) {
      errorDirecto = directError;
    }

    const pendiente = await guardarPendienteLocal(payload);
    if (pendiente) {
      return { ok: true, id: null, guardadoLocal: true, pendiente };
    }

    if (errorDirecto) {
      throw normalizarErrorReporte(errorDirecto);
    }

    throw normalizarErrorReporte(error);
  }
}
