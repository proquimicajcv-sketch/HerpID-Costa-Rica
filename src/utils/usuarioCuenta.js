export function resolverDestinoEliminacionCuenta({ uid, email }) {
  const uidLimpio = String(uid || '').trim();
  const emailLimpio = String(email || '').trim().toLowerCase();

  if (!uidLimpio) {
    throw new Error('Se requiere uid o email para eliminar la cuenta.');
  }

  return {
    uid: uidLimpio,
    email: emailLimpio
  };
}
