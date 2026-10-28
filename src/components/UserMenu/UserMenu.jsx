import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './UserMenu.module.css';

export default function UserMenu({ displayName, role }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    logout();
    setOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button
        type="button"
        className={styles.profile}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.profileText}>
          <div className={styles.profileName}>{displayName}</div>
          <div className={styles.profileRole}>{role}</div>
        </div>
        <ChevronDown size={16} className={styles.chevron} />
      </button>

      {open && (
        <div className={styles.dropdown}>
          <button type="button" className={styles.menuItem} onClick={handleSignOut}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
