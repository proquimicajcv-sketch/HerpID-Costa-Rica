export function validarRegistroContacto({ credencialInput, correoRecuperacion }) {
  const input = String(credencialInput || '').trim();
  const correo = String(correoRecuperacion || '').trim().toLowerCase();

  if (!input) {
    return { ok: false, error: 'Debes ingresar un correo válido o un número de celular para registrarte.' };
  }

  if (input.includes('@')) {
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    if (!emailValido) {
      return { ok: false, error: 'Ingresa un correo electrónico válido.' };
    }

    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return { ok: false, error: 'Si agregas un correo de recuperación, debe ser un correo válido.' };
    }

    return { ok: true, esCorreo: true, emailFinal: input.toLowerCase(), telefono: '' };
  }

  const soloNumeros = input.replace(/\D/g, '');
  if (soloNumeros.length < 8) {
    return { ok: false, error: 'Ingresa un número de celular válido para registrarte.' };
  }

  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return {
      ok: false,
      error: 'Para cuentas con celular, agrega un correo de recuperación válido. Ese correo será clave para recuperar el acceso si olvidas la contraseña.'
    };
  }

  return { ok: true, esCorreo: false, emailFinal: correo, telefono: soloNumeros };
}
