import {

  BarChart,

  Bar,

  XAxis,

  YAxis,

  CartesianGrid,

  Tooltip,

  ResponsiveContainer,

  Cell,

  ReferenceLine,

} from 'recharts';

import { formatCurrency } from '../../utils/formatters';

import { CHART_COLORS } from '../../assets/chartColors';

import shared from '../../pages/shared.module.css';

import styles from './Lucros.module.css';



const POSITIVE_COLOR = CHART_COLORS.success;

const NEGATIVE_COLOR = CHART_COLORS.danger;

const PARTIAL_COLOR = CHART_COLORS.warning || '#f59e0b';



export default function ProfitByWorkChart({ metrics, partialMetrics = [] }) {

  const data = [...metrics]

    .sort((a, b) => b.lucroContratual - a.lucroContratual)

    .map((m) => ({

      name: m.obraNome,

      lucro: m.lucroContratual,

      prejuizo: m.lucroContratual < 0,

      parcial: false,

    }));



  const partialData = [...partialMetrics]

    .sort((a, b) => b.lucroContratual - a.lucroContratual)

    .map((m) => ({

      name: `${m.obraNome} *`,

      lucro: m.lucroContratual,

      prejuizo: m.lucroContratual < 0,

      parcial: true,

    }));



  const allData = [...data, ...partialData];



  if (allData.length === 0) {

    return (

      <div className={shared.detailCard}>

        <h3 className={shared.detailCardTitle}>Lucro por obra</h3>

        <p className={shared.mutedCenter}>Nenhuma obra com dados completos para os filtros actuais.</p>

      </div>

    );

  }



  const chartHeight = Math.max(220, allData.length * 44);



  return (

    <div className={shared.detailCard}>

      <h3 className={shared.detailCardTitle}>Lucro por obra</h3>

      <p className={styles.chartHint}>

        Lucro estimado = valor da obra − custos (diárias + gastos). Nas parcerias, o lucro da Emerson
        é a percentagem combinada desse lucro real. Obras com dados parciais aparecem com * e cor
        diferenciada.

      </p>

      <div className={styles.chartContainer} style={{ height: chartHeight }}>

        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={allData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>

            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />

            <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />

            <YAxis

              type="category"

              dataKey="name"

              width={130}

              tick={{ fontSize: 11 }}

              interval={0}

            />

            <ReferenceLine x={0} stroke={CHART_COLORS.neutral} />

            <Tooltip formatter={(v) => formatCurrency(v)} />

            <Bar dataKey="lucro" radius={[0, 4, 4, 0]} maxBarSize={28}>

              {allData.map((entry) => (

                <Cell

                  key={entry.name}

                  fill={

                    entry.parcial

                      ? PARTIAL_COLOR

                      : entry.prejuizo

                        ? NEGATIVE_COLOR

                        : POSITIVE_COLOR

                  }

                />

              ))}

            </Bar>

          </BarChart>

        </ResponsiveContainer>

      </div>

      {partialData.length > 0 && (

        <p className={styles.chartPartialNote}>

          * Obras com dados parciais/históricos — valores baseados apenas no registado.

        </p>

      )}

    </div>

  );

}


