import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarContactoBaneo, construirMensajeBaneo } from '../src/utils/baneos.js';

test('normaliza contactos de bloqueo para email o celular', () => {
  assert.equal(normalizarContactoBaneo('  usuario@example.com  '), 'usuario@example.com');
  assert.equal(normalizarContactoBaneo('+506 8888-7777'), '88887777');
});

test('construye un mensaje claro para un usuario baneado', () => {
  const mensaje = construirMensajeBaneo('Incumplió las reglas');

  assert.match(mensaje, /suspendido/i);
  assert.match(mensaje, /Incumplió las reglas/i);
});
