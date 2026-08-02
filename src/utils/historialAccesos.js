export function crearEntradaHistorialAcceso({ usuario, tipo, detalle = '', origen = 'app' }) {
  const fecha = new Date();

  return {
    tipo,
    origen,
    detalle,
    userId: usuario?.id || usuario?.uid || null,
    email: usuario?.email || null,
    nombre: usuario?.nombre || null,
    rol: usuario?.rol || null,
    timestamp: fecha.getTime(),
    fecha: fecha.toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })
  };
}
