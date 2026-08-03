import test from 'node:test';
import assert from 'node:assert/strict';
import { persistirAvistamientoConFallback } from '../src/utils/reporteEnvio.js';

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
