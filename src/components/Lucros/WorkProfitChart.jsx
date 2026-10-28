import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { CHART_COLORS } from '../../assets/chartColors';
import { formatCurrency } from '../../utils/formatters';
import styles from './Lucros.module.css';

const COLORS = {
  Contratado: CHART_COLORS.primaryDark,
  Recebido: CHART_COLORS.primary,
  Custos: CHART_COLORS.success,
  Lucro: CHART_COLORS.warning,
  Prejuízo: CHART_COLORS.danger,
};

export default function WorkProfitChart({ metrics }) {
  const lucroValue = metrics.lucroContratual;
  const lucroLabel = lucroValue >= 0 ? 'Lucro' : 'Prejuízo';

  const data = [
    { name: 'Contratado', value: metrics.valorContratado, color: COLORS.Contratado },
    { name: 'Recebido', value: metrics.totalRecebido, color: COLORS.Recebido },
    { name: 'Custos', value: metrics.totalCusto, color: COLORS.Custos },
    {
      name: lucroLabel,
      value: Math.abs(lucroValue),
      color: lucroValue >= 0 ? COLORS.Lucro : COLORS.Prejuízo,
    },
  ];

  return (
    <div className={styles.workChart}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
          <Tooltip formatter={(v) => formatCurrency(v)} />
          <Legend />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
