import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/Button/Button';
import FuncionarioFormModal from '../../components/FuncionarioForm/FuncionarioFormModal';
import FuncionarioCard from '../../components/Funcionarios/FuncionarioCard';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import { persistFuncionarioForm, getFuncionarioDeleteSummary } from '../../utils/funcionarioForm';
import { getFuncionarioAcertoSummary } from '../../utils/acertoCalculations';
import { getFuncionarioPagamentoResumo } from '../../utils/pagamentoPeriodCalculations';
import cardStyles from '../../components/Funcionarios/FuncionarioCard.module.css';
import shared from '../shared.module.css';
import PeriodFilter from '../../components/PeriodFilter/PeriodFilter';
import { usePeriodFilter } from '../../hooks/usePeriodFilter';
import { filterByPeriod, summarizeDiariasPeriodo } from '../../utils/periodFilter';
import { sameFuncionarioId } from '../../utils/fechamentoPagamentoCalculations';
import { isParceiroFuncionario } from '../../utils/funcionarioTipo';

function FuncionarioSection({ title, icon, funcionarios, fechamentosPagamento, valoresAcerto, periodStatsById, onOpen, onEdit, onDelete, parceiro = false }) {
  if (funcionarios.length === 0) {
    return null;
  }

  return (
    <section className={cardStyles.sectionBlock}>
      <h3 className={cardStyles.sectionTitle}>
        <span>{icon}</span>
        <span>{title}</span>
        <span className={cardStyles.sectionCount}>({funcionarios.length})</span>
      </h3>
      <div className={cardStyles.sectionGrid}>
        {funcionarios.map((func) => (
          <FuncionarioCard
            key={func.id}
            funcionario={func}
            pagamentoResumo={getFuncionarioPagamentoResumo(func, fechamentosPagamento)}
            acertoSummary={getFuncionarioAcertoSummary(func.id, valoresAcerto)}
            periodStats={periodStatsById?.[func.id] || null}
            parceiro={parceiro || isParceiroFuncionario(func)}
            onOpen={() => onOpen(func.id)}
            onEdit={(e) => onEdit(func, e)}
            onDelete={(e) => onDelete(func, e)}
          />
        ))}
      </div>
    </section>
  );
}

export default function Funcionarios() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {
    funcionarios,
    diarias,
    valoresAcerto,
    pagamentos,
    fechamentosPagamento,
    addFuncionario,
    updateFuncionario,
    deleteFuncionario,
  } = useApp();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFuncionario, setSelectedFuncionario] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [filtro, setFiltro] = useState('');
  const period = usePeriodFilter();

  useEffect(() => {
    if (searchParams.get('nova') === 'true') setCreateModalOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
      navigate(location.pathname, { replace: true, state: {} });
      const timer = setTimeout(() => setSuccessMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [location.state, location.pathname, navigate]);

  const filtered = funcionarios.filter(
    (f) => !filtro || f.nome.toLowerCase().includes(filtro.toLowerCase())
  );

  const { pagos, pendentes, parceiros } = useMemo(() => {
    const parceirosList = filtered.filter(isParceiroFuncionario);
    const normais = filtered.filter((func) => !isParceiroFuncionario(func));
    const withStatus = normais.map((func) => ({
      func,
      resumo: getFuncionarioPagamentoResumo(func, fechamentosPagamento),
    }));

    return {
      parceiros: parceirosList,
      pagos: withStatus.filter(({ resumo }) => resumo.isPaid).map(({ func }) => func),
      pendentes: withStatus.filter(({ resumo }) => !resumo.isPaid).map(({ func }) => func),
    };
  }, [filtered, fechamentosPagamento]);

  const periodStatsById = useMemo(() => {
    const stats = {};
    filtered.forEach((func) => {
      const diariasPeriodo = filterByPeriod(
        diarias.filter((d) => sameFuncionarioId(d.funcionarioId, func.id)),
        period.range
      );
      stats[func.id] = summarizeDiariasPeriodo(diariasPeriodo);
    });
    return stats;
  }, [filtered, diarias, period.range]);

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const saveActions = { addFuncionario, updateFuncionario };

  const handleCreate = (form) => {
    persistFuncionarioForm(form, { mode: 'create', actions: saveActions });
    setCreateModalOpen(false);
    showSuccess('Funcionário criado com sucesso.');
  };

  const handleEdit = (form) => {
    persistFuncionarioForm(form, {
      mode: 'edit',
      funcionario: selectedFuncionario,
      actions: saveActions,
    });
    setEditModalOpen(false);
    setSelectedFuncionario(null);
    showSuccess('Funcionário atualizado com sucesso.');
  };

  const handleDelete = () => {
    deleteFuncionario(selectedFuncionario.id);
    setDeleteDialogOpen(false);
    setSelectedFuncionario(null);
    showSuccess('Funcionário excluído com sucesso.');
  };

  const openEdit = (func, e) => {
    e.stopPropagation();
    setSelectedFuncionario(func);
    setEditModalOpen(true);
  };

  const openDelete = (func, e) => {
    e.stopPropagation();
    setSelectedFuncionario(func);
    setDeleteDialogOpen(true);
  };

  const deleteSummary = selectedFuncionario
    ? getFuncionarioDeleteSummary(selectedFuncionario.id, {
        diarias,
        valoresAcerto,
        pagamentos,
        funcionarios,
        fechamentosPagamento,
      })
    : null;

  return (
    <div className={shared.page}>
      <PageHeader
        title="Funcionários"
        subtitle="Gerir a equipa, parceiros de obras e pagamentos por período"
        actions={<Button icon={Plus} onClick={() => setCreateModalOpen(true)}>Novo funcionário</Button>}
      />

      {successMessage && (
        <div className={shared.successBanner} role="status">
          {successMessage}
        </div>
      )}

      <div className={shared.filters}>
        <input
          className={shared.filterInput}
          placeholder="Pesquisar funcionários..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
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

      <FuncionarioSection
        title="Parceiros de obras"
        icon="🤝"
        funcionarios={parceiros}
        fechamentosPagamento={fechamentosPagamento}
        valoresAcerto={valoresAcerto}
        periodStatsById={periodStatsById}
        parceiro
        onOpen={(id) => navigate(`/funcionarios/${id}`)}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      <FuncionarioSection
        title="Pagamentos em dia"
        icon="🟢"
        funcionarios={pagos}
        fechamentosPagamento={fechamentosPagamento}
        valoresAcerto={valoresAcerto}
        periodStatsById={periodStatsById}
        onOpen={(id) => navigate(`/funcionarios/${id}`)}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      <FuncionarioSection
        title="Pagamentos pendentes"
        icon="🟠"
        funcionarios={pendentes}
        fechamentosPagamento={fechamentosPagamento}
        valoresAcerto={valoresAcerto}
        periodStatsById={periodStatsById}
        onOpen={(id) => navigate(`/funcionarios/${id}`)}
        onEdit={openEdit}
        onDelete={openDelete}
      />

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
          Nenhum funcionário encontrado.
        </p>
      )}

      <FuncionarioFormModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        mode="create"
        onSubmit={handleCreate}
      />

      <FuncionarioFormModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedFuncionario(null);
        }}
        mode="edit"
        funcionario={selectedFuncionario}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedFuncionario(null);
        }}
        onConfirm={handleDelete}
        title="Excluir funcionário?"
        message={
          deleteSummary?.hasFinancialRecords
            ? 'Este funcionário possui registros financeiros associados. Tem certeza que deseja excluir?'
            : 'Tem certeza que deseja excluir este funcionário?'
        }
        cancelLabel="Cancelar"
        confirmLabel="Excluir funcionário"
      >
        {deleteSummary?.hasFinancialRecords && (
          <ul style={{ marginTop: '0.75rem', paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
            {deleteSummary.counts.diarias > 0 && <li>{deleteSummary.counts.diarias} diária(s)</li>}
            {deleteSummary.counts.valoresAcerto > 0 && <li>{deleteSummary.counts.valoresAcerto} valor(es) para acerto</li>}
            {deleteSummary.counts.fechamentos > 0 && <li>{deleteSummary.counts.fechamentos} pagamento(s) fechado(s)</li>}
            {deleteSummary.counts.pagamentos > 0 && <li>{deleteSummary.counts.pagamentos} pagamento(s)</li>}
            {deleteSummary.counts.alugueis > 0 && <li>{deleteSummary.counts.alugueis} aluguel(is)</li>}
            {deleteSummary.counts.descontosMensais > 0 && (
              <li>{deleteSummary.counts.descontosMensais} desconto(s) mensal(is)</li>
            )}
          </ul>
        )}
      </ConfirmDialog>
    </div>
  );
}
