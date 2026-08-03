const STORAGE_KEY_REPORTES_PENDIENTES = 'herpid_reportes_pendientes_v1';

function obtenerAlmacenLocal() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function guardarPendienteLocal(payload) {
  const almacen = obtenerAlmacenLocal();
  if (!almacen) {
    return null;
  }

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

  const pendiente = {
    ...payload,
    guardadoLocalAt: Date.now(),
    guardadoLocal: true
  };

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

export async function persistirAvistamientoConFallback({ payload, guardarRemoto, guardarDirecto }) {
  try {
    const resultado = await guardarRemoto(payload);
    return resultado;
  } catch (error) {
    try {
      if (typeof guardarDirecto === 'function') {
        return await guardarDirecto(payload);
      }
    } catch (directError) {
      // continuar con fallback local
    }

    const pendiente = guardarPendienteLocal(payload);
    if (pendiente) {
      return { ok: true, id: null, guardadoLocal: true, pendiente };
    }

    throw error;
  }
}
