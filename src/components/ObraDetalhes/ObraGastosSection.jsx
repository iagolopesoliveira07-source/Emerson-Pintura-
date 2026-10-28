import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { useApp } from '../../context/AppContext';
import Button from '../Button/Button';
import Table from '../Table/Table';
import GastoFormModal from '../GastoForm/GastoFormModal';
import CategoriaGastoBadge from '../Gastos/CategoriaGastoBadge';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import confirmStyles from '../ConfirmDialog/ConfirmDialog.module.css';
import { formToGastoPayload, buildGastoUpdate } from '../../utils/gastoForm';
import { resolveFornecedorIvaOptions } from '../../utils/empresaFornecedores';
import {
  isPartnershipObra,
  getPrimaryPartner,
  summarizeGastosPorPagador,
  getGastoPagadorLabel,
  resolveGastoPagadorId,
  summarizeSocioMaoDeObraColuna,
  summarizePartnershipMaoDeObra,
  calcTotalPessoaColunaParceria,
  formatPartnershipQuantidade,
  formatPartnershipQuantidadeCurta,
} from '../../utils/obraSpecial';
import { formatCurrency, formatDate } from '../../utils/formatters';
import Badge from '../Badge/Badge';
import DocumentoTipoBadge from '../Gastos/DocumentoTipoBadge';
import { alternarGastoPagoPeloCliente, getGastoCustoEmpresa, getGastoValorAssinado } from '../../utils/gastoDocumentoTipo';
import {
  formatGastoQuantidade,
  getGastoObservacaoDisplay,
  getGastoTipoLabel,
} from '../../utils/gastoDisplay';
import gastosStyles from '../../pages/Gastos/Gastos.module.css';
import shared from '../../pages/shared.module.css';
import colStyles from './ObraGastosParceria.module.css';

export default function ObraGastosSection({
  obra,
  onSuccess,
  intervencaoId = null,
  unassignedOnly = false,
  title = 'Gastos',
}) {
  const {
    gastos,
    obras,
    addGasto,
    updateGasto,
    deleteGasto,
    empresaFornecedores = [],
    empresaIvaRegras = [],
    diarias = [],
    funcionarios = [],
  } = useApp();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const isPartnership = isPartnershipObra(obra);

  const obraGastos = (gastos || [])
    .filter((g) => {
      if (!g || g.obraId !== obra.id) return false;
      if (intervencaoId) return g.intervencaoId === intervencaoId;
      if (unassignedOnly) return !g.intervencaoId;
      return true;
    })
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  const pagadores = summarizeGastosPorPagador(obraGastos, obra);
  const totalCustoMeu = obraGastos.reduce((sum, gasto) => sum + getGastoCustoEmpresa(gasto), 0);

  const marcarPagoPeloCliente = (gasto) => {
    updateGasto(alternarGastoPagoPeloCliente(gasto));
  };

  const handleCreate = (form) => {
    addGasto({
      ...formToGastoPayload(
        { ...form, obraId: obra.id },
        {
          isPartnership,
          partnerId: getPrimaryPartner(obra)?.id,
          ...resolveFornecedorIvaOptions(form, {
            fornecedores: empresaFornecedores,
            regras: empresaIvaRegras,
          }),
        }
      ),
      ...(intervencaoId ? { intervencaoId } : {}),
    });
    setCreateOpen(false);
    onSuccess?.('Gasto registado com sucesso.');
  };

  const handleEdit = (form) => {
    updateGasto(
      buildGastoUpdate(
        selected,
        { ...form, obraId: obra.id },
        {
          isPartnership,
          partnerId: getPrimaryPartner(obra)?.id,
          ...resolveFornecedorIvaOptions(form, {
            fornecedores: empresaFornecedores,
            regras: empresaIvaRegras,
          }),
        }
      )
    );
    setEditOpen(false);
    setSelected(null);
    onSuccess?.('Gasto atualizado com sucesso.');
  };

  const handleDelete = () => {
    deleteGasto(selected.id);
    setDeleteOpen(false);
    setSelected(null);
    onSuccess?.('Gasto excluído com sucesso.');
  };

  const columns = (withPagador) => [
    { key: 'data', label: 'Data', render: (r) => formatDate(r.data) },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (r) => (
        <span>
          <CategoriaGastoBadge categoria={getGastoTipoLabel(r)} />
          {' '}
          <DocumentoTipoBadge gasto={r} />
          {withPagador ? (
            <>
              {' '}
              <Badge variant="warning">{getGastoPagadorLabel(resolveGastoPagadorId(r, obra))}</Badge>
            </>
          ) : null}
        </span>
      ),
    },
    {
      key: 'quantidade',
      label: 'Qtd.',
      align: 'center',
      render: (r) => {
        const q = formatGastoQuantidade(r);
        return <span className={gastosStyles.quantidadeCell}>{q || '—'}</span>;
      },
    },
    {
      key: 'valor',
      label: 'Valor',
      align: 'right',
      render: (r) => (
        <span className={gastosStyles.valorCell}>{formatCurrency(getGastoValorAssinado(r))}</span>
      ),
    },
    {
      key: 'observacao',
      label: 'Observações',
      render: (r) => {
        const obs = getGastoObservacaoDisplay(r);
        if (!obs) return <span className={gastosStyles.observacaoVazia}>—</span>;
        return <span className={gastosStyles.observacaoCell}>{obs}</span>;
      },
    },
    {
      key: 'acoes',
      label: 'Ações',
      align: 'right',
      render: (r) => (
        <div className={shared.tableActions}>
          <Button
            type="button"
            variant={r.pagoPeloCliente === true ? 'primary' : 'secondary'}
            size="sm"
            title={r.pagoPeloCliente === true ? 'Voltar a contar como gasto da empresa' : 'Marcar como pago pelo cliente'}
            onClick={() => marcarPagoPeloCliente(r)}
          >
            Pago pelo cliente
          </Button>
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
      ),
    },
  ];

  return (
    <div className={shared.detailCard}>
      <div className={shared.sectionHeader}>
        <h3 className={shared.sectionHeaderTitle}>{title}</h3>
        <div className={colStyles.barra}>
          {isPartnership ? (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/obras/${obra.id}/acerto`)}>
              Novo Acerto
            </Button>
          ) : null}
          <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
            Adicionar gasto
          </Button>
        </div>
      </div>

      {isPartnership ? (
        <PartnershipGastosColunas
          obra={obra}
          pagadores={pagadores}
          diarias={diarias}
          funcionarios={funcionarios}
          onEdit={(row) => {
            setSelected(row);
            setEditOpen(true);
          }}
          onDelete={(row) => {
            setSelected(row);
            setDeleteOpen(true);
          }}
          onPagoPeloCliente={marcarPagoPeloCliente}
        />
      ) : (
        <>
          <div className={shared.tableScroll}>
            <Table
              columns={columns(false)}
              data={obraGastos}
              emptyMessage={
                intervencaoId
                  ? 'Sem gastos neste serviço.'
                  : unassignedOnly
                    ? 'Sem gastos sem serviço definido.'
                    : 'Sem gastos registados.'
              }
            />
          </div>
          {obraGastos.length > 0 && (
            <div className={shared.sectionTotal}>
              <span>Total de gastos</span>
              <span className={shared.sectionTotalValue}>{formatCurrency(totalCustoMeu)}</span>
            </div>
          )}
        </>
      )}

      <GastoFormModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        obras={obras}
        gastos={gastos}
        fixedObraId={obra.id}
        fixedIntervencaoId={intervencaoId}
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
        fixedObraId={obra.id}
        onSubmit={handleEdit}
      />

      {selected && (
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
              ['Data', formatDate(selected.data)],
              ['Valor', formatCurrency(getGastoValorAssinado(selected))],
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

function PartnershipGastosColunas({ obra, pagadores, diarias, funcionarios, onEdit, onDelete, onPagoPeloCliente }) {
  try {
    const emersonLabor = summarizeSocioMaoDeObraColuna(obra.id, diarias, funcionarios, 'emerson', obra);
    const fabioLabor = summarizeSocioMaoDeObraColuna(obra.id, diarias, funcionarios, 'fabio', obra);
    const julianoLabor = summarizeSocioMaoDeObraColuna(obra.id, diarias, funcionarios, 'juliano', obra);
    const funcionariosLabor = summarizePartnershipMaoDeObra(obra.id, diarias, funcionarios, obra).filter(
      (item) => !item.socio
    );
    const totalFuncionarios = funcionariosLabor.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  const pessoas = [
    {
      key: 'emerson',
      titulo: 'Emerson',
      gastos: pagadores.emerson || [],
      totalGastos: pagadores.totalEmerson || 0,
      diarias: emersonLabor,
    },
    {
      key: 'fabio',
      titulo: 'Fábio',
      gastos: pagadores.fabio || [],
      totalGastos: pagadores.totalFabio || 0,
      diarias: fabioLabor,
    },
    {
      key: 'juliano',
      titulo: 'Juliano',
      gastos: pagadores.juliano || [],
      totalGastos: pagadores.totalJuliano || 0,
      diarias: julianoLabor,
    },
    {
      key: 'caixa',
      titulo: 'Caixa da Parceria',
      gastos: pagadores.caixa || [],
      totalGastos: pagadores.totalCaixa || 0,
      diarias: null,
      caixa: true,
    },
  ];

  return (
    <>
      <p className={colStyles.laborHint}>
        Gastos/compras e diária individual do parceiro são conceitos diferentes. A mão de obra dos
        funcionários aparece em bloco próprio, abaixo.
      </p>
      <div className={colStyles.grid}>
        {pessoas.map((pessoa) => {
          const totalRelacionado = pessoa.caixa
            ? pessoa.totalGastos
            : calcTotalPessoaColunaParceria(pessoa.totalGastos, pessoa.diarias, obra);
          return (
            <article key={pessoa.key} className={colStyles.col}>
              <h4 className={colStyles.title}>{pessoa.titulo}</h4>
              <p className={colStyles.laborHint}>Gastos / compras</p>
              <ul className={colStyles.list}>
                {pessoa.gastos.length === 0 ? (
                  <li className={colStyles.empty}>Sem gastos.</li>
                ) : (
                  pessoa.gastos.map((gasto) => (
                    <li key={gasto.id} className={colStyles.item}>
                      <span className={colStyles.date}>{formatDate(gasto.data)}</span>
                      <span className={colStyles.desc}>{getGastoTipoLabel(gasto)}</span>
                      <span className={colStyles.valor}>{formatCurrency(getGastoValorAssinado(gasto))}</span>
                      <span className={colStyles.acoes}>
                        <Button
                          type="button"
                          variant={gasto.pagoPeloCliente === true ? 'primary' : 'secondary'}
                          size="sm"
                          title={gasto.pagoPeloCliente === true ? 'Voltar a contar como gasto da empresa' : 'Marcar como pago pelo cliente'}
                          onClick={() => onPagoPeloCliente?.(gasto)}
                        >
                          Pago pelo cliente
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Pencil}
                          className={colStyles.iconBtn}
                          title="Editar gasto"
                          onClick={() => onEdit(gasto)}
                        />
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          className={colStyles.iconBtn}
                          title="Excluir gasto"
                          onClick={() => onDelete(gasto)}
                        />
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <div className={colStyles.pessoaResumo}>
                <div className={colStyles.resumoRow}>
                  <span>Total pago (gastos/compras)</span>
                  <span>{formatCurrency(pessoa.totalGastos)}</span>
                </div>
                {pessoa.caixa ? (
                  <p className={colStyles.resumoNota}>Gastos pagos diretamente pelo Caixa. Não gera reembolso.</p>
                ) : (
                  <>
                    <div className={colStyles.resumoRow}>
                      <span>Diária individual do parceiro</span>
                      <span>
                        {formatPartnershipQuantidadeCurta(pessoa.diarias?.quantidade || 0)} d ·{' '}
                        {formatCurrency(pessoa.diarias?.valor || 0)}
                      </span>
                    </div>
                    {pessoa.diarias?.incluidoNosValoresAtuais && (pessoa.diarias?.valor || 0) > 0.004 ? (
                      <p className={colStyles.resumoNota}>
                        Informação — não misturar com gastos/compras nesta coluna.
                      </p>
                    ) : null}
                    <div className={`${colStyles.resumoRow} ${colStyles.resumoTotal}`}>
                      <span>Total relacionado</span>
                      <span>{formatCurrency(totalRelacionado)}</span>
                    </div>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className={colStyles.labor}>
        <h4 className={colStyles.laborTitle}>Mão de obra dos funcionários</h4>
        <p className={colStyles.laborHint}>
          Custo interno dos funcionários na obra. Não é diária individual do parceiro nem gasto/compra.
        </p>
        {funcionariosLabor.length === 0 ? (
          <p className={colStyles.empty}>Sem mão de obra de funcionários nesta obra.</p>
        ) : (
          <ul className={colStyles.laborList}>
            <li className={`${colStyles.laborRow} ${colStyles.laborHead}`}>
              <span>Funcionário</span>
              <span>Quantidade</span>
              <span>Valor/diária</span>
              <span>Total</span>
            </li>
            {funcionariosLabor.map((item) => (
              <li key={item.funcionarioId} className={colStyles.laborRow}>
                <span className={colStyles.laborNome}>{item.nome}</span>
                <span>{formatPartnershipQuantidade(item.quantidade)}</span>
                <span>{formatCurrency(item.valorConsiderado || 0)}</span>
                <span className={colStyles.laborTotal}>{formatCurrency(item.total || 0)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={colStyles.total}>
          <span>Total mão de obra (funcionários)</span>
          <span className={colStyles.totalValue}>{formatCurrency(totalFuncionarios)}</span>
        </div>
      </div>
    </>
  );
  } catch (error) {
    console.error(error);
    return <p className={colStyles.empty}>Não foi possível mostrar as colunas de gastos.</p>;
  }
}
