export function contarMensajesSinLeer(mensajes = [], usuarioId, ultimaLectura = 0) {
  if (!usuarioId) return 0;

  const umbral = Number(ultimaLectura || 0);

  return mensajes.filter((mensaje) => {
    const createdAt = Number(mensaje?.createdAt || 0);
    const esMensajeDelEquipo = Boolean(mensaje?.esAdmin);
    const esMensajePropio = String(mensaje?.senderId || '') === String(usuarioId);

    return createdAt > umbral && esMensajeDelEquipo && !esMensajePropio;
  }).length;
}
