import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, FormRow, FormActions } from '../Form/Form';
import {
  DESCONTO_ALUGUEL_ESTADOS,
  DESCONTO_MENSAL_ESTADOS,
  DESCONTO_UNICO_ESTADOS,
  QUANDO_DESCONTAR,
  QUANDO_DESCONTAR_OPTIONS,
  QUANDO_DESCONTAR_LABEL,
  TIPO_DESCONTO,
  TIPO_DESCONTO_FORM_LABEL,
  TIPO_DESCONTO_FORM_OPTIONS,
  defaultQuandoDescontarForTipo,
  getParcelasDescontadas,
  getParcelasRestantesLabelFromValues,
  getQuandoDescontar,
  getTipoDesconto,
  resolveTipoCobranca,
} from '../../utils/commitmentCalculations';
import { getTodayISO } from '../../utils/formatters';
import { validateRequired, validateNumber, validateForm } from '../../utils/validators';
import styles from './Commitments.module.css';

const emptyForm = () => ({
  tipoDesconto: TIPO_DESCONTO.ADIANTAMENTO,
  descricao: '',
  valorMensal: '',
  valorTotal: '',
  totalParcelas: '10',
  parcelaAtual: '0',
  dataInicio: getTodayISO(),
  observacao: '',
  estado: 'Pendente',
  quandoDescontar: QUANDO_DESCONTAR.UNICO,
});

function estadoDefault(tipo, quando) {
  if (quando === QUANDO_DESCONTAR.UNICO) return 'Pendente';
  if (tipo === TIPO_DESCONTO.ALUGUEL) return 'Ativo';
  return 'Ativo';
}

export default function DescontoFormModal({
  isOpen,
  onClose,
  onSubmit,
  desconto = null,
}) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const isEdit = Boolean(desconto);
  const tipo = form.tipoDesconto;
  const quando = form.quandoDescontar;
  const isEmprestimo = tipo === TIPO_DESCONTO.EMPRESTIMO;
  const isAluguel = tipo === TIPO_DESCONTO.ALUGUEL;
  const isCobrancaUnica = quando === QUANDO_DESCONTAR.UNICO;

  useEffect(() => {
    if (!isOpen) return;
    if (!desconto) {
      setForm(emptyForm());
      setErrors({});
      return;
    }

    const tipoDesconto = getTipoDesconto(desconto);
    const quandoDescontar = getQuandoDescontar(desconto);
    setForm({
      tipoDesconto,
      descricao: desconto.descricao || desconto.motivo || '',
      valorMensal: String(desconto.valorMensal ?? desconto.valorParcela ?? ''),
      valorTotal: String(
        desconto.valorTotal ??
          (desconto.totalParcelas
            ? Math.round((Number(desconto.valorMensal || desconto.valorParcela || 0) * Number(desconto.totalParcelas)) * 100) / 100
            : '')
      ),
      totalParcelas: String(desconto.totalParcelas ?? '10'),
      parcelaAtual: String(getParcelasDescontadas(desconto)),
      dataInicio: desconto.dataInicio || desconto.data || getTodayISO(),
      observacao: desconto.observacao || '',
      estado:
        quandoDescontar === QUANDO_DESCONTAR.UNICO
          ? desconto.estado === 'Descontado' || desconto.estado === 'Concluído'
            ? 'Descontado'
            : 'Pendente'
          : tipoDesconto === TIPO_DESCONTO.ALUGUEL
            ? desconto.estado === 'Inativo' || desconto.estado === 'Encerrado'
              ? 'Inativo'
              : 'Ativo'
            : desconto.estado === 'Inativo'
              ? 'Encerrado'
              : desconto.estado || 'Ativo',
      quandoDescontar,
    });
    setErrors({});
  }, [isOpen, desconto]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (prev.tipoDesconto === TIPO_DESCONTO.EMPRESTIMO) {
        const total = parseFloat(name === 'valorTotal' ? value : prev.valorTotal);
        const parcelas = parseInt(name === 'totalParcelas' ? value : prev.totalParcelas, 10);
        const parcela = parseFloat(name === 'valorMensal' ? value : prev.valorMensal);
        if (name === 'valorTotal' || name === 'totalParcelas') {
          if (total > 0 && parcelas > 0) {
            next.valorMensal = String(Math.round((total / parcelas) * 100) / 100);
          }
        } else if (name === 'valorMensal' && parcela > 0 && parcelas > 0 && !prev.valorTotal) {
          next.valorTotal = String(Math.round(parcela * parcelas * 100) / 100);
        }
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleTipoChange = (tipoDesconto) => {
    if (isEdit) return;
    setForm((prev) => {
      const quandoDescontar = defaultQuandoDescontarForTipo(tipoDesconto);
      return {
        ...prev,
        tipoDesconto,
        quandoDescontar,
        estado: estadoDefault(tipoDesconto, quandoDescontar),
      };
    });
    setErrors({});
  };

  const handleQuandoChange = (quandoDescontar) => {
    setForm((prev) => ({
      ...prev,
      quandoDescontar,
      estado: isEdit ? prev.estado : estadoDefault(prev.tipoDesconto, quandoDescontar),
    }));
  };

  const valorLabel = isEmprestimo
    ? 'Valor da parcela (€)'
    : quando === QUANDO_DESCONTAR.MENSAL
      ? 'Valor mensal (€)'
      : quando === QUANDO_DESCONTAR.SEMANAL
        ? 'Valor semanal (€)'
        : 'Valor (€)';

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateForm({
      descricao: validateRequired(form.descricao, isAluguel ? 'Descrição' : 'Motivo'),
      valorMensal: validateNumber(form.valorMensal, isEmprestimo ? 'Valor da parcela' : 'Valor', 0.01),
      dataInicio: validateRequired(form.dataInicio, isCobrancaUnica ? 'Data' : 'Data de início'),
    });

    if (isEmprestimo) {
      const valorTotal = parseFloat(form.valorTotal);
      const totalParcelas = parseInt(form.totalParcelas, 10);
      const parcelasDescontadas = parseInt(form.parcelaAtual, 10);
      if (!valorTotal || valorTotal <= 0) {
        validation.errors.valorTotal = 'Informe o valor total';
        validation.isValid = false;
      }
      if (!totalParcelas || totalParcelas < 1) {
        validation.errors.totalParcelas = 'Informe a quantidade de parcelas';
        validation.isValid = false;
      }
      if (
        Number.isNaN(parcelasDescontadas) ||
        parcelasDescontadas < 0 ||
        parcelasDescontadas > totalParcelas
      ) {
        validation.errors.parcelaAtual = `Parcelas já descontadas deve estar entre 0 e ${totalParcelas || '?'}`;
        validation.isValid = false;
      }
    }

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    onSubmit({
      ...form,
      tipoCobranca: resolveTipoCobranca({
        tipoDesconto: form.tipoDesconto,
        quandoDescontar: form.quandoDescontar,
        totalParcelas: form.totalParcelas,
      }),
      quandoDescontar: form.quandoDescontar,
    });
  };

  const previewLabel = isEmprestimo
    ? getParcelasRestantesLabelFromValues(form.parcelaAtual, form.totalParcelas)
    : '';
  const saldoPreview =
    isEmprestimo && form.totalParcelas && form.parcelaAtual !== '' && form.valorMensal
      ? Math.max(0, parseInt(form.totalParcelas, 10) - parseInt(form.parcelaAtual, 10)) *
        parseFloat(form.valorMensal || 0)
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar desconto' : 'Novo desconto'}
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEdit ? 'Guardar' : 'Adicionar'}</Button>
        </FormActions>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormGroup label="Tipo">
          <p className={styles.fieldHint}>O motivo / categoria deste desconto.</p>
          <div className={styles.tipoSelector}>
            {TIPO_DESCONTO_FORM_OPTIONS.map((value) => (
              <label key={value} className={styles.tipoOption}>
                <input
                  type="radio"
                  name="tipoDesconto"
                  checked={form.tipoDesconto === value}
                  onChange={() => handleTipoChange(value)}
                  disabled={isEdit}
                />
                {TIPO_DESCONTO_FORM_LABEL[value]}
              </label>
            ))}
          </div>
        </FormGroup>

        <FormGroup label="Quando descontar?">
          <p className={styles.fieldHint}>Como e quando este desconto deve ser cobrado.</p>
          <div className={styles.tipoSelector}>
            {QUANDO_DESCONTAR_OPTIONS.map((value) => (
              <label key={value} className={styles.tipoOption}>
                <input
                  type="radio"
                  name="quandoDescontar"
                  checked={form.quandoDescontar === value}
                  onChange={() => handleQuandoChange(value)}
                />
                {QUANDO_DESCONTAR_LABEL[value]}
              </label>
            ))}
          </div>
        </FormGroup>

        <FormGroup label={isAluguel ? 'Descrição / local' : 'Motivo'} required error={errors.descricao}>
          <Input
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            error={errors.descricao}
            placeholder={
              tipo === TIPO_DESCONTO.ADIANTAMENTO
                ? 'Ex.: Adiantamento de vencimento'
                : isAluguel
                  ? 'Ex.: Casa do João'
                  : isEmprestimo
                    ? 'Ex.: Empréstimo'
                    : 'Ex.: Desconto combinado'
            }
          />
        </FormGroup>

        {isEmprestimo ? (
          <>
            <FormRow>
              <FormGroup label="Valor total (€)" required error={errors.valorTotal}>
                <Input
                  name="valorTotal"
                  type="number"
                  step="0.01"
                  value={form.valorTotal}
                  onChange={handleChange}
                  error={errors.valorTotal}
                />
              </FormGroup>
              <FormGroup label="Valor da parcela (€)" required error={errors.valorMensal}>
                <Input
                  name="valorMensal"
                  type="number"
                  step="0.01"
                  value={form.valorMensal}
                  onChange={handleChange}
                  error={errors.valorMensal}
                />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup label="Quantidade de parcelas" required error={errors.totalParcelas}>
                <Input
                  name="totalParcelas"
                  type="number"
                  min="1"
                  step="1"
                  value={form.totalParcelas}
                  onChange={handleChange}
                  error={errors.totalParcelas}
                />
              </FormGroup>
              <FormGroup label="Parcelas já descontadas" required error={errors.parcelaAtual}>
                <Input
                  name="parcelaAtual"
                  type="number"
                  min="0"
                  step="1"
                  value={form.parcelaAtual}
                  onChange={handleChange}
                  error={errors.parcelaAtual}
                />
              </FormGroup>
            </FormRow>
            <FormGroup label="Data de início" required error={errors.dataInicio}>
              <Input
                name="dataInicio"
                type="date"
                value={form.dataInicio}
                onChange={handleChange}
                error={errors.dataInicio}
              />
            </FormGroup>

            {form.totalParcelas && form.parcelaAtual !== '' && (
              <div className={styles.parcelaPreview}>
                <span className={styles.parcelaPreviewTitle}>RESUMO DO EMPRÉSTIMO</span>
                <strong className={styles.parcelaPreviewValue}>
                  {form.parcelaAtual} pagas · {previewLabel || ''}
                </strong>
                {Number.isFinite(saldoPreview) && (
                  <span className={styles.parcelaPreviewHint}>
                    Saldo restante: {saldoPreview.toFixed(2)} €
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <FormRow>
              <FormGroup label={valorLabel} required error={errors.valorMensal}>
                <Input
                  name="valorMensal"
                  type="number"
                  step="0.01"
                  value={form.valorMensal}
                  onChange={handleChange}
                  error={errors.valorMensal}
                />
              </FormGroup>
              <FormGroup label={isCobrancaUnica ? 'Data' : 'Data de início'} required error={errors.dataInicio}>
                <Input
                  name="dataInicio"
                  type="date"
                  value={form.dataInicio}
                  onChange={handleChange}
                  error={errors.dataInicio}
                />
              </FormGroup>
            </FormRow>
            <FormGroup label="Estado">
              <Select name="estado" value={form.estado} onChange={handleChange}>
                {(isCobrancaUnica
                  ? DESCONTO_UNICO_ESTADOS
                  : isAluguel
                    ? DESCONTO_ALUGUEL_ESTADOS
                    : DESCONTO_MENSAL_ESTADOS
                ).map((estado) => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </Select>
            </FormGroup>
            {isAluguel && (
              <FormGroup label="Observação">
                <Input
                  name="observacao"
                  value={form.observacao}
                  onChange={handleChange}
                  placeholder="Opcional"
                />
              </FormGroup>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
