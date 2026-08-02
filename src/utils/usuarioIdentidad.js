export function normalizarTexto(valor) {
  if (!valor) return '';
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function esUsuarioAdministrativo(email, nombre) {
  const emailNorm = normalizarTexto(email);
  const nombreNorm = normalizarTexto(nombre);

  return (
    emailNorm === 'proquimicajcv@icloud.com' ||
    emailNorm === 'juan.abarca@email.com' ||
    nombreNorm.includes('jorge carvajal') ||
    nombreNorm.includes('juan abarca')
  );
}

export function esUsuarioPrincipal(email, nombre, usuarioId, usuarioIdProtegido) {
  const emailNorm = normalizarTexto(email);
  const nombreNorm = normalizarTexto(nombre);

  return (
    (usuarioId && usuarioIdProtegido && usuarioId === usuarioIdProtegido) ||
    emailNorm === 'proquimicajcv@icloud.com' ||
    nombreNorm.includes('jorge carvajal')
  );
}

export function esUsuarioProtegido(email, nombre, usuarioId, usuarioIdProtegido) {
  const emailNorm = normalizarTexto(email);
  const nombreNorm = normalizarTexto(nombre);

  return (
    esUsuarioPrincipal(email, nombre, usuarioId, usuarioIdProtegido) ||
    emailNorm === 'juan.abarca@email.com' ||
    nombreNorm.includes('juan abarca')
  );
}

export function coincideIdentidadUsuario(registro, usuario) {
  if (!registro || !usuario) return false;

  const nombreRegistro = normalizarTexto(registro.reportante || registro.nombre || '');
  const nombreUsuario = normalizarTexto(usuario.nombre || '');
  const emailRegistro = normalizarTexto(registro.userEmail || '');
  const emailUsuario = normalizarTexto(usuario.email || '');
  const idRegistro = registro.userId || null;
  const idUsuario = usuario.id || null;

  const mismoEmail = Boolean(emailUsuario && emailRegistro && emailUsuario === emailRegistro);
  const mismoId = Boolean(idUsuario && idRegistro && idUsuario === idRegistro);
  const mismoNombre = Boolean(nombreUsuario && nombreRegistro && (
    nombreRegistro.includes(nombreUsuario) || nombreUsuario.includes(nombreRegistro)
  ));

  return mismoEmail || mismoId || mismoNombre;
}
