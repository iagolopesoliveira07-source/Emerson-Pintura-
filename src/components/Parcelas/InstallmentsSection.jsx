import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Settings2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import InstallmentSummary from './InstallmentSummary';
import InstallmentTable from './InstallmentTable';
import InstallmentPlanModal from './InstallmentPlanModal';
import InstallmentFormModal from './InstallmentFormModal';
import InstallmentPaymentModal from './InstallmentPaymentModal';
import InstallmentDetailsModal from './InstallmentDetailsModal';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import {
  applyPaymentToInstallment,
  buildInstallmentPlanRecords,
  buildParcelaRecord,
  canDeleteParcela,
  getObraParcelas,
  getObraParcelasSummary,
  obraHasInstallmentPlan,
  updateParcelaRecord,
  validateParcelasSum,
} from '../../utils/debtCalculations';
import { formatCurrency } from '../../utils/formatters';
import { generateId } from '../../services/storageService';
import shared from '../../pages/shared.module.css';

export default function InstallmentsSection({ obra, onSuccess }) {
  const navigate = useNavigate();
  const { pagamentos, addPagamento, updatePagamento, deletePagamento } = useApp();
  const [planOpen, setPlanOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const parcelas = useMemo(() => getObraParcelas(obra.id, pagamentos), [obra.id, pagamentos]);
  const summary = useMemo(() => getObraParcelasSummary(obra, pagamentos), [obra, pagamentos]);
  const hasParcelas = obraHasInstallmentPlan(obra.id, pagamentos);
  const planoId = parcelas[0]?.planoId || generateId();

  const handleCreatePlan = (installments) => {
    const sumCheck = validateParcelasSum(obra, installments);
    if (!sumCheck.isValid) {
      const confirmed = window.confirm(
        `Os valores das parcelas totalizam ${formatCurrency(sumCheck.total)}, mas o valor contratado da obra é ${formatCurrency(sumCheck.contratado)}. Deseja continuar?`
      );
      if (!confirmed) return;
    }

    buildInstallmentPlanRecords(obra, installments).forEach((record) => addPagamento(record));
    setPlanOpen(false);
    onSuccess?.('Parcelamento configurado com sucesso.');
  };

  const handleAddParcela = (form) => {
    const parcelaTotal = hasParcelas ? parcelas.length + 1 : 1;
    const parcelaNumero = hasParcelas ? parcelas.length + 1 : 1;
    const record = buildParcelaRecord(obra, form, {
      parcelaNumero,
      parcelaTotal,
      planoId: hasParcelas ? parcelas[0]?.planoId || planoId : planoId,
    });

    addPagamento(record);

    if (hasParcelas) {
      parcelas.forEach((parcela) => {
        updatePagamento({ ...parcela, parcelaTotal, updatedAt: new Date().toISOString() });
      });
    }

    setCreateOpen(false);
    onSuccess?.('Parcela adicionada com sucesso.');
  };

  const handleEditParcela = (form) => {
    updatePagamento(updateParcelaRecord(selected, form));
    setEditOpen(false);
    setSelected(null);
    onSuccess?.('Parcela atualizada com sucesso.');
  };

  const handleRegisterPayment = (details) => {
    updatePagamento(applyPaymentToInstallment(selected, details.valor, details));
    setPaymentOpen(false);
    setSelected(null);
    onSuccess?.('Pagamento registado com sucesso.');
  };

  const handleDeleteParcela = () => {
    if (!canDeleteParcela(selected)) {
      window.alert('Esta parcela possui pagamentos registados. Exclua ou reverta os pagamentos antes de excluir a parcela.');
      setDeleteOpen(false);
      setSelected(null);
      return;
    }

    deletePagamento(selected.id);
    const remaining = parcelas.filter((p) => p.id !== selected.id);
    remaining.forEach((parcela, index) => {
      updatePagamento({
        ...parcela,
        parcelaNumero: index + 1,
        parcelaTotal: remaining.length,
        updatedAt: new Date().toISOString(),
      });
    });

    setDeleteOpen(false);
    setSelected(null);
    onSuccess?.('Parcela excluída com sucesso.');
  };

  const handleUpdateFromDetails = (updatedParcela) => {
    updatePagamento(updatedParcela);
    setSelected(updatedParcela);
    onSuccess?.('Parcela atualizada com sucesso.');
  };

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>Parcelas</h3>
        <div className={shared.tableActions}>
          {!hasParcelas && (
            <Button icon={Settings2} size="sm" variant="secondary" onClick={() => setPlanOpen(true)}>
              Configurar parcelamento
            </Button>
          )}
          <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
            Adicionar parcela
          </Button>
        </div>
      </div>

      {hasParcelas ? (
        <>
          <InstallmentSummary summary={summary} />
          <InstallmentTable
            parcelas={parcelas}
            onView={(parcela) => {
              setSelected(parcela);
              setDetailsOpen(true);
            }}
            onEdit={(parcela) => {
              setSelected(parcela);
              setEditOpen(true);
            }}
            onDelete={(parcela) => {
              setSelected(parcela);
              setDeleteOpen(true);
            }}
            onRegisterPayment={(parcela) => {
              setSelected(parcela);
              setPaymentOpen(true);
            }}
          />
        </>
      ) : (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Nenhum parcelamento configurado. Utilize &quot;Configurar parcelamento&quot; para gerar as parcelas ou adicione parcelas manualmente.
        </p>
      )}

      <InstallmentPlanModal
        isOpen={planOpen}
        onClose={() => setPlanOpen(false)}
        obra={obra}
        onSubmit={handleCreatePlan}
      />

      <InstallmentFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        obra={obra}
        nextParcelaNumero={parcelas.length + 1}
        parcelaTotal={parcelas.length + 1}
        onSubmit={handleAddParcela}
      />

      <InstallmentFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        parcela={selected}
        obra={obra}
        onSubmit={handleEditParcela}
      />

      <InstallmentPaymentModal
        isOpen={paymentOpen}
        onClose={() => {
          setPaymentOpen(false);
          setSelected(null);
        }}
        parcela={selected}
        onSubmit={handleRegisterPayment}
      />

      <InstallmentDetailsModal
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelected(null);
        }}
        parcela={selected}
        obra={obra}
        onUpdateParcela={handleUpdateFromDetails}
        onViewObra={(obraId) => navigate(`/obras/${obraId}`)}
      />

      {selected && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDeleteParcela}
          title={`Excluir parcela ${selected.parcelaNumero}/${selected.parcelaTotal}?`}
          cancelLabel="Cancelar"
          confirmLabel="Excluir parcela"
        >
          <p className={confirmStyles.message}>
            Tem certeza que deseja excluir a parcela {selected.parcelaNumero}/{selected.parcelaTotal}?
          </p>
          {!canDeleteParcela(selected) && (
            <p className={confirmStyles.message}>
              Esta parcela possui pagamentos registados. Exclua ou reverta os pagamentos antes de excluir a parcela.
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
