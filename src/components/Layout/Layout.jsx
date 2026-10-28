import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import HubNav from '../Dashboard/HubNav';
import ErrorBoundary from '../ErrorBoundary/ErrorBoundary';
import styles from './Layout.module.css';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/obras': 'Obras',
  '/funcionarios': 'Funcionários',
  '/diarias': 'Diárias',
  '/adiantamentos': 'Valores para acerto',
  '/emprestimos': 'Valores para acerto',
  '/gastos-empresa': 'Gastos da Empresa',
  '/gastos': 'Gastos',
  '/iva': 'Controle de IVA',
  '/pagamentos': 'Pagamentos',
  '/devedores': 'Devedores',
  '/relatorios': 'Relatórios',
  '/lucros': 'Lucros',
  '/configuracoes': 'Configurações',
};

function shouldShowHubNav(pathname) {
  if (pathname === '/' || pathname === '/configuracoes') return false;
  if (pathname.startsWith('/obras/')) return false;
  if (pathname.startsWith('/funcionarios/')) return false;
  return true;
}

function getPageTitle(pathname) {
  if (/^\/obras\/[^/]+\/acerto/.test(pathname)) return 'Acerto da parceria';
  if (pathname.startsWith('/obras/')) return 'Detalhes da Obra';
  if (pathname.startsWith('/funcionarios/')) return 'Detalhes do Funcionário';
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (path === '/' ? pathname === '/' : pathname.startsWith(path)) return title;
  }
  return 'Emerson Pinturas';
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <div className={styles.layout}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={styles.main}>
        <Header title={title} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className={styles.content}>
          {shouldShowHubNav(location.pathname) && (
            <div className={styles.hubWrap}>
              <HubNav />
            </div>
          )}
          <ErrorBoundary key="eb-20260922e" resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
