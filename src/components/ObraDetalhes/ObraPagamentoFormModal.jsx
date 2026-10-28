import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormRow, FormActions } from '../Form/Form';
import { METODOS_PAGAMENTO } from '../../data/mockData';
import { formatCurrency, getTodayISO } from '../../utils/formatters';
import { validateNumber, validateRequired, validateForm } from '../../utils/validators';
import { calcObraRecebimentoResumo } from '../../utils/debtCalculations';
import { applyObraExtrasToResumo } from '../../utils/obraExtras';
import { validateObraPaymentAmount } from '../../utils/obraPagamentoCalculations';
import styles from './ObraPagamentosSection.module.css';

function obraMantemSaldoAntigo(obra) {
  return obra?.tipoObra === 'parceria' || obra?.partnership?.enabled === true;
}

export default function ObraPagamentoFormModal({
  isOpen,
  onClose,
  obra,
  pagamentos,
  onSubmit,
  mode = 'create',
  pagamento = null,
}) {
  const [form, setForm] = useState({
    valor: '',
    data: getTodayISO(),
    metodoPagamento: 'Transferência',
    observacao: '',
  });
  const [errors, setErrors] = useState({});

  const resumoBase = obra ? calcObraRecebimentoResumo(obra, pagamentos) : null;
  const resumo = obra && resumoBase ? applyObraExtrasToResumo(obra, resumoBase) : null;

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && pagamento) {
      setForm({
        valor: String(getValorForForm(pagamento)),
        data: pagamento.data || getTodayISO(),
        metodoPagamento: pagamento.metodoPagamento || 'Transferência',
        observacao: pagamento.observacao || '',
      });
    } else {
      const saldoInicial = obraMantemSaldoAntigo(obra) ? resumoBase?.valorRestante : resumo?.valorRestante;
      setForm({
        valor: saldoInicial ? String(saldoInicial) : '',
        data: getTodayISO(),
        metodoPagamento: 'Transferência',
        observacao: '',
      });
    }
    setErrors({});
  }, [isOpen, mode, pagamento, obra, resumoBase?.valorRestante, resumo?.valorRestante]);

  if (!obra) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validation = validateForm({
      valor: validateNumber(form.valor, 'Valor recebido', 0.01),
      data: validateRequired(form.data, 'Data'),
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const valor = parseFloat(form.valor);

    if (mode === 'create') {
      const amountCheck = validateObraPaymentAmount(obra, pagamentos, valor);
      if (!amountCheck.isValid && amountCheck.exceedsRemaining) {
        const confirmed = window.confirm(
          `${amountCheck.message}\n\nDeseja registar mesmo assim este pagamento?`
        );
        if (!confirmed) return;
      } else if (!amountCheck.isValid) {
        setErrors({ valor: amountCheck.message });
        return;
      }
    }

    onSubmit({
      valor,
      data: form.data,
      metodoPagamento: form.metodoPagamento,
      observacao: form.observacao,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar pagamento' : 'Registrar pagamento'}
      footer={
        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>
            {mode === 'edit' ? 'Guardar alterações' : 'Confirmar pagamento'}
          </Button>
        </FormActions>
      }
    >
      <form onSubmit={handleSubmit}>
        {resumo && mode === 'create' && (
          <div className={styles.paymentSummary}>
            <div className={styles.paymentSummaryGrid}>
              <div>
                <span>Valor original</span>
                <strong>{formatCurrency(resumo.valorOriginal ?? resumo.valorContratado)}</strong>
              </div>
              {resumo.extras?.total > 0.004 ? (
                <div>
                  <span>Extras/serviços</span>
                  <strong>{formatCurrency(resumo.extras.total)}</strong>
                </div>
              ) : null}
              {resumo.extras?.total > 0.004 ? (
                <div>
                  <span>Valor atualizado</span>
                  <strong>{formatCurrency(resumo.valorAtualizado)}</strong>
                </div>
              ) : null}
              <div>
                <span>Total recebido</span>
                <strong>{formatCurrency(resumo.valorRecebido)}</strong>
              </div>
              <div>
                <span>Falta receber</span>
                <strong className={styles.saldoDestaque}>
                  {formatCurrency(resumo.valorRestante)}
                </strong>
              </div>
            </div>
            {resumo.extras?.total > 0.004 && !obraMantemSaldoAntigo(obra) ? (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Os extras já estão no valor atualizado desta obra. Este pagamento abate esse total.
              </p>
            ) : null}
          </div>
        )}

        <FormRow>
          <FormGroup label="Valor recebido (€)" required error={errors.valor}>
            <Input
              name="valor"
              type="number"
              step="0.01"
              min="0.01"
              value={form.valor}
              onChange={handleChange}
              error={errors.valor}
            />
          </FormGroup>
          <FormGroup label="Data" required error={errors.data}>
            <Input name="data" type="date" value={form.data} onChange={handleChange} error={errors.data} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Método de pagamento">
          <Select name="metodoPagamento" value={form.metodoPagamento} onChange={handleChange}>
            {METODOS_PAGAMENTO.map((metodo) => (
              <option key={metodo} value={metodo}>{metodo}</option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup label="Observação">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>

        {mode === 'create' && resumo && (
          <p className={styles.paymentHint}>
            Restante após este pagamento:{' '}
            <strong className={styles.saldoDestaque}>
              {formatCurrency(Math.max(0, resumo.valorRestante - (parseFloat(form.valor) || 0)))}
            </strong>
          </p>
        )}
      </form>
    </Modal>
  );
}

function getValorForForm(pagamento) {
  return pagamento.valorRecebido ?? pagamento.valor ?? 0;
}
