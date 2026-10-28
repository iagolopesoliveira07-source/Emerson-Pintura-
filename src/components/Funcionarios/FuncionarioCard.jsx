import { Pencil, Trash2 } from 'lucide-react';
import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import { formatCurrency } from '../../utils/formatters';
import { isParceiroFuncionario } from '../../utils/funcionarioTipo';
import shared from '../../pages/shared.module.css';
import styles from './FuncionarioCard.module.css';

export default function FuncionarioCard({
  funcionario,
  pagamentoResumo,
  acertoSummary,
  periodStats,
  parceiro = false,
  onOpen,
  onEdit,
  onDelete,
}) {
  const isParceiro = parceiro || isParceiroFuncionario(funcionario);
  const isPaid = pagamentoResumo?.isPaid;

  return (
    <div
      className={`${shared.funcCard} ${
        isParceiro ? styles.cardParceiro : isPaid ? styles.cardPaid : styles.cardPending
      }`}
      onClick={onOpen}
    >
      <div className={shared.funcName}>{funcionario.nome}</div>
      <div className={shared.funcMeta}>{funcionario.telefone || 'Sem telefone'}</div>

      {isParceiro ? (
        <div className={styles.paymentInfo}>
          <div className={styles.diariaValue}>Parceiro de obras</div>
          <div className={styles.frequencia}>Controlo de presença — sem pagamento de diária</div>
        </div>
      ) : (
        <div className={styles.paymentInfo}>
          <div className={styles.diariaValue}>{formatCurrency(funcionario.valorDiaria)}/dia</div>
          <div className={styles.frequencia}>
            Pagamento: <strong>{pagamentoResumo?.frequencia || 'Semanal'}</strong>
          </div>
          <div className={isPaid ? styles.statusPaid : styles.statusPending}>
            {pagamentoResumo?.statusLabel || '🟠 Pendente — período atual'}
          </div>
          <div className={styles.periodLabel}>{pagamentoResumo?.periodLabel}</div>
        </div>
      )}

      {periodStats && (
        <div className={styles.periodStats}>
          No período: {periodStats.dias} {periodStats.dias === 1 ? 'dia' : 'dias'} ·{' '}
          {periodStats.quantidade} {periodStats.quantidade === 1 ? 'diária' : 'diárias'}
          {isParceiro
            ? periodStats.observacoes > 0
              ? ` · ${periodStats.observacoes} obs.`
              : ''
            : ` · ${formatCurrency(periodStats.total)}${
                periodStats.observacoes > 0 ? ` · ${periodStats.observacoes} obs.` : ''
              }`}
        </div>
      )}

      <div className={shared.funcCardActions} onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" size="sm" icon={Pencil} onClick={onEdit}>
          Editar
        </Button>
        <Button variant="danger" size="sm" icon={Trash2} onClick={onDelete}>
          Excluir
        </Button>
      </div>

      <div className={shared.funcFooter}>
        {isParceiro ? <Badge variant="info">Parceiro</Badge> : null}
        <Badge>{funcionario.estado}</Badge>
      </div>
    </div>
  );
}
