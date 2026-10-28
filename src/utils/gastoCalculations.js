import { getGastoCustoEmpresa } from './gastoDocumentoTipo';

export function calcTotalGastos(gastos = []) {
  return gastos.reduce((sum, g) => sum + getGastoCustoEmpresa(g), 0);
}

export function calcTotaisPorCategoria(gastos = [], categorias = []) {
  const result = {};
  categorias.forEach((cat) => {
    result[cat] = gastos
      .filter((g) => g.categoria === cat)
      .reduce((sum, g) => sum + getGastoCustoEmpresa(g), 0);
  });
  return result;
}

export function calcOutrosGastos(gastos = [], categoriasResumo = []) {
  return gastos
    .filter((g) => !categoriasResumo.includes(g.categoria))
    .reduce((sum, g) => sum + getGastoCustoEmpresa(g), 0);
}

export function filterGastos(gastos = [], { categoria, obraId, inicio, fim } = {}) {
  return gastos.filter((g) => {
    if (categoria && g.categoria !== categoria) return false;
    if (obraId && g.obraId !== obraId) return false;
    if (inicio && g.data < inicio) return false;
    if (fim && g.data > fim) return false;
    return true;
  });
}
