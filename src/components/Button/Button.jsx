import styles from './Button.module.css';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  full = false,
  className = '',
  ...props
}) {
  const classes = [
    styles.btn,
    styles[variant],
    size === 'sm' && styles.sm,
    size === 'lg' && styles.lg,
    full && styles.full,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...props}>
      {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 16 : 18} />}
      {children}
      {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}
