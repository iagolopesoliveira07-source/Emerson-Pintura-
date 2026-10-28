import { FormGroup, Select } from '../Form/Form';
import { isPrepaidCreditObra, getServicosAbatimentoOptions } from '../../utils/obraPrepaidCredit';
import { HELP } from '../../utils/helpTexts';

export default function ServicoAbatimentoSelect({
  obras = [],
  obraId,
  value,
  onChange,
  disabled = false,
  required = false,
  name = 'intervencaoId',
}) {
  const obra = (obras || []).find((item) => item.id === obraId) || null;
  if (!isPrepaidCreditObra(obra)) return null;

  const options = getServicosAbatimentoOptions(obra);

  return (
    <FormGroup
      label="Serviço"
      hint="Opcional. Pode deixar sem serviço e associar mais tarde."
      help={HELP.obra.semServico}
      required={required}
    >
      <Select name={name} value={value || ''} onChange={onChange} disabled={disabled}>
        <option value="">Sem serviço definido</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
            {item.valorFinal ? '' : ' — sem orçamento'}
          </option>
        ))}
      </Select>
    </FormGroup>
  );
}
