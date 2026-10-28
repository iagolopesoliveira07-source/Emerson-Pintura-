import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormActions, FormRow } from '../Form/Form';
import { useApp } from '../../context/AppContext';
import { createValorRecuperar } from '../../utils/empresaFinanceiroCalculations';

export default function ValorRecuperarFormModal({ isOpen, onClose, item = null, onSubmit }) {
  const { empresaVeiculos = [] } = useApp();
  const isEdit = Boolean(item);
  const [form, setForm] = useState({ descricao: '', valor: '', previsaoMes: '', veiculoId: '', observacao: '' });

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      descricao: item?.descricao || '',
      valor: item?.valor != null ? String(item.valor) : '',
      previsaoMes: item?.previsaoMes || '',
      veiculoId: item?.veiculoId || '',
      observacao: item?.observacao || '',
    });
  }, [isOpen, item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.descricao.trim() || !form.valor) return;
    onSubmit(
      createValorRecuperar({
        ...(item || {}),
        descricao: form.descricao,
        valor: form.valor,
        previsaoMes: form.previsaoMes || null,
        veiculoId: form.veiculoId || null,
        observacao: form.observacao,
      })
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar valor a recuperar' : 'Novo valor a recuperar'}
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="valor-recuperar-form">
            Guardar
          </Button>
        </FormActions>
      }
    >
      <form id="valor-recuperar-form" onSubmit={handleSubmit}>
        <FormGroup label="Descrição" required>
          <Input
            value={form.descricao}
            onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
          />
        </FormGroup>
        <FormRow>
          <FormGroup label="Valor (€)" required>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={form.valor}
              onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value }))}
            />
          </FormGroup>
          <FormGroup label="Previsão" hint="Mês previsto, sem contar como receita">
            <Input
              type="month"
              value={form.previsaoMes}
              onChange={(e) => setForm((prev) => ({ ...prev, previsaoMes: e.target.value }))}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Veículo">
          <Select
            value={form.veiculoId}
            onChange={(e) => setForm((prev) => ({ ...prev, veiculoId: e.target.value }))}
          >
            <option value="">Nenhum</option>
            {empresaVeiculos.map((veiculo) => (
              <option key={veiculo.id} value={veiculo.id}>
                {veiculo.nome}
              </option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup label="Observação">
          <Textarea
            value={form.observacao}
            onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
