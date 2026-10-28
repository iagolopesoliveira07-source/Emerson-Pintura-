export function validateRequired(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return `${label} é obrigatório.`;
  }
  return null;
}

export function validateNumber(value, label, min = 0) {
  const num = parseFloat(value);
  if (isNaN(num)) return `${label} deve ser um número válido.`;
  if (num < min) return `${label} deve ser no mínimo ${min}.`;
  return null;
}

export function validateDate(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `${label} deve ser uma data válida.`;
  }
  return null;
}

export function validateTelefone(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const cleaned = String(value).replace(/[\s\-()+]/g, '');
  if (!/^\d{9,15}$/.test(cleaned)) {
    return 'Telefone inválido. Use apenas números, espaços ou hífen.';
  }
  return null;
}

export function validateForm(fields) {
  const errors = {};
  for (const [key, error] of Object.entries(fields)) {
    if (error) errors[key] = error;
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
