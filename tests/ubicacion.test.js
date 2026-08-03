import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarUbicacionAutomatica, construirTextoUbicacion } from '../src/utils/ubicacion.js';

test('detecta un cantón cercano desde coordenadas del mapa', () => {
  const resultado = detectarUbicacionAutomatica(9.6507, -84.0002);

  assert.equal(resultado.label, 'Tarrazu');
  assert.deepEqual(resultado.coords, [9.6507, -84.0002]);
  assert.equal(resultado.alt, 1350);
  assert.equal(resultado.temp, 21.0);
});

test('genera un texto legible para la interfaz cuando la ubicación es personalizada', () => {
  const texto = construirTextoUbicacion(9.1234, -83.9876);

  assert.match(texto, /Ubicación personalizada/i);
  assert.match(texto, /9\.1234/);
  assert.match(texto, /-83\.9876/);
});
