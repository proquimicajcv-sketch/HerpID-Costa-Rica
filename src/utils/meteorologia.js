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

export function estimarAltitudYTemperatura(latitud, longitud) {
  const lat = Number(latitud);
  const lng = Number(longitud);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { altitud: '1450', temperatura: '21,5' };
  }

  let mejorCanton = null;
  let menorDistancia = Number.POSITIVE_INFINITY;

  for (const [key, data] of Object.entries(cantonesCR)) {
    const distancia = Math.hypot(lat - data.coords[0], (lng - data.coords[1]) * 1.08);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      mejorCanton = data;
    }
  }

  const cantonBaseAltitud = mejorCanton?.alt ?? 650;
  const cantonBaseTemp = mejorCanton?.temp ?? 24.5;

  const ajusteLat = (lat - (mejorCanton?.coords?.[0] ?? 9.65)) * 900;
  const ajusteLng = (lng - (mejorCanton?.coords?.[1] ?? -84.0)) * 160;
  const ajusteTotal = Math.max(-600, Math.min(650, ajusteLat + ajusteLng));

  const altitud = Math.round(Math.max(20, Math.min(3400, cantonBaseAltitud + ajusteTotal)));
  const temperatura = Number(Math.max(10, Math.min(32, cantonBaseTemp - (altitud - cantonBaseAltitud) / 180)).toFixed(1));

  return {
    altitud: String(altitud),
    temperatura: temperatura.toFixed(1).replace('.', ',')
  };
}

export function normalizarRegistroMeteorologia(registro) {
  const coords = Array.isArray(registro?.coords) && registro.coords.length >= 2
    ? registro.coords
    : [parseFloat(registro?.lat || registro?.latitud || registro?.latEdit), parseFloat(registro?.lng || registro?.longitud || registro?.lngEdit)];

  const { altitud, temperatura } = estimarAltitudYTemperatura(coords[0], coords[1]);
  const altitudTexto = `${altitud} msnm`;
  const tempTexto = `${temperatura} °C`;

  const necesitaActualizar = String(registro?.altitud || '').trim() !== altitudTexto || String(registro?.temp || '').trim() !== tempTexto;

  return {
    ...registro,
    altitud: altitudTexto,
    temp: tempTexto,
    necesitaActualizar
  };
}
