import Logo from '../Logo/Logo';
import {
  ajusteLabel,
  formatDataComprovativo,
  formatDiariaLinha,
  formatAdiantamentoLinha,
  getComprovativoSecoes,
} from '../../utils/comprovativoPagamento';
import { formatCurrency } from '../../utils/formatters';
import styles from './ComprovativoPagamento.module.css';

function LinhaValor({ label, value }) {
  return (
    <div className={styles.resumoRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ComprovativoPagamentoView({ comprovativo, compact = false }) {
  if (!comprovativo) return null;

  const secoes = getComprovativoSecoes(comprovativo);
  const diarias = [...(comprovativo.diarias || [])].sort((a, b) =>
    String(a.data || '').localeCompare(String(b.data || ''))
  );
  const periodo =
    comprovativo.periodoInicio || comprovativo.periodoFim
      ? `${formatDataComprovativo(comprovativo.periodoInicio)} a ${formatDataComprovativo(comprovativo.periodoFim)}`
      : '';

  return (
    <article className={`${styles.sheet} ${compact ? styles.compact : ''}`}>
      <header className={styles.header}>
        <Logo size="sm" />
        <p className={styles.empresa}>{comprovativo.empresaNome || 'Emerson Pinturas'}</p>
        <h1>Resumo de Pagamento</h1>
      </header>

      <div className={styles.meta}>
        {comprovativo.funcionarioNome ? (
          <p>
            <span>Funcionário</span>
            <strong>{comprovativo.funcionarioNome}</strong>
          </p>
        ) : null}
        {periodo ? (
          <p>
            <span>Período</span>
            <strong>{periodo}</strong>
          </p>
        ) : null}
        {comprovativo.dataPagamento ? (
          <p>
            <span>Pagamento</span>
            <strong>{formatDataComprovativo(comprovativo.dataPagamento)}</strong>
          </p>
        ) : null}
      </div>

      {diarias.length > 0 ? (
        <section className={styles.bloco}>
          <h2>Diárias</h2>
          <ul className={styles.linhaList}>
            {diarias.map((diaria) => (
              <li key={diaria.diariaId || `${diaria.data}-${diaria.total}`}>
                {formatDiariaLinha(diaria)}
              </li>
            ))}
          </ul>
          {comprovativo.subtotalDiarias ? (
            <p className={styles.subtotal}>
              Subtotal das diárias: {formatCurrency(comprovativo.subtotalDiarias)}
            </p>
          ) : null}
        </section>
      ) : null}

      {secoes.acrescimos.length > 0 || secoes.descontos.length > 0 ? (
        <section className={styles.bloco}>
          <h2>Ajustes</h2>
          <ul className={styles.ajusteList}>
            {secoes.acrescimos.map((item, index) => (
              <li key={`a-${index}`}>
                <span>{ajusteLabel(item)}</span>
                <strong>+{formatCurrency(item.valor)}</strong>
              </li>
            ))}
            {secoes.descontos.map((item, index) => (
              <li key={`d-${index}`}>
                <span>{ajusteLabel(item)}</span>
                <strong>-{formatCurrency(item.valor)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {secoes.adiantamentos.length > 0 ? (
        <section className={styles.bloco}>
          <h2>Adiantamentos</h2>
          <ul className={styles.linhaList}>
            {secoes.adiantamentos.map((item, index) => (
              <li key={`ad-${index}`}>{formatAdiantamentoLinha(item)}</li>
            ))}
          </ul>
          <p className={styles.subtotal}>
            Total de adiantamentos: -{formatCurrency(secoes.totalAdiantamentos)}
          </p>
        </section>
      ) : null}

      {(comprovativo.subtotalDiarias ||
      secoes.totalAcrescimos > 0 ||
      secoes.totalDescontos > 0 ||
      secoes.totalAdiantamentos > 0) ? (
      <section className={styles.bloco}>
        <h2>Resumo</h2>
        {comprovativo.subtotalDiarias ? (
          <LinhaValor label="Diárias" value={formatCurrency(comprovativo.subtotalDiarias)} />
        ) : null}
        {secoes.totalAcrescimos > 0 ? (
          <LinhaValor label="Acréscimos" value={`+${formatCurrency(secoes.totalAcrescimos)}`} />
        ) : null}
        {secoes.totalDescontos > 0 ? (
          <LinhaValor label="Descontos" value={`-${formatCurrency(secoes.totalDescontos)}`} />
        ) : null}
        {secoes.totalAdiantamentos > 0 ? (
          <LinhaValor label="Adiantamentos" value={`-${formatCurrency(secoes.totalAdiantamentos)}`} />
        ) : null}
      </section>
      ) : null}

      <div className={styles.total}>
        <span>Total pago</span>
        <strong>{formatCurrency(comprovativo.totalPago)}</strong>
      </div>
      <p className={styles.statusPago}>Status: Pago</p>
    </article>
  );
}
