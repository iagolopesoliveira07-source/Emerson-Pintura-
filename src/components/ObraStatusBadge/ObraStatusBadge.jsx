import Badge from '../Badge/Badge';
import { normalizeObraStatus, getObraStatusVariant, getObraStatusDisplayLabel } from '../../utils/obraStatus';

export default function ObraStatusBadge({ status }) {
  const normalized = normalizeObraStatus(status);

  return (
    <Badge variant={getObraStatusVariant(normalized)}>
      {getObraStatusDisplayLabel(status)}
    </Badge>
  );
}
