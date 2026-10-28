export const SEMANAS_MES = [1, 2, 3, 4];

export function getReferenciaMesAno(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getSemanaDoMes(date = new Date()) {
  const day = (date instanceof Date ? date : new Date(date)).getDate();
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export function getSemanaLabel(semana) {
  return `Semana ${semana}`;
}
