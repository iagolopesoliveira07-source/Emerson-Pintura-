import { validateRequired, validateNumber, validateDate, validateForm } from './validators';
import {
  DIARIA_FRACAO,
  isDiariaMultiObra,
  getDiariaAlocacoes,
} from './diariaObraAlocacao';

export const DIARIA_SEM_OBRA_LABEL = 'Serviço geral';

/** Valor inicial só de uma diária nova de parceiro. Não altera registos já gravados. */
export const PARCEIRO_DIARIA_INICIAL = 130;

export const EMPTY_DIARIA_FORM = {
  funcionarioId: '',
  obraId: '',
  intervencaoId: '',
  data: '',
  quantidade: '1',
  valorDiaria: '',
  observacao: '',
  multiObra: 'nao',
  obraId1: '',
  obraId2: '',
  fracao1: String(DIARIA_FRACAO.MEIO),
  fracao2: String(DIARIA_FRACAO.MEIO),
  intervencaoId1: '',
  intervencaoId2: '',
};

export function getDiariaObraLabel(obraId, resolveObraNome) {
  if (!obraId) return DIARIA_SEM_OBRA_LABEL;

  const nome = typeof resolveObraNome === 'function' ? resolveObraNome(obraId) : null;
  return nome && nome !== '—' ? nome : DIARIA_SEM_OBRA_LABEL;
}

export function diariaToForm(diaria) {
  if (!diaria) return { ...EMPTY_DIARIA_FORM };

  const multi = isDiariaMultiObra(diaria);
  const alocacoes = multi ? getDiariaAlocacoes(diaria) : [];
  const primeira = alocacoes[0] || {};
  const segunda = alocacoes[1] || {};

  return {
    funcionarioId: diaria.funcionarioId || '',
    obraId: diaria.obraId || '',
    intervencaoId: diaria.intervencaoId || '',
    data: diaria.data || '',
    quantidade: diaria.quantidade != null ? String(diaria.quantidade) : '1',
    valorDiaria: diaria.valorDiaria != null ? String(diaria.valorDiaria) : '',
    observacao: diaria.observacao || '',
    multiObra: multi ? 'sim' : 'nao',
    obraId1: primeira.obraId || diaria.obraId || '',
    obraId2: segunda.obraId || '',
    fracao1: String(primeira.quantidade || DIARIA_FRACAO.MEIO),
    fracao2: String(segunda.quantidade || DIARIA_FRACAO.MEIO),
    intervencaoId1: primeira.intervencaoId || '',
    intervencaoId2: segunda.intervencaoId || '',
  };
}

export function formToDiariaPayload(form, existingDiaria = null) {
  const multi = form.multiObra === 'sim';
  const payload = {
    funcionarioId: form.funcionarioId,
    data: form.data?.trim() || null,
    quantidade: multi ? 1 : parseFloat(form.quantidade),
    valorDiaria: parseFloat(form.valorDiaria),
    observacao: String(form.observacao || '').trim(),
    ajustes: existingDiaria?.ajustes || [],
  };

  if (multi) {
    const obrasDoDia = [
      {
        obraId: form.obraId1 || null,
        quantidade: parseFloat(form.fracao1) || DIARIA_FRACAO.MEIO,
        intervencaoId: form.intervencaoId1 || null,
      },
      {
        obraId: form.obraId2 || null,
        quantidade: parseFloat(form.fracao2) || DIARIA_FRACAO.MEIO,
        intervencaoId: form.intervencaoId2 || null,
      },
    ];
    payload.obraId = obrasDoDia[0].obraId;
    payload.intervencaoId = obrasDoDia[0].intervencaoId;
    payload.obrasDoDia = obrasDoDia;
  } else {
    payload.obraId = form.obraId || null;
    payload.intervencaoId = form.intervencaoId || null;
    if (existingDiaria && isDiariaMultiObra(existingDiaria)) {
      payload.obrasDoDia = [];
    }
  }

  return payload;
}

export function validateDiariaForm(form) {
  const multi = form.multiObra === 'sim';
  const errors = validateForm({
    funcionarioId: validateRequired(form.funcionarioId, 'Funcionário'),
    data: form.data ? validateDate(form.data, 'Data') : null,
    quantidade: multi ? null : validateNumber(form.quantidade, 'Quantidade', 0.5),
    valorDiaria: validateNumber(form.valorDiaria, 'Valor da diária', 0.01),
    obraId1: multi ? validateRequired(form.obraId1, '1.ª obra') : null,
    obraId2: multi ? validateRequired(form.obraId2, '2.ª obra') : null,
    fracao1: multi ? validateNumber(form.fracao1, 'Duração na 1.ª obra', 0.5) : null,
    fracao2: multi ? validateNumber(form.fracao2, 'Duração na 2.ª obra', 0.5) : null,
  });

  if (multi && form.obraId1 && form.obraId2 && form.obraId1 === form.obraId2) {
    errors.errors.obraId2 = 'Seleccione duas obras diferentes.';
    errors.isValid = false;
  }

  return errors;
}

export function isDiariaFormDirty(form, initialForm) {
  return JSON.stringify(form) !== JSON.stringify(initialForm);
}

export function buildDiariaUpdate(diaria, form, options = {}) {
  return {
    ...diaria,
    ...formToDiariaPayload(form, diaria, options),
    updatedAt: new Date().toISOString(),
  };
}

export function calcFormDiariaTotal(form) {
  const quantidade = form.multiObra === 'sim' ? 1 : parseFloat(form.quantidade) || 0;
  return quantidade * (parseFloat(form.valorDiaria) || 0);
}
