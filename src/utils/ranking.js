export function encontrarPosicionRanking(rankingUsuarios, usuarioId, usuarioEmail, usuarioNombre) {
  const indice = rankingUsuarios.findIndex((usuario) => {
    const mismoId = Boolean(usuarioId && usuario.id === usuarioId);
    const mismoEmail = Boolean(usuarioEmail && usuario.email === usuarioEmail);
    const mismoNombre = Boolean(usuarioNombre && usuario.nombre === usuarioNombre);
    return mismoId || mismoEmail || mismoNombre;
  });

  return indice >= 0 ? indice + 1 : null;
}

export function detectarSubidaRanking(rankingUsuarios, rankingAnterior, usuarioId, usuarioEmail, usuarioNombre) {
  if (!rankingUsuarios?.length) return null;

  const posicionActual = encontrarPosicionRanking(rankingUsuarios, usuarioId, usuarioEmail, usuarioNombre);
  if (posicionActual === null) return null;

  const posicionAnterior = encontrarPosicionRanking(rankingAnterior || [], usuarioId, usuarioEmail, usuarioNombre);
  if (!posicionAnterior || posicionActual >= posicionAnterior) return null;

  const usuarioActual = rankingUsuarios.find((usuario) => {
    const mismoId = Boolean(usuarioId && usuario.id === usuarioId);
    const mismoEmail = Boolean(usuarioEmail && usuario.email === usuarioEmail);
    const mismoNombre = Boolean(usuarioNombre && usuario.nombre === usuarioNombre);
    return mismoId || mismoEmail || mismoNombre;
  });

  const avistamientos = Number(usuarioActual?.userValidados || 0);
  const lugar = posicionActual === 1 ? 'primer' : posicionActual === 2 ? 'segundo' : posicionActual === 3 ? 'tercer' : `${posicionActual}º`;

  return {
    titulo: '¡Has subido en el ranking!',
    mensaje: `Ahora ocupas el ${lugar} lugar del ranking con ${avistamientos} avistamientos validados.`,
    detalle: 'Tu contribución herpetológica está siendo reconocida.'
  };
}
