export function determinarDestinoLogo({ esAdmin, hayLogoGlobal }) {
  if (esAdmin) return 'global';
  return 'personal';
}
