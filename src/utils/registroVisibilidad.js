export const normalizarEstadoRegistro = (estado) => {
  if (typeof estado !== 'string') return '';
  return estado.trim().toUpperCase();
};

export const esRegistroValidado = (estado) => normalizarEstadoRegistro(estado) === 'VALIDADO';

export const puedeVerReportesEnMapa = () => true;

export const esRegistroVisibleEnMapa = (registro, { esAdminOExperto, esPropietarioReporte, estaAutenticado }) => {
  if (!registro) return false;
  if (!puedeVerReportesEnMapa(estaAutenticado)) return false;
  if (esAdminOExperto) return true;
  return esRegistroValidado(registro.estado) || (typeof esPropietarioReporte === 'function' && esPropietarioReporte(registro));
};
