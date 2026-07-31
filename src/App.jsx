import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- CONEXIÓN CON FIREBASE ---
import { db, auth } from './firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// --- DICCIONARIO DE CANTONES DE COSTA RICA (COORDENADAS, ALTITUD Y TEMPERATURA) ---
const cantonesCR = {
  "tarrazu": { coords: [9.6507, -84.0002], alt: "1350", temp: "21,0" },
  "dota": { coords: [9.6644, -83.8436], alt: "1550", temp: "19,5" },
  "leon cortes": { coords: [9.6828, -84.0519], alt: "1540", temp: "19,8" },
  "zarcero": { coords: [10.1856, -84.3853], alt: "1736", temp: "17,5" },
  "san jose": { coords: [9.9281, -84.0907], alt: "1150", temp: "22,5" },
  "alajuela": { coords: [10.0163, -84.2116], alt: "960", temp: "24,0" },
  "cartago": { coords: [9.8644, -83.9194], alt: "1435", temp: "20,0" },
  "heredia": { coords: [10.0024, -84.1165], alt: "1150", temp: "22,0" },
  "perez zeledon": { coords: [9.3781, -83.7025], alt: "700", temp: "24,5" },
  "aserri": { coords: [9.8556, -84.0894], alt: "1311", temp: "21,0" },
  "acosta": { coords: [9.7667, -84.4000], alt: "990", temp: "23,0" },
  "desamparados": { coords: [9.8903, -84.0667], alt: "1161", temp: "22,0" },
  "curridabat": { coords: [9.9333, -84.0333], alt: "1200", temp: "22,0" },
  "san marcos": { coords: [9.6507, -84.0002], alt: "1350", temp: "21,0" }
};

const buscarCantonEnTexto = (texto) => {
  if (!texto) return null;
  const limpio = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  for (const [key, data] of Object.entries(cantonesCR)) {
    if (limpio.includes(key)) {
      return data;
    }
  }
  return null;
};

// --- OPCIONES TAXONÓMICAS DINÁMICAS ---
const opcionesPorCategoria = {
  Anfibio: [
    { id: 'Rana Arborícola', label: 'Rana / Sapo' },
    { id: 'Salamandra', label: 'Salamandra' },
    { id: 'Cecilia / Cecilios', label: 'Cecilia / Cecilios' }
  ],
  Reptil: [
    { id: 'Serpiente', label: 'Serpiente' },
    { id: 'Lagartija', label: 'Lagartija / Iguana' },
    { id: 'Tortuga', label: 'Tortuga' }
  ]
};

// --- ICONOS PERSONALIZADOS DEL MAPA ---
const crearIconoPersonalizado = (silueta, estado, esPeligroso) => {
  let emoji = '🐸';
  if (silueta === 'Serpiente') emoji = '🐍';
  if (silueta === 'Lagartija' || silueta === 'Salamandra') emoji = '🦎';
  if (silueta === 'Tortuga') emoji = '🐢';
  if (silueta === 'Cecilia / Cecilios') emoji = '🐛';

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

// Selector interactivo de mapa
function EventoMapaPin({ setLat, setLng, setPosPin, setTemp, setAltitud }) {
  useMapEvents({
    click(e) {
      const latFija = e.latlng.lat.toFixed(6);
      const lngFija = e.latlng.lng.toFixed(6);
      setLat(latFija);
      setLng(lngFija);
      setPosPin([e.latlng.lat, e.latlng.lng]);
      const altCalculada = Math.round(1200 + Math.abs(e.latlng.lat - 9.65) * 10000);
      const altEstimada = Math.min(3820, Math.max(0, altCalculada));
      const tempEstimada = (25 - (altEstimada / 280)).toFixed(1).replace('.', ',');
      setTemp(tempEstimada);
      setAltitud(altEstimada.toString());
    },
  });
  return null;
}

export default function App() {
  const [tab, setTab] = useState('mapa');
  const [modalRegistro, setModalRegistro] = useState(false);
  const [modalPerfil, setModalPerfil] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalNuevaEspecieGuia, setModalNuevaEspecieGuia] = useState(false);
  const [modalEditarEspecieGuia, setModalEditarEspecieGuia] = useState(false);
  
  const [registroEditando, setRegistroEditando] = useState(null);
  const [especieGuiaEditando, setEspecieGuiaEditando] = useState(null);

  const [lightboxData, setLightboxData] = useState(null);
  const [alertaMordeduraEntrante, setAlertaMordeduraEntrante] = useState(null);

  const [vistaPerfil, setVistaPerfil] = useState('login');
  const [formLogin, setFormLogin] = useState({ emailOrTel: '', pass: '' });
  const [formReg, setFormReg] = useState({ nombre: '', emailOrTel: '', pass: '' });
  const [busquedaGuia, setBusquedaGuia] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');

  const [editandoNombrePerfil, setEditandoNombrePerfil] = useState(false);
  const [nuevoNombrePerfil, setNuevoNombrePerfil] = useState('');

  const [carruselIndices, setCarruselIndices] = useState({});
  const [tipoChatEquipo, setTipoChatEquipo] = useState('usuarios');

  const [todosLosUsuarios, setTodosLosUsuarios] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [especiesGuia, setEspeciesGuia] = useState([]);

  const [mensajesChat, setMensajesChat] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [imagenChat, setImagenChat] = useState(null);
  const [audioChatURL, setAudioChatURL] = useState(null);
  const [grabandoAudioChat, setGrabandoAudioChat] = useState(false);
  const [tiempoGrabacionChat, setTiempoGrabacionChat] = useState(0);

  const [chatRoomSeleccionado, setChatRoomSeleccionado] = useState(null);
  const chatScrollRef = useRef(null);
  const chatFileInputRef = useRef(null);
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

  const [usuario, setUsuario] = useState(() => {
    try {
      const sesionGuardada = localStorage.getItem('herpid_usuario_sesion_v32');
      if (sesionGuardada) return JSON.parse(sesionGuardada);
    } catch (e) {}
    return { isLoggedIn: false, id: null, nombre: '', email: '', rol: 'Usuario Regular' };
  });

  useEffect(() => {
    try {
      localStorage.setItem('herpid_usuario_sesion_v32', JSON.stringify(usuario));
    } catch (e) {}
  }, [usuario]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const emailLower = firebaseUser.email?.toLowerCase() || '';
        const esAdminMaster = emailLower === 'proquimicajcv@icloud.com';
        
        const userDocRef = doc(db, "usuarios", firebaseUser.uid);
        let rolGuardado = esAdminMaster ? 'Administrador General' : 'Usuario Regular';
        let nombreGuardado = esAdminMaster ? 'Jorge Carvajal' : (firebaseUser.displayName || emailLower.split('@')[0]);

        try {
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (!esAdminMaster && data.rol) rolGuardado = data.rol;
            if (data.nombre) nombreGuardado = data.nombre;
          }

          const userObj = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nombre: nombreGuardado,
            rol: rolGuardado,
            ultimoAcceso: new Date().toLocaleString(),
            ultimoConexion: Date.now()
          };

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
      } else {
        setUsuario({ isLoggedIn: false, id: null, nombre: '', email: '', rol: 'Usuario Regular' });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!usuario?.isLoggedIn || !usuario?.id) return;
    const userRef = doc(db, "usuarios", usuario.id);
    
    const actualizarLatido = () => {
      updateDoc(userRef, { ultimoConexion: Date.now() }).catch(() => {});
    };

    actualizarLatido();
    const interval = setInterval(actualizarLatido, 30000);
    return () => clearInterval(interval);
  }, [usuario?.isLoggedIn, usuario?.id]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const usersList = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      setTodosLosUsuarios(usersList);
    }, (err) => {});

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "avistamientos"), (snapshot) => {
      const lista = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      setRegistros(lista);
    }, (err) => {});

    return () => unsubscribe();
  }, []);

  const esAdminMaster = usuario?.isLoggedIn && (usuario.email?.toLowerCase() === 'proquimicajcv@icloud.com' || usuario.nombre === 'Jorge Carvajal');
  const esAdmin = usuario?.isLoggedIn && (usuario.rol?.includes('Administrador') || esAdminMaster);
  const esExperto = usuario?.isLoggedIn && usuario.rol?.includes('Experto');
  const esAdminOExperto = esAdmin || esExperto;

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "mensajes_chat"), (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      msgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      setMensajesChat(msgs);

      if (esAdminOExperto && msgs.length > 0) {
        const ultimoMsg = msgs[msgs.length - 1];
        const esDeUsuarioRegular = !ultimoMsg.esAdmin;
        const esAlertaMordedura = ultimoMsg.esEmergenciaMordedura || (ultimoMsg.texto && ultimoMsg.texto.includes("MORDEDURA DE SERPIENTE"));
        const esReciente = (Date.now() - (ultimoMsg.createdAt || 0)) < 30000;

        if (esDeUsuarioRegular && esAlertaMordedura && esReciente) {
          setAlertaMordeduraEntrante(ultimoMsg);
        }
      }
    }, (err) => {});

    return () => unsubscribe();
  }, [esAdminOExperto]);

  const especiesGuiaDefecto = [
    { nombre: 'Rana Calzonuda', especie: 'Agalychnis callidryas', tipo: 'Anfibio', esPeligroso: false, img: 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=500', desc: 'Emblemática rana de ojos rojos y costados azulados de los bosques húmedos.' },
    { nombre: 'Terciopelo', especie: 'Bothrops asper', tipo: 'Reptil', esPeligroso: true, img: 'https://images.unsplash.com/photo-1531386151447-fd76ad50012f?w=500', desc: 'Serpiente víbora venagüera de gran tamaño e importancia médica severa.' },
    { nombre: 'Garrita / Sapo del Pacífico', especie: 'Incilius aucoinae', tipo: 'Anfibio', esPeligroso: false, img: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500', desc: 'Sapo común de tierras bajas del Pacífico Sur costarricense.' },
    { nombre: 'Gallego / Basilisco Verde', especie: 'Basiliscus basiliscus', tipo: 'Reptil', esPeligroso: false, img: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=500', desc: 'Lagarto capaz de correr distancias cortas sobre el agua.' }
  ];

  const cargarGuiaNube = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "especies_guia"));
      const lista = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      
      if (lista.length === 0) {
        for (const esp of especiesGuiaDefecto) {
          await addDoc(collection(db, "especies_guia"), esp);
        }
        cargarGuiaNube();
      } else {
        setEspeciesGuia(lista);
      }
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

  const esPropietarioReporte = (reg) => {
    if (!usuario?.isLoggedIn) return false;
    return reg.userId === usuario.id || reg.userEmail === usuario.email || reg.reportante === usuario.nombre;
  };

  const chatsSalas = Array.from(new Set(mensajesChat
    .filter(m => m.chatRoomId !== 'equipo_interno_herpid')
    .map(m => m.chatRoomId)
  )).map(roomId => {
    const msgUser = mensajesChat.find(m => m.chatRoomId === roomId && !m.esAdmin);
    return {
      roomId,
      nombreUsuario: msgUser ? msgUser.usuarioNombre : 'Usuario',
      ultimoMensaje: mensajesChat.filter(m => m.chatRoomId === roomId).slice(-1)[0]
    };
  });

  const chatsPendientesCount = esAdminOExperto ? chatsSalas.filter(sala => {
    const ult = sala.ultimoMensaje;
    return ult && !ult.esAdmin;
  }).length : 0;

  const avistamientosPendientesCount = esAdminOExperto ? registros.filter(r => r.estado !== 'VALIDADO').length : 0;

  const registrosVisibles = esAdminOExperto 
    ? registros 
    : registros.filter(r => r.estado === 'VALIDADO' || esPropietarioReporte(r));

  const obtenerCoordsParaMapa = (coordsOriginales) => {
    if (!coordsOriginales || coordsOriginales.length < 2) return [9.65, -84.00];
    if (esAdmin) return coordsOriginales;
    return [
      Math.round(coordsOriginales[0] * 100) / 100,
      Math.round(coordsOriginales[1] * 100) / 100
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

  const cambiarRangoUsuario = async (userId, userEmail, nuevoRol) => {
    if (!esAdminMaster) return alert("⛔ Solo el Administrador General puede cambiar rangos.");
    if (userEmail?.toLowerCase() === 'proquimicajcv@icloud.com') {
      return alert("⛔ El rango del Administrador General está totalmente protegido.");
    }
    try {
      const userRef = doc(db, "usuarios", userId);
      await updateDoc(userRef, { rol: nuevoRol });
      alert(`¡Rango del usuario actualizado a: ${nuevoRol}!`);
    } catch (e) {
      alert("Error al actualizar rango del usuario.");
    }
  };

  const cambiarNombreUsuarioAdmin = async (userId, nombreActual) => {
    if (!esAdmin) return alert("⛔ Solo los Administradores pueden cambiar nombres de usuario.");
    const nuevoNombre = prompt("Ingrese el nuevo nombre para este usuario:", nombreActual);
    if (!nuevoNombre || !nuevoNombre.trim()) return;
    try {
      const userRef = doc(db, "usuarios", userId);
      await updateDoc(userRef, { nombre: nuevoNombre.trim() });
      alert("¡Nombre de usuario actualizado con éxito!");
    } catch (e) {
      alert("Error al actualizar el nombre del usuario.");
    }
  };

  const eliminarUsuarioRegular = async (userId, userEmail) => {
    if (!esAdmin) return alert("⛔ No tienes permisos para realizar esta acción.");
    if (userEmail?.toLowerCase() === 'proquimicajcv@icloud.com') {
      return alert("⛔ No se puede eliminar al Administrador General.");
    }
    if (!window.confirm("⚠️ ¿Estás seguro de eliminar permanentemente a este usuario regular del sistema?")) return;
    try {
      await deleteDoc(doc(db, "usuarios", userId));
      alert("🗑️ Usuario regular eliminado correctamente.");
    } catch (e) {
      alert("Error al eliminar el usuario de la base de datos.");
    }
  };

  const eliminarMensajeChatAdmin = async (msgId) => {
    if (!esAdmin) return alert("⛔ Solo los Administradores pueden eliminar mensajes del chat.");
    if (!window.confirm("⚠️ ¿Deseas eliminar este mensaje permanentemente?")) return;
    try {
      await deleteDoc(doc(db, "mensajes_chat", msgId));
      alert("🗑️ Mensaje eliminado correctamente.");
    } catch (e) {
      alert("Error al eliminar el mensaje.");
    }
  };

  const eliminarChatCompleto = async (roomId) => {
    if (!esAdmin) return alert("⛔ Solo los Administradores pueden eliminar conversaciones completas.");
    if (!window.confirm("⚠️ ¿Deseas eliminar todo este chat de consultas generales permanentemente?")) return;
    try {
      const msgsAEliminar = mensajesChat.filter(m => m.chatRoomId === roomId);
      for (const m of msgsAEliminar) {
        await deleteDoc(doc(db, "mensajes_chat", m.id));
      }
      alert("🗑️ Conversación eliminada correctamente.");
      if (chatRoomSeleccionado === roomId) {
        setChatRoomSeleccionado(null);
      }
    } catch (e) {
      alert("Error al eliminar la conversación.");
    }
  };

  const guardarNombrePerfil = async () => {
    if (!nuevoNombrePerfil.trim()) return alert("El nombre no puede estar vacío.");
    try {
      const userRef = doc(db, "usuarios", usuario.id);
      await updateDoc(userRef, { nombre: nuevoNombrePerfil.trim() });
      setUsuario({ ...usuario, nombre: nuevoNombrePerfil.trim() });
      setEditandoNombrePerfil(false);
      alert("¡Nombre actualizado correctamente!");
    } catch (e) {
      alert("Error al actualizar el nombre en la base de datos.");
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
    if (!usuario?.isLoggedIn) {
      alert("Debes iniciar sesión para interactuar en el chat.");
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
      await addDoc(collection(db, "mensajes_chat"), msgData);
      if (!textoPersonalizado) setNuevoMensaje('');
      setImagenChat(null);
      setAudioChatURL(null);

      if (esEmergencia) {
        alert("🚨 Alerta de mordedura enviada al equipo científico. Por favor, comunícate INMEDIATAMENTE con el 911.");
      }
    } catch (e) {
      alert("Error al enviar el mensaje.");
    }
  };

  const handleImagenChatUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const comprimida = await comprimirImagen(file);
      setImagenChat(comprimida);
    }
  };

  const [tipoFauna, setTipoFauna] = useState('Anfibio');
  const [silueta, setSilueta] = useState('Rana Arborícola');
  const [desconocido, setDesconocido] = useState(true);
  const [esPeligrosoReporte, setEsPeligrosoReporte] = useState(false);
  const [nombreCientifico, setNombreCientifico] = useState('');
  const [nombreComun, setNombreComun] = useState('');
  const [lat, setLat] = useState('9.650746');
  const [lng, setLng] = useState('-84.000193');
  const [posPin, setPosPin] = useState([9.650746, -84.000193]);
  const [comunidad, setComunidad] = useState('');
  const [estadoOrganismo, setEstadoOrganismo] = useState('Vivo / Activo');
  const [etapa, setEtapa] = useState('Adulto');
  const [temp, setTemp] = useState('21,5');
  const [altitud, setAltitud] = useState('1450');
  const [microhabitat, setMicrohabitat] = useState('Vegetación / Finca Cafetalera');
  const [fotosRegistro, setFotosRegistro] = useState([]);

  const [grabandoAudio, setGrabandoAudio] = useState(false);
  const [tiempoGrabacion, setTiempoGrabacion] = useState(0);
  const [audioURL, setAudioURL] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const abrirModalRegistro = () => {
    setTipoFauna('Anfibio');
    setSilueta('Rana Arborícola');
    setDesconocido(true);
    setEsPeligrosoReporte(false);
    setNombreCientifico('');
    setNombreComun('');
    setComunidad('');
    setEstadoOrganismo('Vivo / Activo');
    setEtapa('Adulto');
    setMicrohabitat('Vegetación / Finca Cafetalera');
    setFotosRegistro([]);
    setAudioURL(null);
    setErrorEnvio('');
    setModalRegistro(true);
  };

  const obtenerUbicacionGPS = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latGps = pos.coords.latitude.toFixed(6);
          const lngGps = pos.coords.longitude.toFixed(6);
          setLat(latGps);
          setLng(lngGps);
          setPosPin([pos.coords.latitude, pos.coords.longitude]);
          const altCalculada = Math.round(1200 + Math.abs(pos.coords.latitude - 9.65) * 10000);
          const altEstimada = Math.min(3820, Math.max(0, altCalculada));
          const tempEstimada = (25 - (altEstimada / 280)).toFixed(1).replace('.', ',');
          setTemp(tempEstimada);
          setAltitud(altEstimada.toString());
          alert('📍 GPS detectado correctamente.');
        },
        () => {
          alert('No se pudo obtener el GPS automáticamente. Puedes marcar el punto manualmente en el mapa.');
        }
      );
    } else {
      alert('Geolocalización no soportada en este navegador.');
    }
  };

  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
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

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabandoAudio) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setGrabandoAudio(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const comprimirImagen = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
    });
  };

  const handleFotosUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const procesadas = await Promise.all(files.map(comprimirImagen));
      setFotosRegistro([...fotosRegistro, ...procesadas].slice(0, 3));
    }
  };

  const guardarNuevaEspecieGuia = async () => {
    if (!esAdmin) return alert("⛔ Acción restringida a Administradores.");
    if (!formGuia.nombre || !formGuia.especie) {
      return alert('Debe completar al menos el Nombre Común y Nombre Científico.');
    }
    const nueva = {
      nombre: formGuia.nombre,
      especie: formGuia.especie,
      tipo: formGuia.tipo,
      esPeligroso: formGuia.esPeligroso,
      img: formGuia.img || 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=500',
      desc: formGuia.desc || 'Especie registrada en la guía oficial.'
    };
    try {
      await addDoc(collection(db, "especies_guia"), nueva);
      await cargarGuiaNube();
      alert('¡Especie agregada a la Guía Herpetológica!');
      setModalNuevaEspecieGuia(false);
      setFormGuia({ nombre: '', especie: '', tipo: 'Anfibio', esPeligroso: false, img: '', desc: '' });
    } catch (e) {
      alert('Error al guardar especie en la nube.');
    }
  };

  const guardarEdicionEspecieGuia = async () => {
    if (!esAdmin) return alert("⛔ Acción restringida a Administradores.");
    if (!especieGuiaEditando) return;
    try {
      const docRef = doc(db, "especies_guia", especieGuiaEditando.id);
      await updateDoc(docRef, {
        nombre: especieGuiaEditando.nombre,
        especie: especieGuiaEditando.especie,
        tipo: especieGuiaEditando.tipo,
        esPeligroso: especieGuiaEditando.esPeligroso || false,
        img: especieGuiaEditando.img,
        desc: especieGuiaEditando.desc
      });
      await cargarGuiaNube();
      alert('¡Ficha de la Guía actualizada!');
      setModalEditarEspecieGuia(false);
    } catch (e) {
      alert('Error al actualizar la ficha.');
    }
  };

  const eliminarEspecieGuia = async (id) => {
    if (!esAdmin) return alert("⛔ Acción restringida a Administradores.");
    if (!window.confirm("⚠️ ¿Estás seguro de eliminar esta especie de la Guía Herpetológica?")) return;
    try {
      await deleteDoc(doc(db, "especies_guia", id));
      await cargarGuiaNube();
      alert('🗑️ Especie eliminada de la guía.');
    } catch (e) {
      alert('Error al eliminar especie.');
    }
  };

  const cambiarEstadoReporte = async (id, nuevoEstado) => {
    if (!esAdminOExperto) return alert("⛔ Se requieren permisos de Experto o Administrador.");
    if (!id) return alert("Error: ID del registro no encontrado.");
    try {
      const docRef = doc(db, "avistamientos", id);
      await updateDoc(docRef, { estado: nuevoEstado });
      alert(`¡Estado guardado permanentemente en Firebase como: ${nuevoEstado}!`);
    } catch (e) {
      alert("Error al guardar el cambio en la nube.");
    }
  };

  const abrirEdicionModal = (reg) => {
    const esProp = esPropietarioReporte(reg);
    if (!esAdminOExperto && !esProp) return alert("⛔ Solo puedes editar tus propios reportes.");
    const fotoInicial = reg.fotoAutorizada || reg.img || (reg.fotos && reg.fotos[0]) || '';
    setRegistroEditando({ 
      ...reg, 
      fotoAutorizada: fotoInicial,
      latEdit: reg.coords?.[0] || 9.65,
      lngEdit: reg.coords?.[1] || -84.00
    });
    setModalEditar(true);
  };

  const guardarEdicionRegistro = async () => {
    if (!registroEditando || !registroEditando.id) return alert("Error: Registro sin ID válido.");
    const esProp = esPropietarioReporte(registroEditando);
    if (!esAdminOExperto && !esProp) return alert("⛔ No tienes permisos para editar este registro.");
    
    try {
      const docRef = doc(db, "avistamientos", registroEditando.id);
      const fotoElegida = registroEditando.fotoAutorizada || registroEditando.img || (registroEditando.fotos && registroEditando.fotos[0]) || '';
      
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
        fotoAutorizada: fotoElegida,
        img: fotoElegida,
        coords: nuevasCoords
      };

      await updateDoc(docRef, datosActualizados);
      alert('¡Reporte y ubicación corregidos con éxito en el mapa!');
      setModalEditar(false);
    } catch (e) {
      alert("Error al actualizar la base de datos.");
    }
  };

  const eliminarRegistro = async (id, reg) => {
    const esProp = reg ? esPropietarioReporte(reg) : false;
    if (!esAdminOExperto && !esProp) return alert("⛔ No tienes permisos para eliminar este registro.");
    if (!id) return alert("Error: ID del registro no válido.");
    if (!window.confirm("⚠️ ¿Deseas eliminar permanentemente este avistamiento?")) return;
    try {
      await deleteDoc(doc(db, "avistamientos", id));
      alert('🗑️ Registro eliminado de la base de datos.');
    } catch (e) {
      alert("Error al eliminar el registro.");
    }
  };

  const exportarCSV = () => {
    if (!esAdmin) return alert("⛔ Solo los Administradores pueden exportar datos.");
    if (registros.length === 0) return alert('No hay datos para exportar.');
    const headers = "ID,Nombre Comun,Especie,Categoria,Silueta,Estado,Ubicacion,Peligroso,Reportante,Latitud,Longitud,Temperatura,Altitud\n";
    const rows = registros.map(r => `${r.id},"${r.nombreComun}","${r.especie || 'N/A'}",${r.categoria || 'N/A'},${r.silueta},${r.estado},"${r.ubicacion}",${r.esPeligroso ? 'SI' : 'NO'},"${r.reportante}",${r.coords?.[0] || 'N/A'},${r.coords?.[1] || 'N/A'},${r.temp},${r.altitud}`).join("\n");
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(new Blob([headers + rows], { type: 'text/csv' }));
    a.download = `HerpID_CostaRica_Reportes.csv`;
    a.click();
  };

  const especiesFiltradasGuia = especiesGuia.filter(e => 
    (e.nombre && e.nombre.toLowerCase().includes(busquedaGuia.toLowerCase())) || 
    (e.especie && e.especie.toLowerCase().includes(busquedaGuia.toLowerCase()))
  );

  const registrosFiltradosAdmin = registros.filter(r => 
    (r.nombreComun && r.nombreComun.toLowerCase().includes(busquedaAdmin.toLowerCase())) ||
    (r.ubicacion && r.ubicacion.toLowerCase().includes(busquedaAdmin.toLowerCase()))
  );

  const obtenerCredencialFirebase = (input) => {
    const limpio = input.trim();
    if (limpio.toLowerCase() === 'proquimicajcv@icloud.com') return limpio.toLowerCase();
    if (limpio.includes('@')) return limpio.toLowerCase();
    const soloNumeros = limpio.replace(/\D/g, '');
    return `tel_${soloNumeros}@herpid.cr`;
  };

  const ejecutarLogin = async () => {
    const credencialInput = formLogin.emailOrTel.trim();
    const emailFinal = obtenerCredencialFirebase(credencialInput);
    const esAdminMail = emailFinal.toLowerCase() === 'proquimicajcv@icloud.com';

    try {
      const cred = await signInWithEmailAndPassword(auth, emailFinal, formLogin.pass);
      setUsuario({
        isLoggedIn: true,
        id: cred.user.uid,
        email: cred.user.email,
        nombre: esAdminMail ? 'Jorge Carvajal' : (cred.user.displayName || credencialInput),
        rol: esAdminMail ? 'Administrador General' : 'Usuario Regular'
      });
      setModalPerfil(false);
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
        alert('¡Bienvenido Administrador General!');
      } else {
        alert('Datos incorrectos. Revisa tu correo o número de celular e inténtalo de nuevo.');
      }
    }
  };

  const ejecutarRegistro = async () => {
    const credencialInput = formReg.emailOrTel.trim();
    const emailFinal = obtenerCredencialFirebase(credencialInput);
    const esAdminMail = emailFinal.toLowerCase() === 'proquimicajcv@icloud.com';

    try {
      const cred = await createUserWithEmailAndPassword(auth, emailFinal, formReg.pass);
      const nombreFinal = formReg.nombre || (esAdminMail ? 'Jorge Carvajal' : credencialInput);
      setUsuario({
        isLoggedIn: true,
        id: cred.user.uid,
        email: emailFinal,
        nombre: nombreFinal,
        rol: esAdminMail ? 'Administrador General' : 'Usuario Regular'
      });
      alert('¡Cuenta creada correctamente!');
      setModalPerfil(false);
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
      } else {
        alert('Error al registrar. Es posible que el correo o teléfono ya esté registrado.');
      }
    }
  };

  const activeRoomId = esAdminOExperto 
    ? (tipoChatEquipo === 'interno' ? 'equipo_interno_herpid' : (chatRoomSeleccionado || (chatsSalas[0]?.roomId || usuario.id)))
    : usuario.id;

  const mensajesFiltrados = mensajesChat.filter(m => m.chatRoomId === activeRoomId);

  const misReportes = registros.filter(r => r.userId === usuario.id || r.reportante === usuario.nombre || (usuario.email && r.userEmail === usuario.email));
  const misValidados = misReportes.filter(r => r.estado === 'VALIDADO').length;
  const misPendientes = misReportes.filter(r => r.estado !== 'VALIDADO').length;

  return (
    <div style={{ backgroundColor: '#070D0B', color: '#E0E6E3', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', paddingBottom: '90px' }}>
      
      <header style={{ backgroundColor: '#0B1512', padding: '0.9rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #162B23' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{ background: '#0D2E21', border: '2px solid #00FF88', borderRadius: '50%', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.6rem' }}>🐸</span>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.15rem', color: '#00FF88', fontWeight: '900' }}>HerpID Costa Rica</h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.65rem', color: '#7AA394', fontWeight: 'bold' }}>PLATAFORMA CIENTÍFICA</p>
              <span style={{ fontSize: '0.65rem', color: '#00FF88', fontWeight: '900', backgroundColor: '#0D2E21', padding: '1px 6px', borderRadius: '4px', border: '1px solid #00FF88' }}>
                Elaborado por: JCV
              </span>
            </div>
          </div>
        </div>
        
        <button onClick={() => { setVistaPerfil(usuario?.isLoggedIn ? 'perfil' : 'login'); setModalPerfil(true); }} style={{ backgroundColor: usuario?.isLoggedIn ? '#00C853' : '#102E23', color: usuario?.isLoggedIn ? '#000' : '#00FF88', border: '1.5px solid #00FF88', padding: '0.45rem 0.9rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer' }}>
          {usuario?.isLoggedIn ? `${esAdmin ? '🛡️' : (esExperto ? '🔬' : '👤')} ${usuario.nombre}` : '🔑 INICIAR SESIÓN'}
        </button>
      </header>

      {tab === 'mapa' && (
        <div style={{ position: 'relative', height: 'calc(100vh - 145px)', width: '100%' }}>
          <MapContainer center={[9.650565, -84.000236]} zoom={9} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
            {registrosVisibles.map((reg) => {
              const fotosLista = reg.fotos && reg.fotos.length > 0 ? reg.fotos : [reg.fotoAutorizada || reg.img].filter(Boolean);
              const currentIndex = carruselIndices[reg.id] || 0;
              const fotoAMostrar = fotosLista[currentIndex] || fotosLista[0];
              const posicionFiltro = obtenerCoordsParaMapa(reg.coords);
              const esProp = esPropietarioReporte(reg);

              return (
                <Marker key={reg.id} position={posicionFiltro} icon={crearIconoPersonalizado(reg.silueta, reg.estado, reg.esPeligroso)}>
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

                      <span style={{ fontSize: '0.75rem', color: '#7AA394' }}>👤 {reg.reportante}</span><br />
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: reg.estado === 'VALIDADO' ? '#00A843' : '#D9822B' }}>● {reg.estado}</span>
                      {reg.audioURL && (
                        <div style={{ marginTop: '5px' }}>
                          <audio src={reg.audioURL} controls style={{ width: '100%', height: '28px' }} />
                        </div>
                      )}
                      {(esAdminOExperto || esProp) && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'center' }}>
                          <button onClick={() => abrirEdicionModal(reg)} style={{ background: '#0288D1', color: '#FFF', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>✏️ Editar</button>
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
            <button onClick={() => { if (!usuario?.isLoggedIn) { setVistaPerfil('login'); setModalPerfil(true); } else abrirModalRegistro(); }} style={{ backgroundColor: '#00C853', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>+ Nuevo Reporte</button>
          </div>
          {registrosVisibles.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8AA398', marginTop: '3rem' }}>
              🔬 No hay avistamientos validados públicamente por los expertos todavía.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.2rem' }}>
              {registrosVisibles.map((reg) => {
                const fotosLista = reg.fotos && reg.fotos.length > 0 ? reg.fotos : [reg.fotoAutorizada || reg.img].filter(Boolean);
                const currentIndex = carruselIndices[reg.id] || 0;
                const fotoActual = fotosLista[currentIndex] || fotosLista[0] || 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=500';
                const esProp = esPropietarioReporte(reg);

                return (
                  <div key={reg.id} style={{ backgroundColor: '#0F1A16', borderRadius: '14px', overflow: 'hidden', border: reg.esPeligroso ? '2px solid #FF5252' : '1px solid #1B2E27' }}>
                    
                    <div style={{ position: 'relative', width: '100%', height: '200px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={fotoActual} alt={reg.nombreComun} onClick={() => setLightboxData({ fotos: fotosLista, index: currentIndex })} style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }} title="Click para ampliar carrusel" />
                      
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
                          ⚠️ ALERTA: ESPECIE VENENOSA
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: reg.estado === 'VALIDADO' ? '#00FF88' : '#FFC107', fontWeight: 'bold' }}>● {reg.estado}</span>
                        <span style={{ fontSize: '0.75rem', color: '#6A8A7D' }}>{reg.horaRegistro || 'Reciente'}</span>
                      </div>
                      <h3 style={{ margin: '0.4rem 0 0.2rem 0', color: '#FFF' }}>{reg.nombreComun}</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#00FF88', fontStyle: 'italic' }}>{reg.especie}</p>
                      <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem', color: '#8AA398' }}>📍 {reg.ubicacion}</p>
                      <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#00FF88', fontWeight: 'bold' }}>👤 Reportado por: {reg.reportante || 'Anónimo'}</p>

                      {(esAdminOExperto || esProp) && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                          <button onClick={() => abrirEdicionModal(reg)} style={{ flex: 1, padding: '0.4rem', backgroundColor: '#0288D1', color: '#FFF', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Editar</button>
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
                <strong style={{ fontSize: '0.8rem', color: '#8AA398', display: 'block', marginBottom: '0.6rem' }}>Conversaciones Activas:</strong>
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
                            {sala.ultimoMensaje?.texto || (sala.ultimoMensaje?.imagen ? '📷 [Foto]' : (sala.ultimoMensaje?.audio ? '🎙️ [Audio]' : 'Nuevo chat'))}
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
                      ? '👥 Canal Privado: Equipo Científico (Admin & Expertos)' 
                      : (esAdminOExperto ? `Chat con: ${mensajesChat.find(m => m.chatRoomId === activeRoomId)?.usuarioNombre || 'Usuario'}` : '🎧 Consulta Técnica Directa')}
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#7AA394' }}>
                    {tipoChatEquipo === 'interno' ? 'Espacio de coordinación interna exclusivo para validaciones' : 'Respuesta en tiempo real del equipo científico'}
                  </p>
                </div>
              </div>

              <div style={{ backgroundColor: '#070D0B', padding: '0.5rem', borderBottom: '1px solid #162B23', display: 'flex', gap: '0.4rem', overflowX: 'auto' }}>
                <button 
                  onClick={() => enviarMensajeChat("🚨 EMERGENCIA - MORDEDURA DE SERPIENTE: 1) Mantenga la calma y aléjese del animal. 2) Inmovilice el área afectada. 3) Comuníquese INMEDIATAMENTE al 911 o acuda al centro de salud más cercano. NO realice torniquetes ni cortes.", true)} 
                  style={{ backgroundColor: '#FF1744', color: '#FFF', border: '1px solid #FF5252', padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '900', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 0 10px rgba(255,23,68,0.7)' }}>
                  🚨 MORDEDURA DE SERPIENTE (Comuníquese al 911)
                </button>
                <button 
                  onClick={() => enviarMensajeChat("🚨 ALERTA DE SEGURIDAD: Espécimen potencialmente peligroso / venenoso. Mantenga distancia de seguridad, no intente capturarlo ni acorralarlo.")} 
                  style={{ backgroundColor: '#3A0D11', color: '#FF5252', border: '1px solid #FF5252', padding: '0.35rem 0.7rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🚨 Alerta de Riesgo
                </button>
                <button 
                  onClick={() => enviarMensajeChat("🚑 PROTOCOLO DE MORDEDURA: 1) Mantenga la calma. 2) Inmovilice el área afectada. 3) Traslade inmediatamente al centro de salud. NO realice torniquetes ni cortes.")} 
                  style={{ backgroundColor: '#2E1C05', color: '#FFB300', border: '1px solid #FFB300', padding: '0.35rem 0.7rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🚑 Protocolo Mordedura
                </button>
                <button 
                  onClick={() => enviarMensajeChat("📞 CONTACTO DE EMERGENCIA: Si hay riesgo para personas o viviendas en Costa Rica, comuníquese de inmediato al 911 o al Benemérito Cuerpo de Bomberos.")} 
                  style={{ backgroundColor: '#102E23', color: '#00FF88', border: '1px solid #00FF88', padding: '0.35rem 0.7rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  📞 Contactar al 911
                </button>
              </div>

              <div ref={chatScrollRef} style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {mensajesFiltrados.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6A8A7D', marginTop: '2rem', fontSize: '0.85rem' }}>
                    {tipoChatEquipo === 'interno' ? '👥 ¡Canal interno abierto! Comienza a coordinar con los administradores y expertos.' : '👋 ¡Hola! Escribe tus dudas, presiona 📷 para fotos o 🎙️ para audios.'}
                  </div>
                ) : (
                  mensajesFiltrados.map((m) => {
                    const esMio = usuario?.isLoggedIn && m.senderId === usuario.id;
                    const esAlertaResaltada = m.texto && (m.texto.includes("🚨") || m.texto.includes("🚑") || m.texto.includes("ALERTA") || m.esEmergenciaMordedura);
                    
                    return (
                      <div key={m.id} style={{ alignSelf: esMio ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <div style={{ fontSize: '0.68rem', color: '#7AA394', marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                          <strong style={{ color: m.esAdmin ? '#00FF88' : '#FFF' }}>
                            {m.senderNombre} {m.senderRol ? `(${m.senderRol})` : ''} • {m.hora}
                          </strong>
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
                  onClick={() => chatFileInputRef.current?.click()} 
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
                  placeholder={usuario?.isLoggedIn ? "Escribe un mensaje, foto o audio..." : "Inicia sesión para escribir..."} 
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

      {tab === 'admin' && (
        !esAdminOExperto ? (
          <div style={{ padding: '3rem 1.5rem', maxWidth: '500px', margin: '3rem auto', textAlign: 'center', backgroundColor: '#0F1A16', borderRadius: '16px', border: '1.5px solid #FF5252' }}>
            <span style={{ fontSize: '3.5rem' }}>🔒</span>
            <h2 style={{ color: '#FF5252', margin: '0.8rem 0 0.4rem 0' }}>Acceso Restringido</h2>
            <p style={{ color: '#8AA398', fontSize: '0.9rem' }}>Este módulo es exclusivo para **Administradores** y **Expertos**.</p>
            <button onClick={() => setTab('mapa')} style={{ backgroundColor: '#00E676', color: '#000', border: 'none', padding: '0.7rem 1.4rem', borderRadius: '20px', fontWeight: 'bold', marginTop: '1.2rem', cursor: 'pointer' }}>Volver al Mapa</button>
          </div>
        ) : (
          <div style={{ padding: '1.2rem', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div>
                <h2 style={{ color: '#00FF88', margin: 0 }}>🛡️ Panel de Revisión ({usuario.rol})</h2>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#8AA398' }}>Sesión activa: {usuario.nombre}</p>
              </div>
              {esAdmin && (
                <button onClick={exportarCSV} style={{ backgroundColor: '#00E676', color: '#000', border: 'none', padding: '0.6rem 1.1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📥 Exportar CSV</button>
              )}
            </div>

            {esAdmin && (
              <div style={{ backgroundColor: '#0F1A16', padding: '1.2rem', borderRadius: '14px', border: '1.5px solid #00FF88', marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#00FF88', margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🟢 Usuarios Conectados en Tiempo Real
                </h3>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#8AA398' }}>Lista de usuarios activos en la plataforma en los últimos 2 minutos.</p>

                {(() => {
                  const dosMinutosAtras = Date.now() - 120000;
                  const conectados = todosLosUsuarios.filter(u => u.ultimoConexion && u.ultimoConexion > dosMinutosAtras);

                  if (conectados.length === 0) {
                    return <p style={{ fontSize: '0.8rem', color: '#6A8A7D', margin: 0 }}>No hay otros usuarios activos en este momento.</p>;
                  }

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.8rem' }}>
                      {conectados.map(u => (
                        <div key={u.id} style={{ backgroundColor: '#050A08', padding: '0.7rem', borderRadius: '10px', border: '1px solid #1B3D2F', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ width: '10px', height: '10px', backgroundColor: '#00FF88', borderRadius: '50%', boxShadow: '0 0 8px #00FF88', display: 'inline-block' }}></span>
                          <div style={{ overflow: 'hidden' }}>
                            <strong style={{ color: '#FFF', fontSize: '0.85rem', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || 'Usuario'}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#7AA394' }}>{u.rol || 'Usuario Regular'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
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
                    
                    <div style={{ backgroundColor: '#09130F', padding: '1rem', borderRadius: '12px', border: '1.5px solid #C0C0C0' }}>
                      <h4 style={{ color: '#C0C0C0', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🛡️ Administradores ({todosLosUsuarios.filter(u => u.rol?.includes('Administrador') || u.email?.toLowerCase() === 'proquimicajcv@icloud.com').length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {todosLosUsuarios
                          .filter(u => u.rol?.includes('Administrador') || u.email?.toLowerCase() === 'proquimicajcv@icloud.com')
                          .sort((a, b) => {
                            const esA = a.email?.toLowerCase() === 'proquimicajcv@icloud.com' || a.nombre === 'Jorge Carvajal';
                            const esB = b.email?.toLowerCase() === 'proquimicajcv@icloud.com' || b.nombre === 'Jorge Carvajal';
                            if (esA) return -1;
                            if (esB) return 1;
                            return 0;
                          })
                          .map((u) => {
                            const esAdminGeneral = u.email?.toLowerCase() === 'proquimicajcv@icloud.com' || u.nombre === 'Jorge Carvajal';
                            const userReportes = registros.filter(r => r.userId === u.id || r.userEmail === u.email || r.reportante === u.nombre);
                            const userValidados = userReportes.filter(r => r.estado === 'VALIDADO').length;

                            return (
                              <div key={u.id} style={{ backgroundColor: '#050A08', padding: '0.8rem 1rem', borderRadius: '10px', border: esAdminGeneral ? '1.5px solid #FFD700' : '1px solid #C0C0C0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                                <div>
                                  <strong style={{ color: '#FFF', fontSize: '0.95rem' }}>{u.nombre || 'Usuario'}</strong>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#7AA394' }}>✉️ {u.email?.includes('@herpid.cr') ? `Celular: ${u.email.replace('tel_', '').replace('@herpid.cr', '')}` : u.email}</span>
                                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', backgroundColor: '#0D2E21', color: '#00FF88', padding: '2px 7px', borderRadius: '6px', fontWeight: 'bold' }}>📊 Reportes: {userReportes.length}</span>
                                    <span style={{ fontSize: '0.72rem', color: '#8AA398' }}>(✓ {userValidados} Validados / ⏳ {userReportes.length - userValidados} Pendientes)</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button onClick={() => cambiarNombreUsuarioAdmin(u.id, u.nombre)} style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Cambiar Nombre</button>
                                  {esAdminGeneral ? (
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
                          })
                        }
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#09130F', padding: '1rem', borderRadius: '12px', border: '1.5px solid #0288D1' }}>
                      <h4 style={{ color: '#0288D1', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🔬 Expertos Herpetólogos ({todosLosUsuarios.filter(u => u.rol?.includes('Experto')).length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {todosLosUsuarios.filter(u => u.rol?.includes('Experto')).length === 0 ? (
                          <p style={{ fontSize: '0.75rem', color: '#6A8A7D', margin: 0 }}>No hay expertos asignados actualmente.</p>
                        ) : (
                          todosLosUsuarios.filter(u => u.rol?.includes('Experto')).map((u) => {
                            const userReportes = registros.filter(r => r.userId === u.id || r.userEmail === u.email || r.reportante === u.nombre);
                            const userValidados = userReportes.filter(r => r.estado === 'VALIDADO').length;

                            return (
                              <div key={u.id} style={{ backgroundColor: '#050A08', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #0288D1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                                <div>
                                  <strong style={{ color: '#FFF', fontSize: '0.95rem' }}>{u.nombre || 'Usuario'}</strong>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#7AA394' }}>✉️ {u.email?.includes('@herpid.cr') ? `Celular: ${u.email.replace('tel_', '').replace('@herpid.cr', '')}` : u.email}</span>
                                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', backgroundColor: '#0D2E21', color: '#00FF88', padding: '2px 7px', borderRadius: '6px', fontWeight: 'bold' }}>📊 Reportes: {userReportes.length}</span>
                                    <span style={{ fontSize: '0.72rem', color: '#8AA398' }}>(✓ {userValidados} Validados / ⏳ {userReportes.length - userValidados} Pendientes)</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button onClick={() => cambiarNombreUsuarioAdmin(u.id, u.nombre)} style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Cambiar Nombre</button>
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

                    <div style={{ backgroundColor: '#09130F', padding: '1rem', borderRadius: '12px', border: '1.5px solid #CD7F32' }}>
                      <h4 style={{ color: '#CD7F32', margin: '0 0 0.8rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        👤 Usuarios Regulares ({todosLosUsuarios.filter(u => !u.rol?.includes('Administrador') && !u.rol?.includes('Experto') && u.email?.toLowerCase() !== 'proquimicajcv@icloud.com').length})
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {todosLosUsuarios.filter(u => !u.rol?.includes('Administrador') && !u.rol?.includes('Experto') && u.email?.toLowerCase() !== 'proquimicajcv@icloud.com').length === 0 ? (
                          <p style={{ fontSize: '0.75rem', color: '#6A8A7D', margin: 0 }}>No hay usuarios regulares adicionales.</p>
                        ) : (
                          todosLosUsuarios.filter(u => !u.rol?.includes('Administrador') && !u.rol?.includes('Experto') && u.email?.toLowerCase() !== 'proquimicajcv@icloud.com').map((u) => {
                            const userReportes = registros.filter(r => r.userId === u.id || r.userEmail === u.email || r.reportante === u.nombre);
                            const userValidados = userReportes.filter(r => r.estado === 'VALIDADO').length;

                            return (
                              <div key={u.id} style={{ backgroundColor: '#050A08', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #CD7F32', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
                                <div>
                                  <strong style={{ color: '#FFF', fontSize: '0.95rem' }}>{u.nombre || 'Usuario'}</strong>
                                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#7AA394' }}>✉️ {u.email?.includes('@herpid.cr') ? `Celular: ${u.email.replace('tel_', '').replace('@herpid.cr', '')}` : u.email}</span>
                                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.72rem', backgroundColor: '#0D2E21', color: '#00FF88', padding: '2px 7px', borderRadius: '6px', fontWeight: 'bold' }}>📊 Reportes: {userReportes.length}</span>
                                    <span style={{ fontSize: '0.72rem', color: '#8AA398' }}>(✓ {userValidados} Validados / ⏳ {userReportes.length - userValidados} Pendientes)</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <button onClick={() => cambiarNombreUsuarioAdmin(u.id, u.nombre)} style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Cambiar Nombre</button>
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

            <h3>Gestión de Avistamientos (Con coordenadas completas GPS):</h3>
            {registrosFiltradosAdmin.map((reg) => {
              const fotoPrevia = reg.fotoAutorizada || reg.img || (reg.fotos && reg.fotos[0]);
              const esPendiente = reg.estado !== 'VALIDADO';
              return (
                <div key={reg.id} style={{ backgroundColor: '#0F1A16', padding: '0.8rem 1rem', borderRadius: '14px', border: esPendiente ? '1.5px solid #FF1744' : '1px solid #1B3D2F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    {fotoPrevia && (
                      <img src={fotoPrevia} alt={reg.nombreComun} onClick={() => setLightboxData({ fotos: [fotoPrevia], index: 0 })} style={{ width: '60px', height: '60px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '8px', border: '1px solid #1B3D2F', cursor: 'pointer' }} title="Click para ampliar imagen" />
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
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => cambiarEstadoReporte(reg.id, 'VALIDADO')} style={{ backgroundColor: '#00C853', color: '#000', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✓ Validar</button>
                    <button onClick={() => abrirEdicionModal(reg)} style={{ backgroundColor: '#0288D1', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>✏️ Editar</button>
                    <button onClick={() => eliminarRegistro(reg.id, reg)} style={{ backgroundColor: '#D32F2F', color: '#FFF', border: 'none', padding: '0.45rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️ Borrar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
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
                  📸 Toca una imagen para Autorizarla como la Foto Oficial Pública:
                </label>
                
                <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto' }}>
                  {(registroEditando.fotos && registroEditando.fotos.length > 0 ? registroEditando.fotos : [registroEditando.img || 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=500']).map((fotoSrc, idx) => {
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
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Nombre Común:</label>
                <input type="text" value={registroEditando.nombreComun || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, nombreComun: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Nombre Científico / Especie:</label>
                <input type="text" value={registroEditando.especie || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, especie: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Categoría de Fauna:</label>
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
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Silueta / Tipo:</label>
                <select value={registroEditando.silueta || 'Rana Arborícola'} onChange={(e) => setRegistroEditando({ ...registroEditando, silueta: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px' }}>
                  {opcionesPorCategoria[(registroEditando.categoria || 'ANFIBIO').toLowerCase() === 'reptil' ? 'Reptil' : 'Anfibio'].map((op) => (
                    <option key={op.id} value={op.id}>{op.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ color: '#8AA398', fontSize: '0.75rem', fontWeight: 'bold' }}>Cantón y Ubicación (Autodetecta coordenadas):</label>
              <input 
                type="text" 
                value={registroEditando.ubicacion || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  const cantonMatch = buscarCantonEnTexto(val);
                  setRegistroEditando({ 
                    ...registroEditando, 
                    ubicacion: val,
                    ...(cantonMatch ? {
                      latEdit: cantonMatch.coords[0],
                      lngEdit: cantonMatch.coords[1],
                      altitud: `${cantonMatch.alt} msnm`,
                      temp: `${cantonMatch.temp} °C`
                    } : {})
                  });
                }} 
                style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #00FF88', borderRadius: '8px', boxSizing: 'border-box' }} 
              />
            </div>

            <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '10px', border: '1px solid #00FF88', marginBottom: '0.8rem' }}>
              <label style={{ color: '#00FF88', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>
                📍 Corrección Manual de Coordenadas GPS:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#8AA398' }}>Latitud:</span>
                  <input 
                    type="number" 
                    step="0.0001" 
                    value={registroEditando.latEdit ?? 9.65} 
                    onChange={(e) => setRegistroEditando({ ...registroEditando, latEdit: e.target.value })} 
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#09130F', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '6px', boxSizing: 'border-box' }} 
                  />
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#8AA398' }}>Longitud:</span>
                  <input 
                    type="number" 
                    step="0.0001" 
                    value={registroEditando.lngEdit ?? -84.00} 
                    onChange={(e) => setRegistroEditando({ ...registroEditando, lngEdit: e.target.value })} 
                    style={{ width: '100%', padding: '0.5rem', backgroundColor: '#09130F', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '6px', boxSizing: 'border-box' }} 
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Microhábitat:</label>
                <select value={registroEditando.microhabitat || 'Vegetación / Finca Cafetalera'} onChange={(e) => setRegistroEditando({ ...registroEditando, microhabitat: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px' }}>
                  <option value="Vegetación / Finca Cafetalera">🌿 Vegetación / Finca Cafetalera</option>
                  <option value="Sobre / bajo Roca">🪨 Sobre / bajo Roca</option>
                  <option value="Cuerpo de Agua / Río">🌊 Cuerpo de Agua / Río</option>
                  <option value="Suelo / Hojarasca">🍂 Suelo / Hojarasca</option>
                  <option value="Estructura Humana / Casa">🏠 Estructura Humana</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Estado de Vida / Etapa:</label>
                <input type="text" value={registroEditando.estadoVida || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, estadoVida: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Temperatura:</label>
                <input type="text" value={registroEditando.temp || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, temp: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Altitud:</label>
                <input type="text" value={registroEditando.altitud || ''} onChange={(e) => setRegistroEditando({ ...registroEditando, altitud: e.target.value })} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ color: '#FF5252', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                <input type="checkbox" checked={registroEditando.esPeligroso || false} onChange={(e) => setRegistroEditando({ ...registroEditando, esPeligroso: e.target.checked })} />
                ⚠️ Especie Venenosa / Peligro Médico
              </label>
            </div>

            {esAdminOExperto && (
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Estado de Validación:</label>
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
            
            <label style={{ color: '#8AA398', fontSize: '0.8rem' }}>Categoría:</label>
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

      {modalPerfil && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#09130F', borderRadius: '16px', border: '1px solid #1B3D2F', width: '100%', maxWidth: '420px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
              <h3 style={{ color: '#FFF', margin: 0 }}>{usuario?.isLoggedIn ? '👤 Mi Perfil' : (vistaPerfil === 'login' ? '🔑 Iniciar Sesión' : '📝 Crear Cuenta')}</h3>
              <button onClick={() => setModalPerfil(false)} style={{ background: 'transparent', border: 'none', color: '#FFF', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
            </div>

            {usuario?.isLoggedIn ? (
              <div style={{ textAlign: 'center' }}>
                
                {!editandoNombrePerfil ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                    <h2 style={{ color: '#00FF88', margin: 0 }}>{usuario.nombre}</h2>
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
                  🔒 {usuario.email?.includes('@herpid.cr') ? `Celular: ${usuario.email.replace('tel_', '').replace('@herpid.cr', '')}` : `Correo: ${usuario.email}`}
                </p>

                <div style={{ backgroundColor: '#0F2B20', color: '#00FF88', padding: '0.5rem', borderRadius: '10px', fontWeight: 'bold', margin: '1rem 0', border: '1px solid #00FF88' }}>{usuario.rol}</div>

                <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '10px', border: '1px solid #1B3D2F', margin: '1rem 0', textAlign: 'left' }}>
                  <strong style={{ color: '#00FF88', fontSize: '0.85rem' }}>📊 Mi Historial de Avistamientos:</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.6rem', textAlign: 'center' }}>
                    <div style={{ background: '#0D2E21', padding: '0.5rem', borderRadius: '6px' }}>
                      <span style={{ color: '#FFF', fontWeight: 'bold', fontSize: '1.1rem' }}>{misReportes.length}</span>
                      <span style={{ display: 'block', fontSize: '0.65rem', color: '#7AA394' }}>Enviados</span>
                    </div>
                    <div style={{ background: '#0D2E21', padding: '0.5rem', borderRadius: '6px' }}>
                      <span style={{ color: '#00FF88', fontWeight: 'bold', fontSize: '1.1rem' }}>{misValidados}</span>
                      <span style={{ display: 'block', fontSize: '0.65rem', color: '#7AA394' }}>Validados</span>
                    </div>
                    <div style={{ background: '#0D2E21', padding: '0.5rem', borderRadius: '6px' }}>
                      <span style={{ color: '#FFC107', fontWeight: 'bold', fontSize: '1.1rem' }}>{misPendientes}</span>
                      <span style={{ display: 'block', fontSize: '0.65rem', color: '#7AA394' }}>Pendientes</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.72rem', color: '#00FF88', fontWeight: 'bold', marginTop: '0.8rem' }}>
                  HerpID Costa Rica • Elaborado por: JCV
                </p>

                <button onClick={async () => { await signOut(auth); localStorage.removeItem('herpid_usuario_sesion_v32'); setUsuario({ isLoggedIn: false, rol: 'Usuario Regular' }); setModalPerfil(false); }} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#f44336', color: '#FFF', border: '1px solid #00FF88', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cerrar Sesión</button>
              </div>
            ) : vistaPerfil === 'login' ? (
              <div>
                <input type="text" placeholder="Correo electrónico o Celular (ej. 88887777)" value={formLogin.emailOrTel} onChange={(e) => setFormLogin({ ...formLogin, emailOrTel: e.target.value })} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.9rem', boxSizing: 'border-box' }} />
                <input type="password" placeholder="Contraseña" value={formLogin.pass} onChange={(e) => setFormLogin({ ...formLogin, pass: e.target.value })} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.9rem', boxSizing: 'border-box' }} />
                <button onClick={ejecutarLogin} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Ingresar</button>
                <button onClick={() => setVistaPerfil('registro')} style={{ width: '100%', background: 'transparent', color: '#00FF88', border: 'none', marginTop: '1rem', cursor: 'pointer', textDecoration: 'underline' }}>¿No tienes cuenta? Regístrate aquí</button>
              </div>
            ) : (
              <div>
                <input type="text" placeholder="Tu nombre completo" value={formReg.nombre} onChange={(e) => setFormReg({ ...formReg, nombre: e.target.value })} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.9rem', boxSizing: 'border-box' }} />
                <input type="text" placeholder="Correo electrónico o Celular (+506...)" value={formReg.emailOrTel} onChange={(e) => setFormReg({ ...formReg, emailOrTel: e.target.value })} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.9rem', boxSizing: 'border-box' }} />
                <input type="password" placeholder="Contraseña (mínimo 6 caracteres)" value={formReg.pass} onChange={(e) => setFormReg({ ...formReg, pass: e.target.value })} style={{ width: '100%', padding: '0.75rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginBottom: '0.9rem', boxSizing: 'border-box' }} />
                <button onClick={ejecutarRegistro} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>Crear Cuenta</button>
                <button onClick={() => setVistaPerfil('login')} style={{ width: '100%', background: 'transparent', color: '#8AA398', border: 'none', marginTop: '0.8rem', cursor: 'pointer' }}>← Volver a Iniciar Sesión</button>
              </div>
            )}
          </div>
        </div>
      )}

      {modalRegistro && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#09130F', borderRadius: '16px', border: '1px solid #1B3D2F', width: '100%', maxWidth: '560px', padding: '1.2rem', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#00FF88', margin: '0 0 1rem 0' }}>🐸 Registrar Nuevo Avistamiento</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Categoría de Fauna:</label>
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
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Silueta / Tipo:</label>
                <select value={silueta} onChange={(e) => {
                  const val = e.target.value;
                  setSilueta(val);
                  if (val === 'Serpiente') setEsPeligrosoReporte(true);
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

            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ color: '#8AA398', fontSize: '0.75rem', fontWeight: 'bold' }}>* Cantón y Ubicación exactos (Autodetecta mapa):</label>
              <input 
                type="text" 
                placeholder="Ej. Zarcero, Tarrazú, Dota..." 
                value={comunidad} 
                onChange={(e) => { 
                  const val = e.target.value;
                  setComunidad(val); 
                  setErrorEnvio(''); 
                  const cantonMatch = buscarCantonEnTexto(val);
                  if (cantonMatch) {
                    setLat(cantonMatch.coords[0].toFixed(6));
                    setLng(cantonMatch.coords[1].toFixed(6));
                    setPosPin(cantonMatch.coords);
                    setAltitud(cantonMatch.alt);
                    setTemp(cantonMatch.temp);
                  }
                }} 
                style={{ width: '100%', padding: '0.65rem', backgroundColor: '#050A08', color: '#FFF', border: comunidad ? '1px solid #00FF88' : '1px solid #FF5252', borderRadius: '8px', marginTop: '0.2rem', boxSizing: 'border-box' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Microhábitat:</label>
                <select value={microhabitat} onChange={(e) => setMicrohabitat(e.target.value)} style={{ width: '100%', padding: '0.6rem', backgroundColor: '#050A08', color: '#FFF', border: '1px solid #1B3D2F', borderRadius: '8px', marginTop: '0.2rem' }}>
                  <option value="Vegetación / Finca Cafetalera">🌿 Vegetación / Finca Cafetalera</option>
                  <option value="Sobre / bajo Roca">🪨 Sobre / bajo Roca</option>
                  <option value="Cuerpo de Agua / Río">🌊 Cuerpo de Agua / Río</option>
                  <option value="Suelo / Hojarasca">🍂 Suelo / Hojarasca</option>
                  <option value="Estructura Humana / Casa">🏠 Estructura Humana</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#8AA398', fontSize: '0.75rem' }}>Etapa y Estado:</label>
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
              <button onClick={obtenerUbicacionGPS} type="button" style={{ width: '100%', padding: '0.5rem', backgroundColor: '#102E23', color: '#00FF88', border: '1px solid #00FF88', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                📍 Obtener mi ubicación actual (GPS)
              </button>

              <div style={{ height: '170px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #1B3D2F' }}>
                <MapContainer center={posPin} zoom={11} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                  <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
                  <Marker position={posPin} icon={iconoAlfilerRojo} />
                  <EventoMapaPin setLat={setLat} setLng={setLng} setPosPin={setPosPin} setTemp={setTemp} setAltitud={setAltitud} />
                </MapContainer>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <input type="text" value={`Temp: ${temp} °C`} readOnly style={{ flex: 1, padding: '0.5rem', backgroundColor: '#050A08', color: '#00FF88', border: '1px solid #1B3D2F', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem' }} />
              <input type="text" value={`Altitud: ${altitud} msnm`} readOnly style={{ flex: 1, padding: '0.5rem', backgroundColor: '#050A08', color: '#00FF88', border: '1px solid #1B3D2F', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem' }} />
            </div>

            <div style={{ backgroundColor: '#050A08', padding: '0.8rem', borderRadius: '10px', border: '1px solid #1B3D2F', marginBottom: '0.8rem' }}>
              <label style={{ color: '#00FF88', fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>🎙️ Canto / Audio de Campo (Máx 30s):</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                {!grabandoAudio ? (
                  <button onClick={iniciarGrabacion} type="button" style={{ backgroundColor: '#00C853', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>🔴 Iniciar Grabación</button>
                ) : (
                  <button onClick={detenerGrabacion} type="button" style={{ backgroundColor: '#f44336', color: '#FFF', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem' }}>⏹️ Detener ({tiempoGrabacion}s)</button>
                )}
                {audioURL && <span style={{ color: '#00FF88', fontSize: '0.8rem' }}>✅ Audio adjuntado</span>}
              </div>
              {audioURL && <audio src={audioURL} controls style={{ width: '100%', height: '32px', marginTop: '0.5rem' }} />}
            </div>

            <label style={{ display: 'block', color: '#00FF88', fontSize: '0.8rem', marginBottom: '0.3rem', fontWeight: 'bold' }}>📸 Fotografías del Espécimen (Hasta 3 fotos):</label>
            <input type="file" accept="image/*" multiple onChange={handleFotosUpload} style={{ color: '#FFF', marginBottom: '0.8rem', width: '100%' }} />

            {fotosRegistro.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
                {fotosRegistro.map((f, i) => (
                  <img key={i} src={f} alt={`preview_${i}`} onClick={() => setLightboxData({ fotos: fotosRegistro, index: i })} style={{ width: '60px', height: '50px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '6px', border: '1px solid #00FF88', cursor: 'pointer' }} title="Click para ampliar imagen" />
                ))}
              </div>
            )}

            {errorEnvio && (
              <div style={{ backgroundColor: '#3A0D11', color: '#FF5252', padding: '0.6rem', borderRadius: '8px', border: '1px solid #FF5252', fontSize: '0.85rem', marginBottom: '0.8rem', textAlign: 'center', fontWeight: 'bold' }}>
                {errorEnvio}
              </div>
            )}

            <button onClick={async () => {
              if (!comunidad.trim()) {
                setErrorEnvio('⚠️ Debe indicar la ubicación o cantón obligatoriamente.');
                return;
              }
              
              const nombreReportante = usuario?.isLoggedIn 
                ? (usuario.nombre || usuario.email) 
                : 'Usuario Anónimo';

              const fotoInicial = fotosRegistro[0] || 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=500';

              const nuevo = {
                userId: usuario?.id || null,
                userEmail: usuario?.email || null,
                nombreComun: desconocido ? 'Desconocido (Por verificar)' : (nombreComun || 'Avistamiento'),
                especie: desconocido ? 'Especie por verificar' : (nombreCientifico || nombreComun),
                categoria: tipoFauna.toUpperCase(),
                silueta: silueta,
                esPeligroso: esPeligrosoReporte,
                estado: 'EN REVISIÓN EXPERTA',
                ubicacion: comunidad,
                reportante: nombreReportante,
                temp: `${temp} °C`,
                altitud: `${altitud} msnm`,
                microhabitat: microhabitat,
                estadoVida: `${estadoOrganismo} (${etapa})`,
                horaRegistro: new Date().toLocaleString(),
                audioURL: audioURL || null,
                fotos: fotosRegistro || [],
                fotoAutorizada: fotoInicial,
                img: fotoInicial,
                coords: [parseFloat(lat) || 9.65, parseFloat(lng) || -84.00]
              };

              try {
                await addDoc(collection(db, "avistamientos"), nuevo);
                alert(`¡Avistamiento enviado a revisión experta por parte de: ${nombreReportante}!`);
                setModalRegistro(false);
              } catch (e) {
                alert("Error al enviar el reporte a la nube.");
              }
            }} type="button" style={{ width: '100%', padding: '0.85rem', backgroundColor: '#00E676', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '1rem' }}>Enviar Reporte Científico</button>

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
        <button onClick={() => setTab('mapa')} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'mapa' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>🗺️</span> Mapa
        </button>
        <button onClick={() => setTab('guia')} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'guia' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>📖</span> Guía
        </button>
        <button onClick={() => { if (!usuario?.isLoggedIn) { setVistaPerfil('login'); setModalPerfil(true); } else abrirModalRegistro(); }} style={{ backgroundColor: '#00E676', border: '4px solid #070D0B', color: '#000', width: '56px', height: '56px', borderRadius: '50%', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '-28px', boxShadow: '0 0 15px rgba(0,230,118,0.5)' }}>
          +
        </button>
        <button onClick={() => setTab('chat')} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'chat' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <span style={{ fontSize: '1.2rem' }}>💬</span>
          <span style={{ position: 'relative' }}>
            Chats
            {chatsPendientesCount > 0 && (
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
        <button onClick={() => setTab('admin')} style={{ flex: 1, background: 'transparent', border: 'none', color: tab === 'admin' ? '#00FF88' : '#6A8A7D', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
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