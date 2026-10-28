import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, Wallet, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import Table from '../Table/Table';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import AluguelFormModal from './AluguelFormModal';
import DescontoFormModal from './DescontoFormModal';
import CommitmentRegisterParcelaModal from './CommitmentRegisterParcelaModal';
import CommitmentChangeParcelaModal from './CommitmentChangeParcelaModal';
import CommitmentHistoryModal from './CommitmentHistoryModal';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import {
  addAluguelToFuncionario,
  updateAluguelOnFuncionario,
  deleteAluguelFromFuncionario,
  registerAluguelParcela,
  updateAluguelParcelaAtual,
  updateAluguelParcelaSettings,
  addDescontoToFuncionario,
  updateDescontoOnFuncionario,
  deleteDescontoFromFuncionario,
  registerDescontoParcela,
  updateDescontoParcelaAtual,
  updateDescontoParcelaSettings,
} from '../../utils/funcionarioForm';
import {
  TIPO_COBRANCA,
  canRegisterParcela,
  getCommitmentDisplayEstado,
  getHistoricoParcelas,
  getParcelaProgressLabel,
  getParcelasRestantesTableLabel,
  getTipoCobranca,
  getValorParcela,
  isCommitmentFinanciallyActive,
  isCommitmentParcelado,
  isCommitmentRecorrente,
} from '../../utils/commitmentCalculations';
import { formatCurrency } from '../../utils/formatters';
import shared from '../../pages/shared.module.css';

const KIND_CONFIG = {
  aluguel: {
    field: 'alugueis',
    add: addAluguelToFuncionario,
    update: updateAluguelOnFuncionario,
    delete: deleteAluguelFromFuncionario,
    register: registerAluguelParcela,
    updateParcelaAtual: updateAluguelParcelaAtual,
    updateParcelaSettings: updateAluguelParcelaSettings,
    emptyMessage: 'Sem aluguéis registados.',
    addLabel: 'Adicionar aluguel',
    registerLabel: 'Aluguel',
    deleteTitle: 'Excluir aluguel?',
    FormModal: AluguelFormModal,
    formProp: 'aluguel',
  },
  desconto: {
    field: 'descontosMensais',
    add: addDescontoToFuncionario,
    update: updateDescontoOnFuncionario,
    delete: deleteDescontoFromFuncionario,
    register: registerDescontoParcela,
    updateParcelaAtual: updateDescontoParcelaAtual,
    updateParcelaSettings: updateDescontoParcelaSettings,
    emptyMessage: 'Sem descontos registados.',
    addLabel: 'Adicionar desconto',
    registerLabel: 'Desconto',
    deleteTitle: 'Excluir desconto?',
    FormModal: DescontoFormModal,
    formProp: 'desconto',
  },
};

function estadoBadgeVariant(estado) {
  if (estado === 'Concluído') return 'success';
  if (estado === 'Ativo') return 'primary';
  return 'default';
}

export default function FuncionarioCommitmentsSection({
  kind,
  title,
  funcionario,
  onSuccess,
  tipoFilter = null,
}) {
  const config = KIND_CONFIG[kind];
  const { updateFuncionario, getFuncionarioById } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [changeParcelaOpen, setChangeParcelaOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const FormModal = config.FormModal;

  const items = useMemo(() => {
    const all = [...(funcionario[config.field] || [])];
    const filtered = tipoFilter
      ? all.filter((item) => getTipoCobranca(item) === tipoFilter)
      : all;
    return filtered.sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '', 'pt-PT'));
  }, [funcionario, config.field, tipoFilter]);

  const onlyRecorrente = tipoFilter === TIPO_COBRANCA.RECORRENTE;
  const onlyParcelado = tipoFilter === TIPO_COBRANCA.PARCELADO;

  const totalRecorrenteAtivo = items
    .filter((item) => isCommitmentRecorrente(item) && isCommitmentFinanciallyActive(item))
    .reduce((sum, item) => sum + getValorParcela(item), 0);

  const totalParceladoRegistrado = items
    .filter((item) => isCommitmentParcelado(item))
    .reduce(
      (sum, item) => sum + getHistoricoParcelas(item).reduce((s, e) => s + (e.valor || 0), 0),
      0
    );

  const getCurrentFuncionario = () => getFuncionarioById(funcionario.id) || funcionario;

  const runUpdate = (updater) => {
    try {
      updateFuncionario(updater(getCurrentFuncionario()));
      return true;
    } catch (error) {
      window.alert(error.message || 'Não foi possível concluir a operação.');
      return false;
    }
  };

  const handleCreate = (form) => {
    if (runUpdate((current) => config.add(current, form))) {
      setCreateOpen(false);
      onSuccess?.(`${config.registerLabel} registado com sucesso.`);
    }
  };

  const handleEdit = (form) => {
    if (runUpdate((current) => config.update(current, selected.id, form))) {
      setEditOpen(false);
      setSelected(null);
      onSuccess?.(`${config.registerLabel} atualizado com sucesso.`);
    }
  };

  const handleDelete = () => {
    if (runUpdate((current) => config.delete(current, selected.id))) {
      setDeleteOpen(false);
      setSelected(null);
      onSuccess?.(`${config.registerLabel} excluído com sucesso.`);
    }
  };

  const handleRegisterParcela = (details) => {
    if (runUpdate((current) => config.register(current, selected.id, details))) {
      setRegisterOpen(false);
      setSelected(null);
      onSuccess?.('Parcela registrada com sucesso.');
    }
  };

  const handleChangeParcela = (settings) => {
    if (runUpdate((current) => config.updateParcelaSettings(current, selected.id, settings))) {
      setChangeParcelaOpen(false);
      setSelected(null);
      onSuccess?.('Parcela atualizada com sucesso.');
    }
  };

  const columns = [
    { key: 'descricao', label: 'Descrição' },
    {
      key: 'valor',
      label: onlyRecorrente ? 'Valor mensal' : 'Valor',
      align: 'right',
      render: (r) =>
        isCommitmentParcelado(r)
          ? formatCurrency(getValorParcela(r))
          : `${formatCurrency(getValorParcela(r))}/mês`,
    },
    ...(onlyRecorrente
      ? []
      : [
          {
            key: 'parcela',
            label: 'Parcela',
            render: (r) => (isCommitmentParcelado(r) ? getParcelaProgressLabel(r) : '—'),
          },
          {
            key: 'restantes',
            label: 'Restantes',
            render: (r) =>
              isCommitmentParcelado(r) ? getParcelasRestantesTableLabel(r) : '—',
          },
        ]),
    {
      key: 'estado',
      label: 'Estado',
      render: (r) => {
        const estado = getCommitmentDisplayEstado(r);
        return <Badge variant={estadoBadgeVariant(estado)}>{estado}</Badge>;
      },
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (r) => (
        <div className={shared.tableActions}>
          {isCommitmentParcelado(r) && (
            <>
              {canRegisterParcela(r) && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Wallet}
                  onClick={() => {
                    setSelected(r);
                    setRegisterOpen(true);
                  }}
                >
                  Registrar parcela
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                title="Alterar parcela"
                onClick={() => {
                  setSelected(r);
                  setChangeParcelaOpen(true);
                }}
              >
                Alterar parcela
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={Eye}
                title="Ver histórico"
                onClick={() => {
                  setSelected(r);
                  setHistoryOpen(true);
                }}
              />
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            title="Editar"
            onClick={() => {
              setSelected(r);
              setEditOpen(true);
            }}
          />
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            title="Excluir"
            onClick={() => {
              setSelected(r);
              setDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  const footerLabel = onlyParcelado
    ? 'Total registrado'
    : onlyRecorrente
      ? 'Total mensal ativo'
      : 'Total mensal recorrente ativo';

  const footerValue = onlyParcelado ? totalParceladoRegistrado : totalRecorrenteAtivo;
  const showParceladoFooter = !onlyRecorrente && !onlyParcelado && totalParceladoRegistrado > 0;

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>{title}</h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          {config.addLabel}
        </Button>
      </div>

      <div className={shared.tableScroll}>
        <Table columns={columns} data={items} emptyMessage={config.emptyMessage} />
      </div>

      {items.length > 0 && (footerValue > 0 || onlyParcelado) && (
        <>
          {!onlyParcelado && totalRecorrenteAtivo > 0 && (
            <div className={shared.sectionTotal}>
              <span>{footerLabel}</span>
              <span className={shared.sectionTotalValue}>{formatCurrency(footerValue)}</span>
            </div>
          )}
          {(onlyParcelado || showParceladoFooter) && totalParceladoRegistrado > 0 && (
            <div className={shared.sectionTotal}>
              <span>Total parcelado registrado</span>
              <span className={shared.sectionTotalValue}>
                {formatCurrency(totalParceladoRegistrado)}
              </span>
            </div>
          )}
        </>
      )}

      <FormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        defaultTipoCobranca={tipoFilter || TIPO_COBRANCA.RECORRENTE}
      />

      <FormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        {...{ [config.formProp]: selected }}
        onSubmit={handleEdit}
      />

      <CommitmentRegisterParcelaModal
        isOpen={registerOpen}
        onClose={() => {
          setRegisterOpen(false);
          setSelected(null);
        }}
        item={selected}
        label={config.registerLabel}
        onSubmit={handleRegisterParcela}
      />

      <CommitmentChangeParcelaModal
        isOpen={changeParcelaOpen}
        onClose={() => {
          setChangeParcelaOpen(false);
          setSelected(null);
        }}
        item={selected}
        onSubmit={handleChangeParcela}
      />

      <CommitmentHistoryModal
        isOpen={historyOpen}
        onClose={() => {
          setHistoryOpen(false);
          setSelected(null);
        }}
        item={selected}
      />

      {selected && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDelete}
          title={config.deleteTitle}
          cancelLabel="Cancelar"
          confirmLabel="Excluir"
        >
          <p className={confirmStyles.message}>
            Tem certeza que deseja excluir este registo?
          </p>
          {getHistoricoParcelas(selected).length > 0 && (
            <p className={confirmStyles.message}>
              Este registo possui {getHistoricoParcelas(selected).length} parcela(s) registrada(s)
              no histórico financeiro. A exclusão removerá o lançamento e o histórico associado.
            </p>
          )}
          <div className={confirmStyles.details}>
            {[
              ['Descrição', selected.descricao],
              ['Valor', formatCurrency(getValorParcela(selected))],
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
