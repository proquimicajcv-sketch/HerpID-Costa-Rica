import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverDestinoEliminacionCuenta } from '../src/utils/usuarioCuenta.js';

test('normaliza los datos de una cuenta a eliminar y conserva el UID cuando existe', () => {
  const destino = resolverDestinoEliminacionCuenta({ uid: 'abc123', email: 'USUARIO@EXAMPLE.COM' });

  assert.deepEqual(destino, {
    uid: 'abc123',
    email: 'usuario@example.com'
  });
});

test('permite eliminar una cuenta solo con UID cuando no hay correo', () => {
  const destino = resolverDestinoEliminacionCuenta({ uid: 'abc123', email: '   ' });

  assert.deepEqual(destino, {
    uid: 'abc123',
    email: ''
  });
});

test('rechaza solicitudes vacías para eliminar una cuenta', () => {
  assert.throws(() => resolverDestinoEliminacionCuenta({ uid: '   ', email: '   ' }), /uid o email/i);
});
