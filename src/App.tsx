import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';

// --- Direct Imports to prevent Lazy Loading crashes on Vercel Delta ---
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
import { AdminTresorerie } from './pages/AdminTresorerie';
import { AuditTresorerie } from './pages/AuditTresorerie';
import { Retours } from './pages/Retours';

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', padding: '5rem' }}>
    <div className="spinner"></div>
  </div>
);

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("React Error Boundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#fef2f2', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ color: '#991b1b' }}>Une erreur critique est survenue</h1>
          <p>L'application GomboSwift a rencontré un problème inattendu au rendu.</p>
          <pre style={{ background: '#fee2e2', padding: '1rem', borderRadius: '8px', overflow: 'auto', maxWidth: '90%', fontSize: '0.8rem' }}>
            {this.state.error?.toString()}
          </pre>
          <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children, requiredPermission }: { children: React.ReactNode, requiredPermission: string }) => {
  const { currentUser, hasPermission } = useAuth();
  
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!hasPermission(requiredPermission)) {
    console.warn(`Access denied for ${requiredPermission}`);
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        
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

        <Route path="retours-rma" element={
          <ProtectedRoute requiredPermission="LOGISTIQUE"><Retours /></ProtectedRoute>
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
          <ProtectedRoute requiredPermission="FINANCE"><FinancialReport /></ProtectedRoute>
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

        {/* Admin Treasury & Private Dashboard */}
        <Route path="admin/tresorerie" element={
          <ProtectedRoute requiredPermission="TRESORERIE"><AdminTresorerie /></ProtectedRoute>
        } />

        {/* Audit & Expertise Comptable */}
        <Route path="audit-tresorerie" element={
          <ProtectedRoute requiredPermission="ADMIN"><AuditTresorerie /></ProtectedRoute>
        } />

        {/* Profil Route */}
        <Route path="profil" element={
          <ProtectedRoute requiredPermission="PROFIL"><Profil /></ProtectedRoute>
        } />

        {/* Admin Page */}
        <Route path="admin" element={
          <ProtectedRoute requiredPermission="ADMIN"><Admin /></ProtectedRoute>
        } />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
