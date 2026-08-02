export const getSafeString = (value) => (typeof value === 'string' ? value : '');

export const normalizeLower = (value) => getSafeString(value).toLowerCase();

export const normalizeText = (value) => getSafeString(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export const hasText = (value, search) => getSafeString(value).includes(getSafeString(search));

export const hasRole = (value, role) => hasText(value, role);
