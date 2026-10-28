import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, Building2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import PageHeader from '../../components/PageHeader/PageHeader';
import Button from '../../components/Button/Button';
import Card from '../../components/Card/Card';
import Table from '../../components/Table/Table';
import PeriodFilter from '../../components/PeriodFilter/PeriodFilter';
import GastoFormModal from '../../components/GastoForm/GastoFormModal';
import FornecedoresModal from '../../components/EmpresaFinanceiro/FornecedoresModal';
import DiariasDiaDetalheModal from '../../components/Gastos/DiariasDiaDetalheModal';
import CategoriaGastoBadge from '../../components/Gastos/CategoriaGastoBadge';
import Badge from '../../components/Badge/Badge';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog';
import { GASTO_RESUMO_CATEGORIAS } from '../../constants/gastoCategorias';
import { formToGastoPayload, buildGastoUpdate } from '../../utils/gastoForm';
import { isPartnershipObra, getPrimaryPartner, resolveGastoPagadorId, getGastoPagadorLabel } from '../../utils/obraSpecial';
import {
  DESTINO_GASTO,
  obraGastoFormToEmpresaPayload,
  resolveDestinoGastoSemObra,
} from '../../utils/gastoDestinoSemObra';
import { usePeriodFilter } from '../../hooks/usePeriodFilter';
import { GASTOS_RAPIDOS_PERIOD_PRESETS } from '../../utils/periodFilter';
import { filterGastos } from '../../utils/gastoCalculations';
import { summarizeGastosIvaAssinado, sumValoresAssinados, getIvaBreakdownAssinado } from '../../utils/gastoDocumentoSinal';
import { gastoPagoPeloCliente } from '../../utils/gastoDocumentoTipo';
import { isGastoForaDoIvaEmerson } from '../../utils/gastoEmersonIva';
import { getGastoValorAssinado, applySinal, isNotaCredito } from '../../utils/gastoDocumentoTipo';
import DocumentoTipoBadge from '../../components/Gastos/DocumentoTipoBadge';
import {
  GASTO_CATEGORIA_DIARIAS,
  GASTO_CATEGORIAS_DIARIA_LEGACY,
  buildGastosPageList,
  sortGastosPageList,
  calcGastosPageTotals,
  calcGastosPageResumo,
  getCategoriasFiltroGastosPage,
  isGastoFromDiaria,
  isGastoDiariaGrupo,
} from '../../utils/gastoDiariaIntegration';
import {
  getGastoDescricaoDisplay,
  getGastoObservacaoDisplay,
  getGastoTipoLabel,
  getObraNome,
} from '../../utils/gastoDisplay';
import {
  FILTRO_GASTOS_VAZIO,
  ORDEM_GASTOS,
  filtrarListaGastos,
  filtrosGastosAtivos,
  ordenarListaGastos,
  totalListaGastos,
} from '../../utils/gastoPesquisa';
import { formatCurrency, formatDate, formatDateOrNotInformed } from '../../utils/formatters';
import { HELP } from '../../utils/helpTexts';
import { sortObrasForDisplay } from '../../utils/obraStatus';
import { hasIvaInfo, formatTaxaIva } from '../../utils/ivaCalculations';
import { resolveFornecedorIvaOptions } from '../../utils/empresaFornecedores';
import confirmStyles from '../../components/ConfirmDialog/ConfirmDialog.module.css';
import shared from '../shared.module.css';
import styles from './Gastos.module.css';

export default function Gastos() {
  const [searchParams] = useSearchParams();
  const { gastos, diarias, funcionarios, obras, addGasto, updateGasto, deleteGasto, addGastosEmpresa, empresaFornecedores = [], empresaIvaRegras = [], saveEmpresaFornecedores } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [fornecedoresOpen, setFornecedoresOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [pesquisa, setPesquisa] = useState(FILTRO_GASTOS_VAZIO);
  const [ordemLista, setOrdemLista] = useState(ORDEM_GASTOS.RECENTE);
  const period = usePeriodFilter('todos', GASTOS_RAPIDOS_PERIOD_PRESETS);
  const [diariaGrupoDetalhe, setDiariaGrupoDetalhe] = useState(null);

  useEffect(() => {
    if (searchParams.get('nova') === 'true') setCreateOpen(true);
  }, [searchParams]);

  const pageFilters = useMemo(
    () => ({
      categoria: filtroCategoria,
      obraId: filtroObra,
      inicio: period.range.inicio || '',
      fim: period.range.fim || '',
    }),
    [filtroCategoria, filtroObra, period.range]
  );

  const categoriasFiltro = useMemo(
    () => getCategoriasFiltroGastosPage(gastos, diarias),
    [gastos, diarias]
  );

  const mergedList = useMemo(
    () =>
      sortGastosPageList(
        buildGastosPageList(gastos, diarias, funcionarios, obras, pageFilters)
      ),
    [gastos, diarias, funcionarios, obras, pageFilters]
  );

  const pesquisaAtiva = filtrosGastosAtivos(pesquisa);
  const listaVisivel = useMemo(() => {
    if (!pesquisaAtiva) return mergedList;
    return ordenarListaGastos(filtrarListaGastos(mergedList, pesquisa), ordemLista);
  }, [mergedList, pesquisa, pesquisaAtiva, ordemLista]);
  const totalFiltrado = useMemo(
    () => (pesquisaAtiva ? totalListaGastos(listaVisivel) : 0),
    [pesquisaAtiva, listaVisivel]
  );

  const atualizarPesquisa = (campo, valor) => {
    setPesquisa((atual) => ({ ...atual, [campo]: valor }));
  };

  const limparPesquisa = () => {
    setPesquisa(FILTRO_GASTOS_VAZIO);
    setOrdemLista(ORDEM_GASTOS.RECENTE);
  };

  const { totalDiarias } = useMemo(
    () => calcGastosPageTotals(gastos, diarias, pageFilters),
    [gastos, diarias, pageFilters]
  );

  const gastosReaisPeriodo = useMemo(
    () =>
      filterGastos(gastos, {
        obraId: filtroObra,
        inicio: pageFilters.inicio,
        fim: pageFilters.fim,
      }).filter((gasto) => !GASTO_CATEGORIAS_DIARIA_LEGACY.includes(gasto.categoria)),
    [gastos, filtroObra, pageFilters.inicio, pageFilters.fim]
  );

  const gastosLivrosEmerson = useMemo(
    () => gastosReaisPeriodo.filter((gasto) => !isGastoForaDoIvaEmerson(gasto)),
    [gastosReaisPeriodo]
  );

  const ivaResumo = useMemo(
    () => summarizeGastosIvaAssinado(gastosLivrosEmerson),
    [gastosLivrosEmerson]
  );
  const totalGastos = sumValoresAssinados(
    gastosLivrosEmerson.filter((gasto) => !gastoPagoPeloCliente(gasto))
  );
  const custoTotal = totalGastos + totalDiarias;

  const { totaisResumo, totalOutros, totalDiarias: resumoDiarias } = useMemo(
    () => calcGastosPageResumo(gastos, diarias, GASTO_RESUMO_CATEGORIAS, pageFilters),
    [gastos, diarias, pageFilters]
  );

  const handleCreate = (form) => {
    const destino = resolveDestinoGastoSemObra(form);
    const ivaOptions = resolveFornecedorIvaOptions(form, {
      fornecedores: empresaFornecedores,
      regras: empresaIvaRegras,
    });

    if (!form.obraId && destino === DESTINO_GASTO.EMPRESA) {
      addGastosEmpresa([obraGastoFormToEmpresaPayload(form, ivaOptions)]);
      setCreateOpen(false);
      return;
    }

    const obra = obras.find((item) => item.id === form.obraId);
    addGasto(formToGastoPayload(form, {
      isPartnership: isPartnershipObra(obra),
      partnerId: getPrimaryPartner(obra)?.id,
      ...ivaOptions,
    }));
    setCreateOpen(false);
  };

  const handleEdit = (form) => {
    const obra = obras.find((item) => item.id === (form.obraId || selected?.obraId));
    updateGasto(buildGastoUpdate(selected, form, {
      isPartnership: isPartnershipObra(obra),
      partnerId: getPrimaryPartner(obra)?.id,
      ...resolveFornecedorIvaOptions(form, { fornecedores: empresaFornecedores, regras: empresaIvaRegras }),
    }));
    setEditOpen(false);
    setSelected(null);
  };

  const handleDelete = () => {
    deleteGasto(selected.id);
    setDeleteOpen(false);
    setSelected(null);
  };

  const columns = [
    {
      key: 'data',
      label: 'Data',
      render: (r) =>
        r.data ? formatDate(r.data) : <span className={styles.semData}>Sem data</span>,
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (r) => {
        if (isGastoDiariaGrupo(r) || isGastoFromDiaria(r)) {
          return <CategoriaGastoBadge categoria={getGastoTipoLabel(r)} />;
        }
        const obra = obras.find((item) => item.id === r.obraId);
        const pagadorId = resolveGastoPagadorId(r, obra);
        const partnerLabel =
          isPartnershipObra(obra) && pagadorId !== 'empresa'
            ? getGastoPagadorLabel(pagadorId)
            : null;
        return (
          <span>
            <CategoriaGastoBadge categoria={getGastoTipoLabel(r)} />
            {isNotaCredito(r) ? (
              <>
                {' '}
                <DocumentoTipoBadge gasto={r} />
              </>
            ) : null}
            {partnerLabel ? (
              <>
                {' '}
                <Badge variant="warning">Pago por {partnerLabel}</Badge>
              </>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'descricao',
      label: 'Descrição',
      render: (r) => {
        const desc = getGastoDescricaoDisplay(r);
        if (!desc) return <span className={styles.observacaoVazia}>—</span>;
        return <span className={styles.observacaoCell}>{desc}</span>;
      },
    },
    {
      key: 'obra',
      label: 'Obra',
      help: HELP.gasto.semObra,
      render: (r) => {
        if (isGastoDiariaGrupo(r)) {
          return <span className={styles.obraCell}>{r.obraResumo || '—'}</span>;
        }
        const nome = getObraNome(r.obraId, obras);
        return <span className={styles.obraCell}>{nome || 'Sem obra específica'}</span>;
      },
    },
    {
      key: 'valor',
      label: 'Valor',
      align: 'right',
      render: (r) => (
        <span className={styles.valorCell}>{formatCurrency(getGastoValorAssinado(r))}</span>
      ),
    },
    {
      key: 'iva',
      label: 'IVA',
      help: HELP.iva.registrado,
      align: 'right',
      render: (r) => {
        if (isGastoDiariaGrupo(r)) return <span className={styles.ivaNaoInformado}>—</span>;
        if (!hasIvaInfo(r)) {
          return <span className={styles.ivaNaoInformado}>IVA não informado</span>;
        }
        const breakdown = getIvaBreakdownAssinado(r);
        return (
          <span className={styles.ivaCell}>
            <span>{formatCurrency(applySinal(r.valorIva, r))}</span>
            <small>
              {formatTaxaIva(r.taxaIva)}
              {breakdown.dedutivel != null ? ` · Dedutível ${formatCurrency(breakdown.dedutivel)}` : ''}
            </small>
          </span>
        );
      },
    },
    {
      key: 'observacao',
      label: 'Observações',
      render: (r) => {
        const obs = getGastoObservacaoDisplay(r);
        if (!obs) return <span className={styles.observacaoVazia}>—</span>;
        return <span className={styles.observacaoCell}>{obs}</span>;
      },
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (r) => {
        if (isGastoDiariaGrupo(r)) {
          return (
            <Button
              variant="secondary"
              size="sm"
              icon={Eye}
              onClick={() => setDiariaGrupoDetalhe(r)}
            >
              Ver detalhes
            </Button>
          );
        }

        return (
          <div className={shared.tableActions}>
            <Button
              variant="secondary"
              size="sm"
              icon={Pencil}
              title="Editar gasto"
              aria-label="Editar gasto"
              onClick={() => {
                setSelected(r);
                setEditOpen(true);
              }}
            />
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              title="Excluir gasto"
              aria-label="Excluir gasto"
              onClick={() => {
                setSelected(r);
                setDeleteOpen(true);
              }}
            />
          </div>
        );
      },
    },
  ];

  const showResumoCompleto = !filtroCategoria || filtroCategoria === GASTO_CATEGORIA_DIARIAS;

  return (
    <div className={shared.page}>
      <PageHeader
        title="Gastos"
        subtitle="Visão consolidada de despesas e diárias"
        help={HELP.gasto.obra}
        actions={
          <>
            <Button variant="secondary" icon={Building2} onClick={() => setFornecedoresOpen(true)}>
              Fornecedores
            </Button>
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>Adicionar gasto</Button>
          </>
        }
      />

      <PeriodFilter
        presets={GASTOS_RAPIDOS_PERIOD_PRESETS}
        preset={period.preset}
        onPresetChange={period.setPreset}
        customInicio={period.customInicio}
        customFim={period.customFim}
        onCustomInicioChange={period.setCustomInicio}
        onCustomFimChange={period.setCustomFim}
        label={period.label}
      />

      <div className={styles.custoEmpresaPanel}>
        <div className={styles.custoEmpresaItem}>
          <span className={styles.custoEmpresaLabel}>Total de gastos</span>
          <span className={styles.custoEmpresaValue}>{formatCurrency(totalGastos)}</span>
        </div>
        <div className={styles.custoEmpresaDivider} aria-hidden="true" />
        <div className={styles.custoEmpresaItem}>
          <span className={styles.custoEmpresaLabel}>Total de diárias</span>
          <span className={styles.custoEmpresaValueDiarias}>{formatCurrency(totalDiarias)}</span>
        </div>
        <div className={styles.custoEmpresaDivider} aria-hidden="true" />
        <div className={`${styles.custoEmpresaItem} ${styles.custoEmpresaTotal}`}>
          <span className={styles.custoEmpresaLabel}>Custo total da empresa</span>
          <span className={styles.custoEmpresaValueTotal}>{formatCurrency(custoTotal)}</span>
        </div>
      </div>

      <p className={styles.custoEmpresaNota}>
        As diárias são cadastradas na aba Diárias e aparecem aqui agrupadas por dia. Cada valor é
        contabilizado uma única vez — use «Ver detalhes» para consultar os funcionários de cada dia.
      </p>

      <div className={shared.statsRow}>
        <Card title="Registos" value={mergedList.length} iconColor="blue" />
        <Card title="IVA total" value={formatCurrency(ivaResumo.iva)} iconColor="blue" help={HELP.iva.registrado} />
        <Card title="IVA dedutível" value={formatCurrency(ivaResumo.ivaDedutivel)} iconColor="green" help={HELP.iva.dedutivel} />
        <Card title="IVA não dedutível" value={formatCurrency(ivaResumo.ivaNaoDedutivel)} iconColor="orange" help={HELP.iva.naoDedutivel} />
      </div>

      {showResumoCompleto && (
        <div className={styles.resumoGrid}>
          {GASTO_RESUMO_CATEGORIAS.filter((cat) => cat !== 'Outros').map((cat) => (
            <div key={cat} className={styles.resumoCard}>
              <div className={styles.resumoCardLabel}>{cat}</div>
              <div className={styles.resumoCardValue}>{formatCurrency(totaisResumo[cat] || 0)}</div>
            </div>
          ))}
          <div className={styles.resumoCard}>
            <div className={styles.resumoCardLabel}>Outros gastos</div>
            <div className={styles.resumoCardValue}>
              {formatCurrency((totaisResumo.Outros || 0) + totalOutros)}
            </div>
          </div>
          {diarias.length > 0 && (
            <div className={`${styles.resumoCard} ${styles.resumoCardDiarias}`}>
              <div className={styles.resumoCardLabel}>Diárias</div>
              <div className={styles.resumoCardValueDiarias}>{formatCurrency(resumoDiarias)}</div>
            </div>
          )}
        </div>
      )}

      <div className={styles.chips} role="group" aria-label="Filtrar por tipo de gasto">
        <button
          type="button"
          className={`${styles.chip} ${!filtroCategoria ? styles.chipActive : ''}`}
          onClick={() => setFiltroCategoria('')}
        >
          Todos
        </button>
        {categoriasFiltro.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`${styles.chip} ${filtroCategoria === cat ? styles.chipActive : ''}`}
            onClick={() => setFiltroCategoria(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={shared.filters}>
        <select className={shared.filterInput} value={filtroObra} onChange={(e) => setFiltroObra(e.target.value)}>
          <option value="">Todas as obras</option>
          {sortObrasForDisplay(obras).map((o) => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
      </div>

      <form
        className={styles.pesquisa}
        onSubmit={(event) => event.preventDefault()}
        aria-label="Pesquisar gastos"
      >
        <label className={styles.pesquisaCampoLargo}>
          <span className={styles.pesquisaLabel}>Pesquisar</span>
          <input
            className={shared.filterInput}
            value={pesquisa.texto}
            onChange={(event) => atualizarPesquisa('texto', event.target.value)}
            placeholder="Pesquisar gasto..."
            aria-label="Pesquisar gasto"
          />
        </label>
        <label>
          <span className={styles.pesquisaLabel}>Fornecedor</span>
          <input
            className={shared.filterInput}
            value={pesquisa.fornecedor}
            onChange={(event) => atualizarPesquisa('fornecedor', event.target.value)}
            placeholder="Fornecedor"
            aria-label="Pesquisar por fornecedor"
          />
        </label>
        <label>
          <span className={styles.pesquisaLabel}>Data de</span>
          <input
            className={shared.filterInput}
            type="date"
            value={pesquisa.dataDe}
            onChange={(event) => atualizarPesquisa('dataDe', event.target.value)}
            aria-label="Data de"
            title="Para um único dia, use a mesma data em Data de e Data até."
          />
        </label>
        <label>
          <span className={styles.pesquisaLabel}>Data até</span>
          <input
            className={shared.filterInput}
            type="date"
            value={pesquisa.dataAte}
            onChange={(event) => atualizarPesquisa('dataAte', event.target.value)}
            aria-label="Data até"
            title="Para um único dia, use a mesma data em Data de e Data até."
          />
        </label>
        <label>
          <span className={styles.pesquisaLabel}>Valor mínimo</span>
          <input
            className={shared.filterInput}
            inputMode="decimal"
            value={pesquisa.valorMin}
            onChange={(event) => atualizarPesquisa('valorMin', event.target.value)}
            placeholder="Valor mínimo"
            aria-label="Valor mínimo"
          />
        </label>
        <label>
          <span className={styles.pesquisaLabel}>Valor máximo</span>
          <input
            className={shared.filterInput}
            inputMode="decimal"
            value={pesquisa.valorMax}
            onChange={(event) => atualizarPesquisa('valorMax', event.target.value)}
            placeholder="Valor máximo"
            aria-label="Valor máximo"
          />
        </label>
        <div className={styles.pesquisaAcoes}>
          <Button type="submit">Filtrar</Button>
          <Button type="button" variant="secondary" onClick={limparPesquisa} disabled={!pesquisaAtiva}>
            Limpar filtros
          </Button>
        </div>
      </form>

      {pesquisaAtiva ? (
        <div className={styles.pesquisaResultado}>
          <p>
            <strong>
              {listaVisivel.length === 1
                ? '1 gasto encontrado'
                : `${listaVisivel.length} gastos encontrados`}
            </strong>
            <span>
              Total dos gastos filtrados: {formatCurrency(totalFiltrado)}
            </span>
          </p>
          <label className={styles.pesquisaOrdem}>
            <span className={styles.pesquisaLabel}>Ordenar</span>
            <select
              className={shared.filterInput}
              value={ordemLista}
              onChange={(event) => setOrdemLista(event.target.value)}
              aria-label="Ordenar resultados"
            >
              <option value={ORDEM_GASTOS.RECENTE}>Data mais recente</option>
              <option value={ORDEM_GASTOS.ANTIGA}>Data mais antiga</option>
              <option value={ORDEM_GASTOS.MAIOR}>Maior valor</option>
              <option value={ORDEM_GASTOS.MENOR}>Menor valor</option>
            </select>
          </label>
        </div>
      ) : null}

      <div className={shared.tableScroll}>
        <Table
          columns={columns}
          data={listaVisivel}
          emptyMessage={
            pesquisaAtiva
              ? 'Nenhum gasto encontrado com estes filtros.'
              : filtroCategoria === GASTO_CATEGORIA_DIARIAS
                ? 'Nenhuma diária registada.'
                : 'Nenhum gasto registado.'
          }
        />
      </div>

      <GastoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        obras={obras}
        gastos={gastos}
        onSubmit={handleCreate}
      />

      <GastoFormModal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        mode="edit"
        gasto={selected}
        obras={obras}
        gastos={gastos}
        onSubmit={handleEdit}
      />

      <FornecedoresModal
        isOpen={fornecedoresOpen}
        onClose={() => setFornecedoresOpen(false)}
        fornecedores={empresaFornecedores}
        onSave={saveEmpresaFornecedores}
      />

      {selected && !isGastoFromDiaria(selected) && (
        <ConfirmDialog
          isOpen={deleteOpen}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onConfirm={handleDelete}
          title="Excluir gasto?"
          cancelLabel="Cancelar"
          confirmLabel="Excluir gasto"
        >
          <p className={confirmStyles.message}>Tem certeza que deseja excluir este gasto?</p>
          <div className={confirmStyles.details}>
            {[
              ['Tipo', getGastoTipoLabel(selected)],
              ['Data', selected.data ? formatDate(selected.data) : formatDateOrNotInformed(selected.data)],
              ['Valor', formatCurrency(getGastoValorAssinado(selected))],
              [
                'IVA',
                hasIvaInfo(selected)
                  ? `${formatCurrency(applySinal(selected.valorIva, selected))} (${formatTaxaIva(selected.taxaIva)})`
                  : 'IVA não informado',
              ],
              ...(getGastoDescricaoDisplay(selected)
                ? [['Descrição', getGastoDescricaoDisplay(selected)]]
                : []),
              ...(getObraNome(selected.obraId, obras)
                ? [['Obra', getObraNome(selected.obraId, obras)]]
                : []),
            ].map(([label, value]) => (
              <div key={label} className={confirmStyles.detailRow}>
                <span className={confirmStyles.detailLabel}>{label}:</span>
                <span className={confirmStyles.detailValue}>{value}</span>
              </div>
            ))}
          </div>
        </ConfirmDialog>
      )}

      <DiariasDiaDetalheModal
        isOpen={Boolean(diariaGrupoDetalhe)}
        onClose={() => setDiariaGrupoDetalhe(null)}
        grupo={diariaGrupoDetalhe}
      />
    </div>
  );
}
