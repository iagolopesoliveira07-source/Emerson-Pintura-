import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Textarea, FormActions } from '../Form/Form';
import { formatCurrency, getTodayISO } from '../../utils/formatters';
import {
  formatPeriodicidadeVisivel,
  formatYearMonth,
  getPeriodoCoberto,
  getYearMonth,
  isCoberturaLonga,
  temPagamentoRegistadoNoPeriodo,
} from '../../utils/empresaFinanceiroCalculations';
import { DESPESA_NATUREZA } from '../../constants/empresaFinanceiro';

export default function RegistrarPagamentoProgramadaModal({
  isOpen,
  onClose,
  despesa = null,
  gastos = [],
  mesReferencia = '',
  onSubmit,
}) {
  const [data, setData] = useState(getTodayISO());
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (!isOpen || !despesa) return;
    const cobertura = isCoberturaLonga(despesa) ? getPeriodoCoberto(despesa, { gastos }) : null;
    let dataDefault = getTodayISO();
    if (cobertura?.fim && mesReferencia && mesReferencia === getYearMonth(cobertura.fim)) {
      dataDefault = cobertura.fim;
    }
    setData(dataDefault);
    setValor(despesa.valor != null && despesa.valor !== '' ? String(despesa.valor) : '');
    setObservacao('');
  }, [isOpen, despesa, gastos, mesReferencia]);

  if (!despesa) return null;

  const periodo = mesReferencia || data;
  const jaPago = temPagamentoRegistadoNoPeriodo(despesa, {
    gastos,
    data: periodo,
    yearMonth: mesReferencia,
  });
  const cobertura = isCoberturaLonga(despesa)
    ? despesa.duracaoMeses
      ? `${despesa.duracaoMeses} ${despesa.duracaoMeses === 1 ? 'mês' : 'meses'}`
      : formatPeriodicidadeVisivel(despesa)
    : '';
  const mesLabel = mesReferencia ? formatYearMonth(mesReferencia) : '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (jaPago) return;
    const parsed = Number(String(valor).replace(',', '.'));
    onSubmit({
      data,
      estado: 'pago',
      valor: Number.isFinite(parsed) ? parsed : despesa.valor,
      mesReferencia: mesReferencia || undefined,
      observacao: observacao.trim(),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Descontado neste mês"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="registar-pagamento-programada" disabled={jaPago}>
            Confirmar desconto
          </Button>
        </FormActions>
      }
    >
      <form id="registar-pagamento-programada" onSubmit={handleSubmit}>
        <p style={{ marginTop: 0, marginBottom: '0.35rem' }}>
          <strong>{despesa.natureza === DESPESA_NATUREZA.SEGURO ? 'Seguro' : 'Despesa'}:</strong>{' '}
          {despesa.titulo}
        </p>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Confirma que o valor saiu da conta. No mês seguinte esta despesa volta a aparecer como
          pendente, sem apagar o histórico.
          {mesLabel ? ` Mês de referência: ${mesLabel}.` : ''}
        </p>
        {cobertura ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Cobertura: {cobertura}
          </p>
        ) : null}
        {jaPago ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-warning)' }}>
            Este mês já está marcado como descontado.
          </p>
        ) : null}
        <FormGroup label="Valor pago" required>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </FormGroup>
        <p style={{ margin: '-0.35rem 0 0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Valor habitual: {formatCurrency(despesa.valor)}
        </p>
        <FormGroup label="Data real em que foi descontado" required>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </FormGroup>
        <FormGroup label="Observação (opcional)">
          <Textarea
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: saiu por débito directo"
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
