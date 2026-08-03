export const normalizarContactoBaneo = (valor) => {
  if (typeof valor !== 'string') return '';

  const limpio = valor.trim().toLowerCase();
  if (!limpio) return '';

  if (limpio.startsWith('tel_')) {
    return limpio.replace(/^tel_/, '').replace(/@herpid\.cr$/, '');
  }

  if (limpio.includes('@')) {
    return limpio;
  }

  const soloNumeros = limpio.replace(/[^0-9]/g, '');
  if (soloNumeros.startsWith('506') && soloNumeros.length > 8) {
    return soloNumeros.slice(3);
  }

  return soloNumeros.replace(/^\+/, '');
};

export const construirMensajeBaneo = (motivo = 'Violación de las reglas de la comunidad') => {
  const motivoNormalizado = String(motivo || 'Violación de las reglas de la comunidad').trim();
  return `Tu cuenta ha sido suspendido por ${motivoNormalizado}. Contacta a un administrador para más información.`;
};
