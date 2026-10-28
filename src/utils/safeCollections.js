/** Listas persistidas podem vir incompletas, nulas ou no formato antigo. */

export function asRecordList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
}

export function asIdList(value) {
  if (Array.isArray(value)) {
    return value.filter((id) => id != null && id !== '');
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

export function sumMoney(list, pick = (item) => item?.valor) {
  return asRecordList(list).reduce((sum, item) => sum + (Number(pick(item)) || 0), 0);
}
