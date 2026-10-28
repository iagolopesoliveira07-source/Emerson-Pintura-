import { LOGO_ALT, LOGO_SIDEBAR_SRC, LOGO_SRC } from '../../assets/brand';
import styles from './Logo.module.css';

const SIZE_CLASS = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
  sidebar: styles.sidebar,
};

export default function Logo({
  size = 'md',
  variant = 'default',
  className = '',
  alt = LOGO_ALT,
}) {
  const src = variant === 'sidebar' ? LOGO_SIDEBAR_SRC : LOGO_SRC;

  return (
    <img
      src={src}
      alt={alt}
      className={`${styles.logo} ${SIZE_CLASS[size] || SIZE_CLASS.md} ${className}`.trim()}
      decoding="async"
    />
  );
}
