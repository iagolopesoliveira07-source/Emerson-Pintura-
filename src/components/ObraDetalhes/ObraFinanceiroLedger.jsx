import { useMemo, useState } from 'react';
import Table from '../Table/Table';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { filterFinanceiroLedger } from '../../utils/obraCustos';
import styles from './ObraTipo.module.css';
import shared from '../../pages/shared.module.css';

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'entradas', label: 'Entradas' },
  { id: 'saidas', label: 'Saídas' },
  { id: 'diarias', label: 'Diárias' },
  { id: 'materiais', label: 'Materiais' },
  { id: 'outros', label: 'Outros' },
];

export default function ObraFinanceiroLedger({ movimentos = [], showEntradas = true }) {
  const [filtro, setFiltro] = useState('todos');
  const filtros = showEntradas ? FILTROS : FILTROS.filter((item) => item.id !== 'entradas');
  const filtered = useMemo(() => filterFinanceiroLedger(movimentos, filtro), [movimentos, filtro]);

  const columns = [
    { key: 'data', label: 'Data', render: (row) => (row.data ? formatDate(row.data) : '—') },
    { key: 'descricao', label: 'Descrição', render: (row) => row.descricao || '—' },
    { key: 'categoria', label: 'Categoria' },
    {
      key: 'entrada',
      label: 'Entrada',
      align: 'right',
      render: (row) => (row.entrada > 0 ? formatCurrency(row.entrada) : '—'),
    },
    {
      key: 'saida',
      label: 'Saída',
      align: 'right',
      render: (row) => (row.saida > 0 ? formatCurrency(row.saida) : '—'),
    },
    {
      key: 'saldo',
      label: 'Saldo',
      align: 'right',
      render: (row) => formatCurrency(row.saldo),
    },
    { key: 'origem', label: 'Origem' },
  ].filter((col) => showEntradas || col.key !== 'entrada');

  return (
    <div>
      <div className={styles.filters}>
        {filtros.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`${styles.filterBtn} ${filtro === item.id ? styles.filterBtnActive : ''}`}
            onClick={() => setFiltro(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={`${shared.tableScroll} ${styles.ledgerDesktop}`}>
        <Table columns={columns} data={filtered} emptyMessage="Sem movimentos nesta obra." />
      </div>

      <div className={styles.ledgerMobile}>
        {filtered.length === 0 ? (
          <p className={styles.hint}>Sem movimentos nesta obra.</p>
        ) : (
          filtered.map((row) => (
            <div key={row.id} className={styles.movimento}>
              <div className={styles.movimentoTop}>
                <span className={styles.movimentoDesc}>{row.descricao}</span>
                <span className={row.entrada > 0 ? styles.entrada : styles.saida}>
                  {row.entrada > 0 ? `+ ${formatCurrency(row.entrada)}` : `− ${formatCurrency(row.saida)}`}
                </span>
              </div>
              <div className={styles.movimentoMeta}>
                {row.data ? formatDate(row.data) : '—'} · {row.origem}
                {row.categoria ? ` · ${row.categoria}` : ''} · Saldo {formatCurrency(row.saldo)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
