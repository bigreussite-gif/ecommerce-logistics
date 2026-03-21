import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';

import { Dashboard } from './pages/Dashboard';
import { Produits } from './pages/Produits';
import { Commandes } from './pages/Commandes';
import { CentreAppel } from './pages/CentreAppel';
import { Logistique } from './pages/Logistique';
import { Livraison } from './pages/Livraison';
import { Historique } from './pages/Historique';
import { Caisse } from './pages/Caisse';
import { Clients } from './pages/Clients';
import { Admin } from './pages/Admin';
import { Profil } from './pages/Profil';
import { Login } from './pages/Login';
import { FinancialReport } from './pages/FinancialReport';
import { Home } from './pages/Home';
import { StaffPerformance } from './pages/StaffPerformance';
import { NetProfit } from './pages/NetProfit';

const ProtectedRoute = ({ children, requiredPermission }: { children: React.ReactNode, requiredPermission: string }) => {
  const { currentUser, hasPermission } = useAuth();
  
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!hasPermission(requiredPermission)) return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} /> {/* Set Home as the element for the root route */}
        
        {/* Admin Page */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requiredPermission="COMMUNES">
              <Admin />
            </ProtectedRoute>
          } 
        />
        {/* Admin Dashboard */}
        <Route path="/dashboard" element={
          <ProtectedRoute requiredPermission="DASHBOARD"><Dashboard /></ProtectedRoute>
        } />
        
        {/* Module 1: Produits */}
        <Route path="produits" element={
          <ProtectedRoute requiredPermission="PRODUITS"><Produits /></ProtectedRoute>
        } />
        
        {/* Module 2: Commandes */}
        <Route path="commandes" element={
          <ProtectedRoute requiredPermission="COMMANDES"><Commandes /></ProtectedRoute>
        } />
        
        {/* Module 3: Centre d'Appel */}
        <Route path="centre-appel" element={
          <ProtectedRoute requiredPermission="CENTRE_APPEL"><CentreAppel /></ProtectedRoute>
        } />
        
        {/* Module 4: Logistique */}
        <Route path="logistique" element={
          <ProtectedRoute requiredPermission="LOGISTIQUE"><Logistique /></ProtectedRoute>
        } />
        
        {/* Module 5: Livraison */}
        <Route path="livraison" element={
          <ProtectedRoute requiredPermission="LIVREUR"><Livraison /></ProtectedRoute>
        } />
        
        {/* Module 6: Caisse */}
        <Route path="caisse" element={
          <ProtectedRoute requiredPermission="CAISSE"><Caisse /></ProtectedRoute>
        } />

        {/* Financial Report */}
        <Route path="rapport-financier" element={
          <ProtectedRoute requiredPermission="ADMIN"><FinancialReport /></ProtectedRoute>
        } />

        {/* Historique et Impression */}
        <Route path="historique" element={
          <ProtectedRoute requiredPermission="HISTORIQUE"><Historique /></ProtectedRoute>
        } />

        {/* CRM Web - Clients */}
        <Route path="clients" element={
          <ProtectedRoute requiredPermission="CLIENTS"><Clients /></ProtectedRoute>
        } />

        {/* Staff Performance */}
        <Route path="performance-staff" element={
          <ProtectedRoute requiredPermission="GESTION_LIVREURS"><StaffPerformance /></ProtectedRoute>
        } />

        {/* Net Profit & Expenses */}
        <Route path="net-profit" element={
          <ProtectedRoute requiredPermission="ADMIN"><NetProfit /></ProtectedRoute>
        } />

        {/* Profil Route */}
        <Route path="profil" element={
          <ProtectedRoute requiredPermission="PROFIL"><Profil /></ProtectedRoute>
        } />
      </Route>

      <Route path="/login" element={<Login />} />
    </Routes>
  );
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
