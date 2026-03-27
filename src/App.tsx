import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Produits = lazy(() => import('./pages/Produits').then(m => ({ default: m.Produits })));
const Commandes = lazy(() => import('./pages/Commandes').then(m => ({ default: m.Commandes })));
const CentreAppel = lazy(() => import('./pages/CentreAppel').then(m => ({ default: m.CentreAppel })));
const Logistique = lazy(() => import('./pages/Logistique').then(m => ({ default: m.Logistique })));
const Livraison = lazy(() => import('./pages/Livraison').then(m => ({ default: m.Livraison })));
const Historique = lazy(() => import('./pages/Historique').then(m => ({ default: m.Historique })));
const Caisse = lazy(() => import('./pages/Caisse').then(m => ({ default: m.Caisse })));
const Clients = lazy(() => import('./pages/Clients').then(m => ({ default: m.Clients })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const Profil = lazy(() => import('./pages/Profil').then(m => ({ default: m.Profil })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
import { FinancialReport } from './pages/FinancialReport';
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const StaffPerformance = lazy(() => import('./pages/StaffPerformance').then(m => ({ default: m.StaffPerformance })));
const NetProfit = lazy(() => import('./pages/NetProfit').then(m => ({ default: m.NetProfit })));
const AdminTresorerie = lazy(() => import('./pages/AdminTresorerie').then(m => ({ default: m.AdminTresorerie })));
const AuditTresorerie = lazy(() => import('./pages/AuditTresorerie').then(m => ({ default: m.AuditTresorerie })));

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', padding: '5rem' }}>
    <div className="spinner"></div>
  </div>
);

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
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
