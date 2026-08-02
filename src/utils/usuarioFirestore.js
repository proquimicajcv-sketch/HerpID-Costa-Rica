export function crearDatosUsuarioFirestore({ uid, email, nombre, rol, ultimoAcceso, ultimoConexion }) {
  return {
    uid,
    email,
    nombre,
    rol,
    ultimoAcceso,
    ultimoConexion
  };
}
