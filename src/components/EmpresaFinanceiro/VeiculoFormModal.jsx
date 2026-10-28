import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormActions, FormRow } from '../Form/Form';
import { createVeiculo } from '../../utils/empresaFinanceiroCalculations';
import { VEICULO_COMBUSTIVEL_LABELS } from '../../constants/empresaIva';

export default function VeiculoFormModal({ isOpen, onClose, veiculo = null, onSubmit }) {
  const isEdit = Boolean(veiculo);
  const [form, setForm] = useState({
    nome: '',
    modelo: '',
    combustivel: '',
    propriedadeEmpresa: 'sim',
    regraFiscal: '',
    ivaDedutivelPercent: '',
    observacaoFiscal: '',
    notas: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      nome: veiculo?.nome || '',
      modelo: veiculo?.modelo || '',
      combustivel: veiculo?.combustivel || '',
      propriedadeEmpresa: veiculo?.propriedadeEmpresa === false ? 'nao' : 'sim',
      regraFiscal: veiculo?.regraFiscal || '',
      ivaDedutivelPercent:
        veiculo?.ivaDedutivelPercent == null ? '' : String(veiculo.ivaDedutivelPercent),
      observacaoFiscal: veiculo?.observacaoFiscal || '',
      notas: veiculo?.notas || '',
    });
  }, [isOpen, veiculo]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    onSubmit(
      createVeiculo({
        ...(veiculo || {}),
        nome: form.nome,
        modelo: form.modelo,
        combustivel: form.combustivel || null,
        propriedadeEmpresa: form.propriedadeEmpresa === 'sim',
        regraFiscal: form.regraFiscal || null,
        ivaDedutivelPercent: form.ivaDedutivelPercent === '' ? null : Number(form.ivaDedutivelPercent),
        observacaoFiscal: form.observacaoFiscal,
        notas: form.notas,
      })
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar veículo' : 'Novo veículo'}
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="veiculo-form">
            Guardar
          </Button>
        </FormActions>
      }
    >
      <form id="veiculo-form" onSubmit={handleSubmit}>
        <FormGroup label="Nome" required>
          <Input
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
            placeholder="Ex.: Van Grande"
          />
        </FormGroup>
        <FormRow>
          <FormGroup label="Modelo">
            <Input
              value={form.modelo}
              onChange={(e) => setForm((prev) => ({ ...prev, modelo: e.target.value }))}
              placeholder="Ex.: Toyota Proace"
            />
          </FormGroup>
          <FormGroup label="Combustível / energia">
            <Select
              value={form.combustivel}
              onChange={(e) => setForm((prev) => ({ ...prev, combustivel: e.target.value }))}
            >
              <option value="">Não definido</option>
              {Object.entries(VEICULO_COMBUSTIVEL_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Propriedade">
            <Select
              value={form.propriedadeEmpresa}
              onChange={(e) => setForm((prev) => ({ ...prev, propriedadeEmpresa: e.target.value }))}
            >
              <option value="sim">Da empresa</option>
              <option value="nao">Uso da empresa (não é da empresa)</option>
            </Select>
          </FormGroup>
          <FormGroup label="Regra fiscal">
            <Select
              value={form.regraFiscal}
              onChange={(e) => setForm((prev) => ({ ...prev, regraFiscal: e.target.value }))}
            >
              <option value="">Conforme a despesa</option>
              <option value="conforme_despesa">Conforme a despesa</option>
              <option value="nao_recuperavel">IVA não recuperado pela empresa</option>
            </Select>
          </FormGroup>
        </FormRow>
        {form.regraFiscal === 'nao_recuperavel' || form.ivaDedutivelPercent !== '' ? (
          <FormGroup label="Percentagem dedutível do veículo">
            <Input
              type="number"
              min="0"
              max="100"
              value={form.ivaDedutivelPercent}
              onChange={(e) => setForm((prev) => ({ ...prev, ivaDedutivelPercent: e.target.value }))}
            />
          </FormGroup>
        ) : null}
        <FormGroup label="Observação fiscal">
          <Textarea
            value={form.observacaoFiscal}
            onChange={(e) => setForm((prev) => ({ ...prev, observacaoFiscal: e.target.value }))}
          />
        </FormGroup>
        <FormGroup label="Notas">
          <Textarea
            value={form.notas}
            onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
          />
        </FormGroup>
      </form>
    </Modal>
  );
}
