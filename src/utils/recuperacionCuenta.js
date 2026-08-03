export function generarCodigoRecuperacion() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function normalizarContactoRecuperacion(contacto) {
  const valor = String(contacto || '').trim().toLowerCase();
  if (!valor) return '';

  if (valor.includes('@')) return valor;

  const numeros = valor.replace(/\D/g, '');
  if (numeros.startsWith('506') && numeros.length > 8) {
    return numeros.slice(3);
  }

  return numeros;
}
