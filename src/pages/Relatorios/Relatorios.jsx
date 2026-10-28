import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FileDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Card from '../../components/Card/Card';
import Button from '../../components/Button/Button';
import PeriodFilter from '../../components/PeriodFilter/PeriodFilter';
import Table from '../../components/Table/Table';
import { usePeriodFilter } from '../../hooks/usePeriodFilter';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import HelpTip from '../../components/HelpTip/HelpTip';
import { GASTOS_RAPIDOS_PERIOD_PRESETS } from '../../utils/periodFilter';
import { buildDiagnosticoEmpresa } from '../../utils/relatorioDiagnostico';
import { gerarRelatorioEmpresaPdf } from '../../utils/gerarRelatorioPdf';
import {
  OBRA_STATUS,
  countObrasByStatus,
  countObrasConcluidasNoPeriodo,
  getObraStatusDisplayLabel,
} from '../../utils/obraStatus';
import { isAcertoAcertado } from '../../utils/acertoCalculations';
import { CHART_COLORS } from '../../assets/chartColors';
import shared from '../shared.module.css';
import styles from './Relatorios.module.css';

const COLORS = CHART_COLORS.palette;

function moneyClass(value) {
  if (value > 0) return styles.positive;
  if (value < 0) return styles.negative;
  return undefined;
}

function RankList({ items, getValue }) {
  if (!items.length) {
    return <p className={shared.mutedCenter}>Sem dados no período.</p>;
  }
  return (
    <ol className={styles.rankList}>
      {items.map((item) => {
        const value = getValue(item);
        return (
          <li key={item.id}>
            <span className={styles.rankName}>{item.nome}</span>
            <span className={`${styles.rankValue} ${moneyClass(value) || ''}`}>
              {formatCurrency(value)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const COL_OBRA = [
  { key: 'nome', label: 'Obra' },
  {
    key: 'receitas',
    label: 'Entrada real',
    align: 'right',
    render: (row) => formatCurrency(row.receitas),
  },
  {
    key: 'custos',
    label: 'Gastos da empresa',
    align: 'right',
    render: (row) => formatCurrency(row.custos),
  },
  {
    key: 'resultado',
    label: 'Resultado interno',
    align: 'right',
    render: (row) => (
      <span className={moneyClass(row.resultado)}>{formatCurrency(row.resultado)}</span>
    ),
  },
];

function LinhasMovimento({ linhas }) {
  if (!linhas?.length) return <p className={shared.mutedCenter}>Nada neste período.</p>;
  return (
    <ul className={styles.rankList}>
      {linhas.map((item) => (
        <li key={item.id}>
          <span className={styles.rankName}>
            {item.obra}
            {item.data ? ` · ${formatDate(item.data)}` : ''}
            {item.descricao ? ` · ${item.descricao}` : ''}
          </span>
          <span className={styles.rankValue}>{formatCurrency(item.valor)}</span>
        </li>
      ))}
    </ul>
  );
}

const COL_NOME_VALOR = [
  { key: 'nome', label: 'Nome' },
  {
    key: 'valor',
    label: 'Total',
    align: 'right',
    render: (row) => (
      <span className={moneyClass(row.valor)}>{formatCurrency(row.valor)}</span>
    ),
  },
];

const COL_VIATURA = [
  { key: 'nome', label: 'Viatura' },
  {
    key: 'combustivel',
    label: 'Combustível',
    align: 'right',
    render: (row) => formatCurrency(row.combustivel),
  },
  {
    key: 'viaVerde',
    label: 'Via Verde',
    align: 'right',
    render: (row) => formatCurrency(row.viaVerde),
  },
  {
    key: 'manutencao',
    label: 'Manutenção',
    align: 'right',
    render: (row) => formatCurrency(row.manutencao),
  },
  {
    key: 'seguros',
    label: 'Seguros',
    align: 'right',
    render: (row) => formatCurrency(row.seguros),
  },
  {
    key: 'outros',
    label: 'Outros',
    align: 'right',
    render: (row) => formatCurrency(row.outros),
  },
  {
    key: 'total',
    label: 'Total',
    align: 'right',
    render: (row) => formatCurrency(row.total),
  },
];

export default function Relatorios() {
  const {
    obras,
    funcionarios,
    diarias,
    valoresAcerto,
    gastos,
    gastosEmpresa = [],
    pagamentos,
    fechamentosPagamento = [],
    empresaVeiculos = [],
    configuracoes = {},
  } = useApp();
  const presetsPeriodo = [
    { id: 'esta_semana', label: 'Esta semana' },
    ...GASTOS_RAPIDOS_PERIOD_PRESETS,
  ];
  const period = usePeriodFilter('todos', presetsPeriodo);
  const [pdfEstado, setPdfEstado] = useState('idle');

  const diagnostico = useMemo(() => {
    try {
      return buildDiagnosticoEmpresa({
        obras,
        gastos,
        gastosEmpresa,
        diarias,
        pagamentos,
        funcionarios,
        fechamentosPagamento,
        empresaVeiculos,
        range: period.range,
      });
    } catch (err) {
      console.error('[relatórios] Falha ao montar o diagnóstico', err);
      return {
        resumo: {
          receitas: 0,
          gastosTotais: 0,
          resultado: 0,
          iva: 0,
          ivaDedutivel: 0,
          ivaNaoDedutivel: 0,
          valoresPagos: 0,
          valoresPendentes: 0,
        },
        charts: { receitasMensais: [], gastosMensais: [], porCategoria: [] },
      };
    }
  }, [
      obras,
      gastos,
      gastosEmpresa,
      diarias,
      pagamentos,
      funcionarios,
      fechamentosPagamento,
      empresaVeiculos,
      period.range,
    ]
  );

  const { resumo, charts } = diagnostico;
  const obrasConcluidasNoPeriodo = countObrasConcluidasNoPeriodo(
    obras,
    period.range.inicio,
    period.range.fim
  );
  const acertosEmAberto = valoresAcerto.filter((item) => !isAcertoAcertado(item)).length;
  const obrasPorEstado = OBRA_STATUS.map((status) => ({
    name: getObraStatusDisplayLabel(status),
    value: countObrasByStatus(obras, status),
  })).filter((item) => item.value > 0);

  const handleGerarPdf = async () => {
    setPdfEstado('a-gerar');
    try {
      await gerarRelatorioEmpresaPdf({
        period,
        obras,
        gastos,
        gastosEmpresa,
        diarias,
        pagamentos,
        funcionarios,
        fechamentosPagamento,
        empresaVeiculos,
        configuracoes,
      });
      setPdfEstado('idle');
    } catch (error) {
      console.error(error);
      setPdfEstado('erro');
    }
  };

  return (
    <div className={shared.page}>
      <PageHeader
        title="Relatórios"
        subtitle="Diagnóstico financeiro da empresa no período escolhido"
      />

      <PeriodFilter
        presets={presetsPeriodo}
        preset={period.preset}
        onPresetChange={period.setPreset}
        customInicio={period.customInicio}
        customFim={period.customFim}
        onCustomInicioChange={period.setCustomInicio}
        onCustomFimChange={period.setCustomFim}
        label={period.label}
      />

      <section className={styles.section} aria-labelledby="resumo-geral-title">
        <h2 id="resumo-geral-title" className={styles.sectionTitle}>
          Resumo geral
        </h2>
        <p className={styles.sectionLead}>
          Entradas reais são o dinheiro que entrou no período. O resultado interno é o que pertence à
          Emerson Pinturas. Não é lucro contabilístico nem o valor dos orçamentos.
        </p>
        <div className={shared.statsRow}>
          <Card title="Entradas reais" value={formatCurrency(resumo.entradasReais || 0)} iconColor="green" help={HELP.recebimento.recebido} />
          <Card title="Parte da Emerson nas parcerias" value={formatCurrency(resumo.parteEmerson || 0)} iconColor="cyan" help={HELP.relatorio.resultadoPeriodo} />
          <Card title="Gastos da empresa" value={formatCurrency(resumo.gastosTotais)} iconColor="red" />
          <Card
            title="Resultado interno"
            value={formatCurrency(resumo.resultado)}
            iconColor={resumo.resultado >= 0 ? 'green' : 'red'}
            help={HELP.relatorio.resultadoPeriodo}
          />
          <Card title="IVA" value={formatCurrency(resumo.iva)} iconColor="blue" help={HELP.iva.registrado} />
          <Card title="IVA dedutível" value={formatCurrency(resumo.ivaDedutivel)} iconColor="cyan" help={HELP.iva.dedutivel} />
          <Card title="IVA não dedutível" value={formatCurrency(resumo.ivaNaoDedutivel)} iconColor="orange" help={HELP.iva.naoDedutivel} />
          <Card title="Valores pagos" value={formatCurrency(resumo.valoresPagos)} iconColor="purple" />
          <Card title="Valores pendentes" value={formatCurrency(resumo.valoresPendentes)} iconColor="orange" help={HELP.recebimento.aReceber} />
        </div>
        <p className={styles.tableNote}>
          O resultado interno soma os recebimentos das obras normais e a parte da Emerson nos Acertos
          concluídos, e desconta os gastos da empresa. Reembolso de parceria não entra como lucro.
          Recebimento de parceria ainda sem Acerto entra na movimentação, não no resultado.
        </p>
        {diagnostico.interno ? (
          <div className={styles.highlightRow}>
            <details className={styles.details}>
              <summary>Entradas reais</summary>
              <div className={styles.detailsBody}>
                <LinhasMovimento linhas={diagnostico.interno.entradas} />
              </div>
            </details>
            <details className={styles.details}>
              <summary>Parte econômica da Emerson</summary>
              <div className={styles.detailsBody}>
                <LinhasMovimento linhas={diagnostico.interno.partes} />
              </div>
            </details>
            <details className={styles.details}>
              <summary>Gastos da empresa</summary>
              <div className={styles.detailsBody}>
                <LinhasMovimento linhas={diagnostico.interno.gastosLinhas} />
              </div>
            </details>
            {diagnostico.interno.reembolsos.length > 0 && (
              <details className={styles.details}>
                <summary>Reembolsos ao Emerson — não são lucro</summary>
                <div className={styles.detailsBody}>
                  <LinhasMovimento linhas={diagnostico.interno.reembolsos} />
                </div>
              </details>
            )}
            {diagnostico.interno.pendentes.length > 0 && (
              <details className={styles.details}>
                <summary>Recebimentos de parceria ainda não acertados</summary>
                <div className={styles.detailsBody}>
                  <LinhasMovimento linhas={diagnostico.interno.pendentes} />
                </div>
              </details>
            )}
          </div>
        ) : null}
      </section>

      <div className={shared.responsiveGrid2}>
        <div className={`${shared.detailCard} ${styles.chartCard}`}>
            <h3 className={shared.detailCardTitle}>Entradas reais</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.receitasMensais}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="total" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={`${shared.detailCard} ${styles.chartCard}`}>
          <h3 className={shared.detailCardTitle}>Gastos mensais</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.gastosMensais}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="total" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <section className={styles.section} aria-labelledby="obras-title">
        <h2 id="obras-title" className={styles.sectionTitle}>
          Obras
        </h2>
        <div className={styles.cards}>
          <Card title="Entradas reais" value={formatCurrency(diagnostico.obras.receitas)} iconColor="green" help={HELP.recebimento.recebido} />
          <Card title="Gastos da empresa" value={formatCurrency(diagnostico.obras.custos)} iconColor="red" />
          <Card
            title="Resultado interno"
            value={formatCurrency(diagnostico.obras.resultado)}
            iconColor={diagnostico.obras.resultado >= 0 ? 'green' : 'red'}
            help={HELP.relatorio.resultadoPeriodo}
          />
          <Card
            title="Sem obra específica"
            value={formatCurrency(diagnostico.obras.semObra.total)}
            subtitle={`${diagnostico.obras.semObra.quantidade} gasto${diagnostico.obras.semObra.quantidade === 1 ? '' : 's'}`}
            iconColor="orange"
            help={HELP.gasto.semObra}
          />
        </div>
        <div className={styles.highlightRow}>
          <div className={styles.highlightCard}>
            <h3>Obras com maior gasto</h3>
            <RankList items={diagnostico.obras.maiorGasto} getValue={(item) => item.custos} />
          </div>
          <div className={styles.highlightCard}>
            <h3>Obras com melhor resultado</h3>
            <RankList items={diagnostico.obras.melhorResultado} getValue={(item) => item.resultado} />
          </div>
        </div>
        <details className={styles.details}>
          <summary>Resultado por obra</summary>
          <div className={styles.detailsBody}>
            <Table
              columns={COL_OBRA}
              data={diagnostico.obras.rows}
              emptyMessage="Nenhuma obra com movimento no período."
            />
          </div>
        </details>
      </section>

      <section className={styles.section} aria-labelledby="funcionarios-title">
        <h2 id="funcionarios-title" className={styles.sectionTitle}>
          Funcionários
        </h2>
        <div className={shared.statsRow}>
          <Card title="Total gasto" value={formatCurrency(diagnostico.funcionarios.totalGasto)} iconColor="red" />
          <Card title="Diárias" value={formatCurrency(diagnostico.funcionarios.diarias)} iconColor="blue" />
          <Card title="Pagamentos" value={formatCurrency(diagnostico.funcionarios.pagamentos)} iconColor="green" />
          <Card title="Pendentes" value={formatCurrency(diagnostico.funcionarios.pendentes)} iconColor="orange" help={HELP.diaria.pendente} />
          <Card
            title="Extras / gratificações"
            value={formatCurrency(diagnostico.funcionarios.extras)}
            iconColor="purple"
            help={HELP.diaria.gratificacao}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="gastos-title">
        <h2 id="gastos-title" className={styles.sectionTitle}>
          Gastos
        </h2>
        <div className={shared.statsRow}>
          <Card title="Gastos das obras" value={formatCurrency(diagnostico.gastos.obras)} iconColor="red" help={HELP.gasto.obra} />
          <Card title="Gastos da empresa" value={formatCurrency(diagnostico.gastos.empresa)} iconColor="orange" help={HELP.gasto.empresa} />
          <Card
            title="Faturas"
            value={formatCurrency(diagnostico.gastos.faturas.total)}
            subtitle={`${diagnostico.gastos.faturas.quantidade} documento${diagnostico.gastos.faturas.quantidade === 1 ? '' : 's'}`}
            iconColor="blue"
            help={HELP.gasto.tipoDocumento}
          />
          <Card
            title="Notas de crédito"
            value={formatCurrency(diagnostico.gastos.notasCredito.total)}
            subtitle={`${diagnostico.gastos.notasCredito.quantidade} documento${diagnostico.gastos.notasCredito.quantidade === 1 ? '' : 's'}`}
            iconColor="cyan"
            help={HELP.gasto.notaCredito}
          />
        </div>
        <div className={shared.responsiveGrid2}>
          <div className={`${shared.detailCard} ${styles.chartCard}`}>
            <h3 className={shared.detailCardTitle}>Por categoria</h3>
            {charts.porCategoria.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={charts.porCategoria}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {charts.porCategoria.map((_, index) => (
                      <Cell key={charts.porCategoria[index].name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className={shared.mutedCenter}>Sem dados no período.</p>
            )}
          </div>
          <div className={shared.detailCard}>
            <h3 className={shared.detailCardTitle}>Principais categorias</h3>
            <Table
              columns={COL_NOME_VALOR}
              data={diagnostico.gastos.porCategoria.slice(0, 8)}
              emptyMessage="Sem categorias no período."
            />
          </div>
        </div>
        <details className={styles.details}>
          <summary>Por fornecedor</summary>
          <div className={styles.detailsBody}>
            <Table
              columns={COL_NOME_VALOR}
              data={diagnostico.gastos.porFornecedor}
              emptyMessage="Sem fornecedores no período."
            />
          </div>
        </details>
        <details className={styles.details}>
          <summary>Por viatura</summary>
          <div className={styles.detailsBody}>
            <Table
              columns={COL_NOME_VALOR}
              data={diagnostico.gastos.porViatura}
              emptyMessage="Sem gastos de viatura no período."
            />
          </div>
        </details>
      </section>

      <section className={styles.section} aria-labelledby="iva-title">
        <h2 id="iva-title" className={styles.sectionTitle}>
          IVA
        </h2>
        <div className={shared.statsRow}>
          <Card title="IVA total" value={formatCurrency(diagnostico.iva.iva)} iconColor="blue" help={HELP.iva.registrado} />
          <Card title="IVA dedutível" value={formatCurrency(diagnostico.iva.ivaDedutivel)} iconColor="green" help={HELP.iva.dedutivel} />
          <Card
            title="IVA não dedutível"
            value={formatCurrency(diagnostico.iva.ivaNaoDedutivel)}
            iconColor="orange"
            help={HELP.iva.naoDedutivel}
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="viaturas-title">
        <h2 id="viaturas-title" className={styles.sectionTitle}>
          Viaturas
          <HelpTip text={HELP.viatura.associar} />
        </h2>
        <div className={shared.statsRow}>
          <Card title="Combustível" value={formatCurrency(diagnostico.viaturas.combustivel)} iconColor="orange" help={HELP.gasto.combustivel} />
          <Card title="Via Verde" value={formatCurrency(diagnostico.viaturas.viaVerde)} iconColor="blue" help={HELP.viatura.viaVerde} />
          <Card title="Manutenção" value={formatCurrency(diagnostico.viaturas.manutencao)} iconColor="purple" />
          <Card title="Seguros" value={formatCurrency(diagnostico.viaturas.seguros)} iconColor="cyan" />
          <Card title="Outros gastos" value={formatCurrency(diagnostico.viaturas.outros)} iconColor="red" />
        </div>
        {diagnostico.porVeiculo.length > 0 ? (
          <details className={styles.details}>
            <summary>Detalhe por viatura</summary>
            <div className={styles.detailsBody}>
              <Table columns={COL_VIATURA} data={diagnostico.porVeiculo} emptyMessage="Sem gastos por viatura." />
            </div>
          </details>
        ) : null}
      </section>

      <details className={styles.details}>
        <summary>Indicadores operacionais</summary>
        <div className={styles.detailsBody}>
          {[
            ['Obras em andamento', countObrasByStatus(obras, 'Em andamento')],
            ['Obras concluídas', countObrasByStatus(obras, 'Encerrada')],
            ['Concluídas no período', obrasConcluidasNoPeriodo],
            ['Funcionários activos', diagnostico.funcionarios.funcionariosActivos],
            ['Diárias no período', diagnostico.funcionarios.quantidadeDiarias],
            ['Valores para acerto em aberto', acertosEmAberto],
          ].map(([label, value]) => (
            <div key={label} className={shared.detailRow}>
              <span className={shared.detailLabel}>{label}</span>
              <span className={shared.detailValue}>{value}</span>
            </div>
          ))}
          <h3 className={`${shared.detailCardTitle} ${shared.sectionTitleSpaced}`}>Obras por estado</h3>
          {obrasPorEstado.map(({ name, value }) => (
            <div key={name} className={shared.detailRow}>
              <span className={shared.detailLabel}>{name}</span>
              <span className={shared.detailValue}>{value}</span>
            </div>
          ))}
        </div>
      </details>

      <section className={styles.pdfBar} aria-labelledby="exportar-pdf-title">
        <div>
          <h2 id="exportar-pdf-title" className={styles.sectionTitle}>
            Exportar
          </h2>
          <p className={styles.sectionLead}>
            Gera um relatório executivo em PDF com o período seleccionado. Não é uma impressão desta
            página — o documento tem layout próprio.
          </p>
        </div>
        <Button
          icon={FileDown}
          onClick={handleGerarPdf}
          disabled={pdfEstado === 'a-gerar'}
        >
          {pdfEstado === 'a-gerar' ? 'A gerar PDF…' : 'Gerar Relatório em PDF'}
        </Button>
        {pdfEstado === 'erro' ? (
          <p className={styles.pdfErro} role="alert">
            Não foi possível gerar o PDF. Tente novamente.
          </p>
        ) : null}
      </section>
    </div>
  );
}
