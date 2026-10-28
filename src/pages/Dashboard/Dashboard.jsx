import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  CreditCard,
  Plus,
  UserPlus,
  CalendarDays,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import HubNav from '../../components/Dashboard/HubNav';
import ObraStatusBadge from '../../components/ObraStatusBadge/ObraStatusBadge';
import { countObrasByStatus } from '../../utils/obraStatus';
import { formatCurrency, getGreeting, formatDate } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import HelpTip from '../../components/HelpTip/HelpTip';
import {
  calcTotalGastosMes,
  calcTotalRecebimentosMes,
  calcTotalPagamentosMes,
  calcTotalAReceber,
  getMonthlyData,
  getHistorico,
  mapRecebimentosForChart,
  mapGastosForChart,
} from '../../utils/calculations';
import { buildDashboardAttention } from '../../utils/dashboardHub';
import { CHART_COLORS } from '../../assets/chartColors';
import styles from './Dashboard.module.css';

const TONE_CLASS = {
  danger: styles.alertDanger,
  warning: styles.alertWarning,
  info: styles.alertInfo,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    obras = [],
    funcionarios = [],
    diarias = [],
    fechamentosPagamento = [],
    gastos = [],
    gastosEmpresa = [],
    empresaDespesasProgramadas = [],
    empresaVeiculos = [],
    pagamentos = [],
    valoresAcerto = [],
    configuracoes = {},
  } = useApp();

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const obrasList = Array.isArray(obras) ? obras.filter(Boolean) : [];
  const nomeUtilizador = configuracoes?.utilizador?.nome || '';

  const obrasEmAndamento = countObrasByStatus(obrasList, 'Em andamento');
  const totalAReceber = calcTotalAReceber(obrasList, pagamentos);
  const gastosMes = calcTotalGastosMes(gastos, month, year);
  const valoresPagos = calcTotalPagamentosMes(pagamentos, month, year);
  const receitasMes = calcTotalRecebimentosMes(pagamentos, month, year, obrasList);
  const saldoMes = receitasMes - gastosMes - valoresPagos;

  const receitasData = getMonthlyData(mapRecebimentosForChart(pagamentos, {}, obrasList), 6);
  const gastosData = getMonthlyData(mapGastosForChart(gastos), 6);
  let historico = [];
  try {
    historico = getHistorico({
      obras: obrasList,
      funcionarios,
      diarias: [],
      valoresAcerto,
      gastos,
      pagamentos,
      fechamentosPagamento,
    }).slice(0, 6);
  } catch (err) {
    console.error('[dashboard] Falha ao montar o histórico', err);
  }
  const obrasRecentes = [...obrasList].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  const attention = useMemo(() => {
    try {
      return buildDashboardAttention({
        obras: obrasList,
        funcionarios,
        diarias,
        fechamentosPagamento,
        valoresAcerto,
        gastosEmpresa,
        empresaDespesasProgramadas,
        empresaVeiculos,
      });
    } catch (err) {
      console.error('[dashboard] Falha ao calcular alertas', err);
      return [];
    }
  }, [
    obrasList,
    diarias,
    fechamentosPagamento,
    valoresAcerto,
    gastosEmpresa,
    empresaDespesasProgramadas,
    empresaVeiculos,
    funcionarios,
  ]);

  const compactStats = [
    {
      label: 'Obras em andamento',
      value: obrasEmAndamento,
      path: '/obras',
    },
    {
      label: 'A receber',
      value: formatCurrency(totalAReceber),
      path: '/pagamentos',
      help: HELP.recebimento.aReceber,
    },
    {
      label: 'Receitas do mês',
      value: formatCurrency(receitasMes),
      path: '/pagamentos',
      tone: 'green',
    },
    {
      label: 'Saldo do mês',
      value: formatCurrency(saldoMes),
      path: '/lucros',
      tone: saldoMes < 0 ? 'red' : undefined,
    },
  ];

  const quickActions = [
    { label: 'Nova obra', icon: Plus, path: '/obras?nova=true' },
    { label: 'Funcionário', icon: UserPlus, path: '/funcionarios?nova=true' },
    { label: 'Diária', icon: CalendarDays, path: '/diarias?nova=true' },
    { label: 'Novo gasto', icon: Receipt, path: '/gastos?nova=true' },
    { label: 'Pagamento recebido', icon: CreditCard, path: '/pagamentos?nova=true' },
  ];

  return (
    <div className={styles.dashboard}>
      <div className={styles.greeting}>
        <h2 className={styles.greetingTitle}>
          {getGreeting()}, {nomeUtilizador} 👋
        </h2>
        <p className={styles.greetingSubtitle}>Painel de controlo da empresa.</p>
      </div>

      <HubNav />

      <section className={styles.compactSection} aria-label="Resumo da empresa">
        <div className={styles.compactGrid}>
          {compactStats.map((item) => (
            <button
              key={item.label}
              type="button"
              className={styles.compactItem}
              onClick={() => navigate(item.path)}
            >
              <span className={styles.compactLabel}>
                {item.label}
                {item.help ? <HelpTip text={item.help} /> : null}
              </span>
              <span
                className={`${styles.compactValue} ${
                  item.tone === 'green' ? styles.finValueGreen : item.tone === 'red' ? styles.finValueRed : ''
                }`}
              >
                {item.value}
              </span>
            </button>
          ))}
        </div>
      </section>

      {attention.length > 0 && (
        <section className={styles.attention} aria-label="Precisa da minha atenção">
          <h3 className={styles.sectionTitle}>
            <AlertTriangle size={16} aria-hidden />
            Precisa da minha atenção
          </h3>
          <div className={styles.attentionList}>
            {attention.map((alert) => (
              <button
                key={alert.id}
                type="button"
                className={`${styles.attentionItem} ${TONE_CLASS[alert.tone] || ''}`}
                onClick={() => navigate(alert.path)}
              >
                <span>
                  <span className={styles.attentionTitle}>{alert.title}</span>
                  <span className={styles.attentionDetail}>{alert.detail}</span>
                </span>
                <ChevronRight size={16} aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Receitas (últimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={receitasData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="total" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Gastos (últimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={gastosData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="total" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>Obras recentes</h3>
          {obrasRecentes.length === 0 && <p className={styles.emptyHint}>Ainda não há obras registadas.</p>}
          {obrasRecentes.map((obra) => (
            <div
              key={obra.id}
              className={styles.recentItem}
              onClick={() => navigate(`/obras/${obra.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <div>
                <div className={styles.recentName}>{obra.nome}</div>
                <div className={styles.recentMeta}>{obra.cliente}</div>
              </div>
              <ObraStatusBadge status={obra.estado} />
            </div>
          ))}
        </div>

        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>Últimos lançamentos</h3>
          {historico.length === 0 && <p className={styles.emptyHint}>Sem lançamentos recentes.</p>}
          {historico.map((item) => (
            <div key={item.id} className={styles.lancamentoItem}>
              <div>
                <div className={styles.lancamentoTipo}>{item.tipo}</div>
                <div>{item.descricao}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{formatCurrency(item.valor)}</div>
                <div className={styles.recentMeta}>{formatDate(item.data)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.sectionCard}>
        <h3 className={styles.sectionTitle}>Acções rápidas</h3>
        <div className={styles.quickActions}>
          {quickActions.map(({ label, icon: Icon, path }) => (
            <button key={label} className={styles.quickBtn} onClick={() => navigate(path)}>
              <div className={styles.quickBtnIcon}>
                <Icon size={18} />
              </div>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
