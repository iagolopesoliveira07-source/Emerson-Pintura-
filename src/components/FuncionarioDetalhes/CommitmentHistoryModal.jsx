import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormActions } from '../Form/Form';
import {
  getCommitmentDisplayEstado,
  getDescontoHistoricoUnificado,
  getParcelasDescontadas,
  getParcelasRestantesCount,
  getQuandoDescontarLabel,
  getSaldoRestanteEmprestimo,
  getTipoDescontoLabel,
  getTotalParcelas,
  getValorParcela,
  getValorTotalEmprestimo,
  isCommitmentParcelado,
} from '../../utils/commitmentCalculations';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getFechamentoPeriodoLabel } from '../../utils/pagamentoPeriodCalculations';
import styles from './Commitments.module.css';

function labelDoPagamento(entry, fechamentosPagamento = []) {
  if (!entry?.fechamentoId) return '';
  const fechamento = fechamentosPagamento.find((item) => item.id === entry.fechamentoId);
  if (!fechamento) return 'Pagamento do período correspondente';
  const periodo = getFechamentoPeriodoLabel(fechamento);
  return periodo ? `Pagamento ${periodo}` : 'Pagamento do período correspondente';
}

export default function CommitmentHistoryModal({
  isOpen,
  onClose,
  item,
  onEdit,
  onDelete,
  onDesfazer,
  fechamentosPagamento = [],
}) {
  if (!item) return null;

  const historico = getDescontoHistoricoUnificado(item);
  const total = getTotalParcelas(item);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item.descricao || 'Detalhe'}
      footer={
        <FormActions>
          {onDelete ? (
            <Button variant="danger" onClick={onDelete}>Excluir</Button>
          ) : null}
          {onEdit ? (
            <Button variant="secondary" onClick={onEdit}>Editar</Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </FormActions>
      }
    >
      <p className={styles.historySummary}>
        Tipo: {getTipoDescontoLabel(item)} · Quando descontar: {getQuandoDescontarLabel(item)} ·{' '}
        {getCommitmentDisplayEstado(item)}
      </p>

      {isCommitmentParcelado(item) && (
        <p className={styles.historySummary}>
          {getParcelasDescontadas(item)} de {total} parcelas descontadas ·{' '}
          {getParcelasRestantesCount(item)} restantes · Saldo:{' '}
          {formatCurrency(getSaldoRestanteEmprestimo(item))}
          <br />
          Total {formatCurrency(getValorTotalEmprestimo(item))} · parcela{' '}
          {formatCurrency(getValorParcela(item))}
        </p>
      )}

      {!isCommitmentParcelado(item) && (
        <p className={styles.historySummary}>Valor a descontar: {formatCurrency(getValorParcela(item))}</p>
      )}

      <h4 className={styles.descontoGroupTitle}>Histórico de descontos</h4>
      {historico.length === 0 ? (
        <p className={styles.emptyHistory}>Ainda não há descontos registados neste lançamento.</p>
      ) : (
        <ul className={styles.historyList}>
          {historico.map((entry) => {
            const pagamento = labelDoPagamento(entry, fechamentosPagamento);
            return (
              <li key={entry.id} className={styles.historyItem}>
                <span className={styles.historyCheck}>✓</span>
                <span className={styles.historyText}>
                  {entry.kind === 'parcela' && total
                    ? `Parcela ${entry.numero}/${total}`
                    : entry.status === 'gasto'
                      ? entry.observacao || 'Registo'
                      : 'Desconto'}
                  {entry.origem === 'manual' && !entry.fechamentoId ? ' · Manual' : ''}
                  {entry.data ? ` · ${formatDate(entry.data)}` : entry.mesAno ? ` · ${entry.mesAno}` : ''}
                  {` · ${formatCurrency(entry.valor)}`}
                  {pagamento ? ` · ${pagamento}` : ''}
                </span>
                {onDesfazer && entry.id ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onDesfazer(entry)}
                  >
                    Desfazer
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

