import { useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { FormGroup, Input, Select, Textarea, FormActions, FormRow } from '../Form/Form';
import { useApp } from '../../context/AppContext';
import { getGruposParaSelect } from '../../utils/gastoEmpresaCategoriaCatalog';
import {
  DESPESA_NATUREZA,
  DESPESA_NATUREZA_LABELS,
  DESPESA_PERIODICIDADE,
  DESPESA_PERIODICIDADE_LABELS,
  createDespesaProgramada,
} from '../../utils/empresaFinanceiroCalculations';

const EMPTY = {
  titulo: '',
  natureza: DESPESA_NATUREZA.OUTRO,
  categoria: '',
  valor: '',
  periodicidade: DESPESA_PERIODICIDADE.MENSAL,
  recorrenciaConfirmada: true,
  diaVencimento: '',
  dataInicio: '',
  duracaoMeses: '',
  previsaoMes: '',
  parcelasRestantes: '',
  veiculoId: '',
  observacao: '',
};

export default function DespesaProgramadaFormModal({ isOpen, onClose, despesa = null, onSubmit }) {
  const { gastosEmpresaCategorias, empresaVeiculos = [] } = useApp();
  const isEdit = Boolean(despesa);
  const [form, setForm] = useState(EMPTY);
  const grupos = getGruposParaSelect(gastosEmpresaCategorias, {
    apenasAtivas: true,
    incluirNome: form.categoria,
  });

  useEffect(() => {
    if (!isOpen) return;
    if (!despesa) {
      setForm(EMPTY);
      return;
    }
    setForm({
      titulo: despesa.titulo || '',
      natureza: despesa.natureza || DESPESA_NATUREZA.OUTRO,
      categoria: despesa.categoria || '',
      valor: despesa.valor != null ? String(despesa.valor) : '',
      periodicidade: despesa.periodicidade || DESPESA_PERIODICIDADE.MENSAL,
      recorrenciaConfirmada: despesa.recorrenciaConfirmada !== false && despesa.periodicidade !== DESPESA_PERIODICIDADE.UNICA,
      diaVencimento: despesa.diaVencimento != null ? String(despesa.diaVencimento) : '',
      dataInicio: despesa.dataInicio || '',
      duracaoMeses: despesa.duracaoMeses != null ? String(despesa.duracaoMeses) : '',
      previsaoMes: despesa.previsaoMes || '',
      parcelasRestantes: despesa.parcelasRestantes != null ? String(despesa.parcelasRestantes) : '',
      veiculoId: despesa.veiculoId || '',
      observacao: despesa.observacao || '',
    });
  }, [isOpen, despesa]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'periodicidade') {
        next.recorrenciaConfirmada = value !== DESPESA_PERIODICIDADE.UNICA;
      }
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.categoria || !form.valor) return;
    onSubmit(
      createDespesaProgramada({
        ...(despesa || {}),
        titulo: form.titulo,
        natureza: form.natureza,
        categoria: form.categoria,
        valor: form.valor,
        periodicidade: form.periodicidade,
        recorrenciaConfirmada: form.recorrenciaConfirmada,
        diaVencimento: form.diaVencimento,
        dataInicio: form.dataInicio || null,
        duracaoMeses: form.duracaoMeses,
        previsaoMes: form.previsaoMes || null,
        parcelasRestantes: form.parcelasRestantes,
        veiculoId: form.veiculoId || null,
        observacao: form.observacao,
      })
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Editar despesa programada' : 'Nova despesa programada'}
      size="lg"
      footer={
        <FormActions>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="despesa-programada-form">
            Guardar
          </Button>
        </FormActions>
      }
    >
      <form id="despesa-programada-form" onSubmit={handleSubmit}>
        <FormGroup label="Título" required>
          <Input name="titulo" value={form.titulo} onChange={handleChange} />
        </FormGroup>
        <FormRow>
          <FormGroup label="Natureza" required>
            <Select name="natureza" value={form.natureza} onChange={handleChange}>
              {Object.entries(DESPESA_NATUREZA_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Categoria" required>
            <Select name="categoria" value={form.categoria} onChange={handleChange}>
              <option value="">Seleccionar</option>
              {grupos.map((grupo) => (
                <optgroup key={grupo.grupo} label={grupo.grupo}>
                  {grupo.categorias.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Valor (€)" required>
            <Input name="valor" type="number" step="0.01" min="0.01" value={form.valor} onChange={handleChange} />
          </FormGroup>
          <FormGroup label="Periodicidade" required>
            <Select name="periodicidade" value={form.periodicidade} onChange={handleChange}>
              {Object.entries(DESPESA_PERIODICIDADE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
          </FormGroup>
        </FormRow>
        <FormGroup
          label="Recorrência confirmada"
          hint="Só marcar se existir uma próxima cobrança conhecida. A validade/cobertura não cria sozinha uma obrigação."
        >
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              name="recorrenciaConfirmada"
              checked={Boolean(form.recorrenciaConfirmada)}
              onChange={handleChange}
            />
            Há uma próxima cobrança confirmada nesta periodicidade
          </label>
        </FormGroup>
        <FormRow>
          <FormGroup label="Dia do vencimento" hint="Opcional. Ex.: 1 ou 3">
            <Input name="diaVencimento" type="number" min="1" max="31" value={form.diaVencimento} onChange={handleChange} />
          </FormGroup>
          <FormGroup label="Veículo">
            <Select name="veiculoId" value={form.veiculoId} onChange={handleChange}>
              <option value="">Nenhum</option>
              {empresaVeiculos.filter((item) => item.ativo !== false).map((veiculo) => (
                <option key={veiculo.id} value={veiculo.id}>
                  {veiculo.nome}
                </option>
              ))}
            </Select>
          </FormGroup>
        </FormRow>
        {(form.periodicidade === DESPESA_PERIODICIDADE.ANUAL ||
          form.periodicidade === DESPESA_PERIODICIDADE.TRIMESTRAL ||
          form.periodicidade === DESPESA_PERIODICIDADE.SEMESTRAL ||
          form.periodicidade === DESPESA_PERIODICIDADE.UNICA ||
          form.natureza === DESPESA_NATUREZA.SEGURO) && (
          <FormRow>
            <FormGroup label="Início / data do pagamento">
              <Input name="dataInicio" type="date" value={form.dataInicio} onChange={handleChange} />
            </FormGroup>
            <FormGroup
              label="Cobertura (meses)"
              hint="Período de validade deste pagamento. Não cria automaticamente uma nova cobrança."
            >
              <Input name="duracaoMeses" type="number" min="1" value={form.duracaoMeses} onChange={handleChange} />
            </FormGroup>
          </FormRow>
        )}
        {form.periodicidade === DESPESA_PERIODICIDADE.PARCELAS && (
          <FormGroup label="Parcelas restantes">
            <Input name="parcelasRestantes" type="number" min="0" value={form.parcelasRestantes} onChange={handleChange} />
          </FormGroup>
        )}
        {form.periodicidade === DESPESA_PERIODICIDADE.UNICA && (
          <FormGroup label="Previsão (mês)" hint="AAAA-MM se o dia exacto não for conhecido">
            <Input name="previsaoMes" type="month" value={form.previsaoMes} onChange={handleChange} />
          </FormGroup>
        )}
        <FormGroup label="Observação">
          <Textarea name="observacao" value={form.observacao} onChange={handleChange} />
        </FormGroup>
      </form>
    </Modal>
  );
}
