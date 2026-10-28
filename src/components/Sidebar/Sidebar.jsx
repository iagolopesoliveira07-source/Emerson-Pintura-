import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  HardHat,
  Users,
  CalendarDays,
  Receipt,
  CreditCard,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Settings,
  LogOut,
  Percent,
  Building2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import Logo from '../Logo/Logo';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/obras', label: 'Obras', icon: HardHat },
  { path: '/funcionarios', label: 'Funcionários', icon: Users },
  { path: '/diarias', label: 'Diárias', icon: CalendarDays },
  { path: '/gastos', label: 'Gastos', icon: Receipt },
  { path: '/gastos-empresa', label: 'Gastos da Empresa', icon: Building2 },
  { path: '/iva', label: 'Controle de IVA', icon: Percent },
  { path: '/pagamentos', label: 'Pagamentos', icon: CreditCard },
  { path: '/devedores', label: 'Devedores', icon: AlertCircle },
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { path: '/lucros', label: 'Lucros', icon: TrendingUp },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Sidebar({ isOpen, onClose }) {
  const { configuracoes } = useApp();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logo}>
          <Logo size="sidebar" variant="sidebar" className={styles.logoImage} />
          <div className={styles.logoSub}>Gestão de Obras</div>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/' || path === '/gastos'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              onClick={onClose}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.company}>{configuracoes?.nomeEmpresa || 'Emerson Pinturas'}</div>
          <div className={styles.user}>{configuracoes?.utilizador?.nome || ''}</div>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
