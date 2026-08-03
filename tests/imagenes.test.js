import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BYTES_IMAGEN, resolverConfiguracionCompresion, moverFotoEnLista, subirFotoConFallback } from '../src/utils/imagenes.js';

test('reduce la calidad cuando una imagen supera los 15 MB', () => {
  const config = resolverConfiguracionCompresion(20 * 1024 * 1024);

  assert.equal(config.maxBytes, MAX_BYTES_IMAGEN);
  assert.ok(config.quality < 1);
  assert.ok(config.quality <= 0.85);
});

test('mantiene calidad máxima cuando la imagen ya cabe en el límite', () => {
  const config = resolverConfiguracionCompresion(3 * 1024 * 1024);

  assert.equal(config.quality, 1);
  assert.equal(config.scale, 1);
});

test('permite reordenar las fotos del reporte', () => {
  const fotos = ['a', 'b', 'c'];

  assert.deepEqual(moverFotoEnLista(fotos, 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moverFotoEnLista(fotos, 2, 0), ['c', 'a', 'b']);
});

test('devuelve la misma imagen como fallback cuando la subida falla', async () => {
  const resultado = await subirFotoConFallback({
    dataUrl: 'data:image/jpeg;base64,abc',
    ruta: 'avistamientos/test/foto.jpg',
    subir: async () => {
      throw new Error('storage-down');
    }
  });

  assert.equal(resultado.url, 'data:image/jpeg;base64,abc');
  assert.equal(resultado.usadaComoFallback, true);
});
