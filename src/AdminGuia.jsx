import { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export default function AdminGuia() {
  const [nombreComun, setNombreComun] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [descripcionHtml, setDescripcionHtml] = useState('');
  const [guardando, setGuardando] = useState(false);

  const quillModules = {
    toolbar: [
      ['bold', 'italic'],
      [{ color: [] }, { background: [] }],
      [{ size: ['small', false, 'large', 'huge'] }]
    ]
  };

  const quillFormats = ['bold', 'italic', 'color', 'background', 'size'];

  const guardarEspecie = async () => {
    const nombre = nombreComun.trim();
    const imagen = imagenUrl.trim();

    if (!nombre || !imagen || !descripcionHtml.trim()) {
      alert('Completa nombre común, URL de imagen y descripción.');
      return;
    }

    setGuardando(true);

    try {
      await addDoc(collection(db, 'guia_especies'), {
        nombreComun: nombre,
        imagenUrl: imagen,
        descripcionHtml,
        createdAt: serverTimestamp()
      });

      setNombreComun('');
      setImagenUrl('');
      setDescripcionHtml('');
      alert('Especie guardada correctamente.');
    } catch (error) {
      console.error('Error al guardar especie:', error);
      alert('No se pudo guardar la especie en Firestore.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section
      style={{
        maxWidth: '920px',
        margin: '0 auto',
        padding: '1.2rem',
        backgroundColor: '#121212',
        color: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #2A2A2A',
        boxShadow: '0 10px 28px rgba(0,0,0,0.35)'
      }}
    >
      <style>{`
        .admin-guia-editor .ql-toolbar.ql-snow {
          border: 1px solid #3A3A3A;
          border-bottom: none;
          background: #F8F9FA;
          border-radius: 10px 10px 0 0;
        }

        .admin-guia-editor .ql-container.ql-snow {
          border: 1px solid #3A3A3A;
          border-radius: 0 0 10px 10px;
          background: #FFFFFF;
        }

        .admin-guia-editor .ql-editor {
          min-height: 180px;
          color: #111111;
          font-size: 0.95rem;
          line-height: 1.55;
        }
      `}</style>

      <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1.35rem' }}>Panel Administrador - Guia de Avistamientos</h2>
      <p style={{ margin: '0 0 1rem 0', color: '#A7B5AE', fontSize: '0.86rem' }}>Publica nuevas especies con descripcion enriquecida.</p>

      <div style={{ display: 'grid', gap: '0.85rem' }}>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ color: '#D6E3DD', fontSize: '0.82rem', fontWeight: 700 }}>Nombre Comun</span>
          <input
            type="text"
            value={nombreComun}
            onChange={(event) => setNombreComun(event.target.value)}
            placeholder="Ej. Rana calzonuda"
            style={{
              width: '100%',
              padding: '0.72rem 0.78rem',
              borderRadius: '10px',
              border: '1px solid #3B4C44',
              backgroundColor: '#0D1411',
              color: '#E7F6EC',
              boxSizing: 'border-box'
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ color: '#D6E3DD', fontSize: '0.82rem', fontWeight: 700 }}>URL de la Imagen</span>
          <input
            type="url"
            value={imagenUrl}
            onChange={(event) => setImagenUrl(event.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
            style={{
              width: '100%',
              padding: '0.72rem 0.78rem',
              borderRadius: '10px',
              border: '1px solid #3B4C44',
              backgroundColor: '#0D1411',
              color: '#E7F6EC',
              boxSizing: 'border-box'
            }}
          />
        </label>

        <div className="admin-guia-editor">
          <ReactQuill
            theme="snow"
            value={descripcionHtml}
            onChange={setDescripcionHtml}
            modules={quillModules}
            formats={quillFormats}
            placeholder="Describe la especie con formato enriquecido"
          />
        </div>

        <button
          type="button"
          onClick={guardarEspecie}
          disabled={guardando}
          style={{
            width: '100%',
            padding: '0.86rem 1rem',
            border: 'none',
            borderRadius: '12px',
            cursor: guardando ? 'not-allowed' : 'pointer',
            background: guardando ? '#7C8A83' : 'linear-gradient(90deg, #00E676 0%, #00C853 100%)',
            color: '#03150C',
            fontWeight: 900,
            fontSize: '0.94rem',
            boxShadow: guardando ? 'none' : '0 0 18px rgba(0,230,118,0.33)'
          }}
        >
          {guardando ? 'Publicando...' : 'Publicar Especie'}
        </button>
      </div>
    </section>
  );
}
