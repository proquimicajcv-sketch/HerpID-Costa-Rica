import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* --- CONEXIÓN CON FIREBASE --- */
import { db, auth, storage } from './firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, setDoc, getDoc, query, orderBy, limit, where } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { esRegistroVisibleEnMapa, esRegistroValidado, puedeVerReportesEnMapa } from './utils/registroVisibilidad';
import { detectarSubidaRanking } from './utils/ranking';
import { crearDatosUsuarioFirestore } from './utils/usuarioFirestore';
import { resolverDestinoEliminacionCuenta } from './utils/usuarioCuenta';
import { validarRegistroContacto } from './utils/registroContacto';
import { generarCodigoRecuperacion, normalizarContactoRecuperacion } from './utils/recuperacionCuenta';
import { esUsuarioAdministrativo, esUsuarioProtegido, esUsuarioPrincipal, coincideIdentidadUsuario } from './utils/usuarioIdentidad';
import { normalizarContactoBaneo, construirMensajeBaneo } from './utils/baneos';
import { guardarBorradorLogin, cargarBorradorLogin, limpiarBorradorLogin, guardarBorradorReporte, cargarBorradorReporte, limpiarBorradorReporte, guardarFaqImagenes, cargarFaqImagenes } from './utils/draftStorage';
import { estimarAltitudYTemperatura as estimarAltitudYTemperaturaDesdeServicio } from './utils/altitud';
import { contarMensajesSinLeer } from './utils/mensajesChat';
import { resolverEspeciesGuiaAutorizadas } from './utils/guiaHerpetologica';
import { MAX_BYTES_IMAGEN_REPORTE, resolverConfiguracionCompresion, validarTamanoImagen, moverFotoEnLista, subirFotoConFallback } from './utils/imagenes';
import { persistirAvistamientoConFallback } from './utils/reporteEnvio';

/* --- DICCIONARIO DE CANTONES DE COSTA RICA (COORDENADAS, ALTITUD Y TEMPERATURA) --- */
const cantonesCR = {
  tarrazu: { coords: [9.6507, -84.0002], alt: 1350, temp: 21.0 },
  dota: { coords: [9.6644, -83.8436], alt: 1550, temp: 19.5 },
  leon: { coords: [9.6828, -84.0519], alt: 1540, temp: 19.8 },
  zarcero: { coords: [10.1856, -84.3853], alt: 1736, temp: 17.5 },
  san: { coords: [9.9281, -84.0907], alt: 1150, temp: 22.5 },
  alajuela: { coords: [10.0163, -84.2116], alt: 960, temp: 24.0 },
  cartago: { coords: [9.8644, -83.9194], alt: 1435, temp: 20.0 },
  heredia: { coords: [10.0024, -84.1165], alt: 1150, temp: 22.0 },
  perez: { coords: [9.3781, -83.7025], alt: 700, temp: 24.5 },
  aserri: { coords: [9.8556, -84.0894], alt: 1311, temp: 21.0 },
  acosta: { coords: [9.7667, -84.4000], alt: 990, temp: 23.0 },
  desamparados: { coords: [9.8903, -84.0667], alt: 1161, temp: 22.0 },
  curridabat: { coords: [9.9333, -84.0333], alt: 1200, temp: 22.0 },
  marcos: { coords: [9.6507, -84.0002], alt: 1350, temp: 21.0 }
};

const provinciasCR = ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón'];
const FOTO_PLACEHOLDER_SISTEMA = 'photo-1534567153574-2b12153a87f0';

const provinciaPorCanton = {
  escazu: 'San José',
  desamparados: 'San José',
  puriscal: 'San José',
  tarrazu: 'San José',
  aserri: 'San José',
  mora: 'San José',
  goicoechea: 'San José',
  'santa ana': 'San José',
  alajuelita: 'San José',
  'vasquez de coronado': 'San José',
  acosta: 'San José',
  tibas: 'San José',
  moravia: 'San José',
  'montes de oca': 'San José',
  turrubares: 'San José',
  dota: 'San José',
  curridabat: 'San José',
  'perez zeledon': 'San José',
  'leon cortes castro': 'San José',

  alajuela: 'Alajuela',
  'san ramon': 'Alajuela',
  grecia: 'Alajuela',
  'san mateo': 'Alajuela',
  atenas: 'Alajuela',
  naranjo: 'Alajuela',
  palmares: 'Alajuela',
  poas: 'Alajuela',
  orotina: 'Alajuela',
  'san carlos': 'Alajuela',
  zarcero: 'Alajuela',
  sarchi: 'Alajuela',
  upala: 'Alajuela',
  'los chiles': 'Alajuela',
  guatuso: 'Alajuela',
  'rio cuarto': 'Alajuela',

  cartago: 'Cartago',
  paraiso: 'Cartago',
  'la union': 'Cartago',
  jimenez: 'Cartago',
  turrialba: 'Cartago',
  alvarado: 'Cartago',
  oreamuno: 'Cartago',
  'el guarco': 'Cartago',

  heredia: 'Heredia',
  barva: 'Heredia',
  'santo domingo': 'Heredia',
  'santa barbara': 'Heredia',
  'san rafael': 'Heredia',
  'san isidro': 'Heredia',
  belen: 'Heredia',
  flores: 'Heredia',
  'san pablo': 'Heredia',
  sarapiqui: 'Heredia',

  liberia: 'Guanacaste',
  nicoya: 'Guanacaste',
  'santa cruz': 'Guanacaste',
  bagaces: 'Guanacaste',
  carrillo: 'Guanacaste',
  canas: 'Guanacaste',
  abangares: 'Guanacaste',
  tilaran: 'Guanacaste',
  nandayure: 'Guanacaste',
  'la cruz': 'Guanacaste',
  hojancha: 'Guanacaste',

  puntarenas: 'Puntarenas',
  esparza: 'Puntarenas',
  'buenos aires': 'Puntarenas',
  'montes de oro': 'Puntarenas',
  osa: 'Puntarenas',
  quepos: 'Puntarenas',
  golfito: 'Puntarenas',
  'coto brus': 'Puntarenas',
  corredores: 'Puntarenas',
  garabito: 'Puntarenas',
  parrita: 'Puntarenas',
  'monteverde': 'Puntarenas',
  'puerto jimenez': 'Puntarenas',

  limon: 'Limón',
  pococi: 'Limón',
  siquirres: 'Limón',
  talamanca: 'Limón',
  matina: 'Limón',
  guacimo: 'Limón'
};

const centrosProvinciaCR = {
  'San José': [9.9281, -84.0907],
  Alajuela: [10.0163, -84.2116],
  Cartago: [9.8644, -83.9194],
  Heredia: [10.0024, -84.1165],
  Guanacaste: [10.635, -85.4377],
  Puntarenas: [9.977, -84.8333],
  'Limón': [9.9907, -83.0359]
};

const normalizarTextoLimpio = (texto) => {
  if (!texto) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const esFotoPlaceholderSistema = (url) => {
  return String(url || '').includes(FOTO_PLACEHOLDER_SISTEMA);
};

const buscarProvinciaEnTexto = (texto) => {
  const limpio = normalizarTextoLimpio(texto);
  if (!limpio) return null;

  for (const provincia of provinciasCR) {
    if (limpio.includes(normalizarTextoLimpio(provincia))) {
      return provincia;
    }
  }

  const entradasCanton = Object.entries(provinciaPorCanton).sort((a, b) => b[0].length - a[0].length);
  for (const [canton, provincia] of entradasCanton) {
    if (limpio.includes(canton)) {
      return provincia;
    }
  }

  return null;
};

const obtenerProvinciaPorCoords = (coords) => {
  if (!coords || coords.length < 2) return null;
  const lat = Number(coords[0]);
  const lng = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const toRad = (value) => (value * Math.PI) / 180;
  const radioTierra = 6371;

  let mejorProvincia = null;
  let mejorDistancia = Number.POSITIVE_INFINITY;

  for (const [provincia, centro] of Object.entries(centrosProvinciaCR)) {
    const dLat = toRad(centro[0] - lat);
    const dLon = toRad(centro[1] - lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(centro[0])) * Math.sin(dLon / 2) ** 2;
    const distancia = 2 * radioTierra * Math.asin(Math.sqrt(a));
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejorProvincia = provincia;
    }
  }

  return mejorProvincia;
};

const buscarCantonEnTexto = (texto) => {
  if (!texto) return null;
  const limpio = normalizarTextoLimpio(texto);
  for (const [key, data] of Object.entries(cantonesCR)) {
    if (limpio.includes(key)) {
      return data;
    }
  }
  return null;
};

const estimarAltitudYTemperatura = (latitud, longitud) => {
  return estimarAltitudYTemperaturaDesdeServicio(latitud, longitud);
};

/* --- OPCIONES TAXONÓMICAS DINÁMICAS --- */
const opcionesPorCategoria = {
  Anfibio: [
    { id: 'Rana Arborícola', label: 'Rana / Sapo' },
    { id: 'Salamandra', label: 'Salamandra' },
    { id: 'Cecilia / Cecilios', label: 'Cecilia / Cecilios' }
  ],
  Reptil: [
    { id: 'Serpiente', label: 'Serpiente' },
    { id: 'Lagartija', label: 'Lagartija / Iguana' },
    { id: 'Tortuga', label: 'Tortuga' },
    { id: 'Lagarto/Caimán', label: 'Lagarto / Caimán' }
  ]
};

/* --- ICONOS PERSONALIZADOS DEL MAPA --- */
const crearIconoPersonalizado = (silueta, estado, esPeligroso) => {
  let emoji = '🐸';
  if (silueta === 'Serpiente') emoji = '🐍';
  if (silueta === 'Lagartija' || silueta === 'Salamandra') emoji = '🦎';
  if (silueta === 'Tortuga') emoji = '🐢';
  if (silueta === 'Cecilia / Cecilios') emoji = '🐛';
  if (silueta === 'Lagarto/Caimán') emoji = '🐊';

  const colorFondo = esPeligroso ? '#FF1744' : (estado === 'VALIDADO' ? '#00E676' : (estado === 'RECHAZADO' ? '#FF2A6D' : '#FFB300'));
  const colorBorde = esPeligroso ? '#FF5252' : (estado === 'VALIDADO' ? '#00FF88' : (estado === 'RECHAZADO' ? '#FF5252' : '#FFD54F'));

  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        background-color: #070D0B;
        border: 2px solid ${colorBorde};
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 0 12px ${colorFondo}aa;
        position: relative;
      ">
        ${emoji}
        <span style="
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 12px;
          height: 12px;
          background-color: ${colorFondo};
          border-radius: 50%;
          border: 1.5px solid #070D0B;
        "></span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

const iconoAlfilerRojo = L.divIcon({
  className: 'red-pin-marker',
  html: `<div style="font-size: 34px; filter: drop-shadow(0px 3px 6px rgba(255,0,0,0.8)); cursor: pointer;">📍</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34]
});

const obtenerInsigniaUsuario = (validados) => {
  const total = Number(validados || 0);
  if (total >= 100) {
    return {
      nivel: 'legendario',
      label: '👑 Leyenda Herpetológica',
      color: '#FFD700',
      bg: '#2A2408',
      border: '#FFD700',
      texto: '100+ validaciones',
      glow: '0 0 16px rgba(255,215,0,0.35)'
    };
  }
  if (total >= 50) {
    return {
      nivel: 'platino',
      label: '🏅 Maestro de la Biodiversidad',
      color: '#C0C0C0',
      bg: '#1A1F24',
      border: '#C0C0C0',
      texto: '50 validaciones',
      glow: '0 0 14px rgba(192,192,192,0.25)'
    };
  }
  if (total >= 25) {
    return {
      nivel: 'oro',
      label: '🌟 Guardián del Mapa',
      color: '#00E676',
      bg: '#0D2E21',
      border: '#00E676',
      texto: '25 validaciones',
      glow: '0 0 12px rgba(0,230,118,0.25)'
    };
  }
  if (total >= 10) {
    return {
      nivel: 'azul',
      label: '🔬 Explorador Experimentado',
      color: '#29B6F6',
      bg: '#102534',
      border: '#29B6F6',
      texto: '10 validaciones',
      glow: '0 0 12px rgba(41,182,246,0.25)'
    };
  }
  if (total >= 5) {
    return {
      nivel: 'verde',
      label: '🍃 Observador Activo',
      color: '#7CB342',
      bg: '#12241A',
      border: '#7CB342',
      texto: '5 validaciones',
      glow: '0 0 10px rgba(124,179,66,0.25)'
    };
  }
  if (total >= 3) {
    return {
      nivel: 'bronce',
      label: '🥉 Primeras Huellas',
      color: '#CD7F32',
      bg: '#24160A',
      border: '#CD7F32',
      texto: '3 validaciones',
      glow: '0 0 10px rgba(205,127,50,0.2)'
    };
  }
  return null;
};

const renderizarInsigniaUsuario = (validados) => {
  const insignia = obtenerInsigniaUsuario(validados);
  if (!insignia) return null;

  return (
    <span
      title={`${insignia.label} • ${insignia.texto}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.32rem',
        marginLeft: '0.45rem',
        padding: '0.22rem 0.55rem',
        borderRadius: '999px',
        border: `1px solid ${insignia.border}`,
        background: insignia.bg,
        color: insignia.color,
        fontSize: '0.7rem',
        fontWeight: '800',
        boxShadow: insignia.glow,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle'
      }}
    >
      <span>{insignia.label}</span>
    </span>
  );
};

/* Selector interactivo de mapa */
function EventoMapaPin({ setLat, setLng, setPosPin, setTemp, setAltitud, setComunidad, setErrorEnvio }) {
  const map = useMap();

  useEffect(() => {
    const manejarClick = async (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      const latFija = lat.toFixed(6);
      const lngFija = lng.toFixed(6);
      setLat(latFija);
      setLng(lngFija);
      setPosPin([lat, lng]);
      setComunidad(`Ubicación señalada en el mapa • ${latFija}, ${lngFija}`);
      setErrorEnvio('');
      try {
        const { altitud: altEstimada, temperatura: tempEstimada } = await estimarAltitudYTemperaturaDesdeServicio(lat, lng);
        setTemp(tempEstimada);
        setAltitud(altEstimada);
      } catch (error) {
        setTemp('—');
        setAltitud('—');
      }
    };

    map.on('click', manejarClick);
    return () => map.off('click', manejarClick);
  }, [map, setLat, setLng, setPosPin, setTemp, setAltitud, setComunidad, setErrorEnvio]);

  return null;
}

function MarcadorMapaInteractivo({ posPin, setLat, setLng, setPosPin, setTemp, setAltitud, setComunidad, setErrorEnvio }) {
  const manejarArrastre = async (event) => {
    const { lat, lng } = event.target.getLatLng();
    const latFija = lat.toFixed(6);
    const lngFija = lng.toFixed(6);
    setLat(latFija);
    setLng(lngFija);
    setPosPin([lat, lng]);
    setComunidad(`Ubicación señalada en el mapa • ${latFija}, ${lngFija}`);
    setErrorEnvio('');
    try {
      const { altitud: altEstimada, temperatura: tempEstimada } = await estimarAltitudYTemperaturaDesdeServicio(lat, lng);
      setTemp(tempEstimada);
      setAltitud(altEstimada);
    } catch (error) {
      setTemp('—');
      setAltitud('—');
    }
  };

  return (
    <Marker
      position={posPin}
      icon={iconoAlfilerRojo}
      draggable={true}
      eventHandlers={{ dragend: manejarArrastre }}
    />
  );
}

function ControladorZoomMapa({ setZoomMapa }) {
  const map = useMap();

  useEffect(() => {
    const actualizarZoom = () => setZoomMapa(map.getZoom());
    actualizarZoom();
    map.on('zoomend', actualizarZoom);
    map.on('moveend', actualizarZoom);
    return () => {
      map.off('zoomend', actualizarZoom);
      map.off('moveend', actualizarZoom);
    };
  }, [map, setZoomMapa]);

  return null;
}

function ControladorVistaMapa({ setZoomMapa, setCentroMapa, setPopupMapaAbierto }) {
  const map = useMap();

  useEffect(() => {
    const actualizarVista = () => {
      setZoomMapa(map.getZoom());
      const centro = map.getCenter();
      setCentroMapa([centro.lat, centro.lng]);
    };

    actualizarVista();
    map.on('zoomend', actualizarVista);
    map.on('moveend', actualizarVista);
    return () => {
      map.off('zoomend', actualizarVista);
      map.off('moveend', actualizarVista);
    };
  }, [map, setZoomMapa, setCentroMapa]);

  useEffect(() => {
    const abrirPopup = () => setPopupMapaAbierto(true);
    const cerrarPopup = () => setPopupMapaAbierto(false);
    map.on('popupopen', abrirPopup);
    map.on('popupclose', cerrarPopup);
    return () => {
      map.off('popupopen', abrirPopup);
      map.off('popupclose', cerrarPopup);
    };
  }, [map, setPopupMapaAbierto]);

  return null;
}

const CLAVE_SESION_USUARIO = 'herpid_usuario_sesion_v32';
const CLAVE_LOGOUT_MANUAL = 'herpid_logout_manual_v1';
const CLAVE_INTERVALO_REFRESCO_APP = 'herpid_intervalo_refresco_min_v1';
const USUARIO_DESLOGUEADO = { isLoggedIn: false, id: null, nombre: '', email: '', rol: 'Usuario Regular' };
const MAX_USUARIOS_SINCRONIZADOS = 1200;
const MAX_MENSAJES_CHAT = 600;
const VENTANA_ACTIVOS_MS = 2 * 60 * 1000;
const MAX_INGRESOS_RECIENTES = 20;
const OPCIONES_INTERVALO_REFRESCO_MIN = [1, 5, 10, 25];

export default function App() {
  const [tab, setTab] = useState('mapa');
  const [intervaloRefrescoMin, setIntervaloRefrescoMin] = useState(() => {
    try {
      const guardado = Number(localStorage.getItem(CLAVE_INTERVALO_REFRESCO_APP));
      if (OPCIONES_INTERVALO_REFRESCO_MIN.includes(guardado)) {
        return guardado;
      }
    } catch (e) {}
    return 5;
  });
  const intervaloRefrescoMs = intervaloRefrescoMin * 60 * 1000;
  const [modalRegistro, setModalRegistro] = useState(false);
  const [modalPerfil, setModalPerfil] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalBienvenidaInicio, setModalBienvenidaInicio] = useState(false);
  const [modalNuevaEspecieGuia, setModalNuevaEspecieGuia] = useState(false);
  const [modalEditarEspecieGuia, setModalEditarEspecieGuia] = useState(false);
  const [modoPrivacidadEstrictoMapa, setModoPrivacidadEstrictoMapa] = useState(true);
  
  const [registroEditando, setRegistroEditando] = useState(null);
  const [especieGuiaEditando, setEspecieGuiaEditando] = useState(null);

  const [lightboxData, setLightboxData] = useState(null);
  const [alertaMordeduraEntrante, setAlertaMordeduraEntrante] = useState(null);
  const [avisoRankingEntrante, setAvisoRankingEntrante] = useState(null);
  const rankingAnteriorRef = useRef(null);

  const [vistaPerfil, setVistaPerfil] = useState('login');
  const [formLogin, setFormLogin] = useState(() => cargarBorradorLogin());
  const [formReg, setFormReg] = useState({ nombre: '', emailOrTel: '', correoRecuperacion: '', pass: '' });
  const [formRecuperacion, setFormRecuperacion] = useState({ emailOrTel: '' });
  const [codigoRecuperacion, setCodigoRecuperacion] = useState('');
  const [codigoRecuperacionEnviado, setCodigoRecuperacionEnviado] = useState(false);
  const [codigoTemporal, setCodigoTemporal] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [codigoVerificado, setCodigoVerificado] = useState(false);
  const [emailRecuperacion, setEmailRecuperacion] = useState('');
  const [mostrarPassLogin, setMostrarPassLogin] = useState(false);
  const [mostrarPassRegistro, setMostrarPassRegistro] = useState(false);
  const [busquedaGuia, setBusquedaGuia] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [enviandoReporte, setEnviandoReporte] = useState(false);

  const [editandoNombrePerfil, setEditandoNombrePerfil] = useState(false);
  const [nuevoNombrePerfil, setNuevoNombrePerfil] = useState('');

  const [carruselIndices, setCarruselIndices] = useState({});
  const [tipoChatEquipo, setTipoChatEquipo] = useState('usuarios');
  const [zoomMapa, setZoomMapa] = useState(9);
  const [centroMapa, setCentroMapa] = useState([9.650565, -84.000236]);
  const [popupMapaAbierto, setPopupMapaAbierto] = useState(false);
  const [mostrarPendientesMapaAdmin, setMostrarPendientesMapaAdmin] = useState(false);
  const [marcadoresVisiblesCount, setMarcadoresVisiblesCount] = useState(8);

  const [todosLosUsuarios, setTodosLosUsuarios] = useState([]);
  const [usuariosIndispensables, setUsuariosIndispensables] = useState([]);
  const [ingresosRecientes, setIngresosRecientes] = useState([]);
  const [tickPresencia, setTickPresencia] = useState(Date.now());
  const usuariosPendientesRef = useRef([]);
  const usuariosIndispensablesRef = useRef([]);
  const timerBatchUsuariosRef = useRef(null);
  const usuariosConectadosPreviosRef = useRef(new Map());
  const [registros, setRegistros] = useState([]);
  const [auditoriaRevisionAvistamientos, setAuditoriaRevisionAvistamientos] = useState([]);
  const [especiesGuia, setEspeciesGuia] = useState([]);

  const [mensajesChat, setMensajesChat] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [imagenChat, setImagenChat] = useState(null);
  const [audioChatURL, setAudioChatURL] = useState(null);
  const [grabandoAudioChat, setGrabandoAudioChat] = useState(false);
  const [tiempoGrabacionChat, setTiempoGrabacionChat] = useState(0);

  const [chatRoomSeleccionado, setChatRoomSeleccionado] = useState(null);
  const [ultimaLecturaChats, setUltimaLecturaChats] = useState(() => {
    try {
      return Number(localStorage.getItem('herpid_ultima_lectura_chats') || 0);
    } catch (e) {
      return 0;
    }
  });
  const [logoApp, setLogoApp] = useState(null);
  const [logoAppCargando, setLogoAppCargando] = useState(false);
  const [logoPreviewVisible, setLogoPreviewVisible] = useState(false);
  const logoPreviewTimeoutRef = useRef(null);
  const chatScrollRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const mediaRecorderChatRef = useRef(null);
  const audioChunksChatRef = useRef([]);
  const timerChatRef = useRef(null);

  const [formGuia, setFormGuia] = useState({
    nombre: '',
    especie: '',
    tipo: 'Anfibio',
    esPeligroso: false,
    img: '',
    desc: ''
  });

  const [faqImagenes, setFaqImagenes] = useState(() => cargarFaqImagenes());
  const estiloPreviewFaq = {
    width: '100%',
    maxWidth: '320px',
    height: '180px',
    objectFit: 'contain',
    backgroundColor: '#050A08',
    borderRadius: '12px',
    border: '1px solid #1B3D2F',
    margin: '0 auto',
    display: 'block'
  };

  const [usuario, setUsuario] = useState(() => {
    try {
      const sesionGuardada = localStorage.getItem(CLAVE_SESION_USUARIO);
      if (sesionGuardada) return JSON.parse(sesionGuardada);
    } catch (e) {}
    return USUARIO_DESLOGUEADO;
  });

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_SESION_USUARIO, JSON.stringify(usuario));
    } catch (e) {}
  }, [usuario]);

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_INTERVALO_REFRESCO_APP, String(intervaloRefrescoMin));
    } catch (e) {}
  }, [intervaloRefrescoMin]);

  useEffect(() => {
    guardarBorradorLogin(formLogin);
  }, [formLogin.emailOrTel, formLogin.pass]);

  useEffect(() => {
    guardarFaqImagenes(faqImagenes);
  }, [faqImagenes]);

  useEffect(() => {
    const cargarFaqDesdeNube = async () => {
      try {
        const docRef = doc(db, 'configuracion_app', 'faq_imagenes');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const datos = snap.data();
          const normalizadas = { ...cargarFaqImagenes(), ...datos };
          setFaqImagenes(normalizadas);
        }
      } catch (e) {}
    };

    cargarFaqDesdeNube();
  }, []);

  useEffect(() => {
    const configRef = doc(db, 'configuracion_app', 'privacidad_mapa');
    const unsubscribe = onSnapshot(configRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      if (typeof data.modoPrivacidadEstrictoMapa === 'boolean') {
        setModoPrivacidadEstrictoMapa(data.modoPrivacidadEstrictoMapa);
      }
    }, () => {});

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!usuario.isLoggedIn || !usuario.id) {
      setLogoApp(null);
      return;
    }

    const cargarLogoDesdeFirebase = async () => {
      try {
        const userDocRef = doc(db, 'usuarios', usuario.id);
        const userSnap = await getDoc(userDocRef);
        const logoFirebase = userSnap.exists() ? (userSnap.data()?.logoApp || null) : null;
        setLogoApp(logoFirebase || null);
      } catch (e) {
        setLogoApp(null);
      }
    };

    cargarLogoDesdeFirebase();
  }, [usuario.isLoggedIn, usuario.id]);

  useEffect(() => {
    let activo = true;
    let unsubscribe = () => {};

    const restaurarSesionLocal = () => {
      try {
        const raw = localStorage.getItem(CLAVE_SESION_USUARIO);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !data.isLoggedIn) return null;
        return data;
      } catch (e) {
        return null;
      }
    };

    const iniciarSuscripcionAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (e) {}

      if (!activo) return;

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!activo) return;

        if (firebaseUser) {
          try {
            localStorage.removeItem(CLAVE_LOGOUT_MANUAL);
          } catch (e) {}

          const emailLower = firebaseUser.email ? firebaseUser.email.toLowerCase() : '';
          const esAdminMaster = esUsuarioAdministrativo(emailLower, firebaseUser.displayName || '');

          const userDocRef = doc(db, 'usuarios', firebaseUser.uid);
          let rolGuardado = esAdminMaster ? 'Administrador General' : 'Usuario Regular';
          let nombreGuardado = esAdminMaster ? 'Jorge Carvajal' : (firebaseUser.displayName || emailLower.split('@')[0]);

          try {
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
              const data = userSnap.data();
              if (!esAdminMaster && data.rol) rolGuardado = data.rol;
              if (data.nombre) nombreGuardado = data.nombre;
            }

            const userObj = crearDatosUsuarioFirestore({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              nombre: nombreGuardado || (firebaseUser.displayName || ''),
              rol: rolGuardado,
              ultimoAcceso: new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }),
              ultimoConexion: Date.now()
            });

            await setDoc(userDocRef, userObj, { merge: true });

            setUsuario({
              isLoggedIn: true,
              id: firebaseUser.uid,
              email: firebaseUser.email,
              nombre: nombreGuardado,
              rol: rolGuardado
            });
          } catch (e) {
            setUsuario({
              isLoggedIn: true,
              id: firebaseUser.uid,
              email: firebaseUser.email,
              nombre: nombreGuardado,
              rol: rolGuardado
            });
          }
          return;
        }

        let logoutManual = false;
        try {
          logoutManual = localStorage.getItem(CLAVE_LOGOUT_MANUAL) === '1';
        } catch (e) {}

        if (logoutManual) {
          try {
            localStorage.removeItem(CLAVE_LOGOUT_MANUAL);
          } catch (e) {}
          setUsuario(USUARIO_DESLOGUEADO);
          return;
        }

        const sesionLocal = restaurarSesionLocal();
        if (sesionLocal) {
          setUsuario((prev) => (prev.isLoggedIn ? prev : { ...prev, ...sesionLocal, isLoggedIn: true }));
          return;
        }

        setUsuario(USUARIO_DESLOGUEADO);
      });
    };

    iniciarSuscripcionAuth();

    return () => {
      activo = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!usuario.isLoggedIn || !usuario.id) return;
    const userRef = doc(db, 'usuarios', usuario.id);
    
    const actualizarLatido = () => {
      updateDoc(userRef, { ultimoConexion: Date.now() }).catch(() => {});
    };

    actualizarLatido();
    const interval = setInterval(actualizarLatido, intervaloRefrescoMs);
    return () => clearInterval(interval);
  }, [usuario.isLoggedIn, usuario.id, intervaloRefrescoMs]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTickPresencia(Date.now());
    }, intervaloRefrescoMs);
    return () => clearInterval(interval);
  }, [intervaloRefrescoMs]);

  useEffect(() => {
    usuariosIndispensablesRef.current = usuariosIndispensables;
  }, [usuariosIndispensables]);

  useEffect(() => {
    let activo = true;

    const keyUsuario = (u) => {
      if (!u) return '';
      return String(u.id || u.uid || u.email || u.nombre || '').trim();
    };

    const combinarUsuariosUnicos = (listaPrincipal, listaIndispensable) => {
      const mapa = new Map();
      for (const u of [...(listaPrincipal || []), ...(listaIndispensable || [])]) {
        const key = keyUsuario(u);
        if (!key) continue;
        const previo = mapa.get(key) || {};
        mapa.set(key, { ...previo, ...u });
      }
      return Array.from(mapa.values());
    };

    const commitUsuarios = (usersList) => {
      usuariosPendientesRef.current = usersList;
      if (timerBatchUsuariosRef.current) {
        clearTimeout(timerBatchUsuariosRef.current);
      }
      timerBatchUsuariosRef.current = setTimeout(() => {
        if (!activo) return;
        const combinados = combinarUsuariosUnicos(usuariosPendientesRef.current, usuariosIndispensablesRef.current);
        setTodosLosUsuarios(combinados);
      }, 180);
    };

    const procesarIngresosRecientes = (usersList) => {
      const ahora = Date.now();
      const ventanaIngresos = 20000;
      const mapaPrevio = usuariosConectadosPreviosRef.current;
      const mapaActual = new Map();
      const nuevosIngresos = [];

      for (const u of usersList) {
        const userId = u.id || u.uid || u.email || u.nombre;
        if (!userId) continue;
        const activoReciente = Number(u.ultimoConexion || 0) > (ahora - VENTANA_ACTIVOS_MS);
        mapaActual.set(userId, activoReciente);

        if (!activoReciente) continue;
        if (userId === usuario.id) continue;

        const estabaActivo = Boolean(mapaPrevio.get(userId));
        const conexionReciente = Number(u.ultimoConexion || 0) > (ahora - ventanaIngresos);
        if (!estabaActivo && conexionReciente) {
          nuevosIngresos.push({
            id: `${userId}-${u.ultimoConexion || ahora}`,
            userId,
            nombre: u.nombre || 'Usuario',
            rol: u.rol || 'Usuario Regular',
            timestamp: Number(u.ultimoConexion || ahora)
          });
        }
      }

      usuariosConectadosPreviosRef.current = mapaActual;

      if (nuevosIngresos.length > 0) {
        setIngresosRecientes((prev) => [...nuevosIngresos, ...prev].slice(0, MAX_INGRESOS_RECIENTES));
      }
    };

    const normalizarUsuarios = (snapshot) => {
      return snapshot.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter((u) => u && (u.email || u.nombre || u.uid || u.id));
    };

    const usuariosQuery = query(
      collection(db, 'usuarios'),
      orderBy('ultimoConexion', 'desc'),
      limit(MAX_USUARIOS_SINCRONIZADOS)
    );

    const cargarUsuarios = async () => {
      try {
        const snapshot = await getDocs(usuariosQuery);
        if (!activo) return;
        const usersList = normalizarUsuarios(snapshot);
        procesarIngresosRecientes(usersList);
        commitUsuarios(usersList);
      } catch (err) {
        if (!activo) return;
        commitUsuarios([]);
      }
    };

    cargarUsuarios();

    const unsubscribe = onSnapshot(usuariosQuery, (snapshot) => {
      if (!activo) return;
      const usersList = normalizarUsuarios(snapshot);
      procesarIngresosRecientes(usersList);
      commitUsuarios(usersList);
    }, (err) => {});

    return () => {
      activo = false;
      if (timerBatchUsuariosRef.current) {
        clearTimeout(timerBatchUsuariosRef.current);
        timerBatchUsuariosRef.current = null;
      }
      unsubscribe();
    };
  }, [usuario.id]);

  useEffect(() => {
    const keyUsuario = (u) => String(u?.id || u?.uid || u?.email || u?.nombre || '').trim();
    const mergeUsuarios = (base, extra) => {
      const mapa = new Map();
      for (const u of [...(base || []), ...(extra || [])]) {
        const key = keyUsuario(u);
        if (!key) continue;
        const previo = mapa.get(key) || {};
        mapa.set(key, { ...previo, ...u });
      }
      return Array.from(mapa.values());
    };

    const indispensablesQuery = query(
      collection(db, 'usuarios'),
      where('rol', 'in', ['Administrador', 'Administrador General', 'Experto Herpetólogo', 'Experto'])
    );

    const unsubscribe = onSnapshot(indispensablesQuery, (snapshot) => {
      const lista = snapshot.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .filter((u) => u && (u.email || u.nombre || u.uid || u.id));

      setUsuariosIndispensables(lista);
      setTodosLosUsuarios((prev) => mergeUsuarios(prev, lista));
    }, () => {});

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'avistamientos'), (snapshot) => {
      const lista = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      setRegistros(lista);
    }, (err) => {});

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const auditoriaQuery = query(
      collection(db, 'auditoria_revision_avistamientos'),
      orderBy('createdAt', 'desc'),
      limit(1200)
    );

    const unsubscribe = onSnapshot(auditoriaQuery, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      setAuditoriaRevisionAvistamientos(lista);
    }, () => {});

    return () => unsubscribe();
  }, []);


  const emailUsuario = (usuario?.email || '').toString().toLowerCase();
  const rolUsuario = (usuario?.rol || 'Usuario Regular').toString();
  const nombreUsuario = (usuario?.nombre || '').toString();

  const esAdminMaster = usuario.isLoggedIn && esUsuarioProtegido(emailUsuario, nombreUsuario, usuario.id, 'admin_jcv_master');
  const esAdmin = usuario.isLoggedIn && (rolUsuario.includes('Administrador') || esAdminMaster || esUsuarioAdministrativo(emailUsuario, nombreUsuario));
  const esExperto = usuario.isLoggedIn && rolUsuario.includes('Experto');
  const esAdminOExperto = esAdmin || esExperto;
  const puedeEditarFaq = Boolean(esAdmin);
  const puedeExplorarMapa = puedeVerReportesEnMapa();

  useEffect(() => {
    const mensajesQuery = query(
      collection(db, 'mensajes_chat'),
      orderBy('createdAt', 'desc'),
      limit(MAX_MENSAJES_CHAT)
    );

    const unsubscribe = onSnapshot(mensajesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      msgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setMensajesChat(msgs);

      if (esAdminOExperto && msgs.length > 0) {
        const ultimoMsg = msgs[msgs.length - 1];
        const esDeUsuarioRegular = !ultimoMsg.esAdmin;
        const esAlertaMordedura = ultimoMsg.esEmergenciaMordedura || (ultimoMsg.texto && ultimoMsg.texto.includes('MORDEDURA DE SERPIENTE'));
        const esReciente = (Date.now() - (ultimoMsg.createdAt || 0)) < 30000;

        if (esDeUsuarioRegular && esAlertaMordedura && esReciente) {
          setAlertaMordeduraEntrante(ultimoMsg);
        }
      }
    }, (err) => {});

    return () => unsubscribe();
  }, [esAdminOExperto]);

  const especiesGuiaDefecto = [
    { nombre: 'Rana Calzonuda', especie: 'Agalychnis callidryas', tipo: 'Anfibio', esPeligroso: false, img: 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=500', desc: 'Emblemática rana de ojos rojos y costados azulados de los bosques húmedos.', autorizadoPor: 'admin' },
    { nombre: 'Terciopelo', especie: 'Bothrops asper', tipo: 'Reptil', esPeligroso: true, img: 'https://images.unsplash.com/photo-1531386151447-fd76ad50012f?w=500', desc: 'Serpiente víbora venenosa de gran tamaño e importancia médica severa.', autorizadoPor: 'admin' },
    { nombre: 'Garrita / Sapo del Pacífico', especie: 'Incilius aucoinae', tipo: 'Anfibio', esPeligroso: false, img: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500', desc: 'Sapo común de tierras bajas del Pacífico Sur costarricense.', autorizadoPor: 'admin' },
    { nombre: 'Gallego / Basilisco Verde', especie: 'Basiliscus basiliscus', tipo: 'Reptil', esPeligroso: false, img: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=500', desc: 'Lagarto capaz de correr distancias cortas sobre el agua.', autorizadoPor: 'admin' }
  ];

  const cargarGuiaNube = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'especies_guia'));
      const lista = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      const autorizadas = resolverEspeciesGuiaAutorizadas(lista);

      if (autorizadas.length === 0) {
        for (const esp of especiesGuiaDefecto) {
          await addDoc(collection(db, 'especies_guia'), { ...esp, autorizadoPor: 'admin' });
        }
        await cargarGuiaNube();
        return;
      }

      setEspeciesGuia(autorizadas);
    } catch (e) {
      setEspeciesGuia(especiesGuiaDefecto);
    }
  };

  useEffect(() => {
    cargarGuiaNube();
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [mensajesChat, tab, chatRoomSeleccionado, tipoChatEquipo]);

  useEffect(() => {
    if (!usuario.isLoggedIn || !usuario.id) return;
    if (tab !== 'chat') return;

    const nuevaLectura = Date.now();
    setUltimaLecturaChats(nuevaLectura);
    try {
      localStorage.setItem('herpid_ultima_lectura_chats', String(nuevaLectura));
    } catch (e) {}
  }, [tab, usuario.id, usuario.isLoggedIn]);

  const esPropietarioReporte = useCallback((reg) => {
    if (!usuario.isLoggedIn) return false;
    return coincideIdentidadUsuario(reg, usuario);
  }, [usuario.isLoggedIn, usuario.id, usuario.email, usuario.nombre]);

  const obtenerNombreSalaChat = useCallback((roomId) => {
    const room = String(roomId || '').trim();
    if (!room || room === 'equipo_interno_herpid') return 'Usuario';

    const mensajesSala = mensajesChat.filter((m) => m.chatRoomId === room);
    const msgUsuario = mensajesSala.find((m) => !m.esAdmin && String(m.usuarioNombre || '').trim());
    if (msgUsuario) return String(msgUsuario.usuarioNombre || '').trim();

    const msgConNombre = mensajesSala.find((m) => String(m.usuarioNombre || '').trim());
    if (msgConNombre) return String(msgConNombre.usuarioNombre || '').trim();

    const usuarioPorId = todosLosUsuarios.find((u) => String(u?.id || u?.uid || '').trim() === room);
    if (usuarioPorId?.nombre) return String(usuarioPorId.nombre).trim();

    const reporteAsociado = registros.find((r) => String(r?.userId || '').trim() === room && String(r?.reportante || '').trim());
    if (reporteAsociado?.reportante) return String(reporteAsociado.reportante).trim();

    return 'Usuario';
  }, [mensajesChat, todosLosUsuarios, registros]);

  const roomIdsChats = Array.from(new Set([
    ...mensajesChat
      .filter((m) => m.chatRoomId !== 'equipo_interno_herpid')
      .map((m) => m.chatRoomId),
    ...(esAdminOExperto && tipoChatEquipo === 'usuarios' && chatRoomSeleccionado ? [chatRoomSeleccionado] : [])
  ].filter(Boolean)));

  const chatsSalas = roomIdsChats.map((roomId) => {
    const ultimoMensaje = mensajesChat.filter((m) => m.chatRoomId === roomId).slice(-1)[0] || null;
    return {
      roomId,
      nombreUsuario: obtenerNombreSalaChat(roomId),
      ultimoMensaje
    };
  });

  const chatsPendientesCount = esAdminOExperto ? chatsSalas.filter(sala => {
    const ult = sala.ultimoMensaje;
    return ult && !ult.esAdmin;
  }).length : 0;

  const mensajesNuevosCount = useMemo(() => {
    if (!usuario.isLoggedIn || !usuario.id) return 0;
    return contarMensajesSinLeer(mensajesChat, usuario.id, ultimaLecturaChats);
  }, [mensajesChat, usuario.id, usuario.isLoggedIn, ultimaLecturaChats]);

  const avistamientosPendientesCount = esAdminOExperto ? registros.filter((r) => !esRegistroValidado(r.estado)).length : 0;

  useEffect(() => {
    if (!puedeExplorarMapa) {
      setMarcadoresVisiblesCount(0);
      return;
    }

    let limite = 35;
    if (zoomMapa >= 13) {
      limite = 50;
    } else if (zoomMapa >= 12) {
      limite = 45;
    } else if (zoomMapa >= 11) {
      limite = 40;
    }

    setMarcadoresVisiblesCount(limite);
  }, [zoomMapa, puedeExplorarMapa]);

  const distanciaMapaAproximada = useCallback((coordsA, coordsB) => {
    if (!coordsA || coordsA.length < 2 || !coordsB || coordsB.length < 2) return Number.POSITIVE_INFINITY;
    const lat1 = Number(coordsA[0]);
    const lon1 = Number(coordsA[1]);
    const lat2 = Number(coordsB[0]);
    const lon2 = Number(coordsB[1]);
    if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))) return Number.POSITIVE_INFINITY;

    const toRad = (value) => (value * Math.PI) / 180;
    const radioTierra = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * radioTierra * Math.asin(Math.sqrt(a));
  }, []);

  const obtenerProvinciaRegistro = useCallback((registro) => {
    const provinciaGuardada = buscarProvinciaEnTexto(registro?.provincia);
    if (provinciaGuardada) return provinciaGuardada;

    const provinciaDetectada = buscarProvinciaEnTexto(`${registro?.ubicacion || ''} ${registro?.comunidad || ''} ${registro?.reportante || ''}`);
    if (provinciaDetectada) return provinciaDetectada;

    return obtenerProvinciaPorCoords(registro?.coords) || 'San José';
  }, []);

  const estadisticasPorProvincia = useMemo(() => {
    const base = Object.fromEntries(provinciasCR.map((provincia) => [provincia, { total: 0, visibles: 0 }]));
    for (const registro of registros) {
      const provincia = obtenerProvinciaRegistro(registro);
      if (!base[provincia]) continue;
      base[provincia].total += 1;
    }
    return base;
  }, [registros, obtenerProvinciaRegistro]);

  const registrosVisibles = useMemo(() => {
    if (!puedeExplorarMapa) return [];

    const base = registros.filter((registro) =>
      esRegistroVisibleEnMapa(registro, {
        esAdminOExperto,
        esPropietarioReporte,
        estaAutenticado: puedeExplorarMapa,
      })
    );

    const candidatos = (esAdmin && mostrarPendientesMapaAdmin)
      ? base
      : base.filter((registro) => esRegistroValidado(registro.estado));
    const limitePorProvincia = zoomMapa >= 13 ? 12 : zoomMapa >= 12 ? 8 : 5;

    const grupos = new Map();
    for (const registro of candidatos) {
      const provincia = obtenerProvinciaRegistro(registro);
      const lista = grupos.get(provincia) || [];
      lista.push(registro);
      grupos.set(provincia, lista);
    }

    const priorizados = Array.from(grupos.entries()).flatMap(([, lista]) => {
      return [...lista]
        .sort((a, b) => {
          const aDestacado = a.esPeligroso ? 1 : 0;
          const bDestacado = b.esPeligroso ? 1 : 0;
          const tiempoA = Number(a.createdAt || a.timestamp || 0);
          const tiempoB = Number(b.createdAt || b.timestamp || 0);
          return (bDestacado - aDestacado) || (tiempoB - tiempoA);
        })
        .slice(0, limitePorProvincia);
    });

    return [...priorizados]
      .sort((a, b) => {
        const provinciaA = obtenerProvinciaRegistro(a);
        const provinciaB = obtenerProvinciaRegistro(b);
        if (provinciaA !== provinciaB) return provinciaA.localeCompare(provinciaB);

        const aDestacado = a.esPeligroso ? 1 : 0;
        const bDestacado = b.esPeligroso ? 1 : 0;
        if (aDestacado !== bDestacado) return bDestacado - aDestacado;

        const tiempoA = Number(a.createdAt || a.timestamp || 0);
        const tiempoB = Number(b.createdAt || b.timestamp || 0);
        return tiempoB - tiempoA;
      })
      .slice(0, 50);
  }, [registros, esAdminOExperto, esPropietarioReporte, puedeExplorarMapa, zoomMapa, obtenerProvinciaRegistro, esAdmin, mostrarPendientesMapaAdmin]);

  const estadisticasVisiblesPorProvincia = useMemo(() => {
    const base = Object.fromEntries(provinciasCR.map((provincia) => [provincia, 0]));
    for (const registro of registrosVisibles) {
      const provincia = obtenerProvinciaRegistro(registro);
      if (base[provincia] !== undefined) {
        base[provincia] += 1;
      }
    }
    return base;
  }, [registrosVisibles, obtenerProvinciaRegistro]);

  const obtenerCoordsParaMapa = (coordsOriginales) => {
    if (!coordsOriginales || coordsOriginales.length < 2) return [9.65, -84.00];
    if (esAdmin) return coordsOriginales;
    const precision = modoPrivacidadEstrictoMapa ? 10 : 100;
    return [
      Math.round(coordsOriginales[0] * precision) / precision,
      Math.round(coordsOriginales[1] * precision) / precision
    ];
  };

  const cambiarFotoCarrusel = (id, direccion, total) => {
    setCarruselIndices(prev => {
      const actual = prev[id] || 0;
      let nuevo = actual + direccion;
      if (nuevo < 0) nuevo = total - 1;
      if (nuevo >= total) nuevo = 0;
      return { ...prev, [id]: nuevo };
    });
  };

  const actualizarEstadoBaneoUsuario = async (userId, userData, baneado) => {
    if (!esAdmin) return alert('⛔ Solo los Administradores pueden gestionar bloqueos.');
    if (userData?.email?.toLowerCase() === 'proquimicajcv@icloud.com' || userId === 'admin_jcv_master') {
      return alert('⛔ El Administrador General no puede ser suspendido.');
    }

    const motivo = baneado ? prompt('Escribe el motivo del bloqueo:', 'Violación de las reglas de la comunidad') : '';
    if (baneado && (!motivo || !motivo.trim())) return;

    try {
      const motivoNormalizado = motivo ? motivo.trim() : '';
      const contacto = normalizarContactoBaneo(userData?.email || userData?.telefono || '');
      const mensaje = baneado ? construirMensajeBaneo(motivoNormalizado) : '';

      await updateDoc(doc(db, 'usuarios', userId), {
        baneado,
        motivoBaneo: baneado ? motivoNormalizado : '',
        mensajeBaneo: baneado ? mensaje : '',
        fechaBaneo: baneado ? new Date().toISOString() : '',
        baneoPor: baneado ? (usuario?.email || 'admin') : ''
      });

      if (baneado && contacto) {
        try {
          await fetch('/api/notificar-baneo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacto, motivo: motivoNormalizado, uid: userId })
          });
        } catch (e) {
          console.warn('No fue posible enviar la notificación de baneo:', e);
        }
      }

      alert(baneado ? '🚫 Usuario bloqueado correctamente.' : '✅ El bloqueo fue removido.');
    } catch (e) {
      console.error('Error al actualizar el estado de baneo:', e);
      alert('Error al actualizar el bloqueo del usuario.');
    }
  };

  const cambiarRangoUsuario = async (userId, userEmail, nuevoRol) => {
    if (!esAdminMaster) return alert('⛔ Solo el Administrador General puede cambiar rangos.');
    if (userEmail.toLowerCase() === 'proquimicajcv@icloud.com') {
      return alert('⛔ El rango del Administrador General está totalmente protegido.');
    }
    try {
      const userRef = doc(db, 'usuarios', userId);
      await updateDoc(userRef, { rol: nuevoRol });
      alert(`¡Rango del usuario actualizado a ${nuevoRol}!`);
    } catch (e) {
      alert('Error al actualizar rango del usuario.');
    }
  };

  const cambiarNombreUsuarioAdmin = async (userId, nombreActual) => {
    if (!esAdmin) return alert('⛔ Solo los Administradores pueden cambiar nombres de usuario.');
    const nuevoNombre = prompt('Ingrese el nuevo nombre para este usuario:', nombreActual);
    if (!nuevoNombre || !nuevoNombre.trim()) return;
    try {
      const userRef = doc(db, 'usuarios', userId);
      await updateDoc(userRef, { nombre: nuevoNombre.trim() });
      alert('¡Nombre de usuario actualizado con éxito!');
    } catch (e) {
      alert('Error al actualizar el nombre del usuario.');
    }
  };

  const eliminarUsuarioRegular = async (userId, userEmail) => {
    if (!esAdmin) return alert('⛔ No tienes permisos para realizar esta acción.');
    if (userEmail.toLowerCase() === 'proquimicajcv@icloud.com') {
      return alert('⛔ No se puede eliminar al Administrador General.');
    }
    if (!window.confirm('⚠️ ¿Estás seguro de eliminar permanentemente a este usuario regular del sistema?')) return;

    try {
      const destino = resolverDestinoEliminacionCuenta({ uid: userId, email: userEmail });
      const res = await fetch('/api/eliminar-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(destino)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'No fue posible eliminar la cuenta de autenticación.');
      }

      await deleteDoc(doc(db, 'usuarios', destino.uid));
      alert('🗑️ Usuario regular eliminado correctamente. Podrá crear otra cuenta si necesita acceder nuevamente.');
    } catch (e) {
      console.error('Error al eliminar usuario regular:', e);
      alert('Error al eliminar usuario. Revisa que la cuenta exista y vuelve a intentarlo.');
    }
  };

  const eliminarMensajeChatAdmin = async (msgId) => {
    if (!esAdmin) return alert('⛔ Solo los Administradores pueden eliminar mensajes del chat.');
    if (!window.confirm('⚠️ ¿Deseas eliminar este mensaje permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'mensajes_chat', msgId));
      alert('🗑️ Mensaje eliminado correctamente.');
    } catch (e) {
      alert('Error al eliminar el mensaje.');
    }
  };

  const eliminarChatCompleto = async (roomId) => {
    if (!esAdmin) return alert('⛔ Solo los Administradores pueden eliminar conversaciones completas.');
    if (!window.confirm('⚠️ ¿Deseas eliminar todo este chat de consultas generales permanentemente?')) return;
    try {
      const msgsAEliminar = mensajesChat.filter(m => m.chatRoomId === roomId);
      for (const m of msgsAEliminar) {
        await deleteDoc(doc(db, 'mensajes_chat', m.id));
      }
      alert('🗑️ Conversación eliminada correctamente.');
      if (chatRoomSeleccionado === roomId) {
        setChatRoomSeleccionado(null);
      }
    } catch (e) {
      alert('Error al eliminar la conversación.');
    }
  };

  const abrirChatConReportante = (reg) => {
    if (!esAdminOExperto) return alert('⛔ Solo Administradores o Expertos pueden contactar al reportante.');

    const roomId = String(reg?.userId || '').trim();
    if (!roomId) {
      return alert('Este avistamiento no tiene un usuario asociado para chat directo.');
    }

    const nombreReportante = String(reg?.reportante || '').trim() || 'observador';

    setTipoChatEquipo('usuarios');
    setChatRoomSeleccionado(roomId);
    setTab('chat');
    setImagenChat(null);
    setAudioChatURL(null);
    setNuevoMensaje((prev) => {
      if (String(prev || '').trim()) return prev;
      return `Hola ${nombreReportante}, gracias por tu avistamiento. Para continuar la validación, ¿puedes compartir datos adicionales o más fotografías del ejemplar y el hábitat?`;
    });
  };

  const guardarNombrePerfil = async () => {
    if (!nuevoNombrePerfil.trim()) return alert('El nombre no puede estar vacío.');
    try {
      const userRef = doc(db, 'usuarios', usuario.id);
      await updateDoc(userRef, { nombre: nuevoNombrePerfil.trim() });
      setUsuario({ ...usuario, nombre: nuevoNombrePerfil.trim() });
      setEditandoNombrePerfil(false);
      alert('¡Nombre actualizado correctamente!');
    } catch (e) {
      alert('Error al actualizar el nombre en la base de datos.');
    }
  };

  const iniciarGrabacionChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderChatRef.current = new MediaRecorder(stream);
      audioChunksChatRef.current = [];
      mediaRecorderChatRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksChatRef.current.push(event.data);
      };
      mediaRecorderChatRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksChatRef.current, { type: 'audio/mp3' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => setAudioChatURL(reader.result);
      };
      mediaRecorderChatRef.current.start();
      setGrabandoAudioChat(true);
      setTiempoGrabacionChat(0);
      timerChatRef.current = setInterval(() => {
        setTiempoGrabacionChat((prev) => {
          if (prev >= 30) { detenerGrabacionChat(); return 30; }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      alert('Permiso de micrófono no habilitado.');
    }
  };

  const detenerGrabacionChat = () => {
    if (mediaRecorderChatRef.current && grabandoAudioChat) {
      mediaRecorderChatRef.current.stop();
      mediaRecorderChatRef.current.stream.getTracks().forEach(track => track.stop());
      setGrabandoAudioChat(false);
      clearInterval(timerChatRef.current);
    }
  };

  const enviarMensajeChat = async (textoPersonalizado = null, esEmergencia = false) => {
    const textoAEnviar = textoPersonalizado || nuevoMensaje;
    if (!textoAEnviar.trim() && !imagenChat && !audioChatURL && !esEmergencia) return;
    if (!usuario.isLoggedIn) {
      alert('Debes iniciar sesión para interactuar en el chat.');
      setVistaPerfil('login');
      setModalPerfil(true);
      return;
    }

    const roomId = esAdminOExperto 
      ? (tipoChatEquipo === 'interno' ? 'equipo_interno_herpid' : (chatRoomSeleccionado || usuario.id))
      : usuario.id;

    const nombreTarget = esAdminOExperto && tipoChatEquipo === 'usuarios'
      ? (mensajesChat.find(m => m.chatRoomId === roomId)?.usuarioNombre || 'Usuario')
      : usuario.nombre;

    const msgData = {
      chatRoomId: roomId,
      usuarioNombre: nombreTarget,
      senderId: usuario.id,
      senderNombre: usuario.nombre,
      senderRol: usuario.rol || 'Usuario Regular',
      texto: textoAEnviar.trim(),
      imagen: imagenChat || null,
      audio: audioChatURL || null,
      esAdmin: esAdminOExperto,
      esEmergenciaMordedura: esEmergencia,
      createdAt: Date.now(),
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    try {
      await addDoc(collection(db, 'mensajes_chat'), msgData);
      if (!textoPersonalizado) setNuevoMensaje('');
      setImagenChat(null);
      setAudioChatURL(null);

      if (esEmergencia) {
        alert('🚨 Alerta de mordedura enviada al equipo científico. Por favor, comunícate INMEDIATAMENTE con el 911.');
      }
    } catch (e) {
      alert('Error al enviar el mensaje.');
    }
  };

  const handleImagenChatUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validacion = validarTamanoImagen(file);
    if (!validacion.valido) {
      alert(validacion.motivo);
      if (e?.target) e.target.value = '';
      return;
    }

    try {
      const comprimida = await comprimirImagen(file);
      setImagenChat(comprimida);
    } catch (error) {
      alert(error.message || 'No se pudo procesar la imagen.');
    }
  };

  const [tipoFauna, setTipoFauna] = useState(() => cargarBorradorReporte().tipoFauna);
  const [silueta, setSilueta] = useState(() => cargarBorradorReporte().silueta);
  const [desconocido, setDesconocido] = useState(() => cargarBorradorReporte().desconocido);
  const [esPeligrosoReporte, setEsPeligrosoReporte] = useState(() => cargarBorradorReporte().esPeligrosoReporte);
  const [nombreCientifico, setNombreCientifico] = useState(() => cargarBorradorReporte().nombreCientifico);
  const [nombreComun, setNombreComun] = useState(() => cargarBorradorReporte().nombreComun);
  const [lat, setLat] = useState(() => cargarBorradorReporte().lat);
  const [lng, setLng] = useState(() => cargarBorradorReporte().lng);
  const [posPin, setPosPin] = useState(() => cargarBorradorReporte().posPin);
  const [comunidad, setComunidad] = useState(() => cargarBorradorReporte().comunidad);
  const [estadoOrganismo, setEstadoOrganismo] = useState(() => cargarBorradorReporte().estadoOrganismo);
  const [etapa, setEtapa] = useState(() => cargarBorradorReporte().etapa);
  const [temp, setTemp] = useState(() => cargarBorradorReporte().temp);
  const [altitud, setAltitud] = useState(() => cargarBorradorReporte().altitud);
  const [microhabitat, setMicrohabitat] = useState(() => cargarBorradorReporte().microhabitat);
  const [fotosRegistro, setFotosRegistro] = useState(() => cargarBorradorReporte().fotosRegistro);
  const [fotoPrincipalIndex, setFotoPrincipalIndex] = useState(() => Number(cargarBorradorReporte().fotoPrincipalIndex || 0));
  const [autorizaNombrePublico, setAutorizaNombrePublico] = useState(true);
  const [usarFechaActualAvistamiento, setUsarFechaActualAvistamiento] = useState(true);
  const [fechaHoraAvistamiento, setFechaHoraAvistamiento] = useState('');

  const [grabandoAudio, setGrabandoAudio] = useState(false);
  const [tiempoGrabacion, setTiempoGrabacion] = useState(0);
  const [audioURL, setAudioURL] = useState(() => cargarBorradorReporte().audioURL);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const formatearFechaInputLocal = useCallback((timestamp) => {
    const fecha = new Date(Number(timestamp || Date.now()));
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    const hh = String(fecha.getHours()).padStart(2, '0');
    const mm = String(fecha.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  }, []);

  const parsearFechaInputLocal = useCallback((valor) => {
    if (!valor) return null;
    const fecha = new Date(valor);
    const ms = fecha.getTime();
    if (!Number.isFinite(ms)) return null;
    return ms;
  }, []);

  const abrirModalRegistro = () => {
    const borrador = cargarBorradorReporte();
    setTipoFauna(borrador.tipoFauna || 'Anfibio');
    setSilueta(borrador.silueta || 'Rana Arborícola');
    setDesconocido(borrador.desconocido ?? true);
    setEsPeligrosoReporte(borrador.esPeligrosoReporte || false);
    setNombreCientifico(borrador.nombreCientifico || '');
    setNombreComun(borrador.nombreComun || '');
    setEstadoOrganismo(borrador.estadoOrganismo || 'Vivo / Activo');
    setEtapa(borrador.etapa || 'Adulto');
    setMicrohabitat(borrador.microhabitat || 'Vegetación / Finca Cafetalera');
    const fotosBorrador = borrador.fotosRegistro || [];
    setFotosRegistro(fotosBorrador);
    const indiceBorrador = Number(borrador.fotoPrincipalIndex || 0);
    setFotoPrincipalIndex(
      fotosBorrador.length === 0
        ? 0
        : Math.max(0, Math.min(indiceBorrador, fotosBorrador.length - 1))
    );
    setAudioURL(borrador.audioURL || null);
    const latInicial = Number(borrador.lat || '9.650746');
    const lngInicial = Number(borrador.lng || '-84.000193');
    setLat(String(latInicial.toFixed(6)));
    setLng(String(lngInicial.toFixed(6)));
    setPosPin(borrador.posPin || [latInicial, lngInicial]);
    setTemp(borrador.temp || '21,5');
    setAltitud(borrador.altitud || '1450');
    setAutorizaNombrePublico(true);
    setUsarFechaActualAvistamiento(true);
    setFechaHoraAvistamiento(formatearFechaInputLocal(Date.now()));
    setErrorEnvio('');
    setComunidad(borrador.comunidad || '');
    setModalRegistro(true);
  };

  useEffect(() => {
    guardarBorradorReporte({
      tipoFauna,
      silueta,
      desconocido,
      esPeligrosoReporte,
      nombreCientifico,
      nombreComun,
      lat,
      lng,
      posPin,
      comunidad,
      estadoOrganismo,
      etapa,
      temp,
      altitud,
      microhabitat,
      fotosRegistro,
      fotoPrincipalIndex,
      audioURL
    });
  }, [tipoFauna, silueta, desconocido, esPeligrosoReporte, nombreCientifico, nombreComun, lat, lng, posPin, comunidad, estadoOrganismo, etapa, temp, altitud, microhabitat, fotosRegistro, fotoPrincipalIndex, audioURL]);

  const iniciarGrabacion = async () => {
    if (grabandoAudio) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      setAudioURL(null);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => setAudioURL(reader.result);
      };
      mediaRecorderRef.current.start();
      setGrabandoAudio(true);
      setTiempoGrabacion(0);
      timerIntervalRef.current = setInterval(() => {
        setTiempoGrabacion((prev) => {
          if (prev >= 30) { detenerGrabacion(); return 30; }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      alert('Permiso de micrófono no habilitado.');
    }
  };

  const limpiarGrabacionCampo = ({ silencioso = false } = {}) => {
    if (mediaRecorderRef.current && grabandoAudio) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
      try {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      } catch (e) {}
    }

    setGrabandoAudio(false);
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    audioChunksRef.current = [];
    setTiempoGrabacion(0);
    setAudioURL(null);

    if (!silencioso) {
      alert('🗑️ Grabación eliminada.');
    }
  };

  const sustituirGrabacion = async () => {
    limpiarGrabacionCampo({ silencioso: true });
    await iniciarGrabacion();
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabandoAudio) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setGrabandoAudio(false);
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const comprimirImagen = (file) => {
    return new Promise((resolve, reject) => {
      const validacion = validarTamanoImagen(file);
      if (!validacion.valido) {
        reject(new Error(validacion.motivo));
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          let configuracion = resolverConfiguracionCompresion(file.size);
          const canvas = document.createElement('canvas');
          const maxBytesObjetivo = configuracion.maxBytesFinal || MAX_BYTES_IMAGEN_REPORTE;
          const MAX_SIZE = configuracion.maxDimension || 1500;
          let width = img.width;
          let height = img.height;
          let calidad = 1;
          let escala = 1;
          if (configuracion.debeReducir) {
            calidad = configuracion.quality;
            escala = configuracion.scale;
            width = Math.max(1, Math.floor(width * escala));
            height = Math.max(1, Math.floor(height * escala));
          }
          if (width > height) {
            if (width > MAX_SIZE) { height = MAX_SIZE * height / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width = MAX_SIZE * width / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = canvas.toDataURL('image/jpeg', calidad);
          let intentos = 0;
          while (dataUrl.length > maxBytesObjetivo && intentos < 10) {
            calidad = Math.max(0.42, calidad - 0.08);
            dataUrl = canvas.toDataURL('image/jpeg', calidad);
            intentos += 1;
          }

          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      };
      reader.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
    });
  };

  const manejarCargaImagenFaq = async (event, clave) => {
    if (!puedeEditarFaq) return;

    const file = event?.target?.files?.[0];
    if (!file) return;

    const validacion = validarTamanoImagen(file);
    if (!validacion.valido) {
      alert(validacion.motivo);
      if (event?.target) event.target.value = '';
      return;
    }

    try {
      const contenido = await comprimirImagen(file);
      const ruta = `faq/${usuario.id || 'public'}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const referencia = ref(storage, ruta);
      await uploadString(referencia, contenido, 'data_url');
      const url = await getDownloadURL(referencia);
      const siguiente = { ...faqImagenes, [clave]: url };
      setFaqImagenes(siguiente);
      if (puedeEditarFaq) {
        try {
          const docRef = doc(db, 'configuracion_app', 'faq_imagenes');
          await setDoc(docRef, { ...siguiente, actualizadoEn: new Date().toISOString() }, { merge: true });
          guardarFaqImagenes(siguiente);
        } catch (e) {}
      }
      alert('✅ Imagen subida y lista para verse en la app.');
    } catch (error) {
      const contenidoLocal = await comprimirImagen(file);
      setFaqImagenes(prev => ({ ...prev, [clave]: contenidoLocal }));
      alert('⚠️ No fue posible subirla a la nube, pero la imagen quedó disponible localmente en esta app.');
    }

    if (event?.target) event.target.value = '';
  };

  const guardarFaqActual = async () => {
    if (!puedeEditarFaq) return;
    try {
      const docRef = doc(db, 'configuracion_app', 'faq_imagenes');
      await setDoc(docRef, { ...faqImagenes, actualizadoEn: new Date().toISOString() }, { merge: true });
      guardarFaqImagenes(faqImagenes);
      alert('✅ Las imágenes FAQ quedaron guardadas y serán visibles en todos los dispositivos.');
    } catch (e) {
      guardarFaqImagenes(faqImagenes);
      alert('⚠️ Se guardó localmente, pero no se pudo sincronizar con la nube.');
    }
  };

  const handleFotosUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        const fotosPrevisualizadas = await Promise.all(files.slice(0, 3).map(async (file) => {
          const comprimida = await comprimirImagen(file);
          return comprimida;
        }));

        setFotosRegistro((prev) => {
          const nuevasFotos = [...prev, ...fotosPrevisualizadas].slice(0, 3);
          setFotoPrincipalIndex((prevIdx) => Math.min(prevIdx, Math.max(0, nuevasFotos.length - 1)));
          return nuevasFotos;
        });
        setErrorEnvio('');
      } catch (error) {
        setErrorEnvio(error.message || 'No se pudieron preparar las fotos. Intenta de nuevo con otra imagen.');
      }
    }

    if (e?.target) e.target.value = '';
  };

  const eliminarFotoRegistro = (indiceFoto) => {
    setFotosRegistro((prev) => {
      const fotosActuales = prev.filter((_, indice) => indice !== indiceFoto);
      setFotoPrincipalIndex((prevPrincipal) => {
        if (fotosActuales.length === 0) return 0;
        if (indiceFoto === prevPrincipal) return 0;
        if (indiceFoto < prevPrincipal) return Math.max(0, prevPrincipal - 1);
        return Math.min(prevPrincipal, fotosActuales.length - 1);
      });
      return fotosActuales;
    });
  };

  const moverFotoRegistro = (indiceFoto, direccion) => {
    setFotosRegistro((prev) => {
      const siguienteIndex = indiceFoto + direccion;
      if (siguienteIndex < 0 || siguienteIndex >= prev.length) return prev;
      const nuevasFotos = moverFotoEnLista(prev, indiceFoto, siguienteIndex);
      return nuevasFotos;
    });
  };

  const limpiarFotosRegistro = () => {
    setFotosRegistro([]);
    setFotoPrincipalIndex(0);
  };

  useEffect(() => {
    return () => {
      if (logoPreviewTimeoutRef.current) {
        clearTimeout(logoPreviewTimeoutRef.current);
      }
    };
  }, []);

  const mostrarPreviewLogo = () => {
    if (logoPreviewTimeoutRef.current) {
      clearTimeout(logoPreviewTimeoutRef.current);
    }
    logoPreviewTimeoutRef.current = setTimeout(() => {
      if (logoActivo) {
        setLightboxData({ fotos: [logoActivo], index: 0 });
        setLogoPreviewVisible(true);
      }
    }, 120);
  };

  const ocultarPreviewLogo = () => {
    if (logoPreviewTimeoutRef.current) {
      clearTimeout(logoPreviewTimeoutRef.current);
    }
    setLogoPreviewVisible(false);
    setLightboxData(null);
  };

  const manejarLogoAppUpload = async (e) => {
    const file = e.target.files?.[0] || e?.dataTransfer?.files?.[0];
    if (!file) return;

    const validacion = validarTamanoImagen(file);
    if (!validacion.valido) {
      alert(validacion.motivo);
      if (e?.target) e.target.value = '';
      return;
    }

    if (!usuario.isLoggedIn || !usuario.id) {
      alert('Inicia sesión para personalizar tu logo.');
      e.target.value = '';
      return;
    }

    const tipo = (file.type || '').toLowerCase();
    if (!tipo.startsWith('image/')) {
      alert('Selecciona un archivo de imagen válido para el logo.');
      if (e.target) e.target.value = '';
      return;
    }

    try {
      const contenido = await comprimirImagen(file);

      const userDocRef = doc(db, 'usuarios', usuario.id);
      await setDoc(userDocRef, { logoApp: contenido }, { merge: true });
      setLogoApp(contenido);
      alert('✅ Tu logo se guardó en tu perfil y estará disponible en otros dispositivos.');
    } catch (err) {
      alert('No se pudo guardar el logo. Intenta con otra imagen o vuelve a intentarlo.');
    }

    if (e.target) e.target.value = '';
  };

  const guardarNuevaEspecieGuia = async () => {
    if (!esAdmin) return alert('⛔ Acción restringida a Administradores.');
    if (!formGuia.nombre || !formGuia.especie) {
      return alert('Debe completar al menos el Nombre Común y Nombre Científico.');
    }
    const nueva = {
      nombre: formGuia.nombre.trim(),
      especie: formGuia.especie.trim(),
      tipo: formGuia.tipo,
      esPeligroso: formGuia.esPeligroso,
      img: formGuia.img || 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=500',
      desc: formGuia.desc || 'Especie registrada en la guía oficial.',
      autorizadoPor: 'admin'
    };
    try {
      await addDoc(collection(db, 'especies_guia'), nueva);
      await cargarGuiaNube();
      alert('¡Especie agregada a la Guía Herpetológica!');
      setModalNuevaEspecieGuia(false);
      setFormGuia({ nombre: '', especie: '', tipo: 'Anfibio', esPeligroso: false, img: '', desc: '' });
    } catch (e) {
      alert('Error al guardar especie en la nube.');
    }
  };

  const guardarEdicionEspecieGuia = async () => {
    if (!esAdmin) return alert('⛔ Acción restringida a Administradores.');
    if (!especieGuiaEditando) return;
    try {
      const docRef = doc(db, 'especies_guia', especieGuiaEditando.id);
      await updateDoc(docRef, {
        nombre: especieGuiaEditando.nombre.trim(),
        especie: especieGuiaEditando.especie.trim(),
        tipo: especieGuiaEditando.tipo,
        esPeligroso: especieGuiaEditando.esPeligroso || false,
        img: especieGuiaEditando.img,
        desc: especieGuiaEditando.desc,
        autorizadoPor: 'admin'
      });
      await cargarGuiaNube();
      alert('¡Ficha de la Guía actualizada!');
      setModalEditarEspecieGuia(false);
    } catch (e) {
      alert('Error al actualizar la ficha.');
    }
  };

  const eliminarEspecieGuia = async (id) => {
    if (!esAdmin) return alert('⛔ Acción restringida a Administradores.');
    if (!window.confirm('⚠️ ¿Estás seguro de eliminar esta especie de la Guía Herpetológica?')) return;
    try {
      await deleteDoc(doc(db, 'especies_guia', id));
      await cargarGuiaNube();
      alert('🗑️ Especie eliminada de la guía.');
    } catch (e) {
      alert('Error al eliminar especie.');
    }
  };

  const registrarAuditoriaRevision = async ({ id, estadoAnterior, estadoNuevo, registroBase, accionForzada = null }) => {
    const accion = accionForzada || (String(estadoNuevo || '').toUpperCase() === 'VALIDADO' ? 'aprobacion' : 'revision');
    await addDoc(collection(db, 'auditoria_revision_avistamientos'), {
      avistamientoId: id,
      estadoAnterior: estadoAnterior || null,
      estadoNuevo: estadoNuevo || null,
      accion,
      actorId: usuario.id || null,
      actorEmail: usuario.email || null,
      actorNombre: usuario.nombre || null,
      actorRol: usuario.rol || 'Usuario Regular',
      nombreComun: registroBase?.nombreComun || null,
      ubicacion: registroBase?.ubicacion || null,
      createdAt: Date.now()
    });
  };

  const cambiarEstadoReporte = async (id, nuevoEstado) => {
    if (!esAdminOExperto) return alert('⛔ Se requieren permisos de Experto o Administrador.');
    if (!id) return alert('Error: ID del registro no encontrado.');
    try {
      const docRef = doc(db, 'avistamientos', id);
      const registroActual = registros.find((r) => r.id === id);
      const estadoAnterior = registroActual?.estado || null;
      await updateDoc(docRef, { estado: nuevoEstado });
      await registrarAuditoriaRevision({ id, estadoAnterior, estadoNuevo: nuevoEstado, registroBase: registroActual });
      alert(`¡Estado guardado permanentemente en Firebase como ${nuevoEstado}!`);
    } catch (e) {
      alert('Error al guardar el cambio en la nube.');
    }
  };

  const abrirEdicionModal = (reg) => {
    const esProp = esPropietarioReporte(reg);
    if (!esAdminOExperto && !esProp) return alert('⛔ Solo puedes editar tus propios reportes.');
    if (esRegistroValidado(reg?.estado) && !esAdmin) {
      return alert('⛔ Solo los administradores pueden editar reportes validados.');
    }
    const fotosReales = construirListaFotosPriorizada(reg);
    const fotoInicial = fotosReales[0] || '';
    setRegistroEditando({ 
      ...reg, 
      fotoAutorizada: fotoInicial,
      latEdit: reg.coords?.[0] || 9.65,
      lngEdit: reg.coords?.[1] || -84.00,
      fechaAvistamientoInput: formatearFechaInputLocal(reg.fechaAvistamientoMs || reg.createdAt || reg.timestamp || Date.now())
    });
    setModalEditar(true);
  };

  const guardarEdicionRegistro = async () => {
    if (!registroEditando || !registroEditando.id) return alert('Error: Registro sin ID válido.');
    const esProp = esPropietarioReporte(registroEditando);
    if (!esAdminOExperto && !esProp) return alert('⛔ No tienes permisos para editar este registro.');
    if (esRegistroValidado(registroEditando?.estado) && !esAdmin) return alert('⛔ Solo los administradores pueden editar reportes validados.');
    
    try {
      const docRef = doc(db, 'avistamientos', registroEditando.id);
      const registroActual = registros.find((r) => r.id === registroEditando.id);
      const fotosReales = construirListaFotosPriorizada(registroEditando);
      const fotoElegida = fotosReales.find((f) => f === registroEditando.fotoAutorizada) || fotosReales[0] || '';
      const fechaAvistamientoEditMs = parsearFechaInputLocal(registroEditando.fechaAvistamientoInput) || registroEditando.fechaAvistamientoMs || registroEditando.createdAt || Date.now();
      const fechaAvistamientoTexto = new Date(fechaAvistamientoEditMs).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
      
      const nuevasCoords = [
        parseFloat(registroEditando.latEdit) || 9.65,
        parseFloat(registroEditando.lngEdit) || -84.00
      ];

      const datosActualizados = {
        nombreComun: registroEditando.nombreComun || 'Avistamiento',
        especie: registroEditando.especie || 'Por verificar',
        categoria: registroEditando.categoria || 'ANFIBIO',
        silueta: registroEditando.silueta || 'Rana Arborícola',
        ubicacion: registroEditando.ubicacion || 'Sin datos',
        microhabitat: registroEditando.microhabitat || 'Vegetación',
        estadoVida: registroEditando.estadoVida || 'Vivo / Activo',
        temp: registroEditando.temp || '21,5 °C',
        altitud: registroEditando.altitud || '1200 msnm',
        esPeligroso: registroEditando.esPeligroso || false,
        estado: esAdminOExperto ? (registroEditando.estado || 'EN REVISIÓN EXPERTA') : 'EN REVISIÓN EXPERTA',
        fotoAutorizada: fotoElegida || null,
        img: fotoElegida || null,
        coords: nuevasCoords,
        fechaAvistamientoMs: fechaAvistamientoEditMs,
        fechaAvistamiento: fechaAvistamientoTexto,
        horaRegistro: fechaAvistamientoTexto,
        editedAt: Date.now(),
        editedBy: usuario.nombre || usuario.email || 'Usuario'
      };

      await updateDoc(docRef, datosActualizados);

      if (esAdminOExperto && String(registroEditando.estado || '').toUpperCase() !== String(registroActual?.estado || '').toUpperCase()) {
        await registrarAuditoriaRevision({
          id: registroEditando.id,
          estadoAnterior: registroActual?.estado || null,
          estadoNuevo: datosActualizados.estado,
          registroBase: registroActual,
          accionForzada: String(datosActualizados.estado || '').toUpperCase() === 'VALIDADO' ? 'aprobacion' : 'revision'
        });
      }

      await addDoc(collection(db, 'mensajes_chat'), {
        chatRoomId: 'equipo_interno_herpid',
        usuarioNombre: 'Equipo Científico',
        senderId: 'sistema_avistamientos',
        senderNombre: 'Sistema HerpID',
        senderRol: 'Sistema',
        texto: `📝 Informe de edición: ${usuario.nombre || 'Usuario'} actualizó el avistamiento "${datosActualizados.nombreComun}" (${registroEditando.id}). Fecha del avistamiento: ${fechaAvistamientoTexto}.`,
        esAdmin: true,
        esInformeEdicion: true,
        createdAt: Date.now(),
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      alert('¡Reporte y ubicación corregidos con éxito en el mapa!');
      setModalEditar(false);
    } catch (e) {
      alert('Error al actualizar la base de datos.');
    }
  };

  const eliminarRegistro = async (id, reg) => {
    const esProp = reg ? esPropietarioReporte(reg) : false;
    if (!esAdminOExperto && !esProp) return alert('⛔ No tienes permisos para eliminar este registro.');
    if (!id) return alert('Error: ID del registro no válido.');
    if (!window.confirm('⚠️ ¿Deseas eliminar permanentemente este avistamiento?')) return;
    try {
      await deleteDoc(doc(db, 'avistamientos', id));
      alert('🗑️ Registro eliminado de la base de datos.');
    } catch (e) {
      alert('Error al eliminar el registro.');
    }
  };

  const exportarCSV = () => {
    if (!esAdmin) return alert('⛔ Solo los Administradores pueden exportar datos.');
    if (registros.length === 0) return alert('No hay datos para exportar.');
    const headers = "ID,Nombre Comun,Especie,Categoria,Silueta,Estado,Ubicacion,Peligroso,Reportante,Latitud,Longitud,Temperatura,Altitud\n";
    const rows = registros.map(r => `${r.id},${r.nombreComun},${r.especie || 'NA'},${r.categoria || 'NA'},${r.silueta},${r.estado},${r.ubicacion},${r.esPeligroso ? 'SI' : 'NO'},${r.reportante},${r.coords?.[0] || 'NA'},${r.coords?.[1] || 'NA'},${r.temp},${r.altitud}`).join("\n");
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob([headers + rows], { type: 'text/csv' }));
    a.download = `HerpID_CostaRica_Reportes.csv`;
    a.click();
  };

  const enviarReporteCientifico = async () => {
    if (enviandoReporte) return;
    setErrorEnvio('');

    const fotosAdjuntas = fotosRegistro.filter(Boolean).length;
    if (fotosAdjuntas === 0) {
      const mensaje = '⚠️ Debes adjuntar al menos una fotografía para enviar el reporte.';
      setErrorEnvio(mensaje);
      alert(mensaje);
      return;
    }

    setEnviandoReporte(true);

    try {
      const fechaEventoMs = usarFechaActualAvistamiento
        ? Date.now()
        : (parsearFechaInputLocal(fechaHoraAvistamiento) || Date.now());
      const fechaEventoTexto = new Date(fechaEventoMs).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });

      const nombreReportante = usuario.isLoggedIn
        ? (usuario.nombre || usuario.email)
        : 'Usuario Anónimo';
      const latNumero = Number(lat);
      const lngNumero = Number(lng);
      const latFinal = Number.isFinite(latNumero) ? latNumero : 9.650746;
      const lngFinal = Number.isFinite(lngNumero) ? lngNumero : -84.000193;
      const textoUbicacion = `Ubicación por pin del mapa • ${latFinal.toFixed(6)}, ${lngFinal.toFixed(6)}`;
      const provinciaDetectada = buscarProvinciaEnTexto(textoUbicacion) || buscarProvinciaEnTexto(`${textoUbicacion} ${nombreComun} ${nombreCientifico}`) || 'San José';

      const fotosBase = fotosRegistro.slice(0, 3).filter(Boolean);
      const fotosNormalizadas = [];
      let fotosSinSubir = 0;
      for (let i = 0; i < fotosBase.length; i += 1) {
        const foto = fotosBase[i];
        if (typeof foto === 'string' && foto.startsWith('data:image/')) {
          const ruta = `avistamientos/${usuario.id || 'anonimo'}/${Date.now()}-${i}.jpg`;
          const resultadoSubida = await subirFotoConFallback({
            dataUrl: foto,
            ruta,
            subir: async ({ dataUrl, ruta: rutaDestino }) => {
              const referenciaDestino = ref(storage, rutaDestino);
              await uploadString(referenciaDestino, dataUrl, 'data_url');
              return getDownloadURL(referenciaDestino);
            }
          });

          if (typeof resultadoSubida.url === 'string' && resultadoSubida.url.startsWith('http')) {
            fotosNormalizadas.push(resultadoSubida.url);
          } else {
            if (typeof resultadoSubida.url === 'string' && resultadoSubida.url.startsWith('data:image/')) {
              fotosNormalizadas.push(resultadoSubida.url);
            }
            fotosSinSubir += 1;
          }
        } else {
          fotosNormalizadas.push(foto);
        }
      }

      if (fotosNormalizadas.length === 0) {
        throw new Error('⚠️ No se pudieron subir las fotos al almacenamiento. Revisa tu conexión e inténtalo de nuevo con imágenes más livianas.');
      }

      const fotoInicial = fotosNormalizadas[fotoPrincipalIndex] || fotosNormalizadas[0] || '';
      const fotosOrdenadas = [
        fotoInicial,
        ...fotosNormalizadas.filter((f) => f && f !== fotoInicial)
      ].filter(Boolean).slice(0, 3);

      if (fotosOrdenadas.length === 0 || !fotoInicial) {
        throw new Error('⚠️ No se pudo confirmar una foto válida para el reporte. Vuelve a cargar la imagen e inténtalo de nuevo.');
      }

      const nuevo = {
        userId: usuario.id || null,
        userEmail: usuario.email || null,
        nombreComun: desconocido ? 'Desconocido (Por verificar)' : (nombreComun || 'Avistamiento'),
        especie: desconocido ? 'Especie por verificar' : (nombreCientifico || nombreComun),
        categoria: tipoFauna.toUpperCase(),
        silueta: silueta,
        esPeligroso: esPeligrosoReporte,
        estado: 'EN REVISIÓN EXPERTA',
        ubicacion: textoUbicacion,
        provincia: provinciaDetectada,
        reportante: nombreReportante,
        autorizaNombrePublico,
        temp: `${temp} °C`,
        altitud: `${altitud} msnm`,
        microhabitat: microhabitat,
        estadoVida: `${estadoOrganismo} (${etapa})`,
        horaRegistro: fechaEventoTexto,
        fechaAvistamiento: fechaEventoTexto,
        fechaAvistamientoMs: fechaEventoMs,
        fechaAvistamientoManual: !usarFechaActualAvistamiento,
        audioURL: audioURL || null,
        fotos: fotosOrdenadas,
        fotoAutorizada: fotoInicial || null,
        img: fotoInicial || null,
        fotoPrincipalIndex,
        coords: [latFinal, lngFinal],
        createdAt: Date.now(),
        fotoSubidaAFirebase: fotosSinSubir === 0
      };

      const resultado = await persistirAvistamientoConFallback({
        payload: nuevo,
        guardarRemoto: async (payload) => {
          const requiereSubidaServidor = Array.isArray(payload?.fotos) && payload.fotos.some((f) => String(f || '').startsWith('data:image/'));
          if (requiereSubidaServidor) {
            throw new Error('subida-servidor-requerida');
          }

          const docRef = await addDoc(collection(db, 'avistamientos'), payload);
          return { ok: true, id: docRef?.id || null };
        },
        guardarDirecto: async (payload) => {
          const response = await fetch('/api/registrar-avistamiento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const contentType = String(response.headers.get('content-type') || '').toLowerCase();
          const esJson = contentType.includes('application/json');
          const data = esJson ? await response.json().catch(() => ({})) : {};
          if (!response.ok) {
            throw new Error(data?.error || 'No fue posible registrar el avistamiento en el backend.');
          }

          if (!esJson || data?.ok !== true) {
            throw new Error('Respuesta inválida del backend al registrar el avistamiento.');
          }

          return { ok: true, id: data?.id || null };
        }
      });

      if (!resultado?.ok) {
        throw new Error('No se pudo guardar el reporte.');
      }

      limpiarBorradorReporte();
      if (resultado?.guardadoLocal) {
        alert('⚠️ El reporte se guardó localmente por un problema de conexión y se enviará cuando el servicio se restablezca.');
      } else {
        alert(`¡Avistamiento enviado a revisión experta por parte de ${nombreReportante}!`);
      }
      setModalRegistro(false);
    } catch (e) {
      const mensajeError = e?.message || 'Error al enviar el reporte a la nube.';
      setErrorEnvio(mensajeError);
      alert(mensajeError);
    } finally {
      setEnviandoReporte(false);
    }
  };

const especiesFiltradasGuia = resolverEspeciesGuiaAutorizadas(especiesGuia).filter((e) =>
    (e.nombre && e.nombre.toLowerCase().includes(busquedaGuia.toLowerCase())) || 
    (e.especie && e.especie.toLowerCase().includes(busquedaGuia.toLowerCase()))
  );

  const obtenerNombrePublicoReportante = useCallback((reg) => {
    if (reg?.autorizaNombrePublico === false) {
      return 'Observador protegido';
    }

    const raw = String(reg?.reportante || '').trim();
    if (!raw) return 'Observador registrado';

    const contieneCorreo = /@/.test(raw) || /tel_/i.test(raw);
    const contieneTelefono = /\+?\d[\d\s()\-]{6,}/.test(raw);
    if (contieneCorreo || contieneTelefono) {
      return 'Observador protegido';
    }

    return raw.slice(0, 48);
  }, []);

  const construirListaFotosPriorizada = useCallback((reg) => {
    const fotosBase = Array.isArray(reg?.fotos)
      ? reg.fotos.filter((f) => Boolean(f) && !esFotoPlaceholderSistema(f))
      : [];
    const candidata = reg?.fotoAutorizada || reg?.img || '';
    const fotoPrioritaria = esFotoPlaceholderSistema(candidata) ? '' : candidata;
    if (!fotoPrioritaria) return fotosBase;
    const restantes = fotosBase.filter((f) => f !== fotoPrioritaria);
    return [fotoPrioritaria, ...restantes];
  }, []);

  const obtenerContactoAdminReportante = useCallback((reg) => {
    const correo = String(reg?.userEmail || '').trim().toLowerCase();
    if (correo) {
      if (correo.startsWith('tel_') && correo.endsWith('@herpid.cr')) {
        const base = correo.replace(/^tel_/, '').replace(/@herpid\.cr$/, '');
        const soloDigitos = base.replace(/\D/g, '');
        if (soloDigitos.length >= 8) {
          return `Tel: ${soloDigitos}`;
        }
      }
      return `Correo: ${correo}`;
    }

    const nombre = String(reg?.reportante || '').trim();
    if (nombre) {
      return `Nombre registrado: ${nombre}`;
    }

    return 'Contacto no disponible';
  }, []);

  const formatearFechaReporte = useCallback((reg) => {
    const ts = Number(reg?.createdAt || reg?.timestamp || reg?.fechaMs || 0);
    if (Number.isFinite(ts) && ts > 0) {
      return new Date(ts).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
    }
    return reg?.horaRegistro || 'Fecha no disponible';
  }, []);

  const obtenerMomentoRegistro = useCallback((r) => {
    return Number(r?.createdAt || r?.timestamp || r?.fechaMs || 0);
  }, []);

  const compararPrioridadNovedad = useCallback((a, b) => {
    const aPendiente = esRegistroValidado(a?.estado) ? 0 : 1;
    const bPendiente = esRegistroValidado(b?.estado) ? 0 : 1;
    if (aPendiente !== bPendiente) {
      return bPendiente - aPendiente;
    }

    const tiempoA = obtenerMomentoRegistro(a);
    const tiempoB = obtenerMomentoRegistro(b);
    return tiempoB - tiempoA;
  }, [obtenerMomentoRegistro]);

  const registrosPublicosOrdenados = useMemo(() => {
    return [...registrosVisibles].sort(compararPrioridadNovedad);
  }, [registrosVisibles, compararPrioridadNovedad]);

  const registrosFiltradosAdmin = useMemo(() => {
    return registros
      .filter((r) => !esRegistroValidado(r.estado))
      .filter(r => 
        (r.nombreComun && r.nombreComun.toLowerCase().includes(busquedaAdmin.toLowerCase())) ||
        (r.ubicacion && r.ubicacion.toLowerCase().includes(busquedaAdmin.toLowerCase()))
      )
      .sort(compararPrioridadNovedad);
  }, [registros, busquedaAdmin, compararPrioridadNovedad]);

  const obtenerCredencialFirebase = (input) => {
    const limpio = input.trim();
    if (limpio.toLowerCase() === 'proquimicajcv@icloud.com') return limpio.toLowerCase();
    if (limpio.includes('@')) return limpio.toLowerCase();
    const soloNumeros = limpio.replace(/\D/g, '');
    return `tel_${soloNumeros}@herpid.cr`;
  };

  const normalizarTelefono = (input) => {
    return String(input || '').replace(/\D/g, '');
  };

  const obtenerEmailAsociadoCelular = async (celular) => {
    const telefono = normalizarTelefono(celular);
    if (!telefono) return '';

    const snap = await getDocs(
      query(collection(db, 'usuarios'), where('telefono', '==', telefono), limit(1))
    );

    if (snap.empty) return '';

    const data = snap.docs[0].data() || {};
    const email = String(data.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return '';
    return email;
  };

  const resolverCredencialLogin = async (input) => {
    const limpio = String(input || '').trim();
    if (!limpio) return '';

    if (limpio.toLowerCase() === 'proquimicajcv@icloud.com') {
      return limpio.toLowerCase();
    }

    if (limpio.includes('@')) {
      return limpio.toLowerCase();
    }

    const emailAsociado = await obtenerEmailAsociadoCelular(limpio);
    if (emailAsociado) {
      return emailAsociado;
    }

    return obtenerCredencialFirebase(limpio);
  };

  const ejecutarLogin = async () => {
    const credencialInput = formLogin.emailOrTel.trim();
    if (!credencialInput || !formLogin.pass) {
      alert('Ingresa tu correo o celular y la contraseña.');
      return;
    }

    const emailFinal = await resolverCredencialLogin(credencialInput);
    const esAdminMail = emailFinal.toLowerCase() === 'proquimicajcv@icloud.com';
    const telefonoLogin = credencialInput.includes('@') ? '' : normalizarTelefono(credencialInput);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await signInWithEmailAndPassword(auth, emailFinal, formLogin.pass);
      const userDocRef = doc(db, 'usuarios', cred.user.uid);
      const userSnap = await getDoc(userDocRef);
      const datosUsuario = userSnap.exists() ? userSnap.data() : {};

      if (datosUsuario?.baneado) {
        await signOut(auth);
        alert(construirMensajeBaneo(datosUsuario.motivoBaneo || 'Violación de las reglas de la comunidad'));
        return;
      }

      try {
        localStorage.removeItem(CLAVE_LOGOUT_MANUAL);
      } catch (e) {}
      setUsuario({
        isLoggedIn: true,
        id: cred.user.uid,
        email: cred.user.email,
        nombre: esAdminMail ? 'Jorge Carvajal' : (cred.user.displayName || credencialInput),
        rol: esAdminMail ? 'Administrador General' : 'Usuario Regular'
      });
      await setDoc(userDocRef, crearDatosUsuarioFirestore({
        uid: cred.user.uid,
        email: cred.user.email,
        nombre: esAdminMail ? 'Jorge Carvajal' : (cred.user.displayName || credencialInput),
        rol: esAdminMail ? 'Administrador General' : 'Usuario Regular',
        ultimoAcceso: new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }),
        ultimoConexion: Date.now(),
        telefono: telefonoLogin || undefined
      }), { merge: true });
      limpiarBorradorLogin();
      setModalPerfil(false);
      setModalBienvenidaInicio(true);
      alert('¡Bienvenido!');
    } catch (e) {
      if (esAdminMail) {
        setUsuario({
          isLoggedIn: true,
          id: 'admin_jcv_master',
          email: 'proquimicajcv@icloud.com',
          nombre: 'Jorge Carvajal',
          rol: 'Administrador General'
        });
        setModalPerfil(false);
        setModalBienvenidaInicio(true);
        alert('¡Bienvenido Administrador General!');
      } else {
        alert('Datos incorrectos. Revisa tu correo o número de celular e inténtalo de nuevo.');
      }
    }
  };

  const ejecutarRegistro = async () => {
    const credencialInput = formReg.emailOrTel.trim();
    const correoRecuperacion = formReg.correoRecuperacion.trim().toLowerCase();

    if (!formReg.pass || !formReg.nombre.trim()) {
      alert('Completa nombre y contraseña para continuar.');
      return;
    }

    const validacion = validarRegistroContacto({ credencialInput, correoRecuperacion });
    if (!validacion.ok) {
      alert(validacion.error);
      return;
    }

    const telefonoRegistro = validacion.esCorreo ? '' : validacion.telefono;
    const emailFinal = validacion.emailFinal;

    if (!validacion.esCorreo) {
      const existeTelefono = await getDocs(
        query(collection(db, 'usuarios'), where('telefono', '==', telefonoRegistro), limit(1))
      );

      if (!existeTelefono.empty) {
        alert('Ese número de celular ya está registrado.');
        return;
      }
    }

    const queryBaneo = await getDocs(
      query(collection(db, 'usuarios'), where('email', '==', emailFinal), limit(1))
    );
    const usuarioBaneado = queryBaneo.docs.some((docSnap) => docSnap.data()?.baneado);
    if (usuarioBaneado) {
      alert(construirMensajeBaneo(queryBaneo.docs[0].data()?.motivoBaneo || 'Violación de las reglas de la comunidad'));
      return;
    }

    const esAdminMail = emailFinal.toLowerCase() === 'proquimicajcv@icloud.com';

    try {
      await setPersistence(auth, browserLocalPersistence);
      const cred = await createUserWithEmailAndPassword(auth, emailFinal, formReg.pass);
      const nombreFinal = formReg.nombre || (esAdminMail ? 'Jorge Carvajal' : credencialInput);
      try {
        localStorage.removeItem(CLAVE_LOGOUT_MANUAL);
      } catch (e) {}
      setUsuario({
        isLoggedIn: true,
        id: cred.user.uid,
        email: emailFinal,
        nombre: nombreFinal,
        rol: esAdminMail ? 'Administrador General' : 'Usuario Regular'
      });
      const userDocRef = doc(db, 'usuarios', cred.user.uid);
      await setDoc(userDocRef, crearDatosUsuarioFirestore({
        uid: cred.user.uid,
        email: emailFinal,
        nombre: nombreFinal,
        rol: esAdminMail ? 'Administrador General' : 'Usuario Regular',
        ultimoAcceso: new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' }),
        ultimoConexion: Date.now(),
        telefono: telefonoRegistro || undefined
      }), { merge: true });
      limpiarBorradorLogin();
      alert('¡Cuenta creada correctamente!');
      setModalPerfil(false);
      setModalBienvenidaInicio(true);
    } catch (e) {
      if (esAdminMail) {
        setUsuario({
          isLoggedIn: true,
          id: 'admin_jcv_master',
          email: 'proquimicajcv@icloud.com',
          nombre: 'Jorge Carvajal',
          rol: 'Administrador General'
        });
        alert('¡Bienvenido Administrador!');
        setModalPerfil(false);
        setModalBienvenidaInicio(true);
      } else {
        alert('Error al registrar. Es posible que el correo o teléfono ya esté registrado.');
      }
    }
  };

  const ejecutarRecuperacionContrasena = async () => {
    const contacto = (formRecuperacion.emailOrTel || formLogin.emailOrTel).trim();
    if (!contacto) {
      alert('Ingresa tu correo o celular para recuperar la contraseña.');
      return;
    }

    const contactoNormalizado = normalizarContactoRecuperacion(contacto);
    if (!contactoNormalizado) {
      alert('Ingresa un correo o celular válido.');
      return;
    }

    const codigo = generarCodigoRecuperacion();
    const emailDestino = contactoNormalizado.includes('@') ? contactoNormalizado : '';
    setCodigoTemporal(codigo);
    setCodigoRecuperacionEnviado(true);
    setCodigoRecuperacion('');
    setEmailRecuperacion(emailDestino);

    try {
      const res = await fetch('/api/enviar-codigo-recuperacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacto: contactoNormalizado, codigo })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'No fue posible iniciar la recuperación.');
      }

      setEmailRecuperacion(data?.email || emailDestino);
      const mensaje = contactoNormalizado.includes('@')
        ? `Te enviamos el código de recuperación y el enlace para restablecer tu contraseña al correo ${data.email}.`
        : `Te enviamos el código de recuperación al celular asociado a tu cuenta (${data.email}).`;

      if (data?.email) {
        try {
          const emailRes = await fetch('/api/enviar-email-recuperacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacto: data.email, codigo, resetLink: data.resetLink || '' })
          });
          const emailData = await emailRes.json().catch(() => ({}));
          if (!emailRes.ok && emailData?.error) {
            console.warn('Correo de recuperación no enviado:', emailData.error);
          }
        } catch (emailError) {
          console.warn('Correo de recuperación no enviado:', emailError);
        }
      }

      alert(`${mensaje}\nCódigo: ${codigo}`);
    } catch (e) {
      setCodigoRecuperacionEnviado(false);
      setCodigoTemporal('');
      alert('No se pudo enviar la recuperación en este momento. Intenta nuevamente en unos minutos.');
    }
  };

  const confirmarCodigoRecuperacion = () => {
    if (!codigoRecuperacion.trim()) {
      alert('Ingresa el código de recuperación que recibiste.');
      return;
    }

    if (codigoRecuperacion.trim() !== codigoTemporal) {
      alert('El código ingresado no coincide. Intenta de nuevo.');
      return;
    }

    setCodigoVerificado(true);
    setCodigoRecuperacion('');
    setCodigoRecuperacionEnviado(false);
    alert('Código verificado. Ahora define una nueva contraseña.');
  };

  const restablecerContrasena = async () => {
    if (!codigoVerificado) {
      alert('Primero confirma el código de recuperación.');
      return;
    }

    if (!nuevaContrasena || nuevaContrasena.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      const contactoDestino = emailRecuperacion || formRecuperacion.emailOrTel || formLogin.emailOrTel;
      const res = await fetch('/api/recuperar-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacto: contactoDestino, nuevaContrasena })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'No fue posible restablecer la contraseña.');
      }

      setFormRecuperacion({ emailOrTel: '' });
      setCodigoRecuperacion('');
      setCodigoRecuperacionEnviado(false);
      setCodigoTemporal('');
      setNuevaContrasena('');
      setCodigoVerificado(false);
      setEmailRecuperacion('');
      setVistaPerfil('login');
      alert('¡Contraseña restablecida correctamente! Ya puedes iniciar sesión con la nueva contraseña.');
    } catch (e) {
      alert('No se pudo cambiar la contraseña en este momento. Intenta nuevamente.');
    }
  };

  const activeRoomId = esAdminOExperto 
    ? (tipoChatEquipo === 'interno' ? 'equipo_interno_herpid' : (chatRoomSeleccionado || (chatsSalas[0]?.roomId || usuario.id)))
    : usuario.id;

  const mensajesFiltrados = mensajesChat.filter(m => m.chatRoomId === activeRoomId);

  const misReportes = registros.filter(r => coincideIdentidadUsuario(r, usuario));
  const misReportesOrdenados = useMemo(() => {
    return misReportes
      .filter((r) => !esRegistroValidado(r?.estado))
      .sort((a, b) => {
        const tiempoA = Number(a?.createdAt || a?.timestamp || a?.fechaMs || 0);
        const tiempoB = Number(b?.createdAt || b?.timestamp || b?.fechaMs || 0);
        return tiempoB - tiempoA;
      });
  }, [misReportes]);
  const misValidados = misReportes.filter((r) => esRegistroValidado(r.estado)).length;
  const misPendientes = misReportes.filter((r) => !esRegistroValidado(r.estado)).length;

  const logoActivo = logoApp;

  const rankingUsuarios = useMemo(() => {
    return todosLosUsuarios
      .map((u) => {
        const userReportes = registros.filter(r => coincideIdentidadUsuario(r, u));
        const userValidados = userReportes.filter((r) => esRegistroValidado(r.estado)).length;
        return { ...u, userReportes, userValidados };
      })
      .sort((a, b) => {
        if (b.userValidados !== a.userValidados) return b.userValidados - a.userValidados;
        if (b.userReportes.length !== a.userReportes.length) return b.userReportes.length - a.userReportes.length;
        return (a.nombre || '').localeCompare(b.nombre || '');
      })
      .slice(0, 5);
  }, [todosLosUsuarios, registros]);

  const estadisticasPorUsuario = useMemo(() => {
    const porId = new Map();
    const porEmail = new Map();
    const porNombre = new Map();

    for (const reg of registros) {
      const estadoValido = esRegistroValidado(reg.estado);
      const data = {
        total: 1,
        validados: estadoValido ? 1 : 0
      };

      const userId = reg.userId ? String(reg.userId).trim() : '';
      const userEmail = reg.userEmail ? String(reg.userEmail).trim().toLowerCase() : '';
      const reportante = reg.reportante
        ? String(reg.reportante).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
        : '';

      if (userId) {
        const prev = porId.get(userId) || { total: 0, validados: 0 };
        porId.set(userId, { total: prev.total + data.total, validados: prev.validados + data.validados });
      }
      if (userEmail) {
        const prev = porEmail.get(userEmail) || { total: 0, validados: 0 };
        porEmail.set(userEmail, { total: prev.total + data.total, validados: prev.validados + data.validados });
      }
      if (reportante) {
        const prev = porNombre.get(reportante) || { total: 0, validados: 0 };
        porNombre.set(reportante, { total: prev.total + data.total, validados: prev.validados + data.validados });
      }
    }

    return { porId, porEmail, porNombre };
  }, [registros]);

  const obtenerEstadisticasUsuario = useCallback((u) => {
    if (!u) return { total: 0, validados: 0, pendientes: 0 };

    const userId = u.id ? String(u.id).trim() : '';
    const userEmail = u.email ? String(u.email).trim().toLowerCase() : '';
    const userNombre = u.nombre
      ? String(u.nombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      : '';

    const porId = userId ? estadisticasPorUsuario.porId.get(userId) : null;
    const porEmail = userEmail ? estadisticasPorUsuario.porEmail.get(userEmail) : null;
    const porNombre = userNombre ? estadisticasPorUsuario.porNombre.get(userNombre) : null;
    const stats = porId || porEmail || porNombre || { total: 0, validados: 0 };

    return {
      total: stats.total,
      validados: stats.validados,
      pendientes: Math.max(0, stats.total - stats.validados)
    };
  }, [estadisticasPorUsuario]);

  const esPersonaAdminOExperto = useCallback((u) => {
    const rol = String(u?.rol || '');
    const email = String(u?.email || '');
    const nombre = String(u?.nombre || '');
    return rol.includes('Administrador') || rol.includes('Experto') || esUsuarioAdministrativo(email, nombre);
  }, []);

  const obtenerTextoValidacionesPersona = useCallback((u) => {
    const stats = obtenerEstadisticasUsuario(u);
    const total = Number(stats?.validados || 0);
    const sufijo = total === 1 ? 'validación' : 'validaciones';
    return `✓ ${total} ${sufijo}`;
  }, [obtenerEstadisticasUsuario]);

  const estadisticasRevisionPorUsuario = useMemo(() => {
    const porId = new Map();
    const porEmail = new Map();
    const porNombre = new Map();

    for (const registroAuditoria of auditoriaRevisionAvistamientos) {
      const actorId = registroAuditoria.actorId ? String(registroAuditoria.actorId).trim() : '';
      const actorEmail = registroAuditoria.actorEmail ? String(registroAuditoria.actorEmail).trim().toLowerCase() : '';
      const actorNombre = registroAuditoria.actorNombre
        ? String(registroAuditoria.actorNombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
        : '';
      const accion = String(registroAuditoria.accion || '').toLowerCase();
      const data = {
        aprobaciones: accion === 'aprobacion' ? 1 : 0,
        revisiones: accion === 'revision' ? 1 : 0,
        total: 1
      };

      if (actorId) {
        const previo = porId.get(actorId) || { aprobaciones: 0, revisiones: 0, total: 0 };
        porId.set(actorId, {
          aprobaciones: previo.aprobaciones + data.aprobaciones,
          revisiones: previo.revisiones + data.revisiones,
          total: previo.total + data.total
        });
      }

      if (actorEmail) {
        const previo = porEmail.get(actorEmail) || { aprobaciones: 0, revisiones: 0, total: 0 };
        porEmail.set(actorEmail, {
          aprobaciones: previo.aprobaciones + data.aprobaciones,
          revisiones: previo.revisiones + data.revisiones,
          total: previo.total + data.total
        });
      }

      if (actorNombre) {
        const previo = porNombre.get(actorNombre) || { aprobaciones: 0, revisiones: 0, total: 0 };
        porNombre.set(actorNombre, {
          aprobaciones: previo.aprobaciones + data.aprobaciones,
          revisiones: previo.revisiones + data.revisiones,
          total: previo.total + data.total
        });
      }
    }

    return { porId, porEmail, porNombre };
  }, [auditoriaRevisionAvistamientos]);

  const estadisticasRevisionGlobales = useMemo(() => {
    let aprobaciones = 0;
    let revisiones = 0;

    for (const registroAuditoria of auditoriaRevisionAvistamientos) {
      const accion = String(registroAuditoria?.accion || '').toLowerCase();
      if (accion === 'aprobacion') aprobaciones += 1;
      if (accion === 'revision') revisiones += 1;
    }

    return {
      aprobaciones,
      revisiones,
      total: aprobaciones + revisiones
    };
  }, [auditoriaRevisionAvistamientos]);

  const obtenerEstadisticasRevisionUsuario = useCallback((u) => {
    if (!u) return { aprobaciones: 0, revisiones: 0, total: 0 };

    const esAdminPrincipal = esUsuarioPrincipal(u.email, u.nombre, u.id, 'admin_jcv_master');
    if (esAdminPrincipal) {
      return {
        aprobaciones: estadisticasRevisionGlobales.aprobaciones,
        revisiones: estadisticasRevisionGlobales.revisiones,
        total: estadisticasRevisionGlobales.total
      };
    }

    const userId = u.id ? String(u.id).trim() : '';
    const userEmail = u.email ? String(u.email).trim().toLowerCase() : '';
    const userNombre = u.nombre
      ? String(u.nombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      : '';

    const porId = userId ? estadisticasRevisionPorUsuario.porId.get(userId) : null;
    const porEmail = userEmail ? estadisticasRevisionPorUsuario.porEmail.get(userEmail) : null;
    const porNombre = userNombre ? estadisticasRevisionPorUsuario.porNombre.get(userNombre) : null;
    const stats = porId || porEmail || porNombre || { aprobaciones: 0, revisiones: 0, total: 0 };

    return {
      aprobaciones: stats.aprobaciones,
      revisiones: stats.revisiones,
      total: stats.total
    };
  }, [estadisticasRevisionPorUsuario, estadisticasRevisionGlobales]);

  const obtenerValidacionesRemitenteChat = useCallback((m) => {
    if (!m) return null;

    const rol = String(m.senderRol || '');
    const esAdminExpertoRemitente = Boolean(m.esAdmin) || rol.includes('Administrador') || rol.includes('Experto');
    if (!esAdminExpertoRemitente) return null;

    if (m.senderId && usuario.id && m.senderId === usuario.id && (esAdmin || esExperto)) {
      return Number(misValidados || 0);
    }

    const candidato = todosLosUsuarios.find((u) => {
      if (!u) return false;
      if (m.senderId && u.id && m.senderId === u.id) return true;
      if (m.senderNombre && u.nombre && m.senderNombre === u.nombre) return true;
      return false;
    });

    if (!candidato) return 0;
    return Number(obtenerEstadisticasUsuario(candidato).validados || 0);
  }, [usuario.id, esAdmin, esExperto, misValidados, todosLosUsuarios, obtenerEstadisticasUsuario]);

  const usuariosConectados = useMemo(() => {
    const limiteConectado = tickPresencia - VENTANA_ACTIVOS_MS;
    return todosLosUsuarios
      .filter((u) => Number(u.ultimoConexion || 0) > limiteConectado)
      .sort((a, b) => Number(b.ultimoConexion || 0) - Number(a.ultimoConexion || 0));
  }, [todosLosUsuarios, tickPresencia]);

  const usuariosConectadosPreview = useMemo(() => {
    return usuariosConectados.slice(0, 60);
  }, [usuariosConectados]);

  const usuariosAdmin = useMemo(() => {
    return todosLosUsuarios
      .filter((u) => (u.rol || '').includes('Administrador') || (u.email || '').toLowerCase() === 'proquimicajcv@icloud.com')
      .sort((a, b) => {
        const esPrincipalA = esUsuarioPrincipal(a.email, a.nombre, a.id, 'admin_jcv_master');
        const esPrincipalB = esUsuarioPrincipal(b.email, b.nombre, b.id, 'admin_jcv_master');
        if (esPrincipalA !== esPrincipalB) return esPrincipalA ? -1 : 1;

        const esAdminGeneralA = esUsuarioAdministrativo(a.email, a.nombre) && !esPrincipalA;
        const esAdminGeneralB = esUsuarioAdministrativo(b.email, b.nombre) && !esPrincipalB;
        if (esAdminGeneralA !== esAdminGeneralB) return esAdminGeneralA ? -1 : 1;

        return 0;
      });
  }, [todosLosUsuarios]);

  const usuariosExpertos = useMemo(() => {
    return todosLosUsuarios
      .filter((u) => (u.rol || '').includes('Experto'))
      .sort((a, b) => {
        const esPrincipalA = esUsuarioPrincipal(a.email, a.nombre, a.id, 'admin_jcv_master');
        const esPrincipalB = esUsuarioPrincipal(b.email, b.nombre, b.id, 'admin_jcv_master');
        if (esPrincipalA !== esPrincipalB) return esPrincipalA ? -1 : 1;
        return 0;
      });
  }, [todosLosUsuarios]);

  const usuariosRegulares = useMemo(() => {
    return todosLosUsuarios
      .filter((u) => !(u.rol || '').includes('Administrador') && !(u.rol || '').includes('Experto') && (u.email || '').toLowerCase() !== 'proquimicajcv@icloud.com')
      .sort((a, b) => {
        const esPrincipalA = esUsuarioPrincipal(a.email, a.nombre, a.id, 'admin_jcv_master');
        const esPrincipalB = esUsuarioPrincipal(b.email, b.nombre, b.id, 'admin_jcv_master');
        if (esPrincipalA !== esPrincipalB) return esPrincipalA ? -1 : 1;
        return 0;
      });
  }, [todosLosUsuarios]);

  useEffect(() => {
    if (!usuario.isLoggedIn || !usuario.id) {
      rankingAnteriorRef.current = null;
      return;
    }

    const aviso = detectarSubidaRanking(
      rankingUsuarios,
      rankingAnteriorRef.current,
      usuario.id,
      usuario.email,
      usuario.nombre
    );

    if (aviso) {
      setAvisoRankingEntrante(aviso);
    }

    rankingAnteriorRef.current = rankingUsuarios;
  }, [rankingUsuarios, usuario.id, usuario.email, usuario.nombre, usuario.isLoggedIn]);

  return (
    <div style={{ backgroundColor: '#070D0B', color: '#E0E6E3', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', paddingBottom: '90px' }}>
      
      <header style={{ backgroundColor: '#0B1512', padding: '0.9rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #162B23' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <input
              id="logo-app-input"
              type="file"
              accept="image/*"
              ref={logoInputRef}
              onChange={manejarLogoAppUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => {
                if (logoInputRef.current) {
                  logoInputRef.current.click();
                }
              }}
              style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              {logoActivo ? (
                <img
                  src={logoActivo}
                  alt="Logo personalizado de la app"
                  onClick={() => {
                    setLightboxData({ fotos: [logoActivo], index: 0 });
                    setLogoPreviewVisible(true);
                  }}
                  style={{ width: '46px', height: '46px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #00FF88', background: '#0D2E21', cursor: 'zoom-in' }}
                />
              ) : (
                <div style={{ background: '#0D2E21', border: '2px solid #00FF88', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.6rem' }}>🐸</span>
                </div>
              )}
            </button>
            {logoActivo && (
              <button type="button" onClick={async () => {
                if (!usuario.isLoggedIn || !usuario.id) {
                  return;
                }
                try {
                  const userDocRef = doc(db, 'usuarios', usuario.id);
                  await setDoc(userDocRef, { logoApp: null }, { merge: true });
                  setLogoApp(null);
                } catch (err) {
                  alert('No se pudo quitar el logo de Firebase.');
                }
              }} style={{ background: 'transparent', border: 'none', color: '#FF8A80', fontSize: '0.6rem', cursor: 'pointer', padding: 0 }}>
                Quitar
              </button>
            )}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', color: '#00FF88', fontWeight: '900' }}>HerpID Costa Rica</h1>
            <p style={{ margin: 0, fontSize: '0.65rem', color: '#7AA394', fontWeight: 'bold' }}>PLATAFORMA CIENTÍFICA</p>
            <p style={{ margin: '0.15rem 0 0.2rem 0', fontSize: '0.62rem', color: '#9BD3B8', fontWeight: '700' }}>
              Refresco automático cada {intervaloRefrescoMin} min
            </p>
            <select
              value={intervaloRefrescoMin}
              onChange={(e) => setIntervaloRefrescoMin(Number(e.target.value) || 5)}
              style={{ backgroundColor: '#0D2E21', color: '#CFE8D8', border: '1px solid #1B3D2F', borderRadius: '8px', padding: '0.2rem 0.35rem', fontSize: '0.64rem', fontWeight: '700' }}
              title="Intervalo de refresco automático"
            >
              {OPCIONES_INTERVALO_REFRESCO_MIN.map((min) => (
                <option key={min} value={min}>{min} min</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: '#00FF88', fontWeight: '900', backgroundColor: '#0D2E21', padding: '3px 10px', borderRadius: '6px', border: '1.5px solid #00FF88', display: 'inline-block', boxShadow: '0 0 10px rgba(0,255,136,0.3)' }}>
            Elaborado por JCV
          </span>
        </div>
        
        <button onClick={() => { setVistaPerfil(usuario.isLoggedIn ? 'perfil' : 'login'); setModalPerfil(true); }} style={{ background: usuario.isLoggedIn ? 'linear-gradient(135deg, #1F4E79 0%, #5A6672 100%)' : '#102E23', color: usuario.isLoggedIn ? '#F5F7FA' : '#00FF88', border: usuario.isLoggedIn ? '1.5px solid #7A8796' : '1.5px solid #00FF88', padding: '0.45rem 0.9rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
          {usuario.isLoggedIn ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <span>{usuario.isLoggedIn && (esUsuarioPrincipal(emailUsuario, nombreUsuario, usuario.id, 'admin_jcv_master') || usuario.nombre?.toLowerCase().includes('jorge')) ? 'JCV' : usuario.nombre}</span>
              {(esAdmin || esExperto) && (
                <span style={{ fontSize: '0.68rem', backgroundColor: 'rgba(15,26,22,0.85)', border: '1px solid #8AA398', borderRadius: '999px', padding: '2px 7px', color: '#E5F3EA', fontWeight: '800' }}>
                  ✓ {misValidados}
                </span>
              )}
              {renderizarInsigniaUsuario(misValidados)}
            </span>
          ) : '🔑 INICIAR SESIÓN'}
        </button>
      </header>

      {!usuario.isLoggedIn ? (
        <>
          <div style={{ padding: '1.2rem', maxWidth: '560px', margin: '2rem auto', textAlign: 'center', background: 'linear-gradient(135deg, rgba(10,24,17,0.95) 0%, rgba(7,13,11,0.95) 100%)', border: '1px solid #1B3D2F', borderRadius: '22px', boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.6rem' }}>🌿</div>
            <h2 style={{ color: '#00FF88', margin: '0 0 0.5rem 0' }}>Explora HerpID Costa Rica</h2>
            <p style={{ color: '#8AA398', margin: '0 0 1rem 0', lineHeight: 1.55 }}>
              Puedes ver la plataforma y explorar el mapa incluso antes de iniciar sesión. Si deseas participar más activamente, puedes entrar con tu cuenta en cualquier momento.
            </p>
            <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => { setVistaPerfil('login'); setModalPerfil(true); }} style={{ padding: '0.8rem 1rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Iniciar sesión</button>
              <button onClick={() => { setVistaPerfil('registro'); setModalPerfil(true); }} style={{ padding: '0.8rem 1rem', backgroundColor: 'transparent', color: '#00FF88', border: '1px solid #00FF88', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Crear cuenta</button>
            </div>
          </div>
          {tab === 'mapa' && (
            <div style={{ position: 'relative', height: 'calc(100vh - 145px)', width: '100%', background: 'linear-gradient(135deg, #07110D 0%, #0C1711 100%)' }}>
              <MapContainer center={[9.650565, -84.000236]} zoom={9} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
                <ControladorVistaMapa setZoomMapa={setZoomMapa} setCentroMapa={setCentroMapa} setPopupMapaAbierto={setPopupMapaAbierto} />
                {registrosVisibles.map((reg) => {
                  const fotosLista = construirListaFotosPriorizada(reg);
                  const currentIndex = carruselIndices[reg.id] || 0;
                  const fotoAMostrar = fotosLista[currentIndex] || fotosLista[0];
                  const posicionFiltro = obtenerCoordsParaMapa(reg.coords);
                  const esProp = esPropietarioReporte(reg);
                  const reportantePublico = obtenerNombrePublicoReportante(reg);
                  const fechaPublica = formatearFechaReporte(reg);

                  return (
                    <Marker key={`${reg.id}-${reg.estado || 'sin-estado'}-${reg.coords?.[0] ?? 'na'}-${reg.coords?.[1] ?? 'na'}`} position={posicionFiltro} icon={crearIconoPersonalizado(reg.silueta, reg.estado, reg.esPeligroso)}>
                      <Popup>
                        <div style={{ textAlign: 'center', minWidth: '190px' }}>
                          {fotosLista.length > 0 && (
                            <div style={{ position: 'relative', width: '100%', height: '130px', backgroundColor: '#000', borderRadius: '8px', marginBottom: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <img 
                                src={fotoAMostrar} 
                                alt={reg.nombreComun} 
                                onClick={() => setLightboxData({ fotos: fotosLista, index: currentIndex })}
                                style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }} 
                                title="Click para ampliar carrusel"
                              />
                              {fotosLista.length > 1 && (
                                <>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); cambiarFotoCarrusel(reg.id, -1, fotosLista.length); }}
                                    style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: '#00FF88', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                                  >
                                    ◀
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); cambiarFotoCarrusel(reg.id, 1, fotosLista.length); }}
                                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: '#00FF88', border: '1px solid #00FF88', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                                  >▶</button>
                                </>
                              )}
                            </div>
                          )}
                          <div style={{ fontWeight: '900', color: '#00FF88', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{reg.nombreComun || 'Avistamiento'}</div>
                          <div style={{ color: '#D9F5E3', fontSize: '0.82rem', marginBottom: '0.1rem' }}>{reg.especie || 'Por verificar'}</div>
                          <div style={{ color: '#8AA398', fontSize: '0.74rem' }}>{reg.ubicacion || 'Sin ubicación'}</div>
                          <div style={{ color: '#7AA394', fontSize: '0.74rem', marginTop: '0.2rem' }}>👤 {reportantePublico}</div>
                          <div style={{ color: '#7AA394', fontSize: '0.7rem' }}>🗓️ {fechaPublica}</div>
                          {esProp && <div style={{ color: '#00C853', fontSize: '0.72rem', marginTop: '0.3rem' }}>✅ Tu reporte</div>}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          )}
        </>
      ) : (
        <>
          {tab === 'mapa' && (
            <div style={{ position: 'relative', height: 'calc(100vh - 145px)', width: '100%', background: 'linear-gradient(135deg, #07110D 0%, #0C1711 100%)' }}>
          {esAdmin && (
            <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 1000, background: 'rgba(7, 13, 11, 0.92)', border: '1px solid #1B3D2F', borderRadius: '10px', padding: '0.45rem 0.65rem', boxShadow: '0 8px 20px rgba(0,0,0,0.35)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#CFE8D8', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={mostrarPendientesMapaAdmin}
                  onChange={(e) => setMostrarPendientesMapaAdmin(e.target.checked)}
                />
                Mostrar pendientes en mapa (solo Admin)
              </label>
            </div>
          )}
          {!puedeExplorarMapa ? (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.2rem' }}>
              <div style={{ width: '100%', maxWidth: '460px', background: 'rgba(7, 13, 11, 0.95)', border: '1px solid #1B3D2F', borderRadius: '20px', padding: '1.2rem', boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}>
                <div style={{ color: '#00FF88', fontSize: '1.5rem', marginBottom: '0.55rem' }}>🔐 Acceso al mapa</div>
                <h3 style={{ color: '#F8FFF9', margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>Para explorar observaciones validadas debes iniciar sesión</h3>
                <p style={{ color: '#8AA398', margin: '0 0 1rem 0', lineHeight: 1.55 }}>
                  Solo los usuarios autenticados pueden ver los reportes validados en el mapa y descubrir nuevas especies conforme acercan el zoom.
                </p>
                <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
                  <button onClick={() => { setVistaPerfil('login'); setModalPerfil(true); }} style={{ flex: 1, minWidth: '130px', padding: '0.75rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Iniciar sesión</button>
                  <button onClick={() => { setVistaPerfil('registro'); setModalPerfil(true); }} style={{ flex: 1, minWidth: '130px', padding: '0.75rem', backgroundColor: 'transparent', color: '#00FF88', border: '1px solid #00FF88', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Crear cuenta</button>
                </div>
              </div>
            </div>
          ) : null}
          <MapContainer center={[9.650565, -84.000236]} zoom={9} style={{ height: '100%', width: '100%', filter: puedeExplorarMapa ? 'none' : 'blur(1px)' }}>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
            <ControladorVistaMapa setZoomMapa={setZoomMapa} setCentroMapa={setCentroMapa} setPopupMapaAbierto={setPopupMapaAbierto} />
            {!esAdminOExperto && zoomMapa < 10 && (
              <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 1000, background: 'rgba(7, 13, 11, 0.9)', border: '1px solid #00FF88', color: '#00FF88', padding: '0.45rem 0.7rem', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 'bold', boxShadow: '0 0 10px rgba(0,255,136,0.2)' }}>
                🔎 Acércate para ver más validaciones aprobadas
              </div>
            )}
            {registrosVisibles.map((reg) => {
              const fotosLista = construirListaFotosPriorizada(reg);
              const currentIndex = carruselIndices[reg.id] || 0;
              const fotoAMostrar = fotosLista[currentIndex] || fotosLista[0];
              const posicionFiltro = obtenerCoordsParaMapa(reg.coords);
              const esProp = esPropietarioReporte(reg);
              const reportantePublico = obtenerNombrePublicoReportante(reg);
              const fechaPublica = formatearFechaReporte(reg);

              return (
                <Marker key={`${reg.id}-${reg.estado || 'sin-estado'}-${reg.coords?.[0] ?? 'na'}-${reg.coords?.[1] ?? 'na'}`} position={posicionFiltro} icon={crearIconoPersonalizado(reg.silueta, reg.estado, reg.esPeligroso)}>
                  <Popup>
                    <div style={{ textAlign: 'center', minWidth: '190px' }}>
                      {fotosLista.length > 0 && (
                        <div style={{ position: 'relative', width: '100%', height: '130px', backgroundColor: '#000', borderRadius: '8px', marginBottom: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img 
                            src={fotoAMostrar} 
                            alt={reg.nombreComun} 
                            onClick={() => setLightboxData({ fotos: fotosLista, index: currentIndex })}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }} 
                            title="Click para ampliar carrusel"
                          />
                          {fotosLista.length > 1 && (
                            <>
                              <button 
                                onClick={(e) => { e.stopPropagation(); cambiarFotoCarrusel(reg.id, -1, fotosLista.length); }}
                                style={{ position: 'absolute', left: '4px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: '#00FF88', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                              >
                                ◀
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); cambiarFotoCarrusel(reg.id, 1, fotosLista.length); }}
                                style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: '#00FF88', border: '1px solid #00FF88', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                              >
                                ▶
                              </button>
                              <div style={{ position: 'absolute', bottom: '4px', right: '6px', background: 'rgba(0,0,0,0.7)', color: '#00FF88', padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                {currentIndex + 1} / {fotosLista.length}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <strong style={{ color: '#00C853', fontSize: '1rem' }}>{reg.nombreComun}</strong><br /> 
                      <em style={{ fontSize: '0.8rem', color: '#AAA' }}>{reg.especie}</em><br /> 
                      
                      {reg.esPeligroso && (
                        <div style={{ backgroundColor: '#3A0D11', border: '1px solid #FF5252', color: '#FF5252', padding: '3px 6px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.7rem', margin: '4px 0' }}>
                          ⚠️ ESPECIE VENENOSA / PELIGRO
                        </div>
                      )}

                      <span style={{ fontSize: '0.8rem', color: '#555' }}>📍 {reg.ubicacion}</span><br /> 

                      <span style={{ fontSize: '0.7rem', color: esAdmin ? '#00FF88' : '#FF9800', fontWeight: 'bold', display: 'block', margin: '2px 0' }}>
                        {esAdmin 
                          ? `🌐 GPS: ${reg.coords?.[0]}, ${reg.coords?.[1]}`
                          : '🔒 Coordenadas Ocultas (Protección Especie)'}
                      </span>

                      <span style={{ fontSize: '0.75rem', color: '#7AA394' }}>👤 {reportantePublico}</span><br /> 
                      <span style={{ fontSize: '0.72rem', color: '#7AA394' }}>🗓️ {fechaPublica}</span><br />
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: reg.estado === 'VALIDADO' ? '#00A843' : '#D9822B' }}>● {reg.estado}</span>
                      {reg.audioURL && (
                        <div style={{ marginTop: '5px' }}>
                          <audio src={reg.audioURL} controls style={{ width: '100%', height: '28px' }} />
                        </div>
                      )}
                      {(esAdminOExperto || esProp) && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'center' }}>
                          {(esAdmin || !esRegistroValidado(reg.estado)) && (
                            <button onClick={() => abrirEdicionModal(reg)} style={{ background: '#0288D1', color: '#FFF', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>✏️ Editar</button>
                          )}
                          {(esAdminOExperto || esProp) && (
                            <button onClick={() => eliminarRegistro(reg.id, reg)} style={{ background: '#D32F2F', color: '#FFF', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>🗑️ Borrar</button>
                          )}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      {tab === 'ranking' && (
        <div style={{ padding: '1.2rem', maxWidth: '780px', margin: '0 auto', paddingBottom: '100px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(13,46,33,0.95) 0%, rgba(9,19,15,0.95) 100%)', border: '1px solid #1C3B2D', borderRadius: '22px', padding: '1rem 1rem 1.1rem', boxShadow: '0 10px 30px rgba(0,255,136,0.08)', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#00FF88', fontWeight: '900', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  <span>🐍</span> Observatorio herpetológico
                </div>
                <h2 style={{ color: '#F8FFF9', margin: '0 0 0.25rem 0', fontSize: '1.15rem' }}>Top 5 observadores activos</h2>
                <p style={{ color: '#8AA398', margin: 0, fontSize: '0.9rem' }}>Usuarios con más registros validados y reconocimientos de campo.</p>
              </div>
              <div style={{ minWidth: '132px', background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: '14px', padding: '0.6rem 0.7rem', textAlign: 'center' }}>
                <div style={{ color: '#00FF88', fontSize: '1.05rem', fontWeight: '900' }}>🦎 {rankingUsuarios.reduce((total, usuario) => total + (usuario.userValidados || 0), 0)}</div>
                <div style={{ color: '#8AA398', fontSize: '0.68rem', marginTop: '0.15rem' }}>Reportes Totales aprobados</div>
              </div>
            </div>
          </div>

          {rankingUsuarios.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8AA398', padding: '2rem 1rem', backgroundColor: '#0F1A16', borderRadius: '16px', border: '1px solid #1B3D2F' }}>
              Aún no hay usuarios con avistamientos aprobados.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {rankingUsuarios.map((u, index) => {
                const insignia = obtenerInsigniaUsuario(u.userValidados);
                const medalla = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                const bordeDestacado = index === 0 ? 'rgba(0,255,136,0.35)' : index === 1 ? 'rgba(255,255,255,0.16)' : index === 2 ? 'rgba(255,193,7,0.25)' : 'rgba(41,182,246,0.25)';
                const fondoIcono = index === 0 ? 'linear-gradient(135deg, #0D2E21 0%, #11442E 100%)' : index === 1 ? 'linear-gradient(135deg, #142431 0%, #1B3342 100%)' : index === 2 ? 'linear-gradient(135deg, #3D2A0B 0%, #5A3C10 100%)' : 'linear-gradient(135deg, #0F1F2D 0%, #153149 100%)';

                return (
                  <div key={u.id || `${u.email}-${index}`} style={{ background: 'linear-gradient(135deg, #0F1A16 0%, #09130F 100%)', border: `1px solid ${bordeDestacado}`, borderRadius: '18px', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', boxShadow: index === 0 ? '0 8px 24px rgba(0,255,136,0.12)' : '0 6px 16px rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0 }}>
                      <div style={{ width: '47px', height: '47px', borderRadius: '50%', background: fondoIcono, border: `2px solid ${bordeDestacado}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', fontWeight: '900', color: '#00FF88', flexShrink: 0 }}>
                        {medalla}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#FFF', fontSize: '0.98rem' }}>{u.nombre || 'Usuario'}</strong>
                          {insignia && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.5rem', borderRadius: '999px', background: insignia.bg, color: insignia.color, border: `1px solid ${insignia.border}`, fontSize: '0.66rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                              {insignia.label}
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#8AA398', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                          <span>Registro activo en el monitoreo herpetológico</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: '#00FF88', fontSize: '1.3rem', fontWeight: '900' }}>{u.userValidados}</div>
                      <div style={{ color: '#8AA398', fontSize: '0.72rem' }}>aprobados</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'guia' && (
        <div style={{ padding: '1.2rem', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <h2 style={{ color: '#00FF88', margin: 0 }}>📖 Guía Herpetológica</h2>
            {esAdmin && (
              <button onClick={() => setModalNuevaEspecieGuia(true)} style={{ backgroundColor: '#00E676', color: '#000', border: 'none', padding: '0.45rem 0.9rem', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>+ Agregar Especie</button>
            )}
          </div>

          <input type="text" placeholder="🔍 Buscar especie..." value={busquedaGuia} onChange={(e) => setBusquedaGuia(e.target.value)} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '10px', marginBottom: '1.2rem', boxSizing: 'border-box' }} /> 
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.2rem' }}>
            {especiesFiltradasGuia.map((esp) => (
              <div key={esp.id || esp.nombre} style={{ backgroundColor: '#0F1A16', borderRadius: '14px', border: esp.esPeligroso ? '2px solid #FF5252' : '1px solid #1B2E27', overflow: 'hidden', position: 'relative' }}>
                <img src={esp.img} alt={esp.nombre} onClick={() => setLightboxData({ fotos: [esp.img], index: 0 })} style={{ width: '100%', height: '200px', objectFit: 'contain', backgroundColor: '#000', cursor: 'pointer' }} title="Click para ampliar imagen" /> 
                
                {esp.esPeligroso && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#FF1744', color: '#FFF', padding: '0.25rem 0.6rem', borderRadius: '12px', fontSize: '0.68rem', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(255,23,68,0.8)' }}>
                    ⚠️ VENENOSA / IMPORTANCIA MÉDICA
                  </div>
                )}

                <div style={{ padding: '1rem' }}>
                  <span style={{ fontSize: '0.7rem', backgroundColor: '#0D2E21', color: '#00FF88', padding: '0.2rem 0.6rem', borderRadius: '10px', fontWeight: 'bold' }}>{esp.tipo}</span>
                  <h3 style={{ margin: '0.4rem 0 0.2rem 0', color: '#FFF' }}>{esp.nombre}</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#00FF88', fontStyle: 'italic' }}>{esp.especie}</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#8AA398' }}>{esp.desc}</p>

                  <div style={{ marginTop: '0.8rem', padding: '0.4rem 0.6rem', borderRadius: '8px', background: 'linear-gradient(90deg, #FFB300 0%, #FF6F00 100%)', color: '#111', fontSize: '0.72rem', fontWeight: '900', textAlign: 'center', boxShadow: '0 2px 8px rgba(255,179,0,0.35)' }}>
                    Créditos al autor de la fotografía
                  </div>
                  
                  {esAdmin && esp.id && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                      <button onClick={() => { setEspecieGuiaEditando({ ...esp }); setModalEditarEspecieGuia(true); }} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#0288D1', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Editar</button>
                      <button onClick={() => eliminarEspecieGuia(esp.id)} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#D32F2F', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️ Borrar</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'galeria' && (
        <div style={{ padding: '1.2rem', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <h2 style={{ color: '#00FF88', margin: 0 }}>🌿 Registros Públicos</h2>
            <button onClick={() => { if (!usuario.isLoggedIn) { setVistaPerfil('login'); setModalPerfil(true); } else abrirModalRegistro(); }} style={{ backgroundColor: '#00C853', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>+ Nuevo Reporte</button>
          </div>
          {registrosPublicosOrdenados.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8AA398', marginTop: '3rem' }}>
              🔬 No hay avistamientos validados públicamente por los expertos todavía.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.2rem' }}>
              {registrosPublicosOrdenados.map((reg) => {
                const fotosLista = construirListaFotosPriorizada(reg);
                const currentIndex = carruselIndices[reg.id] || 0;
                const fotoActual = fotosLista[currentIndex] || fotosLista[0] || null;
                const esProp = esPropietarioReporte(reg);
                const reportantePublico = obtenerNombrePublicoReportante(reg);
                const fechaPublica = formatearFechaReporte(reg);

                return (
                  <div key={reg.id} style={{ backgroundColor: '#0F1A16', borderRadius: '14px', overflow: 'hidden', border: reg.esPeligroso ? '2px solid #FF5252' : '1px solid #1B2E27' }}>
                    
                    <div style={{ position: 'relative', width: '100%', height: '200px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {fotoActual ? (
                        <img src={fotoActual} alt={reg.nombreComun} onClick={() => setLightboxData({ fotos: fotosLista, index: currentIndex })} style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }} title="Click para ampliar carrusel" />
                      ) : (
                        <div style={{ color: '#7AA394', fontSize: '0.84rem', fontWeight: '700' }}>Sin foto adjunta</div>
                      )}
                      
                      {fotosLista.length > 1 && (
                        <>
                          <button 
                            onClick={() => cambiarFotoCarrusel(reg.id, -1, fotosLista.length)}
                            style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: '#00FF88', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}
                          >
                            ◀
                          </button>
                          <button 
                            onClick={() => cambiarFotoCarrusel(reg.id, 1, fotosLista.length)}
                            style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: '#00FF88', border: '1px solid #00FF88', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}
                          >
                            ▶
                          </button>
                          <div style={{ position: 'absolute', bottom: '8px', right: '10px', background: 'rgba(0,0,0,0.75)', color: '#00FF88', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #00FF88' }}>
                            {currentIndex + 1} / {fotosLista.length}
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{ padding: '1rem' }}>
                      {reg.esPeligroso && (
                        <div style={{ backgroundColor: '#3A0D11', border: '1px solid #FF5252', color: '#FF5252', padding: '0.3rem 0.6rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.72rem', marginBottom: '0.5rem', textAlign: 'center' }}>
                          ⚠️ ALERTA ESPECIE VENENOSA
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: reg.estado === 'VALIDADO' ? '#00FF88' : '#FFC107', fontWeight: 'bold' }}>● {reg.estado}</span>
                        <span style={{ fontSize: '0.75rem', color: '#6A8A7D' }}>{fechaPublica}</span>
                      </div>
                      <h3 style={{ margin: '0.4rem 0 0.2rem 0', color: '#FFF' }}>{reg.nombreComun}</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#00FF88', fontStyle: 'italic' }}>{reg.especie}</p>
                      <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem', color: '#8AA398' }}>📍 {reg.ubicacion}</p>
                      <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#00FF88', fontWeight: 'bold' }}>👤 Reportado por {reportantePublico}</p>

                      {(esAdminOExperto || esProp) && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                          {(esAdmin || !esRegistroValidado(reg.estado)) && (
                            <button onClick={() => abrirEdicionModal(reg)} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#0288D1', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Editar</button>
                          )}
                          <button onClick={() => eliminarRegistro(reg.id, reg)} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#D32F2F', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️ Borrar</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'chat' && (
        <div style={{ padding: '1rem', maxWidth: '850px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <h2 style={{ color: '#00FF88', margin: 0 }}>💬 Atención Técnica y Consultas</h2>
          </div>

          {esAdminOExperto && (
            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.8rem' }}>
              <button 
                onClick={() => setTipoChatEquipo('usuarios')}
                style={{ 
                  flex: 1, 
                  padding: '0.6rem', 
                  backgroundColor: tipoChatEquipo === 'usuarios' ? '#00E676' : '#0B1512', 
                  color: tipoChatEquipo === 'usuarios' ? '#000' : '#00FF88', 
                  border: '1.5px solid #00FF88', 
                  borderRadius: '10px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  fontSize: '0.8rem' 
                }}
              >
                💬 Consultas de Ciudadanos {chatsPendientesCount > 0 && `(${chatsPendientesCount} nuevos)`}
              </button>
              <button 
                onClick={() => setTipoChatEquipo('interno')}
                style={{ 
                  flex: 1, 
                  padding: '0.6rem', 
                  backgroundColor: tipoChatEquipo === 'interno' ? '#0288D1' : '#0B1512', 
                  color: tipoChatEquipo === 'interno' ? '#FFF' : '#0288D1', 
                  border: '1.5px solid #0288D1', 
                  borderRadius: '10px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer', 
                  fontSize: '0.8rem' 
                }}
              >
                👥 Chat Interno del Equipo (Admin & Expertos)
              </button>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '1rem', height: 'calc(100vh - 250px)', minHeight: '380px' }}>
            
            {esAdminOExperto && tipoChatEquipo === 'usuarios' && (
              <div style={{ width: '250px', backgroundColor: '#0B1512', borderRadius: '12px', border: '1px solid #162B23', overflowY: 'auto', padding: '0.6rem' }}>
                <strong style={{ fontSize: '0.8rem', color: '#8AA398', display: 'block', marginBottom: '0.6rem' }}>Conversaciones Activas</strong>
                {chatsSalas.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: '#555' }}>No hay chats abiertos.</p>
                ) : (
                  chatsSalas.map(sala => {
                    const tieneNuevoChat = sala.ultimoMensaje && !sala.ultimoMensaje.esAdmin;
                    return (
                      <div 
                        key={sala.roomId} 
                        style={{ 
                          padding: '0.6rem', 
                          borderRadius: '8px', 
                          backgroundColor: activeRoomId === sala.roomId ? '#0D2E21' : '#050A08', 
                          border: activeRoomId === sala.roomId ? '1px solid #00FF88' : '1px solid #162B23',
                          marginBottom: '0.5rem',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setChatRoomSeleccionado(sala.roomId)}>
                          <strong style={{ color: '#FFF', fontSize: '0.85rem' }}>👤 {sala.nombreUsuario}</strong>
                          {tieneNuevoChat && (
                            <span style={{ backgroundColor: '#FF1744', color: '#FFF', fontSize: '0.55rem', fontWeight: '900', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>NUEVO</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#7AA394', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, cursor: 'pointer' }} onClick={() => setChatRoomSeleccionado(sala.roomId)}>
                            {sala.ultimoMensaje?.texto || (sala.ultimoMensaje?.imagen ? '📷 [Foto]' : (sala.ultimoMensaje?.audio ? '🎙️ [Audio]' : 'Sin mensajes aún'))}
                          </span>
                          {esAdmin && (
                            <button 
                              onClick={() => eliminarChatCompleto(sala.roomId)} 
                              style={{ background: 'transparent', border: 'none', color: '#FF5252', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold', marginLeft: '6px' }}
                              title="Eliminar chat completo"
                            >
                              🗑️ Borrar chat
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div style={{ flex: 1, backgroundColor: '#0B1512', borderRadius: '12px', border: '1px solid #162B23', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              <div style={{ backgroundColor: '#0F1A16', padding: '0.7rem 1rem', borderBottom: '1px solid #162B23', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: tipoChatEquipo === 'interno' ? '#0288D1' : '#00FF88', fontSize: '0.95rem' }}>
                    {tipoChatEquipo === 'interno' 
                      ? '👥 Canal Privado Equipo Científico (Admin & Expertos)' 
                      : (esAdminOExperto ? `Chat con ${obtenerNombreSalaChat(activeRoomId)}` : '🎧 Consulta Técnica Directa')}
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#7AA394' }}>
                    {tipoChatEquipo === 'interno' ? 'Espacio de coordinación interna exclusivo para validaciones' : 'Respuesta en tiempo real del equipo científico'}
                  </p>
                </div>
              </div>

              <div style={{ backgroundColor: '#070D0B', padding: '0.5rem', borderBottom: '1px solid #162B23', display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
                {esAdminOExperto && tipoChatEquipo === 'usuarios' && (
                  <button
                    onClick={() => setNuevoMensaje('Gracias por tu reporte. Para concluir la revisión necesitamos: ubicación más precisa (cantón/comunidad), fecha exacta del avistamiento y cualquier comportamiento observado.')}
                    style={{ backgroundColor: '#123529', color: '#9CF7C7', border: '1px solid #2E7D5A', padding: '0.35rem 0.7rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    📝 Solicitar datos faltantes
                  </button>
                )}
                {esAdminOExperto && tipoChatEquipo === 'usuarios' && (
                  <button
                    onClick={() => setNuevoMensaje('¿Podrías subir 1-2 fotos adicionales? Idealmente una vista lateral del ejemplar y otra del microhábitat donde fue observado.')}
                    style={{ backgroundColor: '#0F2A43', color: '#9BD3FF', border: '1px solid #2E5F8A', padding: '0.35rem 0.7rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    📷 Solicitar más fotos
                  </button>
                )}
                <button 
                  onClick={() => enviarMensajeChat("🚨 EMERGENCIA - MORDEDURA DE SERPIENTE:\n1) Mantenga la calma y aléjese del animal.\n2) Inmovilice el área afectada.\n3) Comuníquese INMEDIATAMENTE al 911 o acuda al centro de salud más cercano. NO realice torniquetes ni cortes.", true)} 
                  style={{ backgroundColor: '#FF1744', color: '#FFF', border: '1px solid #FF5252', padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '900', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 0 10px rgba(255,23,68,0.7)' }}
                >
                  🚨 MORDEDURA DE SERPIENTE (Comuníquese al 911)
                </button>
                <button 
                  onClick={() => enviarMensajeChat("🚨 ALERTA DE SEGURIDAD: Espécimen potencialmente peligroso / venenoso. Mantenga distancia de seguridad, no intente capturarlo ni acorralarlo.")} 
                  style={{ backgroundColor: '#3A0D11', color: '#FF5252', border: '1px solid #FF5252', padding: '0.35rem 0.7rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  🚨 Alerta de Riesgo
                </button>
                <button 
                  onClick={() => enviarMensajeChat("🚑 PROTOCOLO DE MORDEDURA:\n1) Mantenga la calma.\n2) Inmovilice el área afectada.\n3) Traslade inmediatamente al centro de salud. NO realice torniquetes ni cortes.")} 
                  style={{ backgroundColor: '#2E1C05', color: '#FFB300', border: '1px solid #FFB300', padding: '0.35rem 0.7rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  🚑 Protocolo Mordedura
                </button>
              </div>

              <div ref={chatScrollRef} style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {mensajesFiltrados.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6A8A7D', marginTop: '2rem', fontSize: '0.85rem' }}>
                    {tipoChatEquipo === 'interno' ? '👥 ¡Canal interno abierto! Comienza a coordinar con los administradores y expertos.' : '👋 ¡Hola! Escribe tus dudas, presiona 📷 para fotos o 🎙️ para audios.'}
                  </div>
                ) : (
                  mensajesFiltrados.map((m) => {
                    const esMio = usuario.isLoggedIn && m.senderId === usuario.id;
                    const esAlertaResaltada = m.texto && (m.texto.includes('🚨') || m.texto.includes('🚑') || m.texto.includes('ALERTA') || m.esEmergenciaMordedura);
                    const validacionesRemitente = obtenerValidacionesRemitenteChat(m);
                    
                    return (
                      <div key={m.id} style={{ alignSelf: esMio ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <div style={{ fontSize: '0.68rem', color: '#7AA394', marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <strong style={{ color: m.esAdmin ? '#00FF88' : '#FFF' }}>
                              {m.senderNombre} {m.senderRol ? `(${m.senderRol})` : ''} • {m.hora}
                            </strong>
                            {validacionesRemitente !== null && (
                              <span style={{ fontSize: '0.62rem', backgroundColor: '#10261D', border: '1px solid #1B3D2F', borderRadius: '999px', padding: '1px 6px', color: '#DCECDD', fontWeight: '800' }}>
                                ✓ {validacionesRemitente}
                              </span>
                            )}
                          </div>
                          {esAdmin && (
                            <button 
                              onClick={() => eliminarMensajeChatAdmin(m.id)} 
                              style={{ background: 'transparent', border: 'none', color: '#FF5252', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}
                              title="Eliminar mensaje"
                            >
                              🗑️ Borrar
                            </button>
                          )}
                        </div>

                        <div style={{ 
                          backgroundColor: esAlertaResaltada ? '#FF1744' : (m.esAdmin ? (tipoChatEquipo === 'interno' ? '#0288D1' : '#00C853') : (esMio ? '#00E676' : '#142920')), 
                          color: '#FFF', 
                          padding: '0.65rem 0.95rem', 
                          borderRadius: esMio ? '14px 14px 2px 14px' : '14px 14px 14px 2px', 
                          fontSize: '0.88rem',
                          fontWeight: (m.esAdmin || esAlertaResaltada) ? 'bold' : 'normal',
                          boxShadow: esAlertaResaltada ? '0 0 12px rgba(255,23,68,0.6)' : '0 2px 5px rgba(0,0,0,0.2)'
                        }}>
                          {m.imagen && (
                            <img src={m.imagen} alt="adjunto_chat" onClick={() => setLightboxData({ fotos: [m.imagen], index: 0 })} style={{ width: '100%', maxWidth: '240px', maxHeight: '180px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '8px', marginBottom: m.texto ? '0.5rem' : '0', display: 'block', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer' }} title="Click para ampliar imagen" /> 
                          )}

                          {m.audio && (
                            <div style={{ marginBottom: m.texto ? '0.5rem' : '0' }}>
                              <audio src={m.audio} controls style={{ width: '100%', height: '32px' }} />
                            </div>
                          )}

                          {m.texto}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {(imagenChat || audioChatURL) && (
                <div style={{ padding: '0.4rem 0.8rem', backgroundColor: '#070D0B', borderTop: '1px solid #162B23', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {imagenChat && <img src={imagenChat} alt="preview" onClick={() => setLightboxData({ fotos: [imagenChat], index: 0 })} style={{ width: '45px', height: '45px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '6px', border: '1px solid #00FF88', cursor: 'pointer' }} />}
                  {audioChatURL && <audio src={audioChatURL} controls style={{ height: '30px' }} />}
                  <span style={{ fontSize: '0.75rem', color: '#00FF88' }}>{imagenChat ? '📷 Fotografía lista' : '🎙️ Audio listo'}</span>
                  <button onClick={() => { setImagenChat(null); setAudioChatURL(null); }} style={{ backgroundColor: 'transparent', color: '#FF5252', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', marginLeft: 'auto' }}>✕</button>
                </div>
              )}

              <div style={{ padding: '0.7rem', backgroundColor: '#070D0B', borderTop: '1px solid #162B23', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={chatFileInputRef} 
                  onChange={handleImagenChatUpload} 
                  style={{ display: 'none' }} 
                />
                
                <button 
                  onClick={() => chatFileInputRef.current.click()} 
                  title="Adjuntar fotografía"
                  style={{ backgroundColor: '#0F1A16', color: '#00FF88', border: '1px solid #1B3D2F', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}
                >
                  📷
                </button>

                {!grabandoAudioChat ? (
                  <button 
                    onClick={iniciarGrabacionChat} 
                    title="Grabar audio de voz"
                    style={{ backgroundColor: '#0F1A16', color: '#00FF88', border: '1px solid #1B3D2F', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}
                  >
                    🎙️
                  </button>
                ) : (
                  <button 
                    onClick={detenerGrabacionChat} 
                    title="Detener grabación"
                    style={{ backgroundColor: '#FF1744', color: '#FFF', border: 'none', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}
                  >
                    ⏹️ {tiempoGrabacionChat}s
                  </button>
                )}

                <input 
                  type="text" 
                  placeholder={usuario.isLoggedIn ? "Escribe un mensaje, foto o audio..." : "Inicia sesión para escribir..."} 
                  value={nuevoMensaje} 
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && enviarMensajeChat()}
                  style={{ flex: 1, padding: '0.65rem 0.9rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '20px', fontSize: '0.85rem', outline: 'none' }} 
                />
                <button onClick={() => enviarMensajeChat()} style={{ backgroundColor: '#00E676', color: '#000', border: 'none', padding: '0.65rem 1.2rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                  Enviar
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {tab === 'faq' && (
        <div style={{ padding: '1.2rem', maxWidth: '900px', margin: '0 auto', paddingBottom: '100px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(13,46,33,0.95) 0%, rgba(9,19,15,0.95) 100%)', border: '1px solid #1C3B2D', borderRadius: '22px', padding: '1rem 1rem 1.1rem', boxShadow: '0 10px 30px rgba(0,255,136,0.08)', marginBottom: '1rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#00FF88', fontWeight: '900', fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              <span>🧠</span> Preguntas frecuentes
            </div>
            <h2 style={{ color: '#F8FFF9', margin: '0 0 0.3rem 0', fontSize: '1.15rem' }}>Anfibios, reptiles y conservación en Costa Rica</h2>
            <p style={{ color: '#8AA398', margin: 0, fontSize: '0.9rem' }}>Información clara, segura y motivadora para aprender, respetar y proteger la biodiversidad del país.</p>
            <div style={{ marginTop: '0.7rem', color: '#7EDB9A', fontSize: '0.82rem', fontWeight: '700' }}>📚 Información clara, organizada y pensada para aprender sobre anfibios, reptiles y conservación en Costa Rica.</div>
          </div>

          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>¿Se pueden manipular anfibios y reptiles?</h3>
              <p style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                La manipulación debe ser mínima y realizada solo por personas entrenadas, expertos o personal de salud y conservación. Muchos anfibios y reptiles son muy sensibles al estrés, al cambio de temperatura y al contacto humano. En el caso de especies potencialmente peligrosas, la intervención debe ser exclusiva de personal capacitado.
              </p>
            </div>

            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>¿Qué tipos de sueros antiofídicos existen?</h3>
              <p style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                En Costa Rica, el manejo médico de mordeduras de serpiente debe hacerse en instituciones de salud, con evaluación clínica y, cuando corresponde, administración de suero antiofídico. Los sueros se diseñan según el tipo de ofidio y la gravedad del caso; nunca deben administrarse sin criterio médico ni como medida preventiva.
              </p>
            </div>

            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>¿Cuántas especies son venenosas y cuántas no?</h3>
              <p style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                Costa Rica tiene una gran riqueza de serpientes y otras especies herpetológicas. Solo una fracción pequeña tiene importancia médica importante, mientras que la mayoría de las especies observadas en el campo no son venenosas o representan un riesgo bajo. Lo importante es reconocer que todas las especies merecen respeto, distancia y observación responsable.
              </p>
            </div>

            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>¿Cuál es el rol ecológico de anfibios y reptiles?</h3>
              <p style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                Los anfibios y reptiles cumplen funciones clave en los ecosistemas: controlan insectos, participan en la cadena alimenticia, ayudan a dispersar semillas y sirven como indicadores de la salud ambiental. Cuando desaparecen, muchas redes ecológicas se desequilibran.
              </p>
            </div>

            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>¿Qué importancia tienen en la cadena alimenticia?</h3>
              <p style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                Muchos anfibios son alimento de aves, mamíferos y reptiles; a su vez, se alimentan de insectos y otros invertebrados. Esto los convierte en un eslabón esencial entre los productores primarios y los depredadores superiores.
              </p>
            </div>

            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>¿Cómo respiran algunos anfibios?</h3>
              <p style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                Muchos anfibios presentan respiración cutánea, lo que significa que intercambian gases a través de la piel. Esta adaptación es muy eficiente en ambientes húmedos, pero también los hace muy sensibles a la contaminación y a la pérdida de humedad.
              </p>
            </div>

            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>¿Qué es la metamorfosis en anfibios?</h3>
              <p style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                Muchos anfibios pasan por fases muy distintas: huevo, larva acuática, renacuajo y adulto terrestre o semiacuático. Esta transformación permite que ocupen distintos nichos ecológicos a lo largo de su vida y que se adapten mejor a los cambios del entorno.
              </p>
            </div>

            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>Datos curiosos que motivan a conservar</h3>
              <p style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                Los anfibios son bioindicadores: cuando su población disminuye, suele haber señales tempranas de problemas ambientales. Muchos reptiles ayudan a controlar plagas y mantienen el equilibrio ecológico. Proteger los bosques, humedales y cuerpos de agua no solo salva especies, también protege el agua, el suelo, los cultivos y la salud de las comunidades.
              </p>
            </div>

            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>¿Cómo prevenir las mordeduras de serpiente?</h3>
              <div style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                <ul style={{ margin: '0.35rem 0 0 0', paddingLeft: '1.1rem', display: 'grid', gap: '0.35rem' }}>
                  <li>Use calzado de protección.</li>
                  <li>Evite pisar serpientes.</li>
                  <li>Evite huecos y rocas.</li>
                  <li>Remueva maleza con herramientas.</li>
                  <li>Camine siempre acompañado.</li>
                  <li>Precaución al recolectar frutos.</li>
                  <li>Aléjese de las serpientes.</li>
                  <li>Controle poblaciones de roedores.</li>
                  <li>Eduque a jóvenes y niños.</li>
                  <li>Proteja a depredadores naturales.</li>
                  <li>Respete la legislación ambiental.</li>
                  <li>No mate serpientes.</li>
                </ul>
              </div>
            </div>

            <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '16px', padding: '1rem' }}>
              <h3 style={{ color: '#00FF88', margin: '0 0 0.45rem 0', textAlign: 'left' }}>¿Por qué conservar los hábitats naturales?</h3>
              <p style={{ color: '#DDEFE5', margin: 0, lineHeight: 1.6, textAlign: 'justify' }}>
                Cuando se conserva un bosque, un río o un humedal, no solo se protege a una especie: se preserva toda una red de vida. La biodiversidad aporta alimento, regulación climática, limpieza del agua y resiliencia frente a cambios ambientales. Cada espacio natural conserva más de lo que parece a simple vista.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'admin' && (
        !esAdminOExperto ? (
          <div style={{ padding: '3rem 1.5rem', maxWidth: '500px', margin: '3rem auto', textAlign: 'center', backgroundColor: '#0F1A16', borderRadius: '16px', border: '1.5px solid #FF5252' }}>
            <span style={{ fontSize: '3.5rem' }}>🔒</span>
            <h2 style={{ color: '#FF5252', margin: '0.8rem 0 0.4rem 0' }}>Acceso Restringido</h2>
            <p style={{ color: '#8AA398', fontSize: '0.9rem' }}>Este módulo es exclusivo para Administradores y Expertos.</p>
            <button onClick={() => setTab('mapa')} style={{ backgroundColor: '#00E676', color: '#000', border: 'none', padding: '0.7rem 1.4rem', borderRadius: '20px', fontWeight: 'bold', marginTop: '1.2rem', cursor: 'pointer' }}>Volver al Mapa</button>
          </div>
        ) : (
          <div style={{ padding: '1.2rem', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div>
                <h2 style={{ color: '#00FF88', margin: 0 }}>🛡️ Panel de Revisión ({usuario.rol})</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#8AA398' }}>Sesión activa: {usuario.nombre}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {esAdmin && (
                  <button onClick={exportarCSV} style={{ backgroundColor: '#00E676', color: '#000', border: 'none', padding: '0.6rem 1.1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📥 Exportar CSV</button>
                )}
                {esAdmin && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '10px', padding: '0.45rem 0.65rem', color: '#CFE8D8', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    <input
                      type="checkbox"
                      checked={modoPrivacidadEstrictoMapa}
                      onChange={async (e) => {
                        const nuevoValor = e.target.checked;
                        setModoPrivacidadEstrictoMapa(nuevoValor);
                        try {
                          await setDoc(doc(db, 'configuracion_app', 'privacidad_mapa'), {
                            modoPrivacidadEstrictoMapa: nuevoValor,
                            actualizadoEn: Date.now(),
                            actualizadoPor: usuario.id || usuario.email || 'admin'
                          }, { merge: true });
                        } catch (err) {
                          setModoPrivacidadEstrictoMapa(!nuevoValor);
                          alert('No se pudo guardar el modo de privacidad en este momento.');
                        }
                      }}
                    />
                    🔒 Privacidad estricta de mapa
                  </label>
                )}
              </div>
            </div>

            {esAdmin && (
              <div style={{ backgroundColor: '#0F1A16', padding: '1.2rem', borderRadius: '14px', border: '1.5px solid #00FF88', marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#00FF88', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🟢 Usuarios Conectados en Tiempo Real
                </h3>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#8AA398' }}>
                  Lista de usuarios activos en la plataforma en los últimos 2 minutos.
                  {usuariosConectados.length > usuariosConectadosPreview.length ? ` Mostrando ${usuariosConectadosPreview.length} de ${usuariosConectados.length}.` : ''}
                </p>

                {ingresosRecientes.length > 0 && (
                  <div style={{ marginBottom: '0.9rem', padding: '0.7rem', borderRadius: '10px', border: '1px solid #1B3D2F', backgroundColor: '#09130F' }}>
                    <strong style={{ display: 'block', color: '#A5D6A7', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Ingresos recientes</strong>
                    <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                      {ingresosRecientes.slice(0, 8).map((ingreso) => (
                        <span key={ingreso.id} style={{ whiteSpace: 'nowrap', fontSize: '0.68rem', color: '#DCECDD', backgroundColor: '#10261D', border: '1px solid #1B3D2F', borderRadius: '999px', padding: '2px 8px' }}>
                          + {ingreso.nombre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {usuariosConectados.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#6A8A7D', margin: 0 }}>No hay otros usuarios activos en este momento.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.8rem' }}>
                    {usuariosConectadosPreview.map((u) => {
                      const statsUsuario = obtenerEstadisticasUsuario(u);
                      const mostrarValidaciones = esPersonaAdminOExperto(u);

                      return (
                        <div key={u.id} style={{ backgroundColor: '#050A08', padding: '0.7rem', borderRadius: '10px', border: '1px solid #1B3D2F', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ width: '10px', height: '10px', backgroundColor: '#00FF88', borderRadius: '50%', boxShadow: '0 0 8px #00FF88', display: 'inline-block' }}></span>
                          <div style={{ overflow: 'hidden' }}>
                            <strong style={{ color: '#FFF', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <span>{u.nombre || 'Usuario'}</span>
                              {renderizarInsigniaUsuario(statsUsuario.validados)}
                            </strong>
                            <span style={{ fontSize: '0.7rem', color: '#7AA394' }}>{u.rol || 'Usuario Regular'}</span>
                            {mostrarValidaciones && (
                              <div style={{ fontSize: '0.68rem', color: '#CFE8D8', marginTop: '0.1rem', fontWeight: '700' }}>
                                {obtenerTextoValidacionesPersona(u)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {esAdmin && (
              <div style={{ backgroundColor: '#0F1A16', padding: '1.2rem', borderRadius: '14px', border: '1.5px solid #1B3D2F', marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#00FF88', margin: '0 0 0.4rem 0' }}>👥 Control de Usuarios por Rango ({todosLosUsuarios.length})</h3>
                <p style={{ margin: '0 0 1.2rem 0', fontSize: '0.8rem', color: '#8AA398' }}>Gestiona los permisos, nombres y revisa la actividad organizada por categorías.</p>

                {todosLosUsuarios.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#6A8A7D' }}>No hay usuarios guardados aún.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* ADMINISTRADORES */}
                    <div style={{ backgroundColor: '#09130F', padding: '1rem', borderRadius: '12px', border: '1.5px solid #C0C0C0' }}>
                      <h4 style={{ color: '#C0C0C0', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🛡️ Administradores ({usuariosAdmin.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {usuariosAdmin.map((u) => {
                            const esAdminGeneral = esUsuarioAdministrativo(u.email, u.nombre);
                            const statsUsuario = obtenerEstadisticasUsuario(u);

                            return (
                              <div key={u.id} style={{ backgroundColor: '#050A08', padding: '0.8rem 1rem', borderRadius: '10px', border: esAdminGeneral ? '1.5px solid #FFD700' : '1px solid #C0C0C0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                                <div>
                                  <strong style={{ color: '#FFF', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span>{u.nombre || 'Usuario'}</span>
                                    <span style={{ fontSize: '0.66rem', backgroundColor: '#10261D', border: '1px solid #1B3D2F', borderRadius: '999px', padding: '2px 7px', color: '#DCECDD', fontWeight: '800' }}>
                                      {obtenerTextoValidacionesPersona(u)}
                                    </span>
                                    {renderizarInsigniaUsuario(statsUsuario.validados)}
                                  </strong>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#7AA394' }}>✉️ {(u.email || '').includes('@herpid.cr') ? `Celular: ${(u.email || '').replace('tel_', '').replace('@herpid.cr', '')}` : (u.email || 'Sin correo')}</span>
                                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', backgroundColor: '#0D2E21', color: '#00FF88', padding: '2px 7px', borderRadius: '6px', fontWeight: 'bold' }}>📊 Reportes: {statsUsuario.total}</span>
                                    <span style={{ fontSize: '0.72rem', color: '#8AA398' }}>(✓ {statsUsuario.validados} Validados | ⏳ {statsUsuario.pendientes} Pendientes)</span>
                                  </div>
                                </div>
                                {esAdmin && (
                                  <div style={{ minWidth: '140px', padding: '0.55rem 0.7rem', borderRadius: '10px', backgroundColor: '#0D2E21', border: '1px solid #00FF88', display: 'grid', gap: '0.3rem' }}>
                                    <div style={{ fontSize: '0.66rem', color: '#9BD3B8', fontWeight: '800', textTransform: 'uppercase' }}>Revisiones Admin</div>
                                    <div style={{ fontSize: '0.76rem', color: '#E7FFF1', fontWeight: '800' }}>✅ Aprobaciones: {obtenerEstadisticasRevisionUsuario(u).aprobaciones}</div>
                                    <div style={{ fontSize: '0.76rem', color: '#E7FFF1', fontWeight: '800' }}>📝 Revisiones: {obtenerEstadisticasRevisionUsuario(u).revisiones}</div>
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button onClick={() => cambiarNombreUsuarioAdmin(u.id, u.nombre)} style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Cambiar Nombre</button>
                                  <button onClick={() => actualizarEstadoBaneoUsuario(u.id, u, !Boolean(u.baneado))} style={{ backgroundColor: u.baneado ? '#2E7D32' : '#B71C1C', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>{u.baneado ? '✅ Desbanear' : '🚫 Banear'}</button>
                                  {esAdminGeneral && !esUsuarioPrincipal(u.email, u.nombre, u.id, 'admin_jcv_master') ? (
                                    <div style={{ backgroundColor: '#2A2408', color: '#FFD700', border: '1px solid #FFD700', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold' }}>👑 Admin General</div>
                                  ) : (
                                    <>
                                      <select defaultValue={u.rol || 'Administrador'} onChange={(e) => u.nuevoRolTemp = e.target.value} style={{ padding: '0.45rem', backgroundColor: '#09130F', color: '#C0C0C0', border: '1px solid #C0C0C0', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                        <option value="Usuario Regular">👤 Usuario Regular</option>
                                        <option value="Experto Herpetólogo">🔬 Experto Herpetólogo</option>
                                        <option value="Administrador">🛡️ Administrador</option>
                                      </select>
                                      <button onClick={() => cambiarRangoUsuario(u.id, u.email, u.nuevoRolTemp || u.rol || 'Administrador')} style={{ backgroundColor: '#C0C0C0', color: '#000', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>💾 Cambiar Rango</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* EXPERTOS */}
                    <div style={{ backgroundColor: '#09130F', padding: '1rem', borderRadius: '12px', border: '1.5px solid #0288D1' }}>
                      <h4 style={{ color: '#0288D1', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🔬 Expertos Herpetólogos ({usuariosExpertos.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {usuariosExpertos.length === 0 ? (
                          <p style={{ fontSize: '0.75rem', color: '#6A8A7D', margin: 0 }}>No hay expertos asignados actualmente.</p>
                        ) : (
                          usuariosExpertos.map((u) => {
                            const statsUsuario = obtenerEstadisticasUsuario(u);

                            return (
                              <div key={u.id} style={{ backgroundColor: '#050A08', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #0288D1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                                <div>
                                  <strong style={{ color: '#FFF', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span>{u.nombre || 'Usuario'}</span>
                                    <span style={{ fontSize: '0.66rem', backgroundColor: '#10261D', border: '1px solid #1B3D2F', borderRadius: '999px', padding: '2px 7px', color: '#DCECDD', fontWeight: '800' }}>
                                      {obtenerTextoValidacionesPersona(u)}
                                    </span>
                                    {renderizarInsigniaUsuario(statsUsuario.validados)}
                                  </strong>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#7AA394' }}>✉️ {(u.email || '').includes('@herpid.cr') ? `Celular: ${(u.email || '').replace('tel_', '').replace('@herpid.cr', '')}` : (u.email || 'Sin correo')}</span>
                                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', backgroundColor: '#0D2E21', color: '#00FF88', padding: '2px 7px', borderRadius: '6px', fontWeight: 'bold' }}>📊 Reportes: {statsUsuario.total}</span>
                                    <span style={{ fontSize: '0.72rem', color: '#8AA398' }}>(✓ {statsUsuario.validados} Validados | ⏳ {statsUsuario.pendientes} Pendientes)</span>
                                  </div>
                                </div>
                                {esAdmin && (
                                  <div style={{ minWidth: '140px', padding: '0.55rem 0.7rem', borderRadius: '10px', backgroundColor: '#0D2E21', border: '1px solid #0288D1', display: 'grid', gap: '0.3rem' }}>
                                    <div style={{ fontSize: '0.66rem', color: '#9BD3B8', fontWeight: '800', textTransform: 'uppercase' }}>Revisiones Admin</div>
                                    <div style={{ fontSize: '0.76rem', color: '#E7FFF1', fontWeight: '800' }}>✅ Aprobaciones: {obtenerEstadisticasRevisionUsuario(u).aprobaciones}</div>
                                    <div style={{ fontSize: '0.76rem', color: '#E7FFF1', fontWeight: '800' }}>📝 Revisiones: {obtenerEstadisticasRevisionUsuario(u).revisiones}</div>
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button onClick={() => cambiarNombreUsuarioAdmin(u.id, u.nombre)} style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Cambiar Nombre</button>
                                  <button onClick={() => actualizarEstadoBaneoUsuario(u.id, u, !Boolean(u.baneado))} style={{ backgroundColor: u.baneado ? '#2E7D32' : '#B71C1C', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>{u.baneado ? '✅ Desbanear' : '🚫 Banear'}</button>
                                  <select defaultValue={u.rol || 'Experto Herpetólogo'} onChange={(e) => u.nuevoRolTemp = e.target.value} style={{ padding: '0.45rem', backgroundColor: '#09130F', color: '#0288D1', border: '1px solid #0288D1', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    <option value="Usuario Regular">👤 Usuario Regular</option>
                                    <option value="Experto Herpetólogo">🔬 Experto Herpetólogo</option>
                                    <option value="Administrador">🛡️ Administrador</option>
                                  </select>
                                  <button onClick={() => cambiarRangoUsuario(u.id, u.email, u.nuevoRolTemp || u.rol || 'Experto Herpetólogo')} style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>💾 Cambiar Rango</button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* USUARIOS REGULARES */}
                    <div style={{ backgroundColor: '#09130F', padding: '1rem', borderRadius: '12px', border: '1.5px solid #CD7F32' }}>
                      <h4 style={{ color: '#CD7F32', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        👤 Usuarios Regulares ({usuariosRegulares.length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {usuariosRegulares.length === 0 ? (
                          <p style={{ fontSize: '0.75rem', color: '#6A8A7D', margin: 0 }}>No hay usuarios regulares adicionales.</p>
                        ) : (
                          usuariosRegulares.map((u) => {
                            const statsUsuario = obtenerEstadisticasUsuario(u);

                            return (
                              <div key={u.id} style={{ backgroundColor: '#050A08', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #CD7F32', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                                <div>
                                  <strong style={{ color: '#FFF', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span>{u.nombre || 'Usuario'}</span>
                                    {u.baneado && (
                                      <span style={{ fontSize: '0.66rem', backgroundColor: '#4A0F17', color: '#FFB3B3', padding: '2px 7px', borderRadius: '999px', fontWeight: '800' }}>🚫 Baneado</span>
                                    )}
                                    {renderizarInsigniaUsuario(statsUsuario.validados)}
                                  </strong>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#7AA394' }}>✉️ {(u.email || '').includes('@herpid.cr') ? `Celular: ${(u.email || '').replace('tel_', '').replace('@herpid.cr', '')}` : (u.email || 'Sin correo')}</span>
                                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', backgroundColor: '#0D2E21', color: '#00FF88', padding: '2px 7px', borderRadius: '6px', fontWeight: 'bold' }}>📊 Reportes: {statsUsuario.total}</span>
                                    <span style={{ fontSize: '0.72rem', color: '#8AA398' }}>(✓ {statsUsuario.validados} Validados | ⏳ {statsUsuario.pendientes} Pendientes)</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button onClick={() => cambiarNombreUsuarioAdmin(u.id, u.nombre)} style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Cambiar Nombre</button>
                                  <button onClick={() => actualizarEstadoBaneoUsuario(u.id, u, !Boolean(u.baneado))} style={{ backgroundColor: u.baneado ? '#2E7D32' : '#B71C1C', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>{u.baneado ? '✅ Desbanear' : '🚫 Banear'}</button>
                                  <select defaultValue={u.rol || 'Usuario Regular'} onChange={(e) => u.nuevoRolTemp = e.target.value} style={{ padding: '0.45rem', backgroundColor: '#09130F', color: '#CD7F32', border: '1px solid #CD7F32', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    <option value="Usuario Regular">👤 Usuario Regular</option>
                                    <option value="Experto Herpetólogo">🔬 Experto Herpetólogo</option>
                                    <option value="Administrador">🛡️ Administrador</option>
                                  </select>
                                  <button onClick={() => cambiarRangoUsuario(u.id, u.email, u.nuevoRolTemp || u.rol || 'Usuario Regular')} style={{ backgroundColor: '#CD7F32', color: '#000', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>💾 Cambiar Rango</button>
                                  <button onClick={() => eliminarUsuarioRegular(u.id, u.email)} style={{ backgroundColor: '#D32F2F', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️ Eliminar</button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            <div style={{ backgroundColor: '#0F1A16', padding: '1rem', borderRadius: '12px', border: '1px solid #1B2E27', marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#FFF' }}>📖 Gestión de la Guía Herpetológica</strong>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#8AA398' }}>Total de especies en la enciclopedia: {especiesGuia.length}</p>
              </div>
              {esAdmin && (
                <button onClick={() => setModalNuevaEspecieGuia(true)} style={{ backgroundColor: '#00E676', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>+ Agregar Especie</button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
              <div style={{ backgroundColor: '#0F1A16', padding: '1rem', borderRadius: '12px', border: '1px solid #1B2E27', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', color: '#00FF88', fontWeight: 'bold' }}>{registros.length}</div>
                <div style={{ fontSize: '0.75rem', color: '#8AA398' }}>Total Registros</div>
              </div>
              <div style={{ backgroundColor: '#0F1A16', padding: '1rem', borderRadius: '12px', border: '1px solid #1B2E27', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', color: '#00C853', fontWeight: 'bold' }}>{registros.filter(r => r.estado === 'VALIDADO').length}</div>
                <div style={{ fontSize: '0.75rem', color: '#8AA398' }}>Validados</div>
              </div>
              <div style={{ backgroundColor: '#0F1A16', padding: '1rem', borderRadius: '12px', border: '1px solid #1B2E27', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', color: '#FFC107', fontWeight: 'bold' }}>{registros.filter(r => r.estado !== 'VALIDADO').length}</div>
                <div style={{ fontSize: '0.75rem', color: '#8AA398' }}>Pendientes</div>
              </div>
              <div style={{ backgroundColor: '#0F1A16', padding: '1rem', borderRadius: '12px', border: '1px solid #1B2E27', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', color: '#00B0FF', fontWeight: 'bold' }}>{todosLosUsuarios.length}</div>
                <div style={{ fontSize: '0.75rem', color: '#8AA398' }}>Usuarios Registrados</div>
              </div>
            </div>

            <input type="text" placeholder="🔍 Buscar avistamiento..." value={busquedaAdmin} onChange={(e) => setBusquedaAdmin(e.target.value)} style={{ width: '100%', padding: '0.7rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '10px', marginBottom: '1.2rem', boxSizing: 'border-box' }} /> 

            <h3>Avistamientos NUEVOS pendientes de validación (con coordenadas completas GPS)</h3>
            {registrosFiltradosAdmin.length === 0 ? (
              <div style={{ backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '12px', padding: '1rem', color: '#8AA398', fontSize: '0.85rem', textAlign: 'center' }}>
                No hay reportes nuevos pendientes por validar en este momento.
              </div>
            ) : registrosFiltradosAdmin.map((reg) => {
              const fotosRevision = construirListaFotosPriorizada(reg);
              const fotoPrevia = fotosRevision[0];
              const esPendiente = reg.estado !== 'VALIDADO';
              const contactoAdmin = obtenerContactoAdminReportante(reg);
              const nombreAdminReportante = String(reg.reportante || '').trim() || 'No disponible';
              return (
                <div key={reg.id} style={{ backgroundColor: '#0F1A16', padding: '0.8rem 1rem', borderRadius: '14px', border: esPendiente ? '1.5px solid #FF1744' : '1px solid #1B3D2F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    {fotoPrevia && (
                      <img src={fotoPrevia} alt={reg.nombreComun} onClick={() => setLightboxData({ fotos: fotosRevision, index: 0 })} style={{ width: '60px', height: '60px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '8px', border: '1px solid #1B3D2F', cursor: 'pointer' }} title="Click para ampliar imagen" /> 
                    )}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ color: '#FFF', fontSize: '1rem' }}>{reg.nombreComun}</strong>
                        {esPendiente && (
                          <span style={{ backgroundColor: '#FF1744', color: '#FFF', fontSize: '0.55rem', fontWeight: '900', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>NUEVO</span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#00FF88', fontStyle: 'italic', display: 'block' }}>{reg.especie}</span>
                      <div style={{ fontSize: '0.75rem', color: '#8AA398' }}>📍 {reg.ubicacion} | 🌐 {reg.coords?.[0]}, {reg.coords?.[1]}</div>
                      <div style={{ fontSize: '0.72rem', color: reg.estado === 'VALIDADO' ? '#00FF88' : '#FFC107', marginTop: '0.1rem' }}>Estado: {reg.estado}</div>
                      {esAdmin && (
                        <>
                          <div style={{ fontSize: '0.72rem', color: '#D7EBDD', marginTop: '0.15rem' }}>👤 Reportante: {nombreAdminReportante}</div>
                          <div style={{ fontSize: '0.7rem', color: '#A5C8B4' }}>🔐 Contacto Admin: {contactoAdmin}</div>
                        </>
                      )}
                      {fotosRevision.length > 0 && (
                        <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => setLightboxData({ fotos: fotosRevision, index: 0 })}
                            style={{ backgroundColor: '#0B2A1F', color: '#9CF7C7', border: '1px solid #1B3D2F', padding: '0.28rem 0.55rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '0.68rem' }}
                          >
                            🔍 Ver imágenes grandes
                          </button>
                          <span style={{ fontSize: '0.68rem', color: '#8AA398' }}>{fotosRevision.length} foto(s)</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => abrirChatConReportante(reg)}
                      disabled={!reg.userId}
                      title={reg.userId ? 'Abrir chat directo con reportante' : 'Este reporte no tiene usuario vinculado para chat directo'}
                      style={{ backgroundColor: reg.userId ? '#6A1B9A' : '#3A3A3A', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: reg.userId ? 'pointer' : 'not-allowed', fontSize: '0.75rem', opacity: reg.userId ? 1 : 0.65 }}
                    >
                      💬 Contactar
                    </button>
                    <button onClick={() => cambiarEstadoReporte(reg.id, 'VALIDADO')} style={{ backgroundColor: '#00C853', color: '#000', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✓ Validar</button>
                    {(esAdmin || !esRegistroValidado(reg.estado)) && (
                      <button onClick={() => abrirEdicionModal(reg)} style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Editar</button>
                    )}
                    <button onClick={() => eliminarRegistro(reg.id, reg)} style={{ backgroundColor: '#D32F2F', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️ Borrar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {avisoRankingEntrante && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999998, padding: '1rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #0F1A16 0%, #09130F 100%)', borderRadius: '18px', border: '1.5px solid #00FF88', width: '100%', maxWidth: '440px', padding: '1.2rem', boxShadow: '0 14px 40px rgba(0,255,136,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
              <div style={{ color: '#00FF88', fontSize: '0.95rem', fontWeight: '900' }}>🏆 Ascenso en el ranking</div>
              <button onClick={() => setAvisoRankingEntrante(null)} style={{ background: 'transparent', border: 'none', color: '#8AA398', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
            <h2 style={{ color: '#F8FFF9', margin: '0 0 0.35rem 0', fontSize: '1.08rem' }}>{avisoRankingEntrante.titulo}</h2>
            <p style={{ color: '#DDE9E1', margin: '0 0 0.25rem 0', lineHeight: 1.45 }}>{avisoRankingEntrante.mensaje}</p>
            <p style={{ color: '#8AA398', margin: 0, fontSize: '0.85rem' }}>{avisoRankingEntrante.detalle}</p>
          </div>
        </div>
      )}

      {alertaMordeduraEntrante && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#1A0508', borderRadius: '16px', border: '3px solid #FF1744', width: '100%', maxWidth: '480px', padding: '1.8rem', textAlign: 'center', boxShadow: '0 0 40px rgba(255,23,68,0.8)' }}>
            <span style={{ fontSize: '3.5rem' }}>🚨</span>
            <h2 style={{ color: '#FF1744', margin: '0.8rem 0 0.4rem 0', fontWeight: '900' }}>¡ALERTA CRÍTICA: MORDEDURA!</h2>
            <p style={{ color: '#FFF', fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              El usuario <span style={{ color: '#00FF88' }}>{alertaMordeduraEntrante.usuarioNombre || 'Ciudadano'}</span> ha reportado una emergencia de mordedura de serpiente.
            </p>
            <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '8px', border: '1px solid #FF5252', color: '#FF8A80', fontSize: '0.85rem', marginBottom: '1.2rem', textAlign: 'left' }}>
              {alertaMordeduraEntrante.texto}
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                onClick={() => {
                  setChatRoomSeleccionado(alertaMordeduraEntrante.chatRoomId);
                  setTipoChatEquipo('usuarios');
                  setTab('chat');
                  setAlertaMordeduraEntrante(null);
                }} 
                style={{ flex: 1, padding: '0.8rem', backgroundColor: '#00E676', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                💬 Atender Chat Directo
              </button>
              <button 
                onClick={() => setAlertaMordeduraEntrante(null)} 
                style={{ flex: 1, padding: '0.8rem', backgroundColor: '#333', color: '#FFF', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Cerrar Alerta
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEditar && registroEditando && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#09130F', borderRadius: '16px', border: '1px solid #1B3D2F', width: '100%', maxWidth: '540px', padding: '1.4rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#00FF88', margin: '0 0 1rem 0' }}>✏️ Editar Reporte y Ubicación GPS</h3>

            {esAdminOExperto && (
              <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '10px', border: '1px solid #1B3D2F', marginBottom: '1.2rem' }}>
                <label style={{ color: '#00FF88', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                  📸 Toca una imagen para Autorizarla como la Foto Oficial Pública
                </label>
                
                <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto' }}>
                  {construirListaFotosPriorizada(registroEditando).map((fotoSrc, idx) => {
                    const esSeleccionada = (registroEditando.fotoAutorizada || registroEditando.img) === fotoSrc;
                    return (
                      <div 
                        key={idx} 
                        onClick={() => setRegistroEditando({ ...registroEditando, fotoAutorizada: fotoSrc, img: fotoSrc })}
                        style={{ 
                          position: 'relative', 
                          cursor: 'pointer', 
                          border: esSeleccionada ? '3px solid #00FF88' : '1px solid #1B3D2F',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          boxShadow: esSeleccionada ? '0 0 10px rgba(0,255,136,0.6)' : 'none'
                        }}
                      >
                        <img src={fotoSrc} alt={`foto_${idx}`} style={{ width: '90px', height: '70px', objectFit: 'contain', backgroundColor: '#000' }} />
                        {esSeleccionada && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#00FF88', color: '#000', fontSize: '0.65rem', fontWeight: 'bold', textAlign: 'center', padding: '1px 0' }}>
                            ✓ Autorizada
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {construirListaFotosPriorizada(registroEditando).length === 0 && (
                  <div style={{ marginTop: '0.55rem', color: '#8AA398', fontSize: '0.73rem' }}>
                    Este reporte no incluye fotografías adjuntas.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Nombre Común</label>
                <input type="text" value={registroEditando.nombreComun || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, nombreComun: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} /> 
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Nombre Científico / Especie</label>
                <input type="text" value={registroEditando.especie || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, especie: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} /> 
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Categoría de Fauna</label>
                <select value={registroEditando.categoria || 'ANFIBIO'} onChange={(e) => {
                  const nuevaCat = e.target.value;
                  const catClave = nuevaCat.toLowerCase() === 'reptil' ? 'Reptil' : 'Anfibio';
                  setRegistroEditando({ 
                    ...registroEditando, 
                    categoria: nuevaCat,
                    silueta: opcionesPorCategoria[catClave][0].id
                  });
                }} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px' }}>
                  <option value="ANFIBIO">🐸 ANFIBIO</option>
                  <option value="REPTIL">🐍 REPTIL</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Silueta / Tipo</label>
                <select value={registroEditando.silueta || 'Rana Arborícola'} onChange={(e) => setRegistroEditando({ ...registroEditando, silueta: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px' }}>
                  {opcionesPorCategoria[(registroEditando.categoria || 'ANFIBIO').toLowerCase() === 'reptil' ? 'Reptil' : 'Anfibio'].map((op) => (
                    <option key={op.id} value={op.id}>{op.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '10px', border: '1px solid #00FF88', marginBottom: '0.8rem' }}>
              <label style={{ color: '#00FF88', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>
                📍 Corrección Manual de Coordenadas GPS
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#8AA398' }}>Latitud</span>
                  <input 
                    type="number" 
                    step="0.0001" 
                    value={registroEditando.latEdit || 9.65} 
                    onChange={(e) => setRegistroEditando({ ...registroEditando, latEdit: e.target.value })} 
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#09130F', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '6px', boxSizing: 'border-box' }} 
                  />
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#8AA398' }}>Longitud</span>
                  <input 
                    type="number" 
                    step="0.0001" 
                    value={registroEditando.lngEdit || -84.00} 
                    onChange={(e) => setRegistroEditando({ ...registroEditando, lngEdit: e.target.value })} 
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#09130F', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '6px', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Microhábitat</label>
                <select value={registroEditando.microhabitat || 'Vegetación / Finca Cafetalera'} onChange={(e) => setRegistroEditando({ ...registroEditando, microhabitat: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px' }}>
                  <option value="Vegetación / Finca Cafetalera">🌿 Vegetación / Finca Cafetalera</option>
                  <option value="Sobre / bajo Roca">🪨 Sobre / bajo Roca</option>
                  <option value="Cuerpo de Agua / Río">🌊 Cuerpo de Agua / Río</option>
                  <option value="Suelo / Hojarasca">🍂 Suelo / Hojarasca</option>
                  <option value="Estructura Humana / Casa">🏠 Estructura Humana</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Estado de Vida / Etapa</label>
                <input type="text" value={registroEditando.estadoVida || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, estadoVida: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} /> 
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Temperatura</label>
                <input type="text" value={registroEditando.temp || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, temp: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} /> 
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Altitud</label>
                <input type="text" value={registroEditando.altitud || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, altitud: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} /> 
              </div>
            </div>

            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ color: '#8AA398', fontSize: '0.75rem', fontWeight: 'bold' }}>🗓️ Fecha y hora del avistamiento</label>
              <input
                type="datetime-local"
                value={registroEditando.fechaAvistamientoInput || ''}
                onChange={(e) => setRegistroEditando({ ...registroEditando, fechaAvistamientoInput: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ color: '#FF5252', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                <input type="checkbox" checked={registroEditando.esPeligroso || false} onChange={(e) => setRegistroEditando({ ...registroEditando, esPeligroso: e.target.checked })} /> 
                ⚠️ Especie Venenosa / Peligro Médico
              </label>
            </div>

            {esAdminOExperto && (
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Estado de Validación</label>
                <select value={registroEditando.estado || 'EN REVISIÓN EXPERTA'} onChange={(e) => setRegistroEditando({ ...registroEditando, estado: e.target.value })} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#00FF88', border: '1px solid #1B3D2F', borderRadius: '8px', fontWeight: 'bold' }}>
                  <option value="VALIDADO">✓ VALIDADO</option>
                  <option value="EN REVISIÓN EXPERTA">⏳ EN REVISIÓN EXPERTA</option>
                  <option value="RECHAZADO">✕ RECHAZADO</option>
                </select>
              </div>
            )}

            <button onClick={guardarEdicionRegistro} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem' }}>Guardar Cambios y Ubicación</button>
            <button onClick={() => setModalEditar(false)} style={{ width: '100%', padding: '0.6rem', backgroundColor: 'transparent', color: '#8AA398', border: 'none', marginTop: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {modalNuevaEspecieGuia && esAdmin && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#09130F', borderRadius: '16px', border: '1px solid #1B3D2F', width: '100%', maxWidth: '480px', padding: '1.4rem' }}>
            <h3 style={{ color: '#00FF88', margin: '0 0 1rem 0' }}>📖 Agregar Especie a la Guía</h3>

            <input type="text" placeholder="Nombre Común (ej. Terciopelo)" value={formGuia.nombre} onChange={(e) => setFormGuia({ ...formGuia, nombre: e.target.value })} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.8rem', boxSizing: 'border-box' }} /> 
            <input type="text" placeholder="Nombre Científico (ej. Bothrops asper)" value={formGuia.especie} onChange={(e) => setFormGuia({ ...formGuia, especie: e.target.value })} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.8rem', boxSizing: 'border-box' }} /> 
            
            <label style={{ color: '#8AA398', fontSize: '0.8rem' }}>Categoría</label>
            <select value={formGuia.tipo} onChange={(e) => setFormGuia({ ...formGuia, tipo: e.target.value })} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.8rem' }}>
              <option value="Anfibio">Anfibio</option>
              <option value="Reptil">Reptil</option>
            </select>

            <label style={{ color: '#FF5252', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', fontWeight: 'bold' }}>
              <input type="checkbox" checked={formGuia.esPeligroso} onChange={(e) => setFormGuia({ ...formGuia, esPeligroso: e.target.checked })} /> 
              ⚠️ Especie Venenosa / Peligro Médico
            </label>

            <input type="text" placeholder="URL de la Imagen (Link web)" value={formGuia.img} onChange={(e) => setFormGuia({ ...formGuia, img: e.target.value })} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.8rem', boxSizing: 'border-box' }} /> 
            <textarea placeholder="Descripción biológica o notas..." value={formGuia.desc} onChange={(e) => setFormGuia({ ...formGuia, desc: e.target.value })} style={{ width: '100%', height: '80px', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '1rem', boxSizing: 'border-box' }}></textarea>

            <button onClick={guardarNuevaEspecieGuia} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem' }}>Guardar en la Guía</button>
            <button onClick={() => setModalNuevaEspecieGuia(false)} style={{ width: '100%', padding: '0.6rem', backgroundColor: 'transparent', color: '#8AA398', border: 'none', marginTop: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {modalEditarEspecieGuia && especieGuiaEditando && esAdmin && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#09130F', borderRadius: '16px', border: '1px solid #1B3D2F', width: '100%', maxWidth: '480px', padding: '1.4rem' }}>
            <h3 style={{ color: '#00FF88', margin: '0 0 1rem 0' }}>✏️ Editar Especie de la Guía</h3>

            <input type="text" value={especieGuiaEditando.nombre || ''} onChange={(e) => setEspecieGuiaEditando({ ...especieGuiaEditando, nombre: e.target.value })} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.8rem', boxSizing: 'border-box' }} /> 
            <input type="text" value={especieGuiaEditando.especie || ''} onChange={(e) => setEspecieGuiaEditando({ ...especieGuiaEditando, especie: e.target.value })} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.8rem', boxSizing: 'border-box' }} /> 
            
            <select value={especieGuiaEditando.tipo || 'Anfibio'} onChange={(e) => setEspecieGuiaEditando({ ...especieGuiaEditando, tipo: e.target.value })} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.8rem' }}>
              <option value="Anfibio">Anfibio</option>
              <option value="Reptil">Reptil</option>
            </select>

            <label style={{ color: '#FF5252', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', fontWeight: 'bold' }}>
              <input type="checkbox" checked={especieGuiaEditando.esPeligroso || false} onChange={(e) => setEspecieGuiaEditando({ ...especieGuiaEditando, esPeligroso: e.target.checked })} /> 
              ⚠️ Especie Venenosa / Peligro Médico
            </label>

            <input type="text" value={especieGuiaEditando.img || ''} onChange={(e) => setEspecieGuiaEditando({ ...especieGuiaEditando, img: e.target.value })} style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.8rem', boxSizing: 'border-box' }} /> 
            <textarea value={especieGuiaEditando.desc || ''} onChange={(e) => setEspecieGuiaEditando({ ...especieGuiaEditando, desc: e.target.value })} style={{ width: '100%', height: '80px', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '1rem', boxSizing: 'border-box' }}></textarea>

            <button onClick={guardarEdicionEspecieGuia} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem' }}>Actualizar Guía</button>
            <button onClick={() => setModalEditarEspecieGuia(false)} style={{ width: '100%', padding: '0.6rem', backgroundColor: 'transparent', color: '#8AA398', border: 'none', marginTop: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

        </>
      )}

      {modalPerfil && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#09130F', borderRadius: '16px', border: '1px solid #1B3D2F', width: '100%', maxWidth: '420px', padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
              <h3 style={{ color: '#FFF', margin: 0 }}>{usuario.isLoggedIn ? '👤 Mi Perfil' : (vistaPerfil === 'login' ? '🔑 Iniciar Sesión' : (vistaPerfil === 'registro' ? '📝 Crear Cuenta' : '🔁 Recuperar Contraseña'))}</h3>
              <button onClick={() => setModalPerfil(false)} style={{ background: 'transparent', border: 'none', color: '#FFF', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
            </div>

            {usuario.isLoggedIn ? (
              <div style={{ textAlign: 'center' }}>
                
                {!editandoNombrePerfil ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                    <h2 style={{ color: '#00FF88', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span>{usuario.nombre}</span>
                      {renderizarInsigniaUsuario(misValidados)}
                    </h2>
                    <button onClick={() => { setNuevoNombrePerfil(usuario.nombre); setEditandoNombrePerfil(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title="Editar nombre">✏️</button>
                  </div>
                ) : (
                  <div style={{ margin: '0.8rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <input type="text" value={nuevoNombrePerfil} onChange={(e) => setNuevoNombrePerfil(e.target.value)} style={{ padding: '0.5rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #00FF88', borderRadius: '8px', textAlign: 'center', fontSize: '1rem', fontWeight: 'bold' }} /> 
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={guardarNombrePerfil} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>Guardar</button>
                      <button onClick={() => setEditandoNombrePerfil(false)} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#3A0D11', color: '#FF5252', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>Cancelar</button>
                    </div>
                  </div>
                )}

                <p style={{ color: '#8AA398', margin: '0.3rem 0', fontSize: '0.85rem' }}>
                  🔒 {usuario.email.includes('@herpid.cr') ? `Celular: ${usuario.email.replace('tel_', '').replace('@herpid.cr', '')}` : `Correo: ${usuario.email}`}
                </p>

                <div style={{ backgroundColor: '#0F2B20', color: '#00FF88', padding: '0.5rem', borderRadius: '10px', fontWeight: 'bold', margin: '1rem 0', border: '1px solid #00FF88' }}>{usuario.rol}</div>

                <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '10px', border: '1px solid #1B3D2F', margin: '1rem 0', textAlign: 'left' }}>
                  <strong style={{ color: '#00FF88', fontSize: '0.85rem' }}>📊 Mi Historial de Avistamientos</strong>
                  <div style={{ marginTop: '0.6rem', textAlign: 'center' }}>
                    <div style={{ background: '#0D2E21', padding: '0.6rem', borderRadius: '8px' }}>
                      <span style={{ color: '#FFC107', fontWeight: 'bold', fontSize: '1.2rem' }}>{misPendientes}</span>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: '#7AA394' }}>Pendientes por editar</span>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '10px', border: '1px solid #1B3D2F', margin: '1rem 0', textAlign: 'left' }}>
                  <strong style={{ color: '#00FF88', fontSize: '0.85rem' }}>🧾 Mis reportes</strong>
                  {misReportesOrdenados.length === 0 ? (
                    <p style={{ margin: '0.55rem 0 0 0', color: '#8AA398', fontSize: '0.78rem' }}>No tienes reportes pendientes por editar.</p>
                  ) : (
                    <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.55rem' }}>
                      {misReportesOrdenados.slice(0, 8).map((reporte) => {
                        const fecha = formatearFechaReporte(reporte);
                        return (
                          <div key={reporte.id} style={{ backgroundColor: '#0B1512', border: '1px solid #1B3D2F', borderRadius: '9px', padding: '0.55rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.45rem', alignItems: 'center' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: '#E7FFF1', fontSize: '0.78rem', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {reporte.nombreComun || 'Avistamiento'}
                                </div>
                                <div style={{ color: '#8AA398', fontSize: '0.68rem', marginTop: '0.1rem' }}>{fecha}</div>
                              </div>
                              <span style={{ fontSize: '0.64rem', fontWeight: '900', color: '#FFC107', backgroundColor: '#2A2408', border: '1px solid #FFC107', borderRadius: '999px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
                                Pendiente
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.45rem', gap: '0.5rem' }}>
                              <span style={{ color: '#7AA394', fontSize: '0.68rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reporte.ubicacion || 'Sin ubicación'}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalPerfil(false);
                                  abrirEdicionModal(reporte);
                                }}
                                style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', borderRadius: '7px', padding: '0.3rem 0.55rem', fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer' }}
                              >
                                ✏️ Editar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {misReportesOrdenados.length > 8 && (
                        <div style={{ color: '#8AA398', fontSize: '0.7rem', textAlign: 'center' }}>
                          Mostrando 8 de {misReportesOrdenados.length} reportes.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p style={{ fontSize: '0.72rem', color: '#00FF88', fontWeight: 'bold', marginTop: '0.8rem' }}>
                  HerpID Costa Rica • Elaborado por JCV
                </p>

                <button onClick={async () => { try { localStorage.setItem(CLAVE_LOGOUT_MANUAL, '1'); } catch (e) {} await signOut(auth); localStorage.removeItem(CLAVE_SESION_USUARIO); setUsuario(USUARIO_DESLOGUEADO); setModalPerfil(false); }} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#f44336', color: '#FFF', border: '1px solid #00FF88', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cerrar Sesión</button>
              </div>
            ) : vistaPerfil === 'login' ? (
              <div>
                <input type="text" placeholder="Correo electrónico o Celular (ej. 88887777)" value={formLogin.emailOrTel} onChange={(e) => setFormLogin({ ...formLogin, emailOrTel: e.target.value })} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.9rem', boxSizing: 'border-box' }} /> 
                <div style={{ position: 'relative', marginBottom: '0.9rem' }}>
                  <input
                    type={mostrarPassLogin ? 'text' : 'password'}
                    placeholder="Contraseña"
                    value={formLogin.pass}
                    onChange={(e) => setFormLogin({ ...formLogin, pass: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 2.8rem 0.75rem 0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    aria-label={mostrarPassLogin ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setMostrarPassLogin((prev) => !prev)}
                    style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#8AA398', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                  >
                    {mostrarPassLogin ? '🙈' : '👁️'}
                  </button>
                </div>
                <button onClick={ejecutarLogin} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Ingresar</button>
                <button onClick={() => { setFormRecuperacion({ emailOrTel: formLogin.emailOrTel || '' }); setVistaPerfil('recuperar'); }} style={{ width: '100%', background: 'transparent', color: '#8AA398', border: 'none', marginTop: '0.65rem', cursor: 'pointer', textDecoration: 'underline' }}>¿Olvidaste tu contraseña?</button>
                <button onClick={() => { setFormRecuperacion({ emailOrTel: formLogin.emailOrTel || '' }); setVistaPerfil('recuperar'); }} style={{ width: '100%', background: 'transparent', color: '#00FF88', border: 'none', marginTop: '0.15rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}>Recuperar cuenta con correo</button>
                <button onClick={() => setVistaPerfil('registro')} style={{ width: '100%', background: 'transparent', color: '#00FF88', border: 'none', marginTop: '1rem', cursor: 'pointer', textDecoration: 'underline' }}>¿No tienes cuenta? Regístrate aquí</button>
              </div>
            ) : vistaPerfil === 'registro' ? (
              <div>
                <input type="text" placeholder="Tu nombre completo" value={formReg.nombre} onChange={(e) => setFormReg({ ...formReg, nombre: e.target.value })} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.9rem', boxSizing: 'border-box' }} /> 
                <input type="text" placeholder="Correo electrónico o Celular (+506...)" value={formReg.emailOrTel} onChange={(e) => setFormReg({ ...formReg, emailOrTel: e.target.value })} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.9rem', boxSizing: 'border-box' }} /> 
                {!formReg.emailOrTel.includes('@') && formReg.emailOrTel.trim().length > 0 && (
                  <>
                    <input
                      type="email"
                      placeholder="Correo para recuperación"
                      value={formReg.correoRecuperacion}
                      onChange={(e) => setFormReg({ ...formReg, correoRecuperacion: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.45rem', boxSizing: 'border-box' }}
                    />
                    <p style={{ margin: '0 0 0.9rem 0', fontSize: '0.72rem', color: '#8AA398', lineHeight: 1.4 }}>
                      Si te registras con celular, este correo será obligatorio para recibir el código o enlace de recuperación si olvidas tu contraseña.
                    </p>
                  </>
                )}
                <div style={{ position: 'relative', marginBottom: '0.9rem' }}>
                  <input
                    type={mostrarPassRegistro ? 'text' : 'password'}
                    placeholder="Contraseña (mínimo 6 caracteres)"
                    value={formReg.pass}
                    onChange={(e) => setFormReg({ ...formReg, pass: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem 2.8rem 0.75rem 0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    aria-label={mostrarPassRegistro ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setMostrarPassRegistro((prev) => !prev)}
                    style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#8AA398', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                  >
                    {mostrarPassRegistro ? '🙈' : '👁️'}
                  </button>
                </div>
                <button onClick={ejecutarRegistro} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Crear Cuenta</button>
                <button onClick={() => setVistaPerfil('login')} style={{ width: '100%', background: 'transparent', color: '#8AA398', border: 'none', marginTop: '0.8rem', cursor: 'pointer' }}>← Volver a Iniciar Sesión</button>
              </div>
            ) : (
              <div>
                <h4 style={{ color: '#00FF88', margin: '0 0 0.6rem 0', fontSize: '0.95rem' }}>Recuperar cuenta por correo o celular</h4>
                <input
                  type="text"
                  placeholder="Escribe tu correo o celular registrado"
                  value={formRecuperacion.emailOrTel}
                  onChange={(e) => setFormRecuperacion({ emailOrTel: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.7rem', boxSizing: 'border-box' }}
                />
                <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.75rem', color: '#8AA398', lineHeight: 1.4 }}>
                  Si escribes correo, te enviaremos el enlace y un código de recuperación. Si escribes celular, el enlace llegará al correo vinculado a ese número.
                </p>
                {!codigoRecuperacionEnviado && !codigoVerificado ? (
                  <button onClick={ejecutarRecuperacionContrasena} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Enviar recuperación</button>
                ) : !codigoVerificado ? (
                  <>
                    <input
                      type="text"
                      placeholder="Ingresa el código de 6 dígitos"
                      value={codigoRecuperacion}
                      onChange={(e) => setCodigoRecuperacion(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.7rem', boxSizing: 'border-box' }}
                    />
                    <button onClick={confirmarCodigoRecuperacion} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Confirmar código</button>
                  </>
                ) : (
                  <>
                    <input
                      type="password"
                      placeholder="Nueva contraseña"
                      value={nuevaContrasena}
                      onChange={(e) => setNuevaContrasena(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.7rem', boxSizing: 'border-box' }}
                    />
                    <button onClick={restablecerContrasena} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Restablecer contraseña</button>
                  </>
                )}
                <button onClick={() => { setVistaPerfil('login'); setCodigoRecuperacionEnviado(false); setCodigoTemporal(''); setCodigoRecuperacion(''); setNuevaContrasena(''); setCodigoVerificado(false); setEmailRecuperacion(''); }} style={{ width: '100%', background: 'transparent', color: '#8AA398', border: 'none', marginTop: '0.8rem', cursor: 'pointer' }}>← Volver a Iniciar Sesión</button>
              </div>
            )}
          </div>
        </div>
      )}

      {modalBienvenidaInicio && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.86)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#09130F', borderRadius: '18px', border: '1px solid #1B3D2F', width: '100%', maxWidth: '500px', padding: '1.3rem', boxShadow: '0 0 30px rgba(0,255,136,0.15)' }}>
            <h3 style={{ color: '#00FF88', margin: '0 0 0.7rem 0', fontSize: '1.15rem' }}>🌿 Bienvenido a HerpID Costa Rica</h3>
            <p style={{ color: '#E0E6E3', margin: '0 0 0.8rem 0', lineHeight: 1.5, fontSize: '0.95rem' }}>
              Para ver más especies validadas en el mapa, simplemente acerque el zoom. Los avistamientos aprobados aparecerán de forma progresiva para mantener la vista limpia.
            </p>
            <div style={{ backgroundColor: '#3A0D11', border: '1px solid #FF5252', borderRadius: '12px', padding: '0.8rem', marginBottom: '1rem' }}>
              <strong style={{ color: '#FF5252', display: 'block', marginBottom: '0.35rem' }}>🚨 En caso de mordedura de serpiente</strong>
              <span style={{ color: '#FFD6D6', fontSize: '0.9rem', lineHeight: 1.4 }}>
                Llame primero al 911 o acuda de inmediato a un centro de salud. Luego mantenga la calma, inmovilice el área afectada y evite torniquetes o cortes.
              </span>
            </div>
            <button onClick={() => setModalBienvenidaInicio(false)} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Entendido</button>
          </div>
        </div>
      )}

      {modalRegistro && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#09130F', borderRadius: '16px', border: '1px solid #1B3D2F', width: '100%', maxWidth: '560px', padding: '1.2rem', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#00FF88', margin: '0 0 1rem 0' }}>🐸 Registrar Nuevo Avistamiento</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Categoría de Fauna</label>
                <select value={tipoFauna} onChange={(e) => {
                  const nuevaCat = e.target.value;
                  setTipoFauna(nuevaCat);
                  setSilueta(opcionesPorCategoria[nuevaCat][0].id);
                }} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginTop: '0.2rem' }}>
                  <option value="Anfibio">🐸 Anfibio</option>
                  <option value="Reptil">🐍 Reptil</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Silueta / Tipo</label>
                <select value={silueta} onChange={(e) => {
                  const val = e.target.value;
                  setSilueta(val);
                  if (val === 'Serpiente' || val === 'Lagarto/Caimán') setEsPeligrosoReporte(true);
                }} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginTop: '0.2rem' }}>
                  {opcionesPorCategoria[tipoFauna].map((op) => (
                    <option key={op.id} value={op.id}>{op.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ color: '#8AA398', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={desconocido} onChange={(e) => setDesconocido(e.target.checked)} /> 
                ¿Especie desconocida? (Sugerir para revisión experta)
              </label>
            </div>

            {!desconocido && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                <input type="text" placeholder="Nombre Común" value={nombreComun} onChange={(e) => setNombreComun(e.target.value)} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} /> 
                <input type="text" placeholder="Especie / Nombre Científico" value={nombreCientifico} onChange={(e) => setNombreCientifico(e.target.value)} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} /> 
              </div>
            )}

            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ color: '#FF5252', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                <input type="checkbox" checked={esPeligrosoReporte} onChange={(e) => setEsPeligrosoReporte(e.target.checked)} /> 
                ⚠️ Marcar como especie venenosa / de riesgo médico
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Microhábitat</label>
                <select value={microhabitat} onChange={(e) => setMicrohabitat(e.target.value)} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginTop: '0.2rem' }}>
                  <option value="Vegetación / Finca Cafetalera">🌿 Vegetación / Finca Cafetalera</option>
                  <option value="Sobre / bajo Roca">🪨 Sobre / bajo Roca</option>
                  <option value="Cuerpo de Agua / Río">🌊 Cuerpo de Agua / Río</option>
                  <option value="Suelo / Hojarasca">🍂 Suelo / Hojarasca</option>
                  <option value="Estructura Humana / Casa">🏠 Estructura Humana</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Etapa y Estado</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <select value={etapa} onChange={(e) => setEtapa(e.target.value)} style={{ flex: 1, padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px' }}>
                    <option value="Adulto">Adulto</option>
                    <option value="Juvenil">Juvenil</option>
                    <option value="Renacuajo">Renacuajo</option>
                    <option value="Puesta / Huevos">Puesta / Huevos</option>
                  </select>
                  <select value={estadoOrganismo} onChange={(e) => setEstadoOrganismo(e.target.value)} style={{ flex: 1, padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px' }}>
                    <option value="Vivo / Activo">Vivo</option>
                    <option value="Atropellado / Muerto">Muerto</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ height: '170px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #1B3D2F' }}>
                <MapContainer center={posPin} zoom={11} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                  <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
                  <MarcadorMapaInteractivo posPin={posPin} setLat={setLat} setLng={setLng} setPosPin={setPosPin} setTemp={setTemp} setAltitud={setAltitud} setComunidad={setComunidad} setErrorEnvio={setErrorEnvio} />
                  <EventoMapaPin setLat={setLat} setLng={setLng} setPosPin={setPosPin} setTemp={setTemp} setAltitud={setAltitud} setComunidad={setComunidad} setErrorEnvio={setErrorEnvio} />
                </MapContainer>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <input type="text" value={`Temp: ${temp} °C`} readOnly style={{ flex: 1, padding: '0.5rem', backgroundColor: '#050A08', color: '#00FF88', border: '1px solid #1B3D2F', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem' }} /> 
              <input type="text" value={`Altitud: ${altitud} msnm`} readOnly style={{ flex: 1, padding: '0.5rem', backgroundColor: '#050A08', color: '#00FF88', border: '1px solid #1B3D2F', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem' }} /> 
            </div>

            <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '10px', border: '1px solid #1B3D2F', marginBottom: '0.8rem' }}>
              <label style={{ color: '#00FF88', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.45rem' }}>
                🗓️ Fecha y hora del avistamiento
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#CFE8D8', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={usarFechaActualAvistamiento}
                  onChange={(e) => {
                    const usarActual = e.target.checked;
                    setUsarFechaActualAvistamiento(usarActual);
                    if (usarActual) {
                      setFechaHoraAvistamiento(formatearFechaInputLocal(Date.now()));
                    }
                  }}
                />
                Usar fecha y hora actual (por defecto)
              </label>
              <input
                type="datetime-local"
                value={fechaHoraAvistamiento}
                onChange={(e) => setFechaHoraAvistamiento(e.target.value)}
                disabled={usarFechaActualAvistamiento}
                style={{ width: '100%', padding: '0.6rem', backgroundColor: usarFechaActualAvistamiento ? '#0B1512' : '#09130F', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '10px', border: '1px solid #1B3D2F', marginBottom: '0.8rem' }}>
              <label style={{ color: '#00FF88', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>🎙️ Canto / Audio de Campo (Máx 30s)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                {!grabandoAudio ? (
                  <button onClick={iniciarGrabacion} type="button" style={{ backgroundColor: '#00C853', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>🔴 Iniciar Grabación</button>
                ) : (
                  <button onClick={detenerGrabacion} type="button" style={{ backgroundColor: '#f44336', color: '#FFF', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>⏹️ Detener ({tiempoGrabacion}s)</button>
                )}
                {audioURL && <span style={{ color: '#00FF88', fontSize: '0.8rem' }}>✅ Audio adjuntado</span>}
              </div>
              {audioURL && !grabandoAudio && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.55rem' }}>
                  <button
                    onClick={sustituirGrabacion}
                    type="button"
                    style={{ flex: 1, backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.7rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    🔁 Sustituir grabación
                  </button>
                  <button
                    onClick={() => limpiarGrabacionCampo()}
                    type="button"
                    style={{ flex: 1, backgroundColor: '#5D111A', color: '#FFCDD2', border: '1px solid #FF5252', padding: '0.45rem 0.7rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    🗑️ Eliminar grabación
                  </button>
                </div>
              )}
              {audioURL && <audio src={audioURL} controls style={{ width: '100%', height: '32px', marginTop: '0.5rem' }} />}
            </div>

            <label style={{ display: 'block', color: '#00FF88', fontSize: '0.8rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>📸 Fotografías del Espécimen (Obligatorio, hasta 3 fotos)</label>
            <input type="file" accept="image/*" multiple onChange={handleFotosUpload} style={{ color: '#FFF', marginBottom: '0.8rem', width: '100%' }} /> 

            {fotosRegistro.length > 0 && (
              <div style={{ marginBottom: '0.8rem' }}>
                <div style={{ color: '#8AA398', fontSize: '0.73rem', marginBottom: '0.45rem' }}>
                  Selecciona una foto principal para que aparezca primero en mapa y galería.
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={limpiarFotosRegistro}
                    style={{ backgroundColor: '#5D111A', color: '#FFCDD2', border: '1px solid #FF5252', padding: '0.35rem 0.7rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.72rem' }}
                  >
                    🗑️ Eliminar todas
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {fotosRegistro.map((f, i) => (
                    <div key={i} style={{ border: i === fotoPrincipalIndex ? '2px solid #00FF88' : '1px solid #1B3D2F', borderRadius: '8px', padding: '0.3rem', backgroundColor: '#09130F' }}>
                      <img src={f} alt={`preview_${i}`} onClick={() => setLightboxData({ fotos: fotosRegistro, index: i })} style={{ width: '60px', height: '50px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '6px', border: '1px solid #00FF88', cursor: 'pointer', display: 'block' }} title="Click para ampliar imagen" />
                      <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.3rem' }}>
                        <button
                          type="button"
                          onClick={() => moverFotoRegistro(i, -1)}
                          style={{ flex: 1, backgroundColor: '#123529', color: '#BEE8D0', border: 'none', borderRadius: '6px', padding: '0.2rem 0.3rem', fontSize: '0.66rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moverFotoRegistro(i, 1)}
                          style={{ flex: 1, backgroundColor: '#123529', color: '#BEE8D0', border: 'none', borderRadius: '6px', padding: '0.2rem 0.3rem', fontSize: '0.66rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFotoPrincipalIndex(i)}
                        style={{ marginTop: '0.3rem', width: '100%', backgroundColor: i === fotoPrincipalIndex ? '#00C853' : '#123529', color: i === fotoPrincipalIndex ? '#000' : '#BEE8D0', border: 'none', borderRadius: '6px', padding: '0.2rem 0.3rem', fontSize: '0.66rem', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {i === fotoPrincipalIndex ? '✓ Principal' : 'Elegir principal'}
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarFotoRegistro(i)}
                        style={{ marginTop: '0.28rem', width: '100%', backgroundColor: '#3A0D11', color: '#FFB3B3', border: '1px solid #FF5252', borderRadius: '6px', padding: '0.2rem 0.3rem', fontSize: '0.66rem', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        ✕ Borrar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errorEnvio && (
              <div style={{ backgroundColor: '#3A0D11', color: '#FF5252', padding: '0.6rem', borderRadius: '8px', border: '1px solid #FF5252', fontSize: '0.85rem', marginBottom: '0.8rem', textAlign: 'center', fontWeight: 'bold' }}>
                {errorEnvio}
              </div>
            )}

            {fotosRegistro.filter(Boolean).length === 0 && (
              <div style={{ backgroundColor: '#2A2408', color: '#FFD54F', padding: '0.55rem', borderRadius: '8px', border: '1px solid #FFB300', fontSize: '0.78rem', marginBottom: '0.8rem', textAlign: 'center', fontWeight: '700' }}>
                Adjunta al menos una fotografía para habilitar el envío del reporte.
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', backgroundColor: '#0B1512', border: '1px solid #1B3D2F', borderRadius: '10px', padding: '0.7rem', marginBottom: '0.8rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autorizaNombrePublico}
                onChange={(e) => setAutorizaNombrePublico(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <span style={{ color: '#CFE8D8', fontSize: '0.78rem', lineHeight: 1.4 }}>
                Autorizo que mi nombre aparezca públicamente en el mapa y galería junto al avistamiento.
                Si lo desactivas, se mostrará como Observador protegido.
              </span>
            </label>

            <button onClick={enviarReporteCientifico} disabled={enviandoReporte} type="button" style={{ width: '100%', padding: '0.85rem', backgroundColor: enviandoReporte ? '#6A8A7D' : '#00E676', color: enviandoReporte ? '#E0E0E0' : '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: enviandoReporte ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: enviandoReporte ? 0.85 : 1 }}>{enviandoReporte ? 'Enviando reporte...' : 'Enviar Reporte Científico'}</button>

            <button onClick={() => setModalRegistro(false)} type="button" style={{ width: '100%', padding: '0.6rem', backgroundColor: 'transparent', color: '#8AA398', border: 'none', marginTop: '0.5rem', cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      {lightboxData && (
        <div 
          onClick={() => setLightboxData(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.92)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, padding: '1rem', cursor: 'pointer' }}
        >
          <div style={{ position: 'relative', maxWidth: '95vw', maxHeight: '95vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <img 
              src={lightboxData.fotos[lightboxData.index]} 
              alt="Ampliada detalle" 
              style={{ width: 'auto', height: 'auto', maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '12px', border: '2px solid #00FF88', boxShadow: '0 0 30px rgba(0,255,136,0.6)', backgroundColor: '#000' }} 
            />

            {lightboxData.fotos.length > 1 && (
              <>
                <button 
                  onClick={() => setLightboxData(prev => ({ ...prev, index: (prev.index - 1 + prev.fotos.length) % prev.fotos.length }))}
                  style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.8)', color: '#00FF88', border: '2px solid #00FF88', borderRadius: '50%', width: '45px', height: '45px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}
                >
                  ◀
                </button>
                <button 
                  onClick={() => setLightboxData(prev => ({ ...prev, index: (prev.index + 1) % prev.fotos.length }))}
                  style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.8)', color: '#00FF88', border: '2px solid #00FF88', borderRadius: '50%', width: '45px', height: '45px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' }}
                >
                  ▶
                </button>
                <div style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: '#00FF88', padding: '4px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', border: '1px solid #00FF88' }}>
                  {lightboxData.index + 1} / {lightboxData.fotos.length}
                </div>
              </>
            )}

            <button 
              onClick={() => setLightboxData(null)}
              style={{ position: 'absolute', top: '-14px', right: '-14px', backgroundColor: '#FF1744', color: '#FFF', border: '2px solid #FFF', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.3rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.8)' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#0A120E', display: 'flex', borderTop: '1.5px solid #162B23', height: '65px', alignItems: 'center', zIndex: 1000 }}>
        <button onClick={() => { if (!usuario.isLoggedIn) { setVistaPerfil('login'); setModalPerfil(true); } else setTab('mapa'); }} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'mapa' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>🗺️</span> Mapa
        </button>
        <button onClick={() => { if (!usuario.isLoggedIn) { setVistaPerfil('login'); setModalPerfil(true); } else setTab('ranking'); }} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'ranking' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>🏆</span> Ranking
        </button>
        <button onClick={() => { if (!usuario.isLoggedIn) { setVistaPerfil('login'); setModalPerfil(true); } else setTab('guia'); }} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'guia' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>📖</span> Guía
        </button>
        <button onClick={() => { if (!usuario.isLoggedIn) { setVistaPerfil('login'); setModalPerfil(true); } else abrirModalRegistro(); }} style={{ backgroundColor: '#00E676', border: '4px solid #070D0B', color: '#000', width: '56px', height: '56px', borderRadius: '50%', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '-28px', boxShadow: '0 0 15px rgba(0,230,118,0.5)' }}>
          +
        </button>
        <button onClick={() => { if (!usuario.isLoggedIn) { setVistaPerfil('login'); setModalPerfil(true); } else setTab('chat'); }} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'chat' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <span style={{ fontSize: '1.2rem' }}>💬</span>
          <span style={{ position: 'relative' }}>
            Chats
            {mensajesNuevosCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-18px',
                right: '-24px',
                backgroundColor: '#FF1744',
                color: '#FFF',
                borderRadius: '999px',
                padding: '2px 6px',
                fontSize: '0.55rem',
                fontWeight: '900',
                letterSpacing: '0.5px',
                border: '1.5px solid #0A120E',
                boxShadow: '0 2px 5px rgba(255,23,68,0.5)',
                minWidth: '18px',
                textAlign: 'center'
              }}>
                {mensajesNuevosCount > 9 ? '9+' : mensajesNuevosCount}
              </span>
            )}
          </span>
        </button>
        <button onClick={() => setTab('faq')} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'faq' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>🧠</span>
          <span>FAQ</span>
        </button>
        <button onClick={() => { if (!usuario.isLoggedIn) { setVistaPerfil('login'); setModalPerfil(true); } else setTab('admin'); }} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'admin' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <span style={{ fontSize: '1.2rem' }}>{esAdminOExperto ? '📊' : '🔒'}</span>
          <span style={{ position: 'relative' }}>
            Admin
            {avistamientosPendientesCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-18px',
                right: '-24px',
                backgroundColor: '#FF1744',
                color: '#FFF',
                borderRadius: '6px',
                padding: '2px 5px',
                fontSize: '0.55rem',
                fontWeight: '900',
                letterSpacing: '0.5px',
                border: '1.5px solid #0A120E',
                boxShadow: '0 2px 5px rgba(255,23,68,0.5)',
                textTransform: 'uppercase'
              }}>
                NUEVO
              </span>
            )}
          </span>
        </button>
      </nav>

    </div>
  );
}