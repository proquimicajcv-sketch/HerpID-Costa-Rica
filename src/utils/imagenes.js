export const MAX_BYTES_IMAGEN = 15 * 1024 * 1024;
export const MAX_BYTES_IMAGEN_ORIGINAL = 40 * 1024 * 1024;
export const MAX_BYTES_IMAGEN_REPORTE = 2 * 1024 * 1024;

export function resolverConfiguracionCompresion(sizeInBytes) {
  if (sizeInBytes > MAX_BYTES_IMAGEN * 2) {
    return {
      maxBytes: MAX_BYTES_IMAGEN,
      maxBytesFinal: 1200 * 1024,
      maxDimension: 1400,
      quality: 0.58,
      scale: 0.62,
      debeReducir: true,
    };
  }

  if (sizeInBytes > MAX_BYTES_IMAGEN) {
    return {
      maxBytes: MAX_BYTES_IMAGEN,
      maxBytesFinal: 1500 * 1024,
      maxDimension: 1500,
      quality: 0.68,
      scale: 0.74,
      debeReducir: true,
    };
  }

  if (sizeInBytes > 5 * 1024 * 1024) {
    return {
      maxBytes: MAX_BYTES_IMAGEN,
      maxBytesFinal: 1800 * 1024,
      maxDimension: 1600,
      quality: 0.78,
      scale: 0.88,
      debeReducir: true,
    };
  }

  return {
    maxBytes: MAX_BYTES_IMAGEN,
    maxBytesFinal: MAX_BYTES_IMAGEN_REPORTE,
    maxDimension: 1800,
    quality: 1,
    scale: 1,
    debeReducir: false,
  };
}

export function validarTamanoImagen(file) {
  if (!file) return { valido: false, motivo: 'No se seleccionó ninguna imagen.' };
  if (!file.type?.startsWith('image/')) {
    return { valido: false, motivo: 'Selecciona un archivo de imagen válido.' };
  }

  if (file.size > MAX_BYTES_IMAGEN_ORIGINAL) {
    return {
      valido: false,
      motivo: 'La imagen es demasiado pesada. El máximo permitido es 40 MB por archivo.'
    };
  }

  return { valido: true };
}

export function moverFotoEnLista(fotos, fromIndex, toIndex) {
  const copia = [...fotos];
  const [item] = copia.splice(fromIndex, 1);
  const destino = toIndex < 0 ? 0 : toIndex;
  copia.splice(destino, 0, item);
  return copia;
}

export async function subirFotoConFallback({ dataUrl, ruta, subir }) {
  if (!dataUrl) {
    return { url: '', usadaComoFallback: false };
  }

  try {
    const timeoutMs = 45000;
    const timeoutError = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout-subida-foto')), timeoutMs);
    });

    const url = await Promise.race([
      subir({ dataUrl, ruta }),
      timeoutError
    ]);

    return { url, usadaComoFallback: false };
  } catch (error) {
    return { url: dataUrl, usadaComoFallback: true, error };
  }
}
