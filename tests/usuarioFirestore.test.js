import test from 'node:test';
import assert from 'node:assert/strict';
import { crearDatosUsuarioFirestore } from '../src/utils/usuarioFirestore.js';

test('crea un documento de usuario con nombre, rol y últimos datos de sesión', () => {
  const data = crearDatosUsuarioFirestore({
    uid: 'abc123',
    email: 'user@example.com',
    nombre: 'Ana',
    rol: 'Usuario Regular',
    ultimoAcceso: '2026-08-01',
    ultimoConexion: 123456789
  });

  assert.equal(data.uid, 'abc123');
  assert.equal(data.email, 'user@example.com');
  assert.equal(data.nombre, 'Ana');
  assert.equal(data.rol, 'Usuario Regular');
  assert.equal(data.ultimoAcceso, '2026-08-01');
  assert.equal(data.ultimoConexion, 123456789);
});
