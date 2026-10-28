import { validateRequired, validateNumber, validateForm } from './validators';
import { getTodayISO } from './formatters';

export const EMPTY_PAGAMENTO_FORM = {
  tipo: 'Recebimento de cliente',
  descricao: '',
  valor: '',
  data: getTodayISO(),
  obraId: '',
  pessoaRelacionada: '',
  metodoPagamento: 'Transferência',
  observacao: '',
};

export function pagamentoToForm(pagamento) {
  if (!pagamento) return { ...EMPTY_PAGAMENTO_FORM, data: getTodayISO() };

  return {
    tipo: pagamento.tipo || 'Recebimento de cliente',
    descricao: pagamento.descricao || '',
    valor: pagamento.valor != null ? String(pagamento.valor) : '',
    data: pagamento.data || '',
    obraId: pagamento.obraId || '',
    pessoaRelacionada: pagamento.pessoaRelacionada || '',
    metodoPagamento: pagamento.metodoPagamento || 'Transferência',
    observacao: pagamento.observacao || '',
  };
}

export function formToPagamentoPayload(form) {
  return {
    tipo: form.tipo,
    descricao: form.descricao.trim(),
    valor: parseFloat(form.valor),
    data: form.data,
    obraId: form.obraId || null,
    pessoaRelacionada: form.pessoaRelacionada.trim(),
    metodoPagamento: form.metodoPagamento,
    observacao: form.observacao.trim(),
  };
}

export function validatePagamentoForm(form) {
  return validateForm({
    tipo: validateRequired(form.tipo, 'Tipo'),
    descricao: validateRequired(form.descricao, 'Descrição'),
    valor: validateNumber(form.valor, 'Valor', 0.01),
    data: validateRequired(form.data, 'Data'),
  });
}

export function isPagamentoFormDirty(form, initialForm) {
  return JSON.stringify(form) !== JSON.stringify(initialForm);
}

export function buildPagamentoUpdate(pagamento, form) {
  return {
    ...pagamento,
    ...formToPagamentoPayload(form),
    updatedAt: new Date().toISOString(),
  };
}

export function getEmptyPagamentoForm(overrides = {}) {
  return { ...EMPTY_PAGAMENTO_FORM, data: getTodayISO(), ...overrides };
}
