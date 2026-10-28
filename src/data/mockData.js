export const OBRA_ESTADOS = [
  'Aguardando confirmação',
  'Aguardando início',
  'Em andamento',
  'Pausada',
  'Aguardando pagamento',
  'Encerrada',
  'Cancelada',
];
export const FUNCIONARIO_ESTADOS = ['Ativo', 'Inativo'];
export const EMPRESTIMO_ESTADOS = ['Em aberto', 'Parcialmente pago', 'Pago'];
export { GASTO_CATEGORIAS } from '../constants/gastoCategorias.js';
export const PAGAMENTO_TIPOS = [
  'Recebimento de cliente',
  'Pagamento a funcionário',
  'Pagamento a fornecedor',
  'Repasse de parceria',
  'Outro',
];
export const METODOS_PAGAMENTO = ['Transferência', 'Multibanco', 'Numerário', 'Cheque', 'MB Way'];

export const mockObras = [
  {
    id: 'obra-1',
    nome: 'Pintura Apartamento T3',
    cliente: 'Maria Silva',
    telefone: '912 345 678',
    morada: 'Rua das Flores, 45, Lisboa',
    valorContratado: 4500,
    dataInicio: '2026-01-15',
    dataPrevistaTermino: '2026-03-01',
    estado: 'Em andamento',
    observacoes: 'Inclui pintura de tectos e rodapés.',
    funcionarios: ['func-1', 'func-2'],
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'obra-2',
    nome: 'Renovação Escritório',
    cliente: 'Tech Solutions Lda',
    telefone: '213 456 789',
    morada: 'Av. da Liberdade, 120, Lisboa',
    valorContratado: 8200,
    dataInicio: '2026-02-01',
    dataPrevistaTermino: '2026-04-15',
    estado: 'Em andamento',
    observacoes: 'Pintura de paredes e divisórias.',
    funcionarios: ['func-1', 'func-3'],
    createdAt: '2026-01-25T14:00:00Z',
  },
  {
    id: 'obra-3',
    nome: 'Pintura Moradia V4',
    cliente: 'João Costa',
    telefone: '918 765 432',
    morada: 'Rua do Sol, 88, Cascais',
    valorContratado: 12000,
    dataInicio: '2025-11-01',
    dataPrevistaTermino: '2026-01-20',
    estado: 'Encerrada',
    observacoes: 'Obra concluída com sucesso.',
    funcionarios: ['func-1', 'func-2', 'func-4'],
    createdAt: '2025-10-20T09:00:00Z',
  },
  {
    id: 'obra-4',
    nome: 'Pintura Loja Comercial',
    cliente: 'Moda & Estilo',
    telefone: '219 876 543',
    morada: 'Centro Comercial Norte, Loja 12, Porto',
    valorContratado: 3500,
    dataInicio: '2026-03-10',
    dataPrevistaTermino: '2026-03-25',
    estado: 'Aguardando início',
    observacoes: 'Aguarda entrega de materiais.',
    funcionarios: [],
    createdAt: '2026-02-28T11:00:00Z',
  },
];

export const mockFuncionarios = [
  {
    id: 'func-1',
    nome: 'António Ferreira',
    telefone: '911 222 333',
    valorDiaria: 45,
    dataEntrada: '2023-03-15',
    estado: 'Ativo',
    observacoes: 'Pintor experiente, especialista em acabamentos.',
    createdAt: '2023-03-15T08:00:00Z',
  },
  {
    id: 'func-2',
    nome: 'Pedro Santos',
    telefone: '922 333 444',
    valorDiaria: 40,
    dataEntrada: '2024-01-10',
    estado: 'Ativo',
    observacoes: '',
    createdAt: '2024-01-10T08:00:00Z',
  },
  {
    id: 'func-3',
    nome: 'Ricardo Oliveira',
    telefone: '933 444 555',
    valorDiaria: 42,
    dataEntrada: '2024-06-01',
    estado: 'Ativo',
    observacoes: 'Bom em trabalhos de altura.',
    createdAt: '2024-06-01T08:00:00Z',
  },
  {
    id: 'func-4',
    nome: 'Miguel Alves',
    telefone: '944 555 666',
    valorDiaria: 38,
    dataEntrada: '2022-09-01',
    estado: 'Inativo',
    observacoes: 'Saída por mudança de cidade.',
    createdAt: '2022-09-01T08:00:00Z',
  },
];

export const mockDiarias = [
  { id: 'diaria-1', funcionarioId: 'func-1', obraId: 'obra-1', data: '2026-02-01', quantidade: 1, valorDiaria: 45, observacao: '', createdAt: '2026-02-01T18:00:00Z' },
  { id: 'diaria-2', funcionarioId: 'func-1', obraId: 'obra-1', data: '2026-02-02', quantidade: 1, valorDiaria: 45, observacao: '', createdAt: '2026-02-02T18:00:00Z' },
  { id: 'diaria-3', funcionarioId: 'func-2', obraId: 'obra-1', data: '2026-02-01', quantidade: 1, valorDiaria: 40, observacao: '', createdAt: '2026-02-01T18:00:00Z' },
  { id: 'diaria-4', funcionarioId: 'func-1', obraId: 'obra-2', data: '2026-02-05', quantidade: 1, valorDiaria: 45, observacao: 'Trabalho extra', createdAt: '2026-02-05T18:00:00Z' },
  { id: 'diaria-5', funcionarioId: 'func-3', obraId: 'obra-2', data: '2026-02-05', quantidade: 2, valorDiaria: 42, observacao: 'Fim de semana', createdAt: '2026-02-05T18:00:00Z' },
];

export const mockValoresAcerto = [
  {
    id: 'vac-1',
    funcionarioId: 'func-1',
    obraId: 'obra-1',
    motivo: 'Material para Obra Braga',
    valorEntregue: 500,
    observacao: '',
    gastos: [],
    acerto: null,
    estado: 'Em aberto',
    createdAt: '2026-02-01T10:00:00Z',
  },
];

export const mockAdiantamentos = [
  { id: 'adv-1', funcionarioId: 'func-1', data: '2026-01-20', valor: 200, motivo: 'Despesas pessoais', observacao: '', createdAt: '2026-01-20T10:00:00Z' },
  { id: 'adv-2', funcionarioId: 'func-2', data: '2026-02-01', valor: 150, motivo: 'Material pessoal', observacao: '', createdAt: '2026-02-01T10:00:00Z' },
];

export const mockEmprestimos = [
  { id: 'emp-1', funcionarioId: 'func-1', valor: 500, data: '2025-12-01', motivo: 'Emergência familiar', formaPagamento: 'Desconto em diárias', observacoes: '', estado: 'Parcialmente pago', valorPago: 200, createdAt: '2025-12-01T10:00:00Z' },
  { id: 'emp-2', funcionarioId: 'func-3', valor: 300, data: '2026-01-15', motivo: 'Reparação viatura', formaPagamento: 'Prestações mensais', observacoes: '', estado: 'Em aberto', valorPago: 0, createdAt: '2026-01-15T10:00:00Z' },
];

export const mockGastos = [
  { id: 'gasto-1', descricao: 'Tinta acrílica branca 20L', categoria: 'Material', valor: 180, data: '2026-02-01', obraId: 'obra-1', fornecedor: 'Tintas & Cores Lda', observacao: '', createdAt: '2026-02-01T09:00:00Z' },
  { id: 'gasto-2', descricao: 'Combustível viatura', categoria: 'Combustível', valor: 65, data: '2026-02-03', obraId: 'obra-1', fornecedor: 'Galp', observacao: '', createdAt: '2026-02-03T09:00:00Z' },
  { id: 'gasto-3', descricao: 'Rolos e pincéis', categoria: 'Ferramentas', valor: 45, data: '2026-02-05', obraId: 'obra-2', fornecedor: 'Bricomart', observacao: '', createdAt: '2026-02-05T09:00:00Z' },
  { id: 'gasto-4', descricao: 'Almoço equipa', categoria: 'Alimentação', valor: 38, data: '2026-02-05', obraId: 'obra-2', fornecedor: 'Restaurante O Pintor', observacao: '', createdAt: '2026-02-05T13:00:00Z' },
];

export const mockPagamentos = [
  {
    id: 'pag-1',
    tipo: 'Recebimento de cliente',
    descricao: 'Parcela 1/4 — Apartamento T3',
    valor: 1500,
    valorRecebido: 1500,
    status: 'pago',
    data: '2026-01-20',
    dataVencimento: '2026-01-20',
    obraId: 'obra-1',
    pessoaRelacionada: 'Maria Silva',
    metodoPagamento: 'Transferência',
    observacao: '',
    parcelaNumero: 1,
    parcelaTotal: 4,
    planoId: 'plan-obra-1',
    historicoPagamentos: [],
    createdAt: '2026-01-20T15:00:00Z',
  },
  {
    id: 'pag-5',
    tipo: 'Recebimento de cliente',
    descricao: 'Parcela 2/4 — Apartamento T3',
    valor: 1000,
    valorRecebido: 0,
    status: 'pendente',
    data: null,
    dataVencimento: '2026-02-01',
    obraId: 'obra-1',
    pessoaRelacionada: 'Maria Silva',
    metodoPagamento: null,
    observacao: '',
    parcelaNumero: 2,
    parcelaTotal: 4,
    planoId: 'plan-obra-1',
    historicoPagamentos: [],
    createdAt: '2026-01-21T10:00:00Z',
  },
  {
    id: 'pag-6',
    tipo: 'Recebimento de cliente',
    descricao: 'Parcela 3/4 — Apartamento T3',
    valor: 1000,
    valorRecebido: 0,
    status: 'pendente',
    data: null,
    dataVencimento: '2026-03-01',
    obraId: 'obra-1',
    pessoaRelacionada: 'Maria Silva',
    metodoPagamento: null,
    observacao: '',
    parcelaNumero: 3,
    parcelaTotal: 4,
    planoId: 'plan-obra-1',
    historicoPagamentos: [],
    createdAt: '2026-01-21T10:00:00Z',
  },
  {
    id: 'pag-7',
    tipo: 'Recebimento de cliente',
    descricao: 'Parcela 4/4 — Apartamento T3',
    valor: 1000,
    valorRecebido: 0,
    status: 'pendente',
    data: null,
    dataVencimento: '2026-03-15',
    obraId: 'obra-1',
    pessoaRelacionada: 'Maria Silva',
    metodoPagamento: null,
    observacao: '',
    parcelaNumero: 4,
    parcelaTotal: 4,
    planoId: 'plan-obra-1',
    historicoPagamentos: [],
    createdAt: '2026-01-21T10:00:00Z',
  },
  { id: 'pag-2', tipo: 'Recebimento de cliente', descricao: 'Pagamento final — Moradia V4', valor: 4000, valorRecebido: 4000, status: 'pago', data: '2026-01-25', obraId: 'obra-3', pessoaRelacionada: 'João Costa', metodoPagamento: 'Transferência', observacao: '', parcelaNumero: 1, parcelaTotal: 1, createdAt: '2026-01-25T15:00:00Z' },
  { id: 'pag-3', tipo: 'Pagamento a funcionário', descricao: 'Salário Janeiro — António', valor: 900, data: '2026-02-05', obraId: null, pessoaRelacionada: 'António Ferreira', metodoPagamento: 'Transferência', observacao: '', createdAt: '2026-02-05T16:00:00Z' },
  { id: 'pag-4', tipo: 'Pagamento a fornecedor', descricao: 'Factura tintas', valor: 180, data: '2026-02-02', obraId: 'obra-1', pessoaRelacionada: 'Tintas & Cores Lda', metodoPagamento: 'Transferência', observacao: '', createdAt: '2026-02-02T10:00:00Z' },
];

export const mockConfiguracoes = {
  nomeEmpresa: 'Emerson Pinturas',
  moeda: 'EUR',
  nif: '123 456 789',
  morada: 'Rua da Pintura, 10, Lisboa',
  telefone: '210 000 000',
  email: 'geral@emersonpinturas.pt',
  utilizador: {
    nome: 'Emerson',
    email: 'emerson@emersonpinturas.pt',
    cargo: 'Administrador',
  },
  preferencias: {
    notificacoes: true,
    temaEscuro: false,
  },
  /** Data a partir da qual o controlo detalhado é considerado fiável (YYYY-MM-DD). Vazio = não definido. */
  dataInicioControle: '',
};

export function getInitialData() {
  return {
    obras: mockObras,
    funcionarios: mockFuncionarios,
    diarias: mockDiarias,
    adiantamentos: [],
    emprestimos: [],
    valoresAcerto: mockValoresAcerto,
    fechamentosPagamento: [],
    gastos: mockGastos,
    pagamentos: mockPagamentos,
    configuracoes: mockConfiguracoes,
  };
}
