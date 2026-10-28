import { validateRequired, validateNumber, validateDate, validateTelefone, validateForm } from './validators';
import {
  OBRA_STATUS,
  OBRA_STATUS_DEFAULT,
  normalizeObraStatus,
  isValidObraStatus,
  createStatusHistoryEntry,
  applyConcluidaEmOnStatusChange,
} from './obraStatus';
import { buildObraIvaFields, hasObraIva, previewObraIvaFromForm } from './obraIva';
import {
  preserveSpecialObraFields,
  resolveFinancialModelForSave,
  getTipoObra,
  createAptoTaviraAcordo,
} from './obraSpecial';
import { TIPO_OBRA } from './obraTipo';
import { partnershipToForm, buildPartnershipFields } from './obraPartnership';
import { prepaidCreditToForm, buildPrepaidCreditFields, isPrepaidCreditObra } from './obraPrepaidCredit';
import { createCreditJobConfig } from './obraCreditJob';

export const EMPTY_OBRA_FORM = {
  nome: '',
  cliente: '',
  telefone: '',
  morada: '',
  valorContratado: '',
  dataInicio: '',
  dataPrevistaTermino: '',
  estado: OBRA_STATUS_DEFAULT,
  motivoPausa: '',
  observacoes: '',
  ivaObra: 'nao',
  taxaIva: '',
  tipoObra: TIPO_OBRA.NORMAL,
  parceriaObra: 'nao',
  parceiroNome: 'Fábio',
  percentagemEmpresa: '',
  percentagemParceiro: '',
  creditoPrePago: 'nao',
  creditoInicial: '',
};

const EDITABLE_FIELDS = [
  'nome',
  'cliente',
  'telefone',
  'morada',
  'valorContratado',
  'dataInicio',
  'dataPrevistaTermino',
  'estado',
  'motivoPausa',
  'observacoes',
  'possuiIva',
  'taxaIva',
  'valorSemIva',
  'valorIva',
  'valorComIva',
];

export function obraToForm(obra) {
  if (!obra) return { ...EMPTY_OBRA_FORM };

  const estado = normalizeObraStatus(obra.estado);
  const tipoObra = getTipoObra(obra);
  const partnershipForm = partnershipToForm(obra);
  const valor =
    tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA
      ? obra.valorContratado > 0
        ? String(obra.valorContratado)
        : ''
      : obra.valorContratado != null
        ? String(obra.valorContratado)
        : '';

  return {
    nome: obra.nome || '',
    cliente: obra.cliente || '',
    telefone: obra.telefone || '',
    morada: obra.morada || '',
    valorContratado: valor,
    dataInicio: obra.dataInicio || '',
    dataPrevistaTermino: obra.dataPrevistaTermino || '',
    estado,
    motivoPausa: obra.motivoPausa || '',
    observacoes: obra.observacoes || '',
    ivaObra: hasObraIva(obra) ? 'sim' : 'nao',
    taxaIva: hasObraIva(obra) && obra.taxaIva != null ? String(obra.taxaIva) : '',
    tipoObra,
    ...partnershipForm,
    parceriaObra: tipoObra === TIPO_OBRA.PARCERIA ? 'sim' : partnershipForm.parceriaObra,
    ...prepaidCreditToForm(obra),
  };
}

export function formToObraPayload(form, existingObra = null, { funcionarios = [] } = {}) {
  const estado = normalizeObraStatus(form.estado);
  const tipoObra = form.tipoObra || TIPO_OBRA.NORMAL;
  const formComTipo = {
    ...form,
    tipoObra,
    parceriaObra: tipoObra === TIPO_OBRA.PARCERIA ? 'sim' : 'nao',
  };
  const ivaFields = tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA ? {} : buildObraIvaFields(formComTipo, existingObra);
  const partnershipFields = buildPartnershipFields(formComTipo, existingObra, { funcionarios });
  const prepaidFields =
    existingObra && isPrepaidCreditObra(existingObra)
      ? buildPrepaidCreditFields(formComTipo, existingObra)
      : {};

  if (formComTipo.ivaObra === 'sim' && tipoObra !== TIPO_OBRA.ESPECIAL_TAVIRA && !ivaFields) {
    return null;
  }
  if (partnershipFields.error) {
    return null;
  }
  if (prepaidFields.error) {
    return null;
  }

  const parsedValor = parseFloat(form.valorContratado);
  const valorContratado =
    tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA
      ? existingObra?.valorContratado > 0
        ? existingObra.valorContratado
        : null
      : form.ivaObra === 'sim' && ivaFields?.valorSemIva != null
        ? ivaFields.valorSemIva
        : Number.isFinite(parsedValor)
          ? parsedValor
          : existingObra?.valorContratado ?? null;

  const payload = {
    nome: form.nome.trim(),
    cliente: (form.cliente.trim() || form.nome.trim()),
    telefone: form.telefone.trim(),
    morada: form.morada.trim(),
    valorContratado,
    dataInicio: form.dataInicio?.trim() || null,
    dataPrevistaTermino: form.dataPrevistaTermino?.trim() || null,
    estado,
    motivoPausa: estado === 'Pausada' ? (form.motivoPausa || '').trim() : '',
    observacoes: form.observacoes.trim(),
    tipoObra,
    ...ivaFields,
    ...partnershipFields,
    ...prepaidFields,
  };

  if (tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA) {
    payload.acordoEspecial = createAptoTaviraAcordo(existingObra?.acordoEspecial);
  }
  const creditoPrePagoAtivo = prepaidFields.prepaidCredit?.enabled === true;
  if (tipoObra === TIPO_OBRA.CREDITO && !creditoPrePagoAtivo) {
    payload.creditJob = createCreditJobConfig({
      enabled: true,
      parcelas: existingObra?.creditJob?.parcelas || existingObra?.parcelasCredito || [],
    });
  } else if (existingObra?.creditJob) {
    payload.creditJob = { ...existingObra.creditJob, enabled: false };
  }

  const financialModel = resolveFinancialModelForSave(existingObra, {
    partnership: partnershipFields.partnership,
    prepaidCredit: prepaidFields.prepaidCredit,
    tipoObra,
  });
  if (financialModel) payload.financialModel = financialModel;

  return payload;
}

export function validateObraForm(form, options = {}) {
  const estadoError = isValidObraStatus(form.estado) ? null : 'Status inválido.';
  const tipoObra = form.tipoObra || TIPO_OBRA.NORMAL;
  const creditoAtivo = form.creditoPrePago === 'sim';
  const tavira = tipoObra === TIPO_OBRA.ESPECIAL_TAVIRA;
  const creditoJob = tipoObra === TIPO_OBRA.CREDITO;
  const minValor = options.allowZeroValor || creditoAtivo || tavira || creditoJob ? 0 : 0.01;
  const valorContratadoVazio = form.valorContratado === '' || form.valorContratado == null;

  const errors = {
    nome: validateRequired(form.nome, 'Nome da obra'),
    cliente: tavira ? null : validateRequired(form.cliente, 'Cliente'),
    valorContratado:
      tavira || ((creditoAtivo || creditoJob) && valorContratadoVazio)
        ? null
        : validateNumber(form.valorContratado, creditoJob ? 'Valor acordado' : 'Valor contratado', minValor),
    dataInicio: form.dataInicio ? validateDate(form.dataInicio, 'Data de início') : null,
    dataPrevistaTermino: form.dataPrevistaTermino
      ? validateDate(form.dataPrevistaTermino, 'Data prevista de término')
      : null,
    telefone: validateTelefone(form.telefone),
    estado: estadoError,
    ivaObra:
      tavira || form.ivaObra === 'sim' || form.ivaObra === 'nao'
        ? null
        : 'Indique se a obra tem IVA.',
    tipoObra: Object.values(TIPO_OBRA).includes(tipoObra) ? null : 'Tipo de obra inválido.',
  };

  if (form.ivaObra === 'sim' && !tavira) {
    errors.taxaIva = validateRequired(form.taxaIva, 'Taxa de IVA');
    if (!errors.taxaIva && !previewObraIvaFromForm(form)) {
      errors.valorContratado = errors.valorContratado || 'Não foi possível calcular o IVA. Verifique o valor e a taxa.';
    }
  }

  if (tipoObra === TIPO_OBRA.PARCERIA) {
    errors.parceiroNome = validateRequired(form.parceiroNome || 'Fábio', 'Nome do parceiro');
    const hasAnyPercent =
      String(form.percentagemEmpresa || '').trim() !== '' || String(form.percentagemParceiro || '').trim() !== '';
    if (hasAnyPercent) {
      errors.percentagemEmpresa = validateNumber(form.percentagemEmpresa, 'Percentagem da empresa', 0);
      errors.percentagemParceiro = validateNumber(form.percentagemParceiro, 'Percentagem do parceiro', 0);
      const partnershipFields = buildPartnershipFields(
        { ...form, parceriaObra: 'sim', tipoObra },
        options.existingObra,
        { funcionarios: options.funcionarios }
      );
      if (partnershipFields.error) {
        errors.percentagemParceiro = partnershipFields.error;
      }
    }
  }

  if (creditoAtivo) {
    errors.creditoInicial = validateNumber(form.creditoInicial, 'Crédito inicial', 0.01);
    const prepaidFields = buildPrepaidCreditFields(form, options.existingObra);
    if (prepaidFields.error) {
      errors.creditoInicial = prepaidFields.error;
    }
  }

  return validateForm(errors);
}

export function isObraFormDirty(form, initialForm) {
  return JSON.stringify(form) !== JSON.stringify(initialForm);
}

const IVA_TRACKED_FIELDS = new Set(['possuiIva', 'taxaIva', 'valorSemIva', 'valorIva', 'valorComIva']);

function trackObraChanges(obra, payload) {
  const now = new Date().toISOString();

  return EDITABLE_FIELDS.reduce((changes, campo) => {
    if (IVA_TRACKED_FIELDS.has(campo) && !Object.prototype.hasOwnProperty.call(payload, campo)) {
      return changes;
    }

    const valorAnterior = obra[campo] ?? '';
    const valorNovo = payload[campo] ?? '';

    if (String(valorAnterior) !== String(valorNovo)) {
      changes.push({
        data: now,
        campo,
        valorAnterior,
        valorNovo,
      });
    }

    return changes;
  }, []);
}

export function buildObraUpdate(obra, form, options = {}) {
  const payload = formToObraPayload(form, obra, options);
  if (!payload) return obra;
  const alteracoes = trackObraChanges(obra, payload);
  const statusAnterior = normalizeObraStatus(obra.estado);
  const statusNovo = payload.estado;
  const historicoStatus = [...(obra.historicoStatus || [])];

  if (statusAnterior !== statusNovo) {
    historicoStatus.push(
      createStatusHistoryEntry(statusAnterior, statusNovo, payload.motivoPausa || null)
    );
  }

  return applyConcluidaEmOnStatusChange(
    obra,
    preserveSpecialObraFields(obra, {
      ...obra,
      ...payload,
      updatedAt: new Date().toISOString(),
      historicoAlteracoes: [...(obra.historicoAlteracoes || []), ...alteracoes],
      historicoStatus,
    })
  );
}

export { OBRA_STATUS };
