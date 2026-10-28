import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, UserMinus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Modal from '../Modal/Modal';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import { FormGroup, Select, FormActions } from '../Form/Form';
import { formatCurrency } from '../../utils/formatters';
import { asIdList } from '../../utils/safeCollections';
import shared from '../../pages/shared.module.css';

export default function ObraFuncionariosSection({ obra, onSuccess }) {
  const navigate = useNavigate();
  const { funcionarios, updateObra, getFuncionarioById } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [funcToRemove, setFuncToRemove] = useState(null);

  const funcionarioIds = asIdList(obra.funcionarios);
  const obraFuncionarios = funcionarioIds.map(getFuncionarioById).filter(Boolean);
  const availableFuncionarios = (funcionarios || []).filter(
    (f) => f && f.estado === 'Ativo' && !funcionarioIds.includes(f.id)
  );

  const handleAdd = () => {
    if (!selectedId) return;

    updateObra({
      ...obra,
      funcionarios: [...funcionarioIds, selectedId],
      updatedAt: new Date().toISOString(),
    });

    setSelectedId('');
    setAddOpen(false);
    onSuccess?.('Funcionário adicionado à obra.');
  };

  const handleRemove = () => {
    if (!funcToRemove) return;

    updateObra({
      ...obra,
      funcionarios: funcionarioIds.filter((id) => id !== funcToRemove.id),
      updatedAt: new Date().toISOString(),
    });

    setFuncToRemove(null);
    setRemoveOpen(false);
    onSuccess?.('Funcionário removido da obra.');
  };

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>Funcionários envolvidos</h3>
        <Button icon={Plus} size="sm" onClick={() => setAddOpen(true)}>
          Adicionar funcionário
        </Button>
      </div>

      {obraFuncionarios.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Nenhum funcionário atribuído.
        </p>
      ) : (
        obraFuncionarios.map((func) => (
          <div key={func.id} className={shared.detailRow}>
            <span
              className={shared.detailLabel}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/funcionarios/${func.id}`)}
            >
              {func.nome}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className={shared.detailValue}>{formatCurrency(func.valorDiaria)}/dia</span>
              <Button
                variant="secondary"
                size="sm"
                icon={UserMinus}
                onClick={() => {
                  setFuncToRemove(func);
                  setRemoveOpen(true);
                }}
              >
                Remover
              </Button>
            </div>
          </div>
        ))
      )}

      <Modal
        isOpen={addOpen}
        onClose={() => {
          setAddOpen(false);
          setSelectedId('');
        }}
        title="Adicionar funcionário à obra"
        footer={
          <FormActions>
            <Button
              variant="secondary"
              onClick={() => {
                setAddOpen(false);
                setSelectedId('');
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={!selectedId}>
              Adicionar
            </Button>
          </FormActions>
        }
      >
        {availableFuncionarios.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Não há funcionários disponíveis para adicionar.
          </p>
        ) : (
          <FormGroup label="Funcionário">
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {availableFuncionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>
          </FormGroup>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={removeOpen}
        onClose={() => {
          setRemoveOpen(false);
          setFuncToRemove(null);
        }}
        onConfirm={handleRemove}
        title="Remover funcionário da obra?"
        message={`Remover ${funcToRemove?.nome || 'este funcionário'} desta obra? O funcionário continuará cadastrado no sistema.`}
        cancelLabel="Cancelar"
        confirmLabel="Remover da obra"
        confirmVariant="danger"
      />
    </div>
  );
}
