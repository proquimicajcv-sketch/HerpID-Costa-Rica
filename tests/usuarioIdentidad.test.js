import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTexto,
  esUsuarioAdministrativo,
  esUsuarioProtegido,
  esUsuarioPrincipal,
  coincideIdentidadUsuario
} from '../src/utils/usuarioIdentidad.js';

test('normaliza nombres y correos para comparar identidades', () => {
  assert.equal(normalizarTexto('Jorge Carvajal V'), 'jorge carvajal v');
  assert.equal(normalizarTexto('Juan Abarca'), 'juan abarca');
});

test('reconoce usuarios administrativos por email o nombre', () => {
  assert.equal(esUsuarioAdministrativo('proquimicajcv@icloud.com', 'Jorge Carvajal'), true);
  assert.equal(esUsuarioAdministrativo('juan.abarca@email.com', 'Juan Abarca'), true);
  assert.equal(esUsuarioAdministrativo('otro@email.com', 'Carlos Mora'), false);
});

test('protege al usuario actual y a los administradores principales', () => {
  assert.equal(esUsuarioProtegido('proquimicajcv@icloud.com', 'Jorge Carvajal', 'uid-1', 'uid-2'), true);
  assert.equal(esUsuarioProtegido('juan.abarca@email.com', 'Juan Abarca', 'uid-3', 'uid-2'), true);
  assert.equal(esUsuarioProtegido('otro@email.com', 'Carlos', 'uid-3', 'uid-2'), false);
});

test('identifica el usuario principal con una etiqueta especial', () => {
  assert.equal(esUsuarioPrincipal('proquimicajcv@icloud.com', 'Jorge Carvajal', 'uid-1', 'uid-2'), true);
  assert.equal(esUsuarioPrincipal('otro@email.com', 'Carlos', 'uid-3', 'uid-2'), false);
});

test('une reportes de la misma persona aunque el nombre cambie ligeramente', () => {
  const usuario = { id: 'uid-1', email: 'proquimicajcv@icloud.com', nombre: 'Jorge Carvajal' };
  const registro = { userId: null, userEmail: 'proquimicajcv@icloud.com', reportante: 'Jorge Carvajal V' };

  assert.equal(coincideIdentidadUsuario(registro, usuario), true);
});
