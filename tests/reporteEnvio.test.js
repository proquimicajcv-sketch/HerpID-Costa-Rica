import test from 'node:test';
import assert from 'node:assert/strict';
import { persistirAvistamientoConFallback, guardarAvistamientoDirectoCliente, prepararPayloadAvistamientoConFotosRemotas } from '../src/utils/reporteEnvio.js';

test('usa el guardado directo cuando el backend falla', async () => {
  let remotoLlamado = false;
  let directoLlamado = false;

  const resultado = await persistirAvistamientoConFallback({
    payload: { ubicacion: 'Prueba' },
    guardarRemoto: async () => {
      remotoLlamado = true;
      throw new Error('backend-down');
    },
    guardarDirecto: async () => {
      directoLlamado = true;
      return { ok: true, id: 'doc-1' };
    }
  });

  assert.equal(remotoLlamado, true);
  assert.equal(directoLlamado, true);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.id, 'doc-1');
});

test('guarda el reporte como pendiente local cuando fallan remoto y directo', async () => {
  const store = {};
  const localStorageMock = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    }
  };

  globalThis.localStorage = localStorageMock;
  globalThis.window = { localStorage: localStorageMock };

  const resultado = await persistirAvistamientoConFallback({
    payload: { ubicacion: 'Pendiente local' },
    guardarRemoto: async () => {
      throw new Error('backend-down');
    },
    guardarDirecto: async () => {
      throw new Error('direct-down');
    }
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.guardadoLocal, true);
  assert.match(store.herpid_reportes_pendientes_v1, /Pendiente local/);
});

test('usa IndexedDB cuando localStorage no soporta el tamano del reporte', async () => {
  const store = {};
  const localStorageMock = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem() {
      throw new Error('QuotaExceededError');
    }
  };

  const registrosGuardados = [];
  const indexedDbMock = {
    open() {
      const request = {
        result: {
          objectStoreNames: {
            contains() {
              return false;
            }
          },
          createObjectStore() {},
          transaction() {
            const transaction = {
              onabort: null,
              onerror: null,
              objectStore() {
                return {
                  put(payload) {
                    registrosGuardados.push(payload);
                    const putRequest = { onsuccess: null, onerror: null };
                    queueMicrotask(() => {
                      if (typeof putRequest.onsuccess === 'function') {
                        putRequest.onsuccess();
                      }
                    });
                    return putRequest;
                  }
                };
              }
            };
            return transaction;
          }
        },
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null
      };

      queueMicrotask(() => {
        if (typeof request.onupgradeneeded === 'function') {
          request.onupgradeneeded();
        }
        if (typeof request.onsuccess === 'function') {
          request.onsuccess();
        }
      });

      return request;
    }
  };

  globalThis.localStorage = localStorageMock;
  globalThis.window = { localStorage: localStorageMock, indexedDB: indexedDbMock };
  globalThis.indexedDB = indexedDbMock;

  const resultado = await persistirAvistamientoConFallback({
    payload: { ubicacion: 'Pendiente en indexeddb', fotos: ['data:image/jpeg;base64,AAAA'] },
    guardarRemoto: async () => {
      throw new Error('backend-down');
    },
    guardarDirecto: async () => {
      throw new Error('direct-down');
    }
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.guardadoLocal, true);
  assert.equal(registrosGuardados.length, 1);
  assert.equal(registrosGuardados[0].ubicacion, 'Pendiente en indexeddb');
});

test('usa memoria de sesion cuando no hay localStorage, sessionStorage ni IndexedDB', async () => {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  delete globalThis.indexedDB;
  delete globalThis.window;

  const resultado = await persistirAvistamientoConFallback({
    payload: { ubicacion: 'Pendiente en memoria' },
    guardarRemoto: async () => {
      throw new Error('backend-down');
    },
    guardarDirecto: async () => {
      throw new Error('direct-down');
    }
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.guardadoLocal, true);
  assert.equal(resultado.pendiente.ubicacion, 'Pendiente en memoria');
});

test('no expone el error interno de subida-servidor-requerida si el fallback tambien falla', async () => {
  delete globalThis.localStorage;
  delete globalThis.window;
  delete globalThis.indexedDB;

  const resultado = await persistirAvistamientoConFallback({
    payload: { ubicacion: 'Sin almacenamiento local' },
    guardarRemoto: async () => {
      throw new Error('subida-servidor-requerida');
    },
    guardarDirecto: async () => {
      throw new Error('No fue posible registrar el avistamiento en el backend.');
    }
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.guardadoLocal, true);
});

test('traduce errores de configuracion FIREBASE del backend a un mensaje entendible', async () => {
  delete globalThis.localStorage;
  delete globalThis.window;
  delete globalThis.indexedDB;

  const resultado = await persistirAvistamientoConFallback({
    payload: { ubicacion: 'Backend sin Firebase Admin' },
    guardarRemoto: async () => {
      throw new Error('subida-servidor-requerida');
    },
    guardarDirecto: async () => {
      throw new Error('Missing environment variable: FIREBASE_CLIENT_EMAIL');
    }
  });

  assert.equal(resultado.ok, true);
  assert.equal(resultado.guardadoLocal, true);
});

test('sube fotos en data URL y guarda el avistamiento directamente en Firebase', async () => {
  const documentos = [];
  let uploadCalls = 0;

  const resultado = await guardarAvistamientoDirectoCliente({
    payload: {
      nombreComun: 'Lanza',
      fotos: ['data:image/png;base64,AAAA']
    },
    db: {},
    storage: {},
    uploadString: async () => {
      uploadCalls += 1;
    },
    getDownloadURL: async () => 'https://storage.example/foto.png',
    collection: () => ({}) ,
    addDoc: async (_collection, payload) => {
      documentos.push(payload);
      return { id: 'doc-123' };
    },
    ref: (_storage, path) => ({ path }),
    userId: 'usuario-1'
  });

  assert.equal(uploadCalls, 1);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.id, 'doc-123');
  assert.equal(documentos[0].fotos[0], 'https://storage.example/foto.png');
  assert.equal(documentos[0].img, 'https://storage.example/foto.png');
  assert.equal(documentos[0].fotoAutorizada, 'https://storage.example/foto.png');
});

test('prepara un payload con URLs remotas para que las fotos se vean en otros dispositivos', async () => {
  const resultado = await prepararPayloadAvistamientoConFotosRemotas({
    payload: {
      nombreComun: 'Lanza',
      fotos: ['data:image/png;base64,AAAA'],
      fotoAutorizada: 'data:image/png;base64,AAAA'
    },
    storage: {},
    uploadString: async () => {},
    getDownloadURL: async () => 'https://storage.example/foto.png',
    ref: (_storage, path) => ({ path }),
    userId: 'usuario-1'
  });

  assert.equal(resultado.fotos[0], 'https://storage.example/foto.png');
  assert.equal(resultado.img, 'https://storage.example/foto.png');
  assert.equal(resultado.fotoAutorizada, 'https://storage.example/foto.png');
});
