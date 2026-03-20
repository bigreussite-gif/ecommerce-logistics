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

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { currentUser, hasRole } = useAuth();
  
  if (!currentUser) return <Navigate to="/login" replace />;
  // @ts-ignore
  if (!hasRole(allowedRoles)) return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Admin Page */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN']}><Admin /></ProtectedRoute>
        } />

        {/* Admin Dashboard */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['ADMIN']}><Dashboard /></ProtectedRoute>
        } />
        
        {/* Module 1: Produits */}
        <Route path="produits" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'GESTIONNAIRE']}><Produits /></ProtectedRoute>
        } />
        
        {/* Module 2: Commandes */}
        <Route path="commandes" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'GESTIONNAIRE', 'AGENT_APPEL', 'LOGISTIQUE']}><Commandes /></ProtectedRoute>
        } />
        
        {/* Module 3: Centre d'Appel */}
        <Route path="centre-appel" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'AGENT_APPEL']}><CentreAppel /></ProtectedRoute>
        } />
        
        {/* Module 4: Logistique */}
        <Route path="logistique" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'LOGISTIQUE']}><Logistique /></ProtectedRoute>
        } />
        
        {/* Module 5: Livraison */}
        <Route path="livraison" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'LIVREUR']}><Livraison /></ProtectedRoute>
        } />
        
        {/* Module 6: Caisse */}
        <Route path="caisse" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'CAISSIERE']}><Caisse /></ProtectedRoute>
        } />

        {/* Historique et Impression */}
        <Route path="historique" element={
          <ProtectedRoute allowedRoles={['ADMIN']}><Historique /></ProtectedRoute>
        } />

        {/* CRM Web - Clients */}
        <Route path="clients" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'GESTIONNAIRE', 'AGENT_APPEL']}><Clients /></ProtectedRoute>
        } />

        {/* Profil Route */}
        <Route path="profil" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'GESTIONNAIRE', 'AGENT_APPEL', 'LOGISTIQUE', 'LIVREUR', 'CAISSIERE']}><Profil /></ProtectedRoute>
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
