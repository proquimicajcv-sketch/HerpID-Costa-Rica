export function resolverEspeciesGuiaAutorizadas(especiesGuia = []) {
  if (!Array.isArray(especiesGuia)) return [];
  return especiesGuia.filter((esp) => {
    const nombre = String(esp?.nombre || '').trim();
    const especie = String(esp?.especie || '').trim();
    return Boolean(nombre || especie);
  });
}
