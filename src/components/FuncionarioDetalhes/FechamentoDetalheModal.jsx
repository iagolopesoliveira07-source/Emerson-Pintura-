import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import { FormActions } from '../Form/Form';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getFechamentoPeriodoLabel } from '../../utils/pagamentoPeriodCalculations';
import { getDiariasDoFechamento } from '../../utils/fechamentoPagamentoCalculations';
import styles from './FechamentoPagamento.module.css';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';

export default function FechamentoDetalheModal({
  isOpen,
  onClose,
  fechamento,
  diarias = [],
  onVerComprovativo,
}) {
  if (!fechamento) return null;
  const diariasIncluidas = getDiariasDoFechamento(fechamento, diarias);

  const totalAcrescimo =
    fechamento.totalAcrescimoManual ?? fechamento.totalGratificacao ?? 0;
  const acrescimoObservacao =
    fechamento.acrescimoObservacao || fechamento.gratificacaoObservacao || '';
  const totalDescontoManual = fechamento.totalDescontoManual || 0;

  const rows = [
    ['Data', formatDate(fechamento.data)],
    ['Tipo', fechamento.tipoPagamento],
    ['Período', getFechamentoPeriodoLabel(fechamento)],
    fechamento.semanaMes ? ['Semana', `Semana ${fechamento.semanaMes}`] : null,
    ['Referência', fechamento.referencia || '—'],
    ['Valor bruto', formatCurrency(fechamento.valorBruto ?? fechamento.totalDiarias)],
    totalAcrescimo > 0 ? ['Bónus / ajustes', formatCurrency(totalAcrescimo)] : null,
    totalAcrescimo > 0 && acrescimoObservacao
      ? ['Motivo do acréscimo', acrescimoObservacao]
      : null,
    totalDescontoManual > 0
      ? ['Desconto manual', `- ${formatCurrency(totalDescontoManual)}`]
      : null,
    totalDescontoManual > 0 && fechamento.descontoManualObservacao
      ? ['Motivo do desconto manual', fechamento.descontoManualObservacao]
      : null,
    ['Aluguéis recorrentes', fechamento.totalAluguelRecorrente > 0 ? `- ${formatCurrency(fechamento.totalAluguelRecorrente)}` : '—'],
    ['Descontos mensais', fechamento.totalDescontoRecorrente > 0 ? `- ${formatCurrency(fechamento.totalDescontoRecorrente)}` : '—'],
    ['Descontos parcelados', fechamento.totalDescontosParcelados > 0 ? `- ${formatCurrency(fechamento.totalDescontosParcelados)}` : '—'],
    ['Valores para acerto', fechamento.totalAcertosUtilizado > 0 ? `- ${formatCurrency(fechamento.totalAcertosUtilizado)}` : '—'],
    ['Valor adicional (acerto)', fechamento.totalAcertosAdicional > 0 ? formatCurrency(fechamento.totalAcertosAdicional) : '—'],
    ['Valor líquido pago', formatCurrency(fechamento.totalPago)],
    ['Observação', fechamento.observacao || '—'],
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalhes do pagamento"
      footer={
        <FormActions>
          {onVerComprovativo ? (
            <Button type="button" onClick={onVerComprovativo}>
              Ver comprovativo
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </FormActions>
      }
    >
      <div style={{ marginBottom: '0.75rem' }}>
        <Badge variant="success">{fechamento.status}</Badge>
      </div>

      <div className={confirmStyles.details}>
        {rows.filter(Boolean).map(([label, value]) => (
          <div key={label} className={confirmStyles.detailRow}>
            <span className={confirmStyles.detailLabel}>{label}:</span>
            <span className={confirmStyles.detailValue}>{value}</span>
          </div>
        ))}
      </div>

      {diariasIncluidas.length > 0 && (
        <>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '1rem 0 0.375rem' }}>
            Diárias incluídas neste pagamento ({diariasIncluidas.length}):
          </p>
          <ul className={styles.previewList}>
            {diariasIncluidas.map((item) => (
              <li key={item.id} className={styles.previewRow}>
                <span>
                  {item.data ? formatDate(item.data) : 'Sem data'}
                  {item.observacao ? ` — ${item.observacao}` : ''}
                </span>
                <span>{item.valor != null ? formatCurrency(item.valor) : '—'}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {fechamento.observacoesDiariasReferencia?.length > 0 && (
        <>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '1rem 0 0.375rem' }}>
            Observações das diárias (referência):
          </p>
          <ul className={styles.previewList}>
            {fechamento.observacoesDiariasReferencia.map((item) => (
              <li key={item.diariaId} className={styles.previewRow}>
                <span>
                  {item.data ? `${formatDate(item.data)} — ` : '— — '}
                  {item.observacao}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {fechamento.parcelasRegistradas?.length > 0 && (
        <>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '1rem 0 0.375rem' }}>
            Parcelas descontadas:
          </p>
          <ul className={styles.previewList}>
            {fechamento.parcelasRegistradas.map((p) => (
              <li key={`${p.commitmentId}-${p.numero}`} className={styles.previewRow}>
                <span>
                  {p.descricao} — {p.numero}/{p.total}
                </span>
                <span>- {formatCurrency(p.valor)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {fechamento.acertosAcertados?.length > 0 && (
        <>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '1rem 0 0.375rem' }}>
            Acertos realizados:
          </p>
          <ul className={styles.previewList}>
            {fechamento.acertosAcertados.map((a) => (
              <li key={a.valorAcertoId} className={styles.previewRow}>
                <span>{a.motivo}</span>
                <span>
                  {formatCurrency(a.valorUtilizado)}
                  {a.valorDevolvido > 0 && ` (${formatCurrency(a.valorDevolvido)} devolvido)`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {fechamento.recorrentesAplicados?.length > 0 && (
        <>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '1rem 0 0.375rem' }}>
            Descontos recorrentes aplicados:
          </p>
          <ul className={styles.previewList}>
            {fechamento.recorrentesAplicados.map((r) => (
              <li key={r.commitmentId} className={styles.previewRow}>
                <span>{r.descricao}</span>
                <span>- {formatCurrency(r.valor)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
