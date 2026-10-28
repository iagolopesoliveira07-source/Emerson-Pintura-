import Table from '../Table/Table';
import Button from '../Button/Button';
import DiariaObservacaoCell from './DiariaObservacaoCell';
import { Pencil } from 'lucide-react';
import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import { calcDiariaTotal } from '../../utils/calculations';
import shared from '../../pages/shared.module.css';

function sortDiariasByDate(diarias = []) {
  return [...diarias].sort((a, b) => {
    if (!a.data && !b.data) return 0;
    if (!a.data) return 1;
    if (!b.data) return -1;
    return a.data.localeCompare(b.data);
  });
}

export default function DiariasConferenciaTable({
  diarias,
  emptyMessage = 'Sem diárias.',
  onEditarDiaria,
}) {
  const columns = [
    { key: 'data', label: 'Data', render: (r) => formatDateOrNotInformed(r.data) },
    {
      key: 'total',
      label: 'Diária',
      align: 'right',
      render: (r) => formatCurrency(calcDiariaTotal(r)),
    },
    {
      key: 'observacao',
      label: 'Observação',
      render: (r) => <DiariaObservacaoCell diaria={r} />,
    },
    {
      key: 'acoes',
      label: '',
      align: 'right',
      width: '3.2rem',
      render: (r) =>
        onEditarDiaria ? (
          <div className={shared.tableActions}>
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              title="Editar diária"
              aria-label="Editar diária"
              onClick={(e) => {
                e.stopPropagation();
                onEditarDiaria(r);
              }}
            />
          </div>
        ) : null,
    },
  ];

  return (
    <Table
      compact
      columns={columns}
      data={sortDiariasByDate(diarias)}
      emptyMessage={emptyMessage}
    />
  );
}
