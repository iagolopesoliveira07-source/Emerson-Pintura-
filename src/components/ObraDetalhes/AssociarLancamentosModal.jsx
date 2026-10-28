import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormActions } from '../Form/Form';
import { formatCurrency, formatDateOrNotInformed } from '../../utils/formatters';
import { calcDiariaTotal } from '../../utils/calculations';
import { getGastoValorAssinado } from '../../utils/gastoDocumentoTipo';
import { getGastoEmpresaValor, isGastoEmpresaPrevisto } from '../../utils/gastoEmpresaCalculations';
import { getGastoEmpresaFornecedorLabel } from '../../utils/gastoEmpresaSeguranca';
import { hasIvaInfo, formatTaxaIva } from '../../utils/ivaCalculations';
import { addDaysISO, getIntervencaoNome, getWeekStartISO } from '../../utils/obraPrepaidCredit';
import styles from './ObraCredito.module.css';

function weekLabel(start) {
  if (!start) return 'Sem data';
  const end = addDaysISO(start, 6);
  return `${formatDateOrNotInformed(start)} a ${formatDateOrNotInformed(end)}`;
}

export default function AssociarLancamentosModal({
  isOpen,
  onClose,
  mode = 'diarias',
  obra,
  targetIntervencao,
  servicos = [],
  diarias = [],
  gastos = [],
  gastosEmpresa = [],
  getFuncionarioNome,
  onConfirm,
}) {
  const isDiarias = mode === 'diarias';
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [incluirOutros, setIncluirOutros] = useState(false);
  const [confirmMove, setConfirmMove] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set());
    setIncluirOutros(false);
    setConfirmMove(null);
  }, [isOpen, mode, targetIntervencao?.id]);

  const rows = useMemo(() => {
    if (!isOpen || !obra?.id) return [];
    if (isDiarias) {
      return (diarias || [])
        .filter((item) => item && item.obraId === obra.id)
        .filter((item) => {
          if (!item.intervencaoId) return true;
          if (item.intervencaoId === targetIntervencao?.id) return false;
          return incluirOutros;
        })
        .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
        .map((item) => ({
          id: item.id,
          kind: 'diaria',
          data: item.data,
          intervencaoId: item.intervencaoId || null,
          funcionario: getFuncionarioNome?.(item.funcionarioId) || '—',
          valor: calcDiariaTotal(item),
          observacao: item.observacao || '',
          record: item,
        }));
    }

    const obraGastos = (gastos || [])
      .filter((item) => item && item.obraId === obra.id)
      .map((item) => ({
        id: `obra:${item.id}`,
        recordId: item.id,
        kind: 'obra',
        data: item.data,
        intervencaoId: item.intervencaoId || null,
        fornecedor: item.fornecedorNome || item.fornecedor || '—',
        categoria: item.categoria || item.descricao || '—',
        valor: getGastoValorAssinado(item),
        iva: hasIvaInfo(item)
          ? `${formatTaxaIva(item.taxaIva)}${item.valorIva != null ? ` · ${formatCurrency(item.valorIva)}` : ''}`
          : '',
        record: item,
      }));

    const empresa = (gastosEmpresa || [])
      .filter((item) => item && item.obraId === obra.id && !isGastoEmpresaPrevisto(item))
      .map((item) => ({
        id: `empresa:${item.id}`,
        recordId: item.id,
        kind: 'empresa',
        data: item.data,
        intervencaoId: item.intervencaoId || null,
        fornecedor: getGastoEmpresaFornecedorLabel(item) || item.fornecedorNome || '—',
        categoria: item.categoria || item.descricao || '—',
        valor: getGastoEmpresaValor(item),
        iva: hasIvaInfo(item)
          ? `${formatTaxaIva(item.taxaIva)}${item.valorIva != null ? ` · ${formatCurrency(item.valorIva)}` : ''}`
          : '',
        record: item,
      }));

    return [...obraGastos, ...empresa]
      .filter((item) => {
        if (!item.intervencaoId) return true;
        if (item.intervencaoId === targetIntervencao?.id) return false;
        return incluirOutros;
      })
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  }, [
    isDiarias,
    diarias,
    gastos,
    gastosEmpresa,
    obra?.id,
    targetIntervencao?.id,
    incluirOutros,
    getFuncionarioNome,
    isOpen,
  ]);

  const weeks = useMemo(() => {
    if (!isDiarias) return [];
    const map = new Map();
    rows.forEach((row) => {
      const start = getWeekStartISO(row.data) || 'sem-data';
      const current = map.get(start) || [];
      current.push(row.id);
      map.set(start, current);
    });
    return [...map.entries()].map(([start, ids]) => ({ start, ids, label: weekLabel(start === 'sem-data' ? '' : start) }));
  }, [isDiarias, rows]);

  if (!isOpen) return null;

  const nomeServico = (id) => {
    if (!id) return 'Sem serviço definido';
    const found = (servicos || []).find((item) => item && item.id === id);
    return found ? getIntervencaoNome(found) : 'Outro serviço';
  };

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectIds = (ids) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const moving = selectedRows.filter((row) => row.intervencaoId && row.intervencaoId !== targetIntervencao?.id);

  const submit = () => {
    if (!selectedRows.length) return;
    if (moving.length) {
      setConfirmMove(moving);
      return;
    }
    onConfirm(selectedRows);
  };

  const title = isDiarias ? 'Adicionar diárias' : 'Adicionar gastos';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={!selectedRows.length}>
            Associar {selectedRows.length || ''} {selectedRows.length === 1 ? (isDiarias ? 'diária' : 'gasto') : isDiarias ? 'diárias' : 'gastos'}
          </Button>
        </FormActions>
      }
    >
      <p className={styles.hint}>
        {isDiarias
          ? 'Seleccione as diárias da obra principal. Continuam a pertencer à obra — só ficam agrupadas neste serviço.'
          : 'Seleccione os gastos da obra principal. O valor não é duplicado.'}
      </p>

      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={incluirOutros}
          onChange={(e) => setIncluirOutros(e.target.checked)}
        />
        Incluir lançamentos já associados a outro serviço
      </label>

      <div className={styles.pickerToolbar}>
        <Button type="button" variant="secondary" size="sm" onClick={() => selectIds(rows.map((row) => row.id))}>
          Seleccionar todos
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
          Limpar
        </Button>
        {weeks.map((week) => (
          <Button
            key={week.start}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => selectIds(week.ids)}
          >
            Semana {week.label}
          </Button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className={styles.hint}>Não há lançamentos disponíveis para associar.</p>
      ) : (
        <div className={styles.pickerList}>
          {rows.map((row) => (
            <label key={row.id} className={styles.pickerRow}>
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggle(row.id)}
              />
              {isDiarias ? (
                <span className={styles.pickerMeta}>
                  <strong>{row.funcionario}</strong>
                  <span>{formatDateOrNotInformed(row.data)}</span>
                  <span>{formatCurrency(row.valor)}</span>
                  {row.observacao ? <span>{row.observacao}</span> : null}
                  {row.intervencaoId ? <em>{nomeServico(row.intervencaoId)}</em> : <em>Sem serviço</em>}
                </span>
              ) : (
                <span className={styles.pickerMeta}>
                  <strong>{formatDateOrNotInformed(row.data)}</strong>
                  <span>{row.fornecedor}</span>
                  <span>{row.categoria}</span>
                  <span>{formatCurrency(row.valor)}</span>
                  {row.iva ? <span>IVA {row.iva}</span> : null}
                  {row.intervencaoId ? <em>{nomeServico(row.intervencaoId)}</em> : <em>Sem serviço</em>}
                </span>
              )}
            </label>
          ))}
        </div>
      )}

      {confirmMove ? (
        <div className={styles.moveConfirm} role="dialog" aria-label="Confirmar movimentação">
          <p>
            {confirmMove.length === 1 ? 'Este lançamento já está noutro serviço.' : 'Alguns lançamentos já estão noutro serviço.'}{' '}
            Confirma mover para {getIntervencaoNome(targetIntervencao)}?
          </p>
          <ul>
            {confirmMove.slice(0, 8).map((row) => (
              <li key={row.id}>
                {isDiarias ? row.funcionario : row.categoria} · {formatDateOrNotInformed(row.data)} · {nomeServico(row.intervencaoId)}
              </li>
            ))}
          </ul>
          <div className={styles.actionsCell}>
            <Button variant="secondary" size="sm" type="button" onClick={() => setConfirmMove(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                onConfirm(selectedRows);
                setConfirmMove(null);
              }}
            >
              Mover
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
