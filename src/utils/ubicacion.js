const cantonesCR = [
  { nombre: 'Tarrazu', coords: [9.6507, -84.0002], alt: 1350, temp: 21.0 },
  { nombre: 'Dota', coords: [9.6644, -83.8436], alt: 1550, temp: 19.5 },
  { nombre: 'Leon Cortés Castro', coords: [9.6828, -84.0519], alt: 1540, temp: 19.8 },
  { nombre: 'Zarcero', coords: [10.1856, -84.3853], alt: 1736, temp: 17.5 },
  { nombre: 'Alajuela', coords: [10.0163, -84.2116], alt: 960, temp: 24.0 },
  { nombre: 'Cartago', coords: [9.8644, -83.9194], alt: 1435, temp: 20.0 },
  { nombre: 'Heredia', coords: [10.0024, -84.1165], alt: 1150, temp: 22.0 },
  { nombre: 'Perez Zeledón', coords: [9.3781, -83.7025], alt: 700, temp: 24.5 },
  { nombre: 'Aserrí', coords: [9.8556, -84.0894], alt: 1311, temp: 21.0 },
  { nombre: 'Acosta', coords: [9.7667, -84.4000], alt: 990, temp: 23.0 },
  { nombre: 'Desamparados', coords: [9.8903, -84.0667], alt: 1161, temp: 22.0 },
  { nombre: 'Curridabat', coords: [9.9333, -84.0333], alt: 1200, temp: 22.0 }
];

export function detectarUbicacionAutomatica(latitud, longitud) {
  const lat = Number(latitud);
  const lng = Number(longitud);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { label: 'Ubicación personalizada', coords: null, alt: null, temp: null };
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const radioTierraKm = 6371;

  let mejor = null;
  let mejorDistanciaKm = Number.POSITIVE_INFINITY;

  for (const canton of cantonesCR) {
    const dLat = toRad(canton.coords[0] - lat);
    const dLng = toRad(canton.coords[1] - lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(canton.coords[0])) * Math.sin(dLng / 2) ** 2;
    const distanciaKm = 2 * radioTierraKm * Math.asin(Math.sqrt(a));

    if (distanciaKm < mejorDistanciaKm) {
      mejorDistanciaKm = distanciaKm;
      mejor = canton;
    }
  }

  if (!mejor || mejorDistanciaKm > 40) {
    return { label: 'Ubicación personalizada', coords: [lat, lng], alt: null, temp: null };
  }

  return {
    label: mejor.nombre,
    coords: [lat, lng],
    alt: mejor.alt,
    temp: mejor.temp
  };
}

export function construirTextoUbicacion(latitud, longitud) {
  const ubicacion = detectarUbicacionAutomatica(latitud, longitud);
  if (!ubicacion.coords) {
    return 'Ubicación personalizada';
  }

  const latTexto = Number(ubicacion.coords[0]).toFixed(6);
  const lngTexto = Number(ubicacion.coords[1]).toFixed(6);
  const etiqueta = ubicacion.label === 'Ubicación personalizada' ? 'Ubicación personalizada' : `${ubicacion.label}`;

  return `${etiqueta} • ${latTexto}, ${lngTexto}`;
}
