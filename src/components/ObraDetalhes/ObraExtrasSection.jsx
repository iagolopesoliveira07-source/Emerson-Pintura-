import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Badge from '../Badge/Badge';
import Table from '../Table/Table';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import ObraExtraFormModal from './ObraExtraFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { posicaoFinanceiraObra } from '../../utils/relatorioExecutivo';
import {
  EXTRA_STATUS,
  buildObraExtrasDisplay,
  getExtraDate,
  getExtraStatusLabel,
  getExtraStatusVariant,
  getObraExtras,
  isExtraRecebido,
  removeObraExtra,
  setObraExtraStatus,
  upsertObraExtra,
} from '../../utils/obraExtras';
import { HELP } from '../../utils/helpTexts';
import { isPrepaidCreditObra, isPartnershipObra } from '../../utils/obraSpecial';
import HelpTip, { HelpLabel } from '../HelpTip/HelpTip';
import shared from '../../pages/shared.module.css';
import styles from './ObraExtrasSection.module.css';

export default function ObraExtrasSection({ obra, onSuccess }) {
  const { pagamentos, gastos, gastosEmpresa = [], diarias, updateObra } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const posicao = useMemo(() => {
    try {
      return posicaoFinanceiraObra(obra, pagamentos, { gastos, diarias, gastosEmpresa });
    } catch (err) {
      console.error('[obra] Falha ao calcular a posição financeira', err);
      return null;
    }
  }, [obra, pagamentos, gastos, diarias, gastosEmpresa]);
  const display = useMemo(() => buildObraExtrasDisplay(obra, posicao), [obra, posicao]);
  const prepaid = isPrepaidCreditObra(obra);
  const parceria = isPartnershipObra(obra);
  const extras = useMemo(
    () =>
      [...getObraExtras(obra)].sort((a, b) => {
        const da = getExtraDate(b).localeCompare(getExtraDate(a));
        if (da !== 0) return da;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      }),
    [obra]
  );

  const persist = (nextObra, message) => {
    updateObra(nextObra);
    onSuccess?.(message);
  };

  const handleCreate = (extra) => {
    persist(upsertObraExtra(obra, extra), 'Extra registado com sucesso.');
    setCreateOpen(false);
  };

  const handleEdit = (extra) => {
    persist(upsertObraExtra(obra, extra), 'Extra atualizado com sucesso.');
    setEditOpen(false);
    setSelected(null);
  };

  const handleDelete = () => {
    if (!selected) return;
    persist(removeObraExtra(obra, selected.id), 'Extra excluído com sucesso.');
    setDeleteOpen(false);
    setSelected(null);
  };

  const handleStatus = (extra, status, message) => {
    persist(setObraExtraStatus(obra, extra.id, status), message);
  };

  const columns = [
    {
      key: 'descricao',
      label: 'Serviço adicional',
      render: (row) => (
        <div>
          <strong>{row.descricao}</strong>
          {row.observacao ? <div className={styles.observacao}>{row.observacao}</div> : null}
        </div>
      ),
    },
    {
      key: 'valor',
      label: 'Valor cobrado',
      align: 'right',
      render: (row) => formatCurrency(row.valor),
    },
    {
      key: 'data',
      label: 'Data',
      render: (row) => formatDate(getExtraDate(row)),
    },
    ...(parceria
      ? [
          {
            key: 'status',
            label: 'Status',
            help: HELP.extras.status,
            render: (row) => (
              <Badge variant={getExtraStatusVariant(row.status)}>{getExtraStatusLabel(row.status)}</Badge>
            ),
          },
        ]
      : []),
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (row) => (
        <div className={shared.tableActions}>
          {parceria && !isExtraRecebido(row) ? (
            <Button
              variant="secondary"
              size="sm"
              icon={Check}
              onClick={() => handleStatus(row, EXTRA_STATUS.RECEBIDO, 'Extra marcado como recebido.')}
            >
              Recebido
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            title="Editar extra"
            aria-label="Editar extra"
            onClick={() => {
              setSelected(row);
              setEditOpen(true);
            }}
          />
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            title="Excluir extra"
            aria-label="Excluir extra"
            onClick={() => {
              setSelected(row);
              setDeleteOpen(true);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <div className={shared.detailCard} style={{ marginTop: '1rem' }}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>
          Extras / serviços adicionais
          <HelpTip text={HELP.obra.extras} />
        </h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Adicionar Extra
        </Button>
      </div>

      <div className={styles.resumoBar}>
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.valorOriginal}>
            Valor original
          </HelpLabel>
          <span className={styles.resumoValue}>{formatCurrency(display.valorOriginal)}</span>
        </div>
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.extras}>
            Extras/serviços
          </HelpLabel>
          <span className={styles.resumoValue}>{formatCurrency(display.totalExtras)}</span>
        </div>
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.valorAtualizado}>
            Valor total atualizado
          </HelpLabel>
          <span className={`${styles.resumoValue} ${styles.totalDestaque}`}>
            {formatCurrency(display.valorAtualizado)}
          </span>
        </div>
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.recebido}>
            Recebido
          </HelpLabel>
          <span className={styles.resumoValue}>{formatCurrency(display.recebido)}</span>
        </div>
        {prepaid ? null : (
        <div className={styles.resumoItem}>
          <HelpLabel className={styles.resumoLabel} text={HELP.obra.aReceber}>
            {parceria ? 'A receber' : 'Falta receber'}
          </HelpLabel>
          <span className={`${styles.resumoValue} ${styles.saldoDestaque}`}>
            {display.aReceber == null ? '—' : formatCurrency(display.aReceber)}
          </span>
        </div>
        )}
      </div>

      {extras.length > 0 ? (
        <ul className={styles.extrasList}>
          {extras.map((row) => (
            <li key={row.id}>
              <span>
                {row.descricao}
                {row.observacao ? ` — ${row.observacao}` : ''}
              </span>
              <strong>{formatCurrency(row.valor)}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      <p className={styles.hint}>
        {parceria
          ? 'Cada extra é um serviço desta obra e soma ao valor total. «A cobrar» entra em a receber; «Recebido» passa para recebido, sem duplicar o valor. O valor original da obra não muda.'
          : 'O extra é um acréscimo ao valor desta mesma obra. O valor atualizado é o total real. Os pagamentos abatem esse total. Não é uma segunda obra nem uma cobrança separada.'}
      </p>

      <div className={styles.desktopTable}>
        <div className={shared.tableScroll}>
          <Table
            columns={columns}
            data={extras}
            emptyMessage="Nenhum extra registado. Clique em «Adicionar Extra» para um serviço adicional desta obra."
          />
        </div>
      </div>

      <div className={styles.mobileCards}>
        {extras.length === 0 ? (
          <p className={styles.hint}>Nenhum extra registado.</p>
        ) : (
          extras.map((row) => (
            <article key={row.id} className={styles.extraCard}>
              <div>
                <strong>{row.descricao}</strong>
                {row.observacao ? <div className={styles.observacao}>{row.observacao}</div> : null}
              </div>
              <div className={styles.extraCardGrid}>
                <div>
                  <span>Valor cobrado</span>
                  <strong>{formatCurrency(row.valor)}</strong>
                </div>
                <div>
                  <span>Data</span>
                  <strong>{formatDate(getExtraDate(row))}</strong>
                </div>
                {parceria ? (
                <div>
                  <span>Status</span>
                  <Badge variant={getExtraStatusVariant(row.status)}>{getExtraStatusLabel(row.status)}</Badge>
                </div>
                ) : null}
              </div>
              <div className={shared.tableActions}>
                {parceria && !isExtraRecebido(row) ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatus(row, EXTRA_STATUS.RECEBIDO, 'Extra marcado como recebido.')}
                  >
                    Recebido
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Pencil}
                  onClick={() => {
                    setSelected(row);
                    setEditOpen(true);
                  }}
                >
                  Editar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => {
                    setSelected(row);
                    setDeleteOpen(true);
                  }}
                >
                  Excluir
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <ObraExtraFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        showStatus={parceria}
        onSubmit={handleCreate}
      />
      <ObraExtraFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        mode="edit"
        extra={selected}
        showStatus={parceria}
        onSubmit={handleEdit}
      />
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onConfirm={handleDelete}
        title="Excluir este extra?"
        message={
          selected
            ? `O extra «${selected.descricao}» (${formatCurrency(selected.valor)}) será removido da obra. O valor original não é alterado.`
            : 'Este extra será removido.'
        }
        cancelLabel="Cancelar"
        confirmLabel="Excluir extra"
      />
    </div>
  );
}
