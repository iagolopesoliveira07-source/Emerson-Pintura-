import Badge from '../Badge/Badge';
import { isNotaCredito } from '../../utils/gastoDocumentoTipo';

export default function DocumentoTipoBadge({ gasto }) {
  if (!isNotaCredito(gasto)) return null;
  return <Badge variant="danger">Nota de Crédito</Badge>;
}
