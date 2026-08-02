import test from 'node:test';
import assert from 'node:assert/strict';
import { puedeVerReportesEnMapa } from '../src/utils/registroVisibilidad.js';

test('permite ver reportes en el mapa aunque el usuario no haya iniciado sesión', () => {
  assert.equal(puedeVerReportesEnMapa(false), true);
});

test('permite ver reportes en el mapa cuando el usuario sí está autenticado', () => {
  assert.equal(puedeVerReportesEnMapa(true), true);
});
