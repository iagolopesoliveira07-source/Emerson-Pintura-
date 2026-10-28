import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import GuestRoute from './components/GuestRoute/GuestRoute';
import Layout from './components/Layout/Layout';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Obras from './pages/Obras/Obras';
import ObraDetalhes from './pages/Obras/ObraDetalhes';
import ObraAcertoParceria from './pages/Obras/ObraAcertoParceria';
import Funcionarios from './pages/Funcionarios/Funcionarios';
import FuncionarioDetalhes from './pages/Funcionarios/FuncionarioDetalhes';
import Diarias from './pages/Diarias/Diarias';
import Gastos from './pages/Gastos/Gastos';
import GastosEmpresa from './pages/GastosEmpresa/GastosEmpresa';
import Iva from './pages/Iva/Iva';
import Pagamentos from './pages/Pagamentos/Pagamentos';
import Devedores from './pages/Devedores/Devedores';
import Relatorios from './pages/Relatorios/Relatorios';
import Lucros from './pages/Lucros/Lucros';
import Configuracoes from './pages/Configuracoes/Configuracoes';
import ComprovativoPublico from './pages/ComprovativoPublico/ComprovativoPublico';

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
              <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />
            <Route path="/comprovativo" element={<ComprovativoPublico />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="obras" element={<Obras />} />
              <Route path="obras/:id" element={<ObraDetalhes />} />
              <Route path="obras/:id/acerto" element={<ObraAcertoParceria />} />
              <Route path="obras/:id/acerto/:acertoId" element={<ObraAcertoParceria />} />
              <Route path="funcionarios" element={<Funcionarios />} />
              <Route path="funcionarios/:id" element={<FuncionarioDetalhes />} />
              <Route path="diarias" element={<Diarias />} />
              <Route path="adiantamentos" element={<Navigate to="/funcionarios" replace />} />
              <Route path="emprestimos" element={<Navigate to="/funcionarios" replace />} />
              <Route path="gastos" element={<Gastos />} />
              <Route path="gastos-empresa" element={<GastosEmpresa />} />
              <Route path="iva" element={<Iva />} />
              <Route path="pagamentos" element={<Pagamentos />} />
              <Route path="devedores" element={<Devedores />} />
              <Route path="lucros" element={<Lucros />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="configuracoes" element={<Configuracoes />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
