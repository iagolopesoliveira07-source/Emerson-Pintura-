import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Table from '../Table/Table';
import DiariaFormModal from '../DiariaForm/DiariaFormModal';
import ParceriaDiariaControleModal from './ParceriaDiariaControleModal';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import { formToDiariaPayload, buildDiariaUpdate } from '../../utils/diariaForm';
import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import { calcDiariaTotal } from '../../utils/calculations';
import { isParceiroFuncionario, isDiariaDeParceiro, findFuncionarioById } from '../../utils/funcionarioTipo';
import { getTipoObra, TIPO_OBRA } from '../../utils/obraSpecial';
import { aplicarValorControleParceria, getDiariaCustoInternoParceria } from '../../utils/obraPartnership';
import {
  diariaPertenceAObra,
  getDiariaCustoNaObra,
  getDiariaIntervencaoNaObra,
  getDiariaQuantidadeNaObra,
  formatDiariaQuantidade,
  isDiariaMultiObra,
  formatDiariaObrasLabel,
} from '../../utils/diariaObraAlocacao';
import shared from '../../pages/shared.module.css';

function inicioSemanaDaData(iso) {
  const value = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayNum = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${dayNum}`;
}

/** Semana de segunda a domingo da diária mais recente. Não altera a lista original. */
export function diariasDaSemanaMaisRecente(lista = []) {
  let semana = '';
  lista.forEach((item) => {
    const inicio = inicioSemanaDaData(item?.data);
    if (inicio > semana) semana = inicio;
  });
  if (!semana) return lista;
  return lista.filter((item) => inicioSemanaDaData(item?.data) === semana);
}

export default function ObraDiariasSection({
  obra,
  onSuccess,
  intervencaoId = null,
  unassignedOnly = false,
  title = 'Diárias',
}) {
  const { diarias, funcionarios, obras, addDiaria, updateDiaria, deleteDiaria, getFuncionarioById } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [controleOpen, setControleOpen] = useState(false);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const parceria = getTipoObra(obra) === TIPO_OBRA.PARCERIA;

  const obraDiarias = (diarias || [])
    .filter((d) => {
      if (!d || !diariaPertenceAObra(d, obra.id)) return false;
      const intervencao = getDiariaIntervencaoNaObra(d, obra.id);
      if (intervencaoId) return intervencao === intervencaoId;
      if (unassignedOnly) return !intervencao;
      return true;
    })
    .sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return new Date(b.data) - new Date(a.data);
    });

  const total = obraDiarias.reduce((sum, d) => {
    if (parceria && !isDiariaDeParceiro(d, funcionarios)) {
      return sum + getDiariaCustoInternoParceria(d, obra.id, funcionarios);
    }
    return sum + getDiariaCustoNaObra(d, obra.id, funcionarios);
  }, 0);

  const semanaRecente = diariasDaSemanaMaisRecente(obraDiarias);
  const haMaisDiarias = semanaRecente.length < obraDiarias.length;
  const diariasVisiveis = mostrarTodas || !haMaisDiarias ? obraDiarias : semanaRecente;

  const editarControleParceria = (diaria) => parceria && !isDiariaDeParceiro(diaria, funcionarios);

  const handleCreate = (form) => {
    const func = funcionarios.find((f) => f.id === form.funcionarioId);
    addDiaria({
      ...formToDiariaPayload(form, null, { parceiro: isParceiroFuncionario(func) }),
      ...(intervencaoId ? { intervencaoId } : {}),
    });
    setCreateOpen(false);
    onSuccess?.('Diária registada com sucesso.');
  };

  const handleControle = ({ valor, observacao }) => {
    if (!selected) return;
    updateDiaria(aplicarValorControleParceria(selected, { valor, observacao }));
    setControleOpen(false);
    setSelected(null);
    onSuccess?.('Valor de controlo da parceria atualizado.');
  };

  const handleEdit = (form) => {
    updateDiaria(
      buildDiariaUpdate(selected, form, {
        parceiro: isParceiroFuncionario(funcionarios.find((f) => f.id === form.funcionarioId)),
      })
    );
    setEditOpen(false);
    setSelected(null);
    onSuccess?.('Diária atualizada com sucesso.');
  };

  const handleDelete = () => {
    deleteDiaria(selected.id);
    setDeleteOpen(false);
    setSelected(null);
    onSuccess?.('Diária excluída com sucesso.');
  };

  const columns = [
    { key: 'data', label: 'Data', render: (r) => formatDateOrNotInformed(r.data) },
    {
      key: 'funcionario',
      label: 'Funcionário',
      render: (r) => getFuncionarioById(r.funcionarioId)?.nome
        ? `${getFuncionarioById(r.funcionarioId).nome}${isDiariaDeParceiro(r, funcionarios) ? ' (Parceiro)' : ''}`
        : '—',
    },
    { key: 'quantidade', label: 'Qtd.', render: (r) => formatDiariaQuantidade(getDiariaQuantidadeNaObra(r, obra.id)) },
    {
      key: 'observacao',
      label: 'Observação',
      render: (r) => {
        const extra = isDiariaMultiObra(r)
          ? formatDiariaObrasLabel(r, (id) => obras.find((item) => item.id === id)?.nome)
          : '';
        const nota = r.observacao?.trim() || '';
        if (extra && nota) return `${extra}. ${nota}`;
        return extra || nota || '—';
      },
    },
    {
      key: 'valorDiaria',
      label: 'Valor/dia',
      align: 'right',
      render: (r) => {
        if (isDiariaDeParceiro(r, funcionarios)) {
          const salvo = Number(r.valorDiaria);
          return Number.isFinite(salvo) && salvo > 0 ? formatCurrency(salvo) : '—';
        }
        if (parceria) {
          const quantidade = getDiariaQuantidadeNaObra(r, obra.id);
          const totalControle = getDiariaCustoInternoParceria(r, obra.id, funcionarios);
          const unitario = quantidade > 0 ? totalControle / quantidade : totalControle;
          return formatCurrency(unitario);
        }
        return formatCurrency(r.valorDiaria);
      },
    },
    {
      key: 'total',
      label: 'Total',
      align: 'right',
      render: (r) => {
        if (isDiariaDeParceiro(r, funcionarios)) return 'Controlo';
        if (parceria) return formatCurrency(getDiariaCustoInternoParceria(r, obra.id, funcionarios));
        return formatCurrency(getDiariaCustoNaObra(r, obra.id, funcionarios));
      },
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
            title={editarControleParceria(r) ? 'Editar valor de controlo da parceria' : 'Editar diária'}
            aria-label="Editar diária"
            onClick={() => {
              setSelected(r);
              if (editarControleParceria(r)) setControleOpen(true);
              else setEditOpen(true);
            }}
          >
            {editarControleParceria(r) ? 'Editar' : null}
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            title="Excluir diária"
            aria-label="Excluir diária"
            onClick={() => {
              setSelected(r);
              setDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>{title}</h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Registar diária
        </Button>
      </div>

      {parceria ? (
        <p className={shared.detailValue} style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          As diárias dos funcionários nesta obra são só controlo da parceria. Editar o valor aqui não altera o fechamento do funcionário.
        </p>
      ) : null}

      <div className={shared.tableScroll}>
        <Table
          columns={columns}
          data={diariasVisiveis}
          emptyMessage={
            intervencaoId
              ? 'Sem diárias neste serviço.'
              : unassignedOnly
                ? 'Sem diárias sem serviço definido.'
                : 'Sem diárias registadas.'
          }
        />
      </div>

      {haMaisDiarias ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.65rem' }}>
          <button
            type="button"
            onClick={() => setMostrarTodas((atual) => !atual)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.2rem 0.4rem',
              color: 'var(--color-text-muted)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {mostrarTodas ? 'Mostrar menos' : 'Ler mais'}
          </button>
        </div>
      ) : null}

      {obraDiarias.length > 0 && (
        <div className={shared.sectionTotal}>
          <span>Total de diárias</span>
          <span className={shared.sectionTotalValue}>{formatCurrency(total)}</span>
        </div>
      )}

      <DiariaFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        funcionarios={funcionarios}
        obras={obras}
        fixedObraId={obra.id}
        fixedIntervencaoId={intervencaoId}
        onSubmit={handleCreate}
      />

      <ParceriaDiariaControleModal
        isOpen={controleOpen}
        onClose={() => {
          setControleOpen(false);
          setSelected(null);
        }}
        diaria={selected}
        funcionario={findFuncionarioById(funcionarios, selected?.funcionarioId)}
        onSubmit={handleControle}
      />

      <DiariaFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        mode="edit"
        diaria={selected}
        funcionarios={funcionarios}
        obras={obras}
        fixedObraId={obra.id}
        onSubmit={handleEdit}
      />

      {selected && deleteOpen && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDelete}
          title="Excluir diária?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir diária"
        >
          <p className={confirmStyles.message}>Tem certeza que deseja excluir esta diária?</p>
          <div className={confirmStyles.details}>
            {[
              ['Funcionário', getFuncionarioById(selected.funcionarioId)?.nome || '—'],
              ['Data', formatDateOrNotInformed(selected.data)],
              ['Total', formatCurrency(calcDiariaTotal(selected))],
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
