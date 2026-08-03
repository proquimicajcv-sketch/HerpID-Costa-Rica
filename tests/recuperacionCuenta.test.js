import test from 'node:test';
import assert from 'node:assert/strict';
import { generarCodigoRecuperacion, normalizarContactoRecuperacion } from '../src/utils/recuperacionCuenta.js';

test('genera un código de recuperación de seis dígitos', () => {
  const codigo = generarCodigoRecuperacion();

  assert.match(codigo, /^\d{6}$/);
});

test('normaliza contactos de recuperación para email o celular', () => {
  assert.equal(normalizarContactoRecuperacion('  usuario@example.com  '), 'usuario@example.com');
  assert.equal(normalizarContactoRecuperacion('+506 8888-7777'), '88887777');
});
