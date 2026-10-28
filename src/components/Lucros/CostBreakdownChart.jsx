import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { CHART_COLORS } from '../../assets/chartColors';
import { formatCurrency } from '../../utils/formatters';
import styles from './Lucros.module.css';

const COLORS = CHART_COLORS.palette;

export default function CostBreakdownChart({ breakdown }) {
  if (!breakdown || breakdown.length === 0) {
    return (
      <p className={styles.noBreakdown}>Sem dados suficientes para composição de custos.</p>
    );
  }

  const data = breakdown.map((item) => ({ name: item.name, value: item.value }));
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={styles.costBreakdown}>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} interval={0} />
          <Tooltip formatter={(v) => formatCurrency(v)} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className={styles.breakdownTotal}>
        <span>Total de custos</span>
        <strong>{formatCurrency(total)}</strong>
      </div>
    </div>
  );
}
