import { roundMoney } from './ivaCalculations';
import { getValorRecebidoPagamento } from './debtCalculations';
import { getGastoEmpresaValor } from './gastoEmpresaCalculations';
import { getGastoValorAssinado } from './gastoDocumentoTipo';
import { asRecordList } from './safeCollections';
import {
  filterDiariasDaObra,
  getDiariaCustoNaObra,
  getDiariaQuantidadeNaObra,
} from './diariaObraAlocacao';

function getGastosEmpresaDaObra(obraId, gastosEmpresa = []) {
  return asRecordList(gastosEmpresa).filter((gasto) => gasto.obraId === obraId && gasto.estado !== 'previsto');
}

function gastoValor(gasto) {
  return getGastoValorAssinado(gasto);
}

export function isMaterialCategoria(categoria) {
  const nome = String(categoria || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!nome) return false;
  return nome === 'material' || nome === 'materiais' || nome.startsWith('material ');
}

export function isMaterialGasto(gasto) {
  return isMaterialCategoria(gasto?.categoria);
}

export function isHospedagemCategoria(categoria) {
  const nome = String(categoria || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!nome) return false;
  return nome === 'hospedagem' || nome === 'alojamento' || nome.startsWith('hospedagem');
}

export function isHospedagemGasto(gasto) {
  return isHospedagemCategoria(gasto?.categoria);
}

export function isCombustivelCategoria(categoria) {
  const nome = String(categoria || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!nome) return false;
  return nome.includes('combust');
}

export function isCombustivelGasto(gasto) {
  return isCombustivelCategoria(gasto?.categoria);
}

export function getObraDiarias(obraId, diarias = []) {
  return filterDiariasDaObra(diarias, obraId);
}

export function getObraGastos(obraId, gastos = []) {
  return asRecordList(gastos).filter((item) => item.obraId === obraId);
}

export function getObraRecebimentos(obraId, pagamentos = []) {
  return asRecordList(pagamentos).filter(
    (item) => item.obraId === obraId && item.tipo === 'Recebimento de cliente'
  );
}

export function getObraRepasses(obra, pagamentos = []) {
  if (Array.isArray(obra?.repassesParceria)) return asRecordList(obra.repassesParceria);
  return asRecordList(pagamentos).filter(
    (item) => item.obraId === obra?.id && item.tipo === 'Repasse de parceria'
  );
}

export function calcObraCustosAcumulados(
  obraId,
  { gastos = [], diarias = [], gastosEmpresa = [], funcionarios = [] } = {}
) {
  const listaDiarias = getObraDiarias(obraId, diarias);
  const listaGastos = getObraGastos(obraId, gastos);
  const listaEmpresa = getGastosEmpresaDaObra(obraId, gastosEmpresa);

  const totalDiarias = roundMoney(
    listaDiarias.reduce((sum, item) => sum + getDiariaCustoNaObra(item, obraId, funcionarios), 0)
  );
  const materiaisObra = listaGastos.filter(isMaterialGasto);
  const hospedagemObra = listaGastos.filter((item) => !isMaterialGasto(item) && isHospedagemGasto(item));
  const outrosObra = listaGastos.filter((item) => !isMaterialGasto(item) && !isHospedagemGasto(item));
  const materiaisEmpresa = listaEmpresa.filter(isMaterialGasto);
  const hospedagemEmpresa = listaEmpresa.filter((item) => !isMaterialGasto(item) && isHospedagemGasto(item));
  const outrosEmpresa = listaEmpresa.filter((item) => !isMaterialGasto(item) && !isHospedagemGasto(item));

  const totalMateriais = roundMoney(
    materiaisObra.reduce((sum, item) => sum + gastoValor(item), 0) +
      materiaisEmpresa.reduce((sum, item) => sum + getGastoEmpresaValor(item), 0)
  );
  const totalHospedagem = roundMoney(
    hospedagemObra.reduce((sum, item) => sum + gastoValor(item), 0) +
      hospedagemEmpresa.reduce((sum, item) => sum + getGastoEmpresaValor(item), 0)
  );
  const totalOutros = roundMoney(
    outrosObra.reduce((sum, item) => sum + gastoValor(item), 0) +
      outrosEmpresa.reduce((sum, item) => sum + getGastoEmpresaValor(item), 0)
  );

  return {
    totalDiarias,
    totalMateriais,
    totalHospedagem,
    totalOutros,
    totalGastos: roundMoney(totalMateriais + totalHospedagem + totalOutros),
    totalInvestido: roundMoney(totalDiarias + totalMateriais + totalHospedagem + totalOutros),
    diarias: listaDiarias,
    gastos: listaGastos,
    gastosEmpresa: listaEmpresa,
  };
}

export function calcDiariasPorFuncionario(obraId, diarias = [], funcionarios = []) {
  const map = new Map();
  getObraDiarias(obraId, diarias).forEach((diaria) => {
    const id = diaria.funcionarioId || 'sem-funcionario';
    const current = map.get(id) || {
      funcionarioId: diaria.funcionarioId || null,
      nome: funcionarios.find((item) => item.id === diaria.funcionarioId)?.nome || 'Funcionário',
      quantidade: 0,
      total: 0,
      datas: [],
    };
    current.quantidade += getDiariaQuantidadeNaObra(diaria, obraId);
    current.total = roundMoney(current.total + getDiariaCustoNaObra(diaria, obraId, funcionarios));
    if (diaria.data) current.datas.push(diaria.data);
    current.datas = [...new Set(current.datas)].sort();
    map.set(id, current);
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function movementDate(item) {
  return String(item.data || item.createdAt || '').slice(0, 10);
}

export function buildObraFinanceiroLedger(
  obra,
  { gastos = [], diarias = [], gastosEmpresa = [], pagamentos = [], funcionarios = [], includeRepasses = false } = {}
) {
  if (!obra?.id) return [];

  const movimentos = [];

  getObraRecebimentos(obra.id, pagamentos).forEach((pagamento) => {
    const valor = getValorRecebidoPagamento(pagamento);
    if (!(valor > 0)) return;
    movimentos.push({
      id: `rec-${pagamento.id}`,
      data: movementDate(pagamento),
      tipo: 'entrada',
      descricao: pagamento.descricao || 'Recebimento do cliente',
      categoria: 'Recebimento',
      entrada: roundMoney(valor),
      saida: 0,
      origem: 'Pagamento cliente',
    });
  });

  getObraDiarias(obra.id, diarias).forEach((diaria) => {
    const valor = getDiariaCustoNaObra(diaria, obra.id, funcionarios);
    if (!(valor > 0)) return;
    const nome =
      funcionarios.find((item) => item.id === diaria.funcionarioId)?.nome || 'Funcionário';
    movimentos.push({
      id: `dia-${diaria.id}`,
      data: movementDate(diaria),
      tipo: 'saida',
      descricao: `Diária — ${nome}`,
      categoria: 'Diárias',
      entrada: 0,
      saida: roundMoney(valor),
      origem: 'Diária / Funcionário',
    });
  });

  getObraGastos(obra.id, gastos).forEach((gasto) => {
    const valor = gastoValor(gasto);
    if (!valor) return;
    const material = isMaterialGasto(gasto);
    movimentos.push({
      id: `gas-${gasto.id}`,
      data: movementDate(gasto),
      tipo: 'saida',
      descricao: gasto.descricao || gasto.observacao || gasto.categoria || 'Gasto',
      categoria: material ? 'Materiais' : gasto.categoria || 'Outros',
      entrada: 0,
      saida: roundMoney(valor),
      origem: 'Gasto da obra',
    });
  });

  getGastosEmpresaDaObra(obra.id, gastosEmpresa).forEach((gasto) => {
    const valor = getGastoEmpresaValor(gasto);
    if (!valor) return;
    const material = isMaterialGasto(gasto);
    movimentos.push({
      id: `emp-${gasto.id}`,
      data: movementDate(gasto),
      tipo: 'saida',
      descricao: gasto.descricao || gasto.categoria || 'Gasto da empresa',
      categoria: material ? 'Materiais' : gasto.categoria || 'Outros',
      entrada: 0,
      saida: roundMoney(valor),
      origem: 'Gasto da empresa',
    });
  });

  if (includeRepasses) {
    asRecordList(obra.repassesParceria).forEach((repasse) => {
      const valor = Number(repasse.valor) || 0;
      if (!(valor > 0)) return;
      movimentos.push({
        id: `rep-${repasse.id}`,
        data: movementDate(repasse),
        tipo: 'saida',
        descricao: repasse.observacao || 'Repasse de parceria',
        categoria: 'Repasse de parceria',
        entrada: 0,
        saida: roundMoney(valor),
        origem: 'Repasse',
        naoOperacional: true,
      });
    });
  }

  movimentos.sort((a, b) => {
    const da = a.data || '';
    const db = b.data || '';
    if (da !== db) return da.localeCompare(db);
    return String(a.id).localeCompare(String(b.id));
  });

  let saldo = 0;
  return movimentos.map((item) => {
    saldo = roundMoney(saldo + item.entrada - item.saida);
    return { ...item, saldo };
  });
}

export function filterFinanceiroLedger(movimentos = [], filtro = 'todos') {
  if (!filtro || filtro === 'todos') return movimentos;
  if (filtro === 'entradas') return movimentos.filter((item) => item.entrada > 0);
  if (filtro === 'saidas') return movimentos.filter((item) => item.saida > 0);
  if (filtro === 'diarias') return movimentos.filter((item) => String(item.origem || '').startsWith('Diária'));
  if (filtro === 'materiais') return movimentos.filter((item) => item.categoria === 'Materiais');
  if (filtro === 'outros') {
    return movimentos.filter(
      (item) =>
        item.saida > 0 &&
        !String(item.origem || '').startsWith('Diária') &&
        item.categoria !== 'Materiais' &&
        !isHospedagemCategoria(item.categoria)
    );
  }
  return movimentos;
}
