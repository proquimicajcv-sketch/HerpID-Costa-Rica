export function crearDatosUsuarioFirestore({ uid, email, nombre, rol, ultimoAcceso, ultimoConexion, telefono, baneado, motivoBaneo, mensajeBaneo, fechaBaneo, baneoPor }) {
  const data = {
    uid,
    email,
    nombre,
    rol,
    ultimoAcceso,
    ultimoConexion
  };

  if (typeof telefono === 'string' && telefono.trim()) {
    data.telefono = telefono.trim();
  }

  if (typeof baneado === 'boolean') {
    data.baneado = baneado;
  }

  if (typeof motivoBaneo === 'string' && motivoBaneo.trim()) {
    data.motivoBaneo = motivoBaneo.trim();
  }

  if (typeof mensajeBaneo === 'string' && mensajeBaneo.trim()) {
    data.mensajeBaneo = mensajeBaneo.trim();
  }

  if (typeof fechaBaneo === 'string' && fechaBaneo.trim()) {
    data.fechaBaneo = fechaBaneo.trim();
  }

  if (typeof baneoPor === 'string' && baneoPor.trim()) {
    data.baneoPor = baneoPor.trim();
  }

  return data;
}
