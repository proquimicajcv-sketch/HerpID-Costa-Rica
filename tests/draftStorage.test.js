import test from 'node:test';
import assert from 'node:assert/strict';
import { guardarBorradorLogin, cargarBorradorLogin, limpiarBorradorLogin, guardarBorradorReporte, cargarBorradorReporte, limpiarBorradorReporte } from '../src/utils/draftStorage.js';

const storage = {};

globalThis.localStorage = {
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
  },
  setItem(key, value) {
    storage[key] = String(value);
  },
  removeItem(key) {
    delete storage[key];
  },
  clear() {
    Object.keys(storage).forEach((key) => delete storage[key]);
  }
};

globalThis.window = { localStorage: globalThis.localStorage };

test('guarda y recupera borradores de login', () => {
  limpiarBorradorLogin();
  guardarBorradorLogin({ emailOrTel: '88887777', pass: '123456' });
  assert.deepEqual(cargarBorradorLogin(), { emailOrTel: '88887777', pass: '123456' });
  limpiarBorradorLogin();
  assert.deepEqual(cargarBorradorLogin(), { emailOrTel: '', pass: '' });
});

test('guarda y recupera borradores de reportes', () => {
  limpiarBorradorReporte();
  guardarBorradorReporte({ tipoFauna: 'Reptil', comunidad: 'Tarrazu', nombreComun: 'Serpiente' });
  assert.deepEqual(cargarBorradorReporte(), {
    tipoFauna: 'Reptil',
    silueta: 'Rana Arborícola',
    desconocido: true,
    esPeligrosoReporte: false,
    nombreCientifico: '',
    nombreComun: 'Serpiente',
    lat: '9.650746',
    lng: '-84.000193',
    posPin: [9.650746, -84.000193],
    comunidad: 'Tarrazu',
    estadoOrganismo: 'Vivo / Activo',
    etapa: 'Adulto',
    temp: '21,5',
    altitud: '1450',
    microhabitat: 'Vegetación / Finca Cafetalera',
    fotosRegistro: [],
    fotoPrincipalIndex: 0,
    audioURL: null
  });
  limpiarBorradorReporte();
  assert.deepEqual(cargarBorradorReporte(), {
    tipoFauna: 'Anfibio',
    silueta: 'Rana Arborícola',
    desconocido: true,
    esPeligrosoReporte: false,
    nombreCientifico: '',
    nombreComun: '',
    lat: '9.650746',
    lng: '-84.000193',
    posPin: [9.650746, -84.000193],
    comunidad: '',
    estadoOrganismo: 'Vivo / Activo',
    etapa: 'Adulto',
    temp: '21,5',
    altitud: '1450',
    microhabitat: 'Vegetación / Finca Cafetalera',
    fotosRegistro: [],
    fotoPrincipalIndex: 0,
    audioURL: null
  });
});
