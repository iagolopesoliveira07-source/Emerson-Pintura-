import Badge from '../Badge/Badge';
import { getCategoriaBadgeVariant } from '../../constants/gastoCategorias';

export default function CategoriaGastoBadge({ categoria }) {
  if (!categoria) return '—';
  return <Badge variant={getCategoriaBadgeVariant(categoria)}>{categoria}</Badge>;
}
