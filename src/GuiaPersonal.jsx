import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

const GUIA_ESPECIES_CACHE_KEY = 'herpid_guia_especies_cache_v1';

function leerCacheEspecies() {
  try {
    const raw = localStorage.getItem(GUIA_ESPECIES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarCacheEspecies(especies) {
  try {
    localStorage.setItem(GUIA_ESPECIES_CACHE_KEY, JSON.stringify(especies));
  } catch {
    // Ignorar errores de almacenamiento local.
  }
}

export default function GuiaPersonal({ esAdmin = false, uid = null, scopeId = null }) {
  const [vistos, setVistos] = useState([]);
  const [especiesSemanales, setEspeciesSemanales] = useState(() => leerCacheEspecies());
  const [cargandoEspecies, setCargandoEspecies] = useState(true);
  const [guardandoVisto, setGuardandoVisto] = useState(false);
  const claveVistos = String(scopeId || uid || 'herpid_publico').trim();

  useEffect(() => {
    setCargandoEspecies(true);

    const unsubscribe = onSnapshot(
      collection(db, 'guia_especies'),
      (snap) => {
        const lista = snap.docs.map((item) => {
          const data = item.data() || {};
          return {
            id: String(item.id),
            nombreComun: String(data.nombreComun || 'Sin nombre común'),
            imagenUrl: String(data.imagenUrl || ''),
            descripcionHtml: String(data.descripcionHtml || ''),
          };
        });

        setEspeciesSemanales(lista);
        guardarCacheEspecies(lista);
        setCargandoEspecies(false);
      },
      (error) => {
        console.error('Error sincronizando guia_especies:', error);
        const cache = leerCacheEspecies();
        if (cache.length > 0) {
          setEspeciesSemanales(cache);
        }
        setCargandoEspecies(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!claveVistos) return;
    const docRef = doc(db, 'guia_personal_vistos', claveVistos);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setVistos(Array.isArray(snap.data()?.vistos) ? snap.data().vistos : []);
      } else {
        setVistos([]);
      }
    });
    return () => unsubscribe();
  }, [claveVistos]);

  const toggleVisto = async (id) => {
    if (guardandoVisto) return;
    const anterior = vistos;
    const siguiente = anterior.includes(id)
      ? anterior.filter((v) => v !== id)
      : [...anterior, id];

    setVistos(siguiente);

    if (!claveVistos) return;
    setGuardandoVisto(true);
    try {
      await setDoc(doc(db, 'guia_personal_vistos', claveVistos), {
        vistos: siguiente,
        actualizadoEn: serverTimestamp(),
        ownerUid: uid || null,
        ownerScope: scopeId || null,
      });
    } catch (error) {
      console.error('Error guardando especie observada:', error);
      setVistos(anterior);
    } finally {
      setGuardandoVisto(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: '#FFFFFF', padding: '1.1rem', paddingBottom: '6rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.45rem' }}>📖 Mi Guía Personal: Especies de la Semana</h2>
          <p style={{ margin: 0, color: '#8AA398', fontSize: '0.9rem' }}>
            Has observado <span style={{ color: '#00E676', fontWeight: 800 }}>{vistos.length}</span> de{' '}
            <span style={{ fontWeight: 800 }}>{especiesSemanales.length}</span> especies.
          </p>
        </div>

        {cargandoEspecies ? (
          <div style={{ color: '#8AA398' }}>Cargando especies...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
            {especiesSemanales.length === 0 && (
              <div style={{ color: '#8AA398', gridColumn: '1 / -1', textAlign: 'center', padding: '1.2rem 0.5rem' }}>
                No hay especies publicadas todavía en la guía.
              </div>
            )}
            {especiesSemanales.map((especie) => {
              const estaObservada = vistos.includes(especie.id);
              return (
                <article
                  key={especie.id}
                  style={{
                    backgroundColor: '#1E1E1E',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    border: estaObservada ? '2px solid #00E676' : '1px solid #2A2A2A',
                  }}
                >
                  {especie.imagenUrl ? (
                    <img
                      src={especie.imagenUrl}
                      alt={especie.nombreComun}
                      style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '200px', backgroundColor: '#000' }} />
                  )}

                  <div style={{ padding: '0.95rem' }}>
                    <h3 style={{ margin: '0 0 0.65rem', color: '#FFFFFF', fontSize: '1.05rem' }}>{especie.nombreComun}</h3>

                    <div
                      dangerouslySetInnerHTML={{ __html: especie.descripcionHtml }}
                      className="prose prose-invert text-sm"
                      style={{ color: '#D7E7DD', fontSize: '0.88rem', lineHeight: 1.55 }}
                    />

                    <button
                      type="button"
                      onClick={() => toggleVisto(especie.id)}
                      disabled={guardandoVisto}
                      style={{
                        width: '100%',
                        marginTop: '0.9rem',
                        padding: '0.74rem',
                        borderRadius: '10px',
                        border: estaObservada ? 'none' : '1px solid #3A3A3A',
                        backgroundColor: estaObservada ? '#00E676' : 'transparent',
                        color: estaObservada ? '#04150C' : '#8AA398',
                        fontWeight: 800,
                        cursor: guardandoVisto ? 'not-allowed' : 'pointer',
                        opacity: guardandoVisto ? 0.72 : 1,
                      }}
                    >
                      {estaObservada ? '✅ Observada' : '👁️ Marcar como observada'}
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
