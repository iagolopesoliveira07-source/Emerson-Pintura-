import { useMemo, useState } from 'react';

import { useApp } from '../../context/AppContext';

import PageHeader from '../../components/PageHeader/PageHeader';

import ProfitFilters from '../../components/Lucros/ProfitFilters';

import ProfitSummaryCards from '../../components/Lucros/ProfitSummaryCards';

import ProfitByWorkChart from '../../components/Lucros/ProfitByWorkChart';

import ProfitRanking from '../../components/Lucros/ProfitRanking';

import WorkProfitCard from '../../components/Lucros/WorkProfitCard';

import { calcProfitSummary } from '../../utils/calculations';
import { buildResultadoInternoEmpresa } from '../../utils/resultadoInternoEmpresa';
import { formatCurrency } from '../../utils/formatters';
import Card from '../../components/Card/Card';

import { getDataInicioControle, formatDataInicioControleLabel } from '../../utils/controlDate';

import { normalizeObraStatus } from '../../utils/obraStatus';

import { HELP } from '../../utils/helpTexts';

import HelpTip from '../../components/HelpTip/HelpTip';

import shared from '../shared.module.css';

import styles from '../../components/Lucros/Lucros.module.css';



export default function Lucros() {

  const { obras, gastos, gastosEmpresa = [], pagamentos, diarias, funcionarios = [], fechamentosPagamento = [], configuracoes } = useApp();

  const [statusFilter, setStatusFilter] = useState('');

  const [startDate, setStartDate] = useState('');

  const [endDate, setEndDate] = useState('');



  const dataInicioControle = getDataInicioControle(configuracoes);



  const dateRange = useMemo(

    () => ({ startDate: startDate || undefined, endDate: endDate || undefined }),

    [startDate, endDate],

  );



  const filteredObras = useMemo(() => {
    if (!statusFilter) return (obras || []).filter(Boolean);
    return (obras || []).filter((obra) => obra && normalizeObraStatus(obra.estado) === statusFilter);
  }, [obras, statusFilter]);

  const summary = useMemo(() => {
    try {
      return calcProfitSummary(filteredObras, gastos, pagamentos, diarias, dateRange, {
        dataInicioControle,
        gastosEmpresa,
        funcionarios,
        fechamentosPagamento,
      });
    } catch (err) {
      console.error('[lucros] Falha ao calcular o resumo', err);
      return {
        metrics: [],
        chartMetrics: [],
        partialMetrics: [],
        totalContratado: 0,
        totalRecebido: 0,
        totalCustos: 0,
        lucroTotal: 0,
        lucroRealizadoTotal: 0,
        margemMedia: 0,
      };
    }
  }, [filteredObras, gastos, gastosEmpresa, pagamentos, diarias, dateRange, dataInicioControle]);



  const controlLabel = formatDataInicioControleLabel(dataInicioControle);

  const interno = useMemo(
    () =>
      buildResultadoInternoEmpresa({
        obras: filteredObras,
        gastos,
        gastosEmpresa,
        diarias,
        pagamentos,
        funcionarios,
        range: {
          inicio: startDate || null,
          fim: endDate || null,
        },
      }),
    [filteredObras, gastos, gastosEmpresa, diarias, pagamentos, funcionarios, startDate, endDate]
  );



  return (

    <div className={shared.page}>

      <PageHeader

        title="Lucros"

        subtitle="Resultado interno do período e posição de cada obra. O valor contratado não é dinheiro recebido."

      />



      {controlLabel && (

        <p className={styles.controlDateNote} role="note">

          Controlo detalhado a partir de {controlLabel}. Obras com dados anteriores ou incompletos

          aparecem separadas e não entram nos totais dos gráficos.

        </p>

      )}



      <ProfitFilters

        statusFilter={statusFilter}

        onStatusChange={setStatusFilter}

        startDate={startDate}

        endDate={endDate}

        onStartDateChange={setStartDate}

        onEndDateChange={setEndDate}

      />



      <div className={shared.statsRow}>
        <Card title="Entradas reais" value={formatCurrency(interno.entradasReais)} subtitle="Dinheiro que entrou no período" iconColor="green" />
        <Card title="Parte da Emerson nas parcerias" value={formatCurrency(interno.parteEmerson)} subtitle="Só Acertos concluídos" iconColor="cyan" />
        <Card title="Gastos da empresa" value={formatCurrency(interno.gastosInternos)} iconColor="orange" />
        <Card
          title="Resultado interno"
          value={formatCurrency(interno.resultadoInterno)}
          subtitle="Não é lucro contabilístico"
          iconColor={interno.resultadoInterno >= 0 ? 'green' : 'red'}
        />
      </div>

      <ProfitSummaryCards summary={summary} />



      <ProfitByWorkChart metrics={summary.chartMetrics} partialMetrics={summary.partialMetrics} />



      <ProfitRanking metrics={summary.chartMetrics} />



      {summary.partialMetrics.length > 0 && (

        <section className={styles.partialSection}>

          <h2 className={styles.sectionHeading}>
            Obras com dados parciais / históricos
            <HelpTip text={HELP.relatorio.dadosIncompletos} />
          </h2>

          <p className={styles.sectionDescription}>

            Estas obras possuem registos anteriores ao controlo detalhado ou incompletos. Os valores

            abaixo refletem apenas o que foi registado — não representam lucro definitivo.

          </p>

          <div className={styles.workCardsList}>

            {summary.partialMetrics.map((metrics) => (

              <WorkProfitCard key={metrics.obraId} metrics={metrics} />

            ))}

          </div>

        </section>

      )}



      <section>

        <h2 className={styles.sectionHeading}>Análise por obra</h2>

        <p className={styles.sectionDescription}>

          Cada secção utiliza a mesma fórmula da página de detalhes da obra: custos = gastos + diárias.

        </p>

        <div className={styles.workCardsList}>

          {summary.metrics.length === 0 ? (

            <p className={shared.mutedCenter}>Nenhuma obra encontrada com os filtros actuais.</p>

          ) : (

            summary.metrics.map((metrics) => (

              <WorkProfitCard key={metrics.obraId} metrics={metrics} />

            ))

          )}

        </div>

      </section>

    </div>

  );

}


