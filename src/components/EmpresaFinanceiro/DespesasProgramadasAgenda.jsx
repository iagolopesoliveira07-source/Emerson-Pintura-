import { ChevronLeft, ChevronRight } from 'lucide-react';
import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import {
  addMonthsToYearMonth,
  getYearMonth,
} from '../../utils/empresaFinanceiroCalculations';
import { formatMesAgenda } from '../../utils/despesasProgramadasAgenda';
import { formatCurrency, formatDate, getTodayISO } from '../../utils/formatters';
import styles from '../../pages/GastosEmpresa/GastosEmpresa.module.css';

function badgeVariant(estado) {
  if (estado?.id === 'pago' || estado?.id === 'coberto') return 'success';
  if (estado?.id === 'atrasado') return 'danger';
  if (estado?.id === 'renovacao') return 'info';
  return 'warning';
}

function AgendaCard({
  item,
  onAbrir,
  onPagar,
  mostrarDataPagamento = false,
  acaoPagar = false,
}) {
  const dataLabel = mostrarDataPagamento
    ? item.dataPagamento
      ? `Descontado este mês em ${formatDate(item.dataPagamento)}`
      : 'Descontado neste mês'
    : item.proximaRenovacao && item.dataVencimento
    ? `Próxima renovação: ${formatDate(item.dataVencimento)}`
    : item.dataVencimento
    ? formatDate(item.dataVencimento)
    : 'Data: Não informada';

  return (
    <article className={`${styles.linhaFixa} ${item.estado?.id === 'atrasado' ? styles.agendaCardAtraso : ''}`}>
      <div>
        <strong>{item.titulo}</strong>
        <span>
          {item.semData && !item.pago ? item.valorLabel : formatCurrency(item.valor)}
          {' · '}
          {dataLabel}
        </span>
      </div>
      <div className={styles.linhaFixaAcoes}>
        <Badge variant={badgeVariant(item.estado)}>{item.estado?.label || 'Pendente'}</Badge>
        <Button type="button" variant="secondary" size="sm" onClick={() => onAbrir(item)}>
          Ver detalhes
        </Button>
        {acaoPagar && onPagar ? (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onPagar(item);
            }}
          >
            Descontado neste mês
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function Secao({ id, title, children, tom }) {
  return (
    <section className={tom === 'atraso' ? styles.agendaSecaoAtraso : styles.agendaSecao} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DespesasProgramadasAgenda({
  agenda,
  yearMonth,
  onYearMonthChange,
  onNova,
  onAbrir,
  onPagar,
}) {
  const todayMonth = getYearMonth(getTodayISO());
  const anterior = addMonthsToYearMonth(yearMonth, -1);
  const seguinte = addMonthsToYearMonth(yearMonth, 1);

  return (
    <div className={styles.agenda}>
      <div className={styles.agendaHeader}>
        <nav className={styles.agendaNav} aria-label="Mês das despesas programadas">
          <button
            type="button"
            className={styles.agendaNavBtn}
            onClick={() => onYearMonthChange(anterior)}
            aria-label={`Ver ${formatMesAgenda(anterior)}`}
          >
            <ChevronLeft size={18} />
          </button>
          <div className={styles.agendaNavMeses}>
            <button type="button" className={styles.agendaNavSide} onClick={() => onYearMonthChange(anterior)}>
              {formatMesAgenda(anterior)}
            </button>
            <p className={styles.agendaNavAtual}>{formatMesAgenda(yearMonth)}</p>
            <button type="button" className={styles.agendaNavSide} onClick={() => onYearMonthChange(seguinte)}>
              {formatMesAgenda(seguinte)}
            </button>
          </div>
          <button
            type="button"
            className={styles.agendaNavBtn}
            onClick={() => onYearMonthChange(seguinte)}
            aria-label={`Ver ${formatMesAgenda(seguinte)}`}
          >
            <ChevronRight size={18} />
          </button>
        </nav>
        {yearMonth !== todayMonth ? (
          <button type="button" className={styles.agendaHoje} onClick={() => onYearMonthChange(todayMonth)}>
            Mês actual
          </button>
        ) : null}
        <Button size="sm" onClick={onNova}>
          Nova programada
        </Button>
      </div>

      <section className={styles.agendaResumo} aria-label="Resumo do mês">
        <div className={styles.agendaResumoCard}>
          <span>A pagar</span>
          <strong className={styles.pendente}>{formatCurrency(agenda.resumo?.aPagar || 0)}</strong>
        </div>
        <div className={styles.agendaResumoCard}>
          <span>Já pago</span>
          <strong className={styles.pago}>{formatCurrency(agenda.resumo?.jaPago || 0)}</strong>
        </div>
        <div className={styles.agendaResumoCard}>
          <span>Em atraso</span>
          <strong className={(agenda.resumo?.emAtraso || 0) > 0 ? styles.agendaAtrasoValor : undefined}>
            {formatCurrency(agenda.resumo?.emAtraso || 0)}
          </strong>
        </div>
      </section>

      {(agenda.atrasadas || []).length > 0 ? (
        <Secao id="agenda-atrasadas" title="Atrasadas" tom="atraso">
          <div className={styles.agendaLista}>
            {(agenda.atrasadas || []).map((item) => (
              <AgendaCard key={item.id} item={item} onAbrir={onAbrir} onPagar={onPagar} acaoPagar />
            ))}
          </div>
        </Secao>
      ) : null}

      {(agenda.proximas || []).length > 0 ? (
        <Secao id="agenda-proximas" title="Próximas despesas">
          <div className={styles.agendaLista}>
            {(agenda.proximas || []).map((item) => (
              <AgendaCard key={`prox-${item.id}`} item={item} onAbrir={onAbrir} onPagar={onPagar} acaoPagar />
            ))}
          </div>
        </Secao>
      ) : null}

      {(agenda.desteMes || []).length > 0 || (agenda.semData || []).length > 0 ? (
        <Secao id="agenda-mes" title="Despesas deste mês">
          {(agenda.desteMes || []).length > 0 ? (
            <div className={styles.agendaLista}>
              {(agenda.desteMes || []).map((item) => (
                <AgendaCard
                  key={`mes-${item.id}`}
                  item={item}
                  onAbrir={onAbrir}
                  onPagar={onPagar}
                  acaoPagar={!item.pago}
                  mostrarDataPagamento={item.pago}
                />
              ))}
            </div>
          ) : null}
          {(agenda.semData || []).length > 0 ? (
            <div className={styles.agendaSemData}>
              <h3 className={styles.grupoTitulo}>Sem data definida</h3>
              <div className={styles.agendaLista}>
                {(agenda.semData || []).map((item) => (
                  <AgendaCard
                    key={`nodate-${item.id}`}
                    item={item}
                    onAbrir={onAbrir}
                    onPagar={onPagar}
                    acaoPagar={!item.pago}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </Secao>
      ) : (
        <p className={styles.nota}>Não há despesas programadas neste mês.</p>
      )}

      {(agenda.pagasRecentemente || []).length > 0 ? (
        <Secao id="agenda-pagas" title="Pagas recentemente">
          <div className={styles.agendaLista}>
            {(agenda.pagasRecentemente || []).map((item) => (
              <AgendaCard
                key={`pago-${item.id}`}
                item={item}
                onAbrir={onAbrir}
                mostrarDataPagamento
              />
            ))}
          </div>
        </Secao>
      ) : null}
    </div>
  );
}
