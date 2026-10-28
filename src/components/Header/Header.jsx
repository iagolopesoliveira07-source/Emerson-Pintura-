import { Menu, Search, Bell } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import UserMenu from '../UserMenu/UserMenu';
import styles from './Header.module.css';

export default function Header({ title, onMenuToggle, searchValue, onSearchChange }) {
  const { configuracoes } = useApp();

  return (
    <header className={styles.header}>
      <button className={styles.menuBtn} onClick={onMenuToggle} aria-label="Abrir menu">
        <Menu size={20} />
      </button>

      <h1 className={styles.title}>{title}</h1>

      <div className={styles.spacer} />

      {onSearchChange && (
        <div className={styles.search}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Pesquisar..."
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.iconBtn} aria-label="Notificações">
          <Bell size={18} />
          <span className={styles.notifDot} />
        </button>

        <UserMenu
          displayName={configuracoes?.utilizador?.nome || ''}
          role={configuracoes?.utilizador?.cargo || ''}
        />
      </div>
    </header>
  );
}
