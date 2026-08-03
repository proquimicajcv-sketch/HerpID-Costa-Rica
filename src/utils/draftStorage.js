const STORAGE_KEYS = {
  login: 'herpid_borrador_login_v1',
  reporte: 'herpid_borrador_reporte_v1',
  faqImagenes: 'herpid_faq_imagenes_v1'
};

const borradorLoginPorDefecto = () => ({ emailOrTel: '', pass: '' });
const borradorReportePorDefecto = () => ({
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

function leerStorage(key) {
  try {
    const storage = obtenerStorage();
    if (!storage) return null;
    const leer = storage.getItem || storage.getltem;
    if (typeof leer !== 'function') return null;
    return leer.call(storage, key);
  } catch {
    return null;
  }
}

function guardarStorage(key, valor) {
  try {
    const storage = obtenerStorage();
    if (!storage) return;
    const guardar = storage.setItem || storage.setltem;
    if (typeof guardar !== 'function') return;
    guardar.call(storage, key, JSON.stringify(valor));
  } catch {}
}

function limpiarStorage(key) {
  try {
    const storage = obtenerStorage();
    if (!storage) return;
    const limpiar = storage.removeItem || storage.removeltem;
    if (typeof limpiar !== 'function') return;
    limpiar.call(storage, key);
  } catch {}
}

function obtenerStorage() {
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
    return globalThis.localStorage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

const faqImagenesPorDefecto = () => ({
  manipular: '',
  sueros: '',
  especies: '',
  ecologico: '',
  cadena: '',
  respiracion: '',
  metamorfosis: '',
  curiosos: '',
  habitat: ''
});

export function guardarBorradorLogin(datos) {
  guardarStorage(STORAGE_KEYS.login, { ...borradorLoginPorDefecto(), ...datos });
}

export function cargarBorradorLogin() {
  const datos = leerStorage(STORAGE_KEYS.login);
  if (!datos) return borradorLoginPorDefecto();
  try {
    return { ...borradorLoginPorDefecto(), ...JSON.parse(datos) };
  } catch {
    return borradorLoginPorDefecto();
  }
}

export function limpiarBorradorLogin() {
  limpiarStorage(STORAGE_KEYS.login);
}

export function guardarBorradorReporte(datos) {
  const actual = cargarBorradorReporte();
  guardarStorage(STORAGE_KEYS.reporte, { ...actual, ...datos });
}

export function cargarBorradorReporte() {
  const datos = leerStorage(STORAGE_KEYS.reporte);
  if (!datos) return borradorReportePorDefecto();
  try {
    return { ...borradorReportePorDefecto(), ...JSON.parse(datos) };
  } catch {
    return borradorReportePorDefecto();
  }
}

export function limpiarBorradorReporte() {
  limpiarStorage(STORAGE_KEYS.reporte);
}

export function guardarFaqImagenes(datos) {
  guardarStorage(STORAGE_KEYS.faqImagenes, { ...faqImagenesPorDefecto(), ...datos });
}

export function cargarFaqImagenes() {
  const datos = leerStorage(STORAGE_KEYS.faqImagenes);
  if (!datos) return faqImagenesPorDefecto();
  try {
    return { ...faqImagenesPorDefecto(), ...JSON.parse(datos) };
  } catch {
    return faqImagenesPorDefecto();
  }
}

export function limpiarFaqImagenes() {
  limpiarStorage(STORAGE_KEYS.faqImagenes);
}
