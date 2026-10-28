import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { HUB_ITEMS, buildHubSummaries } from '../../utils/dashboardHub';
import styles from './HubNav.module.css';

export default function HubNav() {
  const location = useLocation();
  const scrollerRef = useRef(null);
  const {
    obras,
    funcionarios,
    diarias,
    fechamentosPagamento = [],
    gastos,
    gastosEmpresa = [],
    pagamentos,
    configuracoes,
  } = useApp();

  const summaries = useMemo(
    () =>
      buildHubSummaries({
        obras,
        funcionarios,
        diarias,
        fechamentosPagamento,
        gastos,
        gastosEmpresa,
        pagamentos,
        configuracoes,
      }),
    [obras, funcionarios, diarias, fechamentosPagamento, gastos, gastosEmpresa, pagamentos, configuracoes]
  );

  useEffect(() => {
    const active = scrollerRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <nav className={styles.hub} aria-label="Áreas principais da empresa">
      <div ref={scrollerRef} className={styles.scroller}>
        {HUB_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.end === true}
              className={({ isActive }) => `${styles.chip} ${isActive ? styles.chipActive : ''}`}
            >
              <span className={styles.chipIcon}>
                <Icon size={18} aria-hidden />
              </span>
              <span className={styles.chipText}>
                <span className={styles.chipLabel}>{item.label}</span>
                <span className={styles.chipMeta}>{summaries[item.id]}</span>
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
