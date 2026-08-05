import React, { useEffect, useMemo, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { db } from './firebase';
import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

const COLECCION_GUIA_MANUAL = 'guia_especies_manual';
const COLECCION_GUIA_PUBLICA = 'especies_guia';

const LOCAL_INSTALL_ID_KEY = 'herpid_install_id_v1';
const LOCAL_VISTOS_PREFIX = 'herpid_guia_vistos_';
const LOCAL_GUIA_CACHE_KEY = 'herpid_guia_especies_cache_v1';

function generarIdInstalacion() {
  return `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function obtenerScopeLocal() {
  if (typeof window === 'undefined') return 'inst_servidor';
  try {
    const existente = localStorage.getItem(LOCAL_INSTALL_ID_KEY);
    if (existente) return existente;
    const nuevo = generarIdInstalacion();
    localStorage.setItem(LOCAL_INSTALL_ID_KEY, nuevo);
    return nuevo;
  } catch {
    return 'inst_fallback';
  }
}

function leerVistosLocal(clave) {
  if (typeof window === 'undefined' || !clave) return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_VISTOS_PREFIX}${clave}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarVistosLocal(clave, vistos) {
  if (typeof window === 'undefined' || !clave) return;
  try {
    localStorage.setItem(`${LOCAL_VISTOS_PREFIX}${clave}`, JSON.stringify(vistos));
  } catch {
    // No bloquear la UX si falla el almacenamiento local.
  }
}

function leerEspeciesCache() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_GUIA_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarEspeciesCache(especies) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_GUIA_CACHE_KEY, JSON.stringify(especies));
  } catch {
    // Ignorar errores de cache.
  }
}

function normalizarEspecieManual(item) {
  const data = item.data() || {};
  return {
    id: String(item.id),
    nombreComun: String(data.nombreComun || data.nombre || 'Sin nombre'),
    imagenUrl: String(data.imagenUrl || data.img || ''),
    descripcionHtml: String(data.descripcionHtml || data.desc || ''),
  };
}

function normalizarEspeciePublica(item) {
  const data = item.data() || {};
  return {
    id: String(item.id),
    nombreComun: String(data.nombreComun || data.nombre || 'Sin nombre'),
    imagenUrl: String(data.imagenUrl || data.img || ''),
    descripcionHtml: String(data.descripcionHtml || data.desc || ''),
  };
}

function htmlTieneContenido(html) {
  const limpio = String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return limpio.length > 0;
}

export default function GuiaPersonal({ esAdmin = false, canEditAlways = false, uid = null, scopeId = null }) {
  const puedeEditarGuia = Boolean(canEditAlways);
  const quillModules = useMemo(() => ({
    toolbar: [
      [{ size: ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean']
    ]
  }), []);
  const quillFormats = useMemo(() => ([
    'size',
    'bold',
    'italic',
    'underline',
    'color',
    'background',
    'list',
    'bullet'
  ]), []);
  const scopeLocal = useMemo(() => obtenerScopeLocal(), []);
  const claveVistos = useMemo(() => {
    const base = String(scopeId || uid || scopeLocal || '').trim().toLowerCase();
    return base || 'inst_fallback';
  }, [scopeId, uid, scopeLocal]);

  const [especiesSemanales, setEspeciesSemanales] = useState(() => leerEspeciesCache());
  const [cargandoEspecies, setCargandoEspecies] = useState(true);
  const [formNombre, setFormNombre] = useState('');
  const [formImagenUrl, setFormImagenUrl] = useState('');
  const [formDescripcionHtml, setFormDescripcionHtml] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [guardandoAdmin, setGuardandoAdmin] = useState(false);
  const [vistos, setVistos] = useState(() => leerVistosLocal(claveVistos));
  const [guardandoVisto, setGuardandoVisto] = useState(false);

  const cargarDesdeRespaldoPublico = async () => {
    try {
      const snap = await getDocs(collection(db, COLECCION_GUIA_PUBLICA));
      const lista = snap.docs.map(normalizarEspeciePublica).filter((item) => item.nombreComun);
      setEspeciesSemanales(lista);
      guardarEspeciesCache(lista);
    } catch {
      const cache = leerEspeciesCache();
      setEspeciesSemanales(cache);
    } finally {
      setCargandoEspecies(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLECCION_GUIA_MANUAL),
      (snap) => {
        const lista = snap.docs.map(normalizarEspecieManual).filter((item) => item.nombreComun);

        setEspeciesSemanales(lista);
        guardarEspeciesCache(lista);
        setCargandoEspecies(false);
      },
      (error) => {
        console.error('Error leyendo guía manual:', error);
        cargarDesdeRespaldoPublico();
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setVistos(leerVistosLocal(claveVistos));
  }, [claveVistos]);

  useEffect(() => {
    if (!claveVistos) return;

    const docRef = doc(db, 'guia_personal_vistos', claveVistos);
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) return;
        const cloudVistos = Array.isArray(snap.data()?.vistos) ? snap.data().vistos : [];
        setVistos(cloudVistos);
        guardarVistosLocal(claveVistos, cloudVistos);
      },
      () => {
        // Si falla Firestore (permisos/red), seguimos con localStorage por dispositivo.
      }
    );

    return () => unsubscribe();
  }, [claveVistos]);

  const toggleVisto = async (id) => {
    if (guardandoVisto) return;

    const anterior = vistos;
    const siguiente = anterior.includes(id)
      ? anterior.filter((v) => v !== id)
      : [...anterior, id];

    setVistos(siguiente);
    guardarVistosLocal(claveVistos, siguiente);

    setGuardandoVisto(true);
    try {
      await setDoc(doc(db, 'guia_personal_vistos', claveVistos), {
        vistos: siguiente,
        actualizadoEn: serverTimestamp(),
        ownerUid: uid || null,
        ownerScope: scopeId || null,
      });
    } catch {
      // Ya persistimos localmente; el usuario mantiene su conteo individual.
    } finally {
      setGuardandoVisto(false);
    }
  };

  const limpiarFormularioAdmin = () => {
    setFormNombre('');
    setFormImagenUrl('');
    setFormDescripcionHtml('');
    setEditandoId(null);
  };

  const cargarEnFormularioAdmin = (especie) => {
    if (!puedeEditarGuia) return;
    setFormNombre(especie.nombreComun || '');
    setFormImagenUrl(especie.imagenUrl || '');
    setFormDescripcionHtml(especie.descripcionHtml || '');
    setEditandoId(especie.id);
  };

  const guardarEspecieAdmin = async () => {
    if (!puedeEditarGuia) {
      alert('Solo el Admin General principal puede editar la guía.');
      return;
    }

    const nombre = formNombre.trim();
    const imagen = formImagenUrl.trim();
    const descripcion = String(formDescripcionHtml || '').trim();

    if (!nombre || !imagen || !htmlTieneContenido(descripcion)) {
      alert('Completa nombre, URL de imagen y descripción HTML.');
      return;
    }

    if (!/^https?:\/\//i.test(imagen)) {
      alert('La URL de imagen debe iniciar con http:// o https://');
      return;
    }

    setGuardandoAdmin(true);
    try {
      const especieId = editandoId || doc(collection(db, COLECCION_GUIA_MANUAL)).id;
      const payloadComun = {
        nombreComun: nombre,
        imagenUrl: imagen,
        descripcionHtml: descripcion,
      };

      await Promise.all([
        setDoc(doc(db, COLECCION_GUIA_MANUAL, especieId), {
          ...payloadComun,
          actualizadoEn: serverTimestamp(),
          ...(editandoId ? {} : { creadoEn: serverTimestamp() }),
        }, { merge: true }),
        setDoc(doc(db, COLECCION_GUIA_PUBLICA, especieId), {
          ...payloadComun,
          nombre: nombre,
          img: imagen,
          desc: descripcion,
          autorizadoPor: 'admin_general_principal',
          actualizadoEn: serverTimestamp(),
          ...(editandoId ? {} : { creadoEn: serverTimestamp() }),
        }, { merge: true })
      ]);

      limpiarFormularioAdmin();
    } catch (error) {
      console.error('Error guardando especie manual:', error);
      alert('No se pudo guardar la especie en la guía manual.');
    } finally {
      setGuardandoAdmin(false);
    }
  };

  const eliminarEspecieAdmin = async (id) => {
    if (!puedeEditarGuia) {
      alert('Solo el Admin General principal puede editar la guía.');
      return;
    }

    const confirmar = window.confirm('¿Eliminar esta especie de la guía?');
    if (!confirmar) return;

    try {
      const resultados = await Promise.allSettled([
        deleteDoc(doc(db, COLECCION_GUIA_MANUAL, id)),
        deleteDoc(doc(db, COLECCION_GUIA_PUBLICA, id))
      ]);

      const errorPrincipal = resultados[0]?.status === 'rejected';
      if (errorPrincipal) {
        throw new Error('No se pudo eliminar en la colección principal.');
      }

      if (editandoId === id) {
        limpiarFormularioAdmin();
      }
    } catch (error) {
      console.error('Error eliminando especie manual:', error);
      alert('No se pudo eliminar la especie.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: '#FFFFFF', padding: '1.15rem', paddingBottom: '6rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        {puedeEditarGuia && (
          <style>{`
            .ql-toolbar.ql-snow {
              border: none;
              border-bottom: 1px solid #d6dbd7;
              background: #eef1ee;
            }

            .ql-container.ql-snow {
              border: none;
              background: #ffffff;
            }

            .ql-editor {
              min-height: 150px;
              color: #1a1a1a;
              font-size: 0.92rem;
              line-height: 1.55;
            }
          `}</style>
        )}

        {puedeEditarGuia && (
          <section style={{ marginBottom: '1rem', backgroundColor: '#0F1A16', border: '1px solid #1B3D2F', borderRadius: '14px', padding: '0.95rem' }}>
            <h3 style={{ margin: '0 0 0.65rem', color: '#00FF88' }}>Admin General: Editor Manual de Guía</h3>
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              <input
                type="text"
                placeholder="Nombre común"
                value={formNombre}
                onChange={(event) => setFormNombre(event.target.value)}
                style={{ width: '100%', padding: '0.62rem', borderRadius: '8px', border: '1px solid #2A3F35', backgroundColor: '#07110D', color: '#E8F5EC', boxSizing: 'border-box' }}
              />
              <input
                type="url"
                placeholder="https://ejemplo.com/imagen.jpg"
                value={formImagenUrl}
                onChange={(event) => setFormImagenUrl(event.target.value)}
                style={{ width: '100%', padding: '0.62rem', borderRadius: '8px', border: '1px solid #2A3F35', backgroundColor: '#07110D', color: '#E8F5EC', boxSizing: 'border-box' }}
              />
              <div style={{ border: '1px solid #2A3F35', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#F7F8F7' }}>
                <ReactQuill
                  theme="snow"
                  value={formDescripcionHtml}
                  onChange={setFormDescripcionHtml}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Describe la especie con formato (negrita, color, etc.)"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={guardarEspecieAdmin}
                  disabled={guardandoAdmin}
                  style={{ backgroundColor: '#00E676', color: '#04150C', border: 'none', borderRadius: '8px', padding: '0.62rem 0.9rem', fontWeight: 800, cursor: guardandoAdmin ? 'not-allowed' : 'pointer', opacity: guardandoAdmin ? 0.7 : 1 }}
                >
                  {guardandoAdmin ? 'Guardando...' : (editandoId ? 'Actualizar especie' : 'Agregar especie')}
                </button>
                {editandoId && (
                  <button
                    type="button"
                    onClick={limpiarFormularioAdmin}
                    style={{ backgroundColor: 'transparent', color: '#9FB8AA', border: '1px solid #2A3F35', borderRadius: '8px', padding: '0.62rem 0.9rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.45rem' }}>📖 Mi Guía Personal: Especies de la Semana</h2>
          <p style={{ margin: 0, color: '#8AA398', fontSize: '0.9rem' }}>
            Has visto <span style={{ color: '#00E676', fontWeight: 800 }}>{vistos.length}</span> de{' '}
            <span style={{ fontWeight: 800 }}>{especiesSemanales.length}</span> especies
          </p>
        </div>

        {cargandoEspecies ? (
          <div style={{ color: '#8AA398' }}>Cargando guía...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
          {especiesSemanales.length === 0 && (
            <div style={{ gridColumn: '1 / -1', color: '#8AA398', padding: '1rem 0.2rem' }}>
              No hay especies cargadas en la guía todavía.
            </div>
          )}
          {especiesSemanales.map((especie) => {
            const estaVisto = vistos.includes(especie.id);
            return (
              <article
                key={especie.id}
                style={{
                  backgroundColor: '#1E1E1E',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: estaVisto ? '2px solid #00E676' : '1px solid #2A2A2A'
                }}
              >
                <img
                  src={especie.imagenUrl}
                  alt={especie.nombreComun}
                  style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
                />

                <div style={{ padding: '0.95rem' }}>
                  <h3 style={{ margin: '0 0 0.6rem', color: '#FFFFFF', fontSize: '1.03rem' }}>{especie.nombreComun}</h3>

                  <div
                    dangerouslySetInnerHTML={{ __html: especie.descripcionHtml }}
                    style={{ color: '#D7E7DD', fontSize: '0.88rem', lineHeight: 1.55 }}
                  />

                  {puedeEditarGuia && (
                    <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={() => cargarEnFormularioAdmin(especie)}
                        style={{ flex: 1, border: '1px solid #4FC3F7', backgroundColor: 'transparent', color: '#4FC3F7', borderRadius: '8px', padding: '0.45rem 0.55rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarEspecieAdmin(especie.id)}
                        style={{ flex: 1, border: '1px solid #FF5252', backgroundColor: 'transparent', color: '#FF5252', borderRadius: '8px', padding: '0.45rem 0.55rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleVisto(especie.id)}
                    disabled={guardandoVisto}
                    style={{
                      width: '100%',
                      marginTop: '0.85rem',
                      padding: '0.72rem',
                      borderRadius: '10px',
                      border: estaVisto ? 'none' : '1px solid #3A3A3A',
                      backgroundColor: estaVisto ? '#00E676' : 'transparent',
                      color: estaVisto ? '#04150C' : '#8AA398',
                      fontWeight: 800,
                      cursor: guardandoVisto ? 'not-allowed' : 'pointer',
                      opacity: guardandoVisto ? 0.72 : 1,
                    }}
                  >
                    {estaVisto ? '✅ Observada' : '👁️ Marcar como observada'}
                  </button>
                </div>
              </article>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}
