export const estimarAltitudYTemperaturaBasica = (latitud, longitud) => {
  const lat = Number(latitud);
  const lng = Number(longitud);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { altitud: '1450', temperatura: '21,5' };
  }

  const latitudAbs = Math.abs(lat - 9.65);
  const longitudAbs = Math.abs(lng + 84.0);

  const elevacionBase = 850 + (latitudAbs * 1100) + (longitudAbs * 140);
  const elevacionCosta = Math.max(20, Math.min(3400, Math.round(elevacionBase)));

  const tempBase = 24.5 - (elevacionCosta / 450);
  const temperatura = Math.max(10, Math.min(32, Number(tempBase.toFixed(1))));

  return {
    altitud: `${elevacionCosta}`,
    temperatura: temperatura.toFixed(1).replace('.', ',')
  };
};

export async function estimarAltitudYTemperatura(latitud, longitud) {
  const lat = Number(latitud);
  const lng = Number(longitud);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return estimarAltitudYTemperaturaBasica(latitud, longitud);
  }

  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Elevation request failed');

    const data = await response.json();
    const elevationValue = Array.isArray(data?.elevation) ? data.elevation[0] : data?.elevation;
    const elevation = Number(elevationValue);

    if (Number.isFinite(elevation)) {
      const temperatura = Math.max(10, Math.min(32, Number((24.5 - (elevation / 450)).toFixed(1))));
      return {
        altitud: `${Math.round(elevation)}`,
        temperatura: temperatura.toFixed(1).replace('.', ',')
      };
    }
  } catch {}

  return estimarAltitudYTemperaturaBasica(latitud, longitud);
}
