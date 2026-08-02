import test from 'node:test';
import assert from 'node:assert/strict';
import { contarMensajesSinLeer } from '../src/utils/mensajesChat.js';

test('cuenta solo mensajes del equipo nuevos desde la última lectura', () => {
  const mensajes = [
    { id: 'a', senderId: 'equipo-1', createdAt: 1000, esAdmin: true },
    { id: 'b', senderId: 'usuario-1', createdAt: 1500, esAdmin: false },
    { id: 'c', senderId: 'equipo-2', createdAt: 2500, esAdmin: true },
    { id: 'd', senderId: 'equipo-3', createdAt: 3000, esAdmin: true }
  ];

  assert.equal(contarMensajesSinLeer(mensajes, 'usuario-1', 2000), 2);
});

test('no cuenta mensajes antiguos ni mensajes del propio usuario', () => {
  const mensajes = [
    { id: 'a', senderId: 'usuario-1', createdAt: 1000, esAdmin: false },
    { id: 'b', senderId: 'equipo-1', createdAt: 1200, esAdmin: true },
    { id: 'c', senderId: 'equipo-2', createdAt: 1300, esAdmin: true }
  ];

  assert.equal(contarMensajesSinLeer(mensajes, 'usuario-1', 1400), 0);
});
