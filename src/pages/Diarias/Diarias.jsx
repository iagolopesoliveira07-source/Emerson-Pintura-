import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Card from '../../components/Card/Card';
import Table from '../../components/Table/Table';
import DiariaFormModal from '../../components/DiariaForm/DiariaFormModal';
import DiariaObservacaoCell from '../../components/FuncionarioDetalhes/DiariaObservacaoCell';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import confirmStyles from '../../components/ConfirmDialog/ConfirmDialog.module.css';
import {
  formToDiariaPayload,
  buildDiariaUpdate,
} from '../../utils/diariaForm';
import { diariaPertenceAObra, formatDiariaObrasLabel } from '../../utils/diariaObraAlocacao';
import { formatCurrency, formatDate, formatDateOrNotInformed } from '../../utils/formatters';
import { calcDiariaTotal } from '../../utils/calculations';
import { isParceiroFuncionario, isDiariaDeParceiro, calcDiariaValorPagavel } from '../../utils/funcionarioTipo';
import {
  isDiariaPendente,
  getDiariaDataPagamento,
} from '../../utils/fechamentoPagamentoCalculations';
import PeriodFilter from '../../components/PeriodFilter/PeriodFilter';
import { usePeriodFilter } from '../../hooks/usePeriodFilter';
import { filterByPeriod } from '../../utils/periodFilter';
import shared from '../shared.module.css';
import { HELP } from '../../utils/helpTexts';

export default function Diarias() {
  const [searchParams] = useSearchParams();
  const { diarias, funcionarios, obras, fechamentosPagamento, addDiaria, updateDiaria, deleteDiaria, marcarDiariaComoPaga } = useApp();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDiaria, setSelectedDiaria] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [filtroFunc, setFiltroFunc] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const period = usePeriodFilter();

  useEffect(() => {
    if (searchParams.get('nova') === 'true') setCreateModalOpen(true);
  }, [searchParams]);

  const filtered = useMemo(() => {
    return filterByPeriod(diarias, period.range).filter((d) => {
      if (filtroFunc && d.funcionarioId !== filtroFunc) return false;
      if (filtroObra && !diariaPertenceAObra(d, filtroObra)) return false;
      return true;
    });
  }, [diarias, filtroFunc, filtroObra, period.range]);

  const sortedData = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (!a.data && !b.data) return 0;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return new Date(b.data) - new Date(a.data);
      }),
    [filtered]
  );

  const totalGeral = filtered.reduce((s, d) => s + calcDiariaValorPagavel(d, funcionarios), 0);

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleCreate = (form) => {
    const func = funcionarios.find((f) => f.id === form.funcionarioId);
    addDiaria(formToDiariaPayload(form, null, { parceiro: isParceiroFuncionario(func) }));
    setCreateModalOpen(false);
  };

  const handleEdit = (form) => {
    const func = funcionarios.find((f) => f.id === form.funcionarioId);
    updateDiaria(buildDiariaUpdate(selectedDiaria, form, { parceiro: isParceiroFuncionario(func) }));
    setEditModalOpen(false);
    setSelectedDiaria(null);
    showSuccess('Diária atualizada com sucesso.');
  };

  const handleDelete = () => {
    deleteDiaria(selectedDiaria.id);
    setDeleteDialogOpen(false);
    setSelectedDiaria(null);
    showSuccess('Diária excluída com sucesso.');
  };

  const openEdit = (diaria) => {
    setSelectedDiaria(diaria);
    setEditModalOpen(true);
  };

  const openDelete = (diaria) => {
    setSelectedDiaria(diaria);
    setDeleteDialogOpen(true);
  };

  const handleMarcarComoPago = (diaria) => {
    const result = marcarDiariaComoPaga(diaria.id);
    if (result.error) {
      window.alert(result.error);
      return;
    }
    showSuccess('Diária marcada como paga.');
  };

  const renderEstadoDiaria = (diaria) => {
    if (isDiariaDeParceiro(diaria, funcionarios)) {
      return <Badge variant="info">Controlo</Badge>;
    }
    const pendente = isDiariaPendente(diaria, fechamentosPagamento);
    const dataPagamento = getDiariaDataPagamento(diaria, fechamentosPagamento);

    if (pendente) {
      return (
        <div className={shared.tableActions} style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <Badge variant="warning">Pendente</Badge>
          <Button
            variant="secondary"
            size="sm"
            icon={CheckCircle}
            onClick={() => handleMarcarComoPago(diaria)}
          >
            Marcar como pago
          </Button>
        </div>
      );
    }

    return (
      <div>
        <Badge variant="success">Pago</Badge>
        {dataPagamento && (
          <div style={{ fontSize: '0.85em', color: '#64748b', marginTop: 4 }}>
            Pago em {formatDate(dataPagamento)}
          </div>
        )}
      </div>
    );
  };

  const getFuncionarioNome = (id) => funcionarios.find((f) => f.id === id)?.nome || '—';
  const getObraNome = (id) => obras.find((o) => o.id === id)?.nome || '—';
  const getObraLabel = (diaria) => formatDiariaObrasLabel(diaria, getObraNome);

  const columns = [
    { key: 'data', label: 'Data', render: (r) => formatDateOrNotInformed(r.data) },
    { key: 'funcionario', label: 'Funcionário', render: (r) => {
      const nome = getFuncionarioNome(r.funcionarioId);
      return isDiariaDeParceiro(r, funcionarios) ? `${nome} (Parceiro)` : nome;
    } },
    { key: 'obra', label: 'Obra', render: (r) => getObraLabel(r) },
    { key: 'quantidade', label: 'Qtd.' },
    {
      key: 'valorDiaria',
      label: 'Valor/dia',
      align: 'right',
      render: (r) => {
        if (isDiariaDeParceiro(r, funcionarios)) {
          const salvo = Number(r.valorDiaria);
          return Number.isFinite(salvo) && salvo > 0 ? formatCurrency(salvo) : '—';
        }
        return formatCurrency(r.valorDiaria);
      },
    },
    { key: 'total', label: 'Diária', align: 'right', render: (r) => isDiariaDeParceiro(r, funcionarios) ? 'Controlo' : formatCurrency(calcDiariaValorPagavel(r, funcionarios)) },
    {
      key: 'observacao',
      label: 'Observação',
      help: HELP.diaria.observacao,
      render: (r) => <DiariaObservacaoCell diaria={r} />,
    },
    {
      key: 'estado',
      label: 'Estado',
      help: HELP.diaria.estado,
      render: (r) => renderEstadoDiaria(r),
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (r) => (
        <div className={shared.tableActions}>
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            title="Editar diária"
            aria-label="Editar diária"
            onClick={() => openEdit(r)}
          />
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            title="Excluir diária"
            aria-label="Excluir diária"
            onClick={() => openDelete(r)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className={shared.page}>
      <PageHeader
        title="Diárias"
        subtitle="Registar e consultar diárias de trabalho"
        actions={<Button icon={Plus} onClick={() => setCreateModalOpen(true)}>Registar diária</Button>}
      />

      {successMessage && (
        <div className={shared.successBanner} role="status">
          {successMessage}
        </div>
      )}

      <div className={shared.statsRow}>
        <Card title="Total filtrado" value={formatCurrency(totalGeral)} iconColor="blue" />
        <Card title="Registos" value={filtered.length} iconColor="cyan" />
      </div>

      <div className={shared.filters}>
        <select className={shared.filterInput} value={filtroFunc} onChange={(e) => setFiltroFunc(e.target.value)}>
          <option value="">Todos os funcionários</option>
          {funcionarios.filter((f) => f.estado === 'Ativo').map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
        <select className={shared.filterInput} value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)}>
          <option value="">Todas as obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </div>

      <PeriodFilter
        preset={period.preset}
        onPresetChange={period.setPreset}
        customInicio={period.customInicio}
        customFim={period.customFim}
        onCustomInicioChange={period.setCustomInicio}
        onCustomFimChange={period.setCustomFim}
        label={period.label}
      />

      <Table
        columns={columns}
        data={sortedData}
        emptyMessage={period.preset === 'todos' ? 'Nenhuma diária registada.' : 'Nenhuma diária neste período.'}
      />

      <DiariaFormModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        mode="create"
        funcionarios={funcionarios}
        obras={obras}
        onSubmit={handleCreate}
      />

      <DiariaFormModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedDiaria(null);
        }}
        mode="edit"
        diaria={selectedDiaria}
        funcionarios={funcionarios}
        obras={obras}
        onSubmit={handleEdit}
      />

      {selectedDiaria && deleteDialogOpen && (
        <ConfirmDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setSelectedDiaria(null);
          }}
          onConfirm={handleDelete}
          title="Excluir diária?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir diária"
        >
          <p className={confirmStyles.message}>Tem certeza que deseja excluir este registo de diária?</p>
          <div className={confirmStyles.details}>
            {[
              ['Funcionário', getFuncionarioNome(selectedDiaria.funcionarioId)],
              ['Obra', getObraLabel(selectedDiaria)],
              ['Data', formatDateOrNotInformed(selectedDiaria.data)],
              ['Total', formatCurrency(calcDiariaTotal(selectedDiaria))],
            ].map(([label, value]) => (
              <div key={label} className={confirmStyles.detailRow}>
                <span className={confirmStyles.detailLabel}>{label}:</span>
                <span className={confirmStyles.detailValue}>{value}</span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
