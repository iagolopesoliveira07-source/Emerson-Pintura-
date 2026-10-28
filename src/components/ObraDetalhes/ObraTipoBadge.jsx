import Badge from '../Badge/Badge';
import HelpTip from '../HelpTip/HelpTip';
import { getTipoObra, getTipoObraLabel, TIPO_OBRA } from '../../utils/obraSpecial';
import { HELP } from '../../utils/helpTexts';
import styles from './ObraTipo.module.css';

const VARIANT = {
  [TIPO_OBRA.PARCERIA]: 'purple',
  [TIPO_OBRA.CREDITO]: 'info',
  [TIPO_OBRA.ESPECIAL_TAVIRA]: 'orange',
  [TIPO_OBRA.NORMAL]: 'default',
};

export default function ObraTipoBadge({ obra, tipo }) {
  const resolved = tipo || getTipoObra(obra);
  if (!resolved || resolved === TIPO_OBRA.NORMAL) return null;
  return (
    <span className={styles.tipoBadgeWrap}>
      <Badge variant={VARIANT[resolved] || 'default'}>
        <span className={styles.tipoBadge}>{getTipoObraLabel(resolved)}</span>
      </Badge>
      {resolved === TIPO_OBRA.CREDITO ? <HelpTip text={HELP.obra.credito} /> : null}
    </span>
  );
}
