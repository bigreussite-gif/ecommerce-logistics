import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';

// --- Lazy Loading for Performance Optimization ---
// --- Lazy Loading Utility with Automatic Retry/Reload ---
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  React.lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        return window.location.reload();
      }
      throw error;
    }
  });

const Dashboard = lazyWithRetry(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Produits = lazyWithRetry(() => import('./pages/Produits').then(m => ({ default: m.Produits })));
const Commandes = lazyWithRetry(() => import('./pages/Commandes').then(m => ({ default: m.Commandes })));
const CentreAppel = lazyWithRetry(() => import('./pages/CentreAppel').then(m => ({ default: m.CentreAppel })));
const Logistique = lazyWithRetry(() => import('./pages/Logistique').then(m => ({ default: m.Logistique })));
const Livraison = lazyWithRetry(() => import('./pages/Livraison').then(m => ({ default: m.Livraison })));
const Historique = lazyWithRetry(() => import('./pages/Historique').then(m => ({ default: m.Historique })));
const Caisse = lazyWithRetry(() => import('./pages/Caisse').then(m => ({ default: m.Caisse })));
const Clients = lazyWithRetry(() => import('./pages/Clients').then(m => ({ default: m.Clients })));
const Admin = lazyWithRetry(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Profil = lazyWithRetry(() => import('./pages/Profil').then(m => ({ default: m.Profil })));
const Login = lazyWithRetry(() => import('./pages/Login').then(m => ({ default: m.Login })));
const FinancialReport = lazyWithRetry(() => import('./pages/FinancialReport').then(m => ({ default: m.FinancialReport })));
const Home = lazyWithRetry(() => import('./pages/Home').then(m => ({ default: m.Home })));
const StaffPerformance = lazyWithRetry(() => import('./pages/StaffPerformance').then(m => ({ default: m.StaffPerformance })));
const NetProfit = lazyWithRetry(() => import('./pages/NetProfit').then(m => ({ default: m.NetProfit })));
const AdminTresorerie = lazyWithRetry(() => import('./pages/AdminTresorerie').then(m => ({ default: m.AdminTresorerie })));
const AuditTresorerie = lazyWithRetry(() => import('./pages/AuditTresorerie').then(m => ({ default: m.AuditTresorerie })));
const Retours = lazyWithRetry(() => import('./pages/Retours').then(m => ({ default: m.Retours })));
const Defaillants = lazyWithRetry(() => import('./pages/Defaillants').then(m => ({ default: m.Defaillants })));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', padding: '5rem' }}>
    <div className="spinner"></div>
  </div>
);

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
      const isChunkError = this.state.error?.toString().includes('Failed to fetch dynamically imported module');
      return (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#fef2f2', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ color: '#991b1b' }}>{isChunkError ? 'Mise à jour disponible' : 'Une erreur critique est survenue'}</h1>
          <p>{isChunkError ? 'Une nouvelle version de GomboSwift est prête. Veuillez recharger la page.' : 'L\'application a rencontré un problème inattendu.'}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: '1rem', padding: '0.75rem 2rem', borderRadius: '14px' }}>
            {isChunkError ? 'Mettre à jour maintenant' : 'Recharger l\'application'}
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

        <Route path="defaillants" element={
          <ProtectedRoute requiredPermission="LOGISTIQUE"><Defaillants /></ProtectedRoute>
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
