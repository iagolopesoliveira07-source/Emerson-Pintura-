import shared from '../../pages/shared.module.css';

export default function DebtorFilters({ filters, onChange, clientes, obras }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({ ...filters, [name]: value });
  };

  return (
    <div className={shared.filters}>
      <input
        className={shared.filterInput}
        name="search"
        placeholder="Pesquisar cliente ou obra..."
        value={filters.search}
        onChange={handleChange}
      />
      <select className={shared.filterInput} name="status" value={filters.status} onChange={handleChange}>
        <option value="todos">Todos</option>
        <option value="parcial">Com pagamento parcial</option>
        <option value="pendente">Sem recebimentos</option>
      </select>
      <select className={shared.filterInput} name="cliente" value={filters.cliente} onChange={handleChange}>
        <option value="">Todos os clientes</option>
        {clientes.map((cliente) => (
          <option key={cliente} value={cliente}>{cliente}</option>
        ))}
      </select>
      <select className={shared.filterInput} name="obraId" value={filters.obraId} onChange={handleChange}>
        <option value="">Todas as obras</option>
        {obras.map((obra) => (
          <option key={obra.id} value={obra.id}>{obra.nome}</option>
        ))}
      </select>
    </div>
  );
}
