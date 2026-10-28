import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Badge from '../Badge/Badge';
import Button from '../Button/Button';
import {
  addMonthsToYearMonth,
  getYearMonth,
} from '../../utils/empresaFinanceiroCalculations';
import { formatMesAgenda } from '../../utils/despesasProgramadasAgenda';
import { formatCurrency, formatDate, getTodayISO } from '../../utils/formatters';
import styles from '../../pages/GastosEmpresa/GastosEmpresa.module.css';

function statusVariant(status) {
  if (status === 'descontado' || status === 'pago') return 'success';
  if (status === 'atrasado') return 'danger';
  return 'warning';
}

function ResumoCard({ label, value, tom }) {
  return (
    <div className={styles.agendaResumoCard}>
      <span>{label}</span>
      <strong className={tom === 'pendente' ? styles.pendente : tom === 'pago' ? styles.pago : undefined}>
        {value}
      </strong>
    </div>
  );
}

function LinhaRecorrente({ item, onAbrir, onDescontar }) {
  return (
    <article className={`${styles.agendaCard} ${item.status === 'atrasado' ? styles.agendaCardAtraso : ''}`}>
      <button type="button" className={styles.agendaCardMain} onClick={() => onAbrir?.(item)}>
        <div className={styles.agendaCardTopo}>
          <h3>{item.nome}</h3>
          <Badge variant={statusVariant(item.status)}>{item.statusLabel}</Badge>
        </div>
        <p className={styles.agendaValor}>{formatCurrency(item.valorHabitual)}</p>
        <p className={styles.agendaMeta}>
          {item.dataDescontoLabel ||
            (item.dataVencimento ? `Vencimento: ${formatDate(item.dataVencimento)}` : 'Valor habitual do mês')}
        </p>
        {item.indicador && item.status !== 'descontado' ? (
          <p className={item.status === 'atrasado' ? styles.agendaAtraso : styles.agendaVence}>
            {item.indicador}
          </p>
        ) : null}
      </button>
      {item.status !== 'descontado' && onDescontar ? (
        <div className={styles.agendaCardAcao}>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDescontar(item);
            }}
          >
            Descontado neste mês
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function LinhaFuncionario({ item }) {
  return (
    <article className={styles.agendaCard}>
      <div className={styles.agendaCardMain}>
        <div className={styles.agendaCardTopo}>
          <h3>{item.nome}</h3>
          <Badge variant={statusVariant(item.status)}>{item.statusLabel}</Badge>
        </div>
        <p className={styles.agendaValor}>{formatCurrency(item.valor)}</p>
        <p className={styles.agendaMeta}>{item.periodo}</p>
        {item.dataPagamento ? (
          <p className={styles.agendaMeta}>Pago em {formatDate(item.dataPagamento)}</p>
        ) : null}
        {item.diariasPendentes > 0 ? (
          <p className={styles.agendaVence}>
            {item.diariasPendentes === 1
              ? '1 diária ainda pendente'
              : `${item.diariasPendentes} diárias ainda pendentes`}
          </p>
        ) : null}
        {item.funcionarioId ? (
          <p className={styles.agendaMeta}>
            <Link to={`/funcionarios/${item.funcionarioId}`}>Abrir funcionário</Link>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function LinhaOutro({ item, onAbrir }) {
  return (
    <article className={styles.agendaCard}>
      <button type="button" className={styles.agendaCardMain} onClick={() => onAbrir?.(item.gasto)}>
        <div className={styles.agendaCardTopo}>
          <h3>{item.descricao}</h3>
          <Badge variant={item.estado === 'pago' ? 'success' : 'warning'}>{item.estadoLabel}</Badge>
        </div>
        <p className={styles.agendaValor}>{formatCurrency(item.valor)}</p>
        <p className={styles.agendaMeta}>
          {item.data ? formatDate(item.data) : 'Sem data'} · {item.categoria}
        </p>
      </button>
    </article>
  );
}

export default function ControleDoMes({
  modelo,
  yearMonth,
  onYearMonthChange,
  onAbrirRecorrente,
  onDescontarRecorrente,
  onAbrirOutro,
}) {
  const todayMonth = getYearMonth(getTodayISO());
  const anterior = addMonthsToYearMonth(yearMonth, -1);
  const seguinte = addMonthsToYearMonth(yearMonth, 1);
  const resumo = modelo?.resumo || {};

  return (
    <div className={styles.agenda}>
      <div className={styles.agendaHeader}>
        <nav className={styles.agendaNav} aria-label="Mês do controlo">
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
      </div>

      <p className={styles.meta} style={{ marginTop: 0 }}>
        Vista rápida do que já saiu da conta e do que ainda falta confirmar. Pendente não conta como
        dinheiro gasto.
      </p>

      <section className={styles.agendaResumo} aria-label="Resumo do controlo do mês">
        <ResumoCard
          label="Recorrentes por confirmar"
          value={`${resumo.recorrentesPendentes || 0} · ${formatCurrency(resumo.totalRecorrentePendente || 0)}`}
          tom="pendente"
        />
        <ResumoCard
          label="Já descontados"
          value={`${resumo.recorrentesDescontados || 0} · ${formatCurrency(resumo.totalRecorrenteDescontado || 0)}`}
          tom="pago"
        />
        <ResumoCard
          label="Funcionários pendentes"
          value={`${resumo.funcionariosPendentes || 0} · ${formatCurrency(resumo.totalFuncionariosPendente || 0)}`}
          tom="pendente"
        />
        <ResumoCard
          label="Pagamentos a funcionários"
          value={formatCurrency(resumo.totalFuncionariosPago || 0)}
          tom="pago"
        />
      </section>

      <section className={styles.agendaSecao} aria-labelledby="controle-recorrentes">
        <h2 id="controle-recorrentes" className={styles.sectionTitle}>
          1. Despesas recorrentes
        </h2>
        {(modelo?.recorrentes || []).length === 0 ? (
          <p className={styles.meta}>Sem despesas recorrentes neste mês.</p>
        ) : (
          <div className={styles.agendaLista}>
            {modelo.recorrentes.map((item) => (
              <LinhaRecorrente
                key={item.id}
                item={item}
                onAbrir={onAbrirRecorrente}
                onDescontar={onDescontarRecorrente}
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.agendaSecao} aria-labelledby="controle-funcionarios">
        <h2 id="controle-funcionarios" className={styles.sectionTitle}>
          2. Pagamentos de funcionários
        </h2>
        {(modelo?.pagamentosFuncionarios || []).length === 0 ? (
          <p className={styles.meta}>Sem pagamentos nem diárias pendentes neste mês.</p>
        ) : (
          <div className={styles.agendaLista}>
            {modelo.pagamentosFuncionarios.map((item) => (
              <LinhaFuncionario key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className={styles.agendaSecao} aria-labelledby="controle-outros">
        <h2 id="controle-outros" className={styles.sectionTitle}>
          3. Outros gastos
        </h2>
        <p className={styles.meta}>
          Gastos pontuais lançados neste mês. Não geram obrigação automática no mês seguinte.
        </p>
        {(modelo?.outros || []).length === 0 ? (
          <p className={styles.meta}>Sem outros gastos neste mês.</p>
        ) : (
          <div className={styles.agendaLista}>
            {modelo.outros.map((item) => (
              <LinhaOutro key={item.id} item={item} onAbrir={onAbrirOutro} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
