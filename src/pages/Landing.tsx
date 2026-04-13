import { Link } from 'react-router-dom';
import { Package, Truck, Activity, ShieldCheck, Zap, ArrowRight, TrendingUp } from 'lucide-react';

export const Landing = () => {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>
      {/* Header */}
      <header style={{ padding: '1.5rem 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', position: 'fixed', top: 0, width: '100%', zIndex: 50, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 0 20px rgba(99, 102, 255, 0.4)' }}>
            <Package size={24} />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.04em' }}>GomboSwift</span>
        </div>
        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
           <Link to="/login" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', border: 'none', fontWeight: 800, textDecoration: 'none', color: 'white', boxShadow: '0 10px 25px -5px rgba(99, 102, 255, 0.4)' }}>
             SE CONNECTER
           </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section style={{ paddingTop: '8rem', paddingBottom: '5rem', paddingLeft: '5%', paddingRight: '5%', minHeight: '90vh', display: 'flex', alignItems: 'center', position: 'relative' }}>
        {/* Background Blobs */}
        <div style={{ position: 'absolute', top: '10%', right: '10%', width: '500px', height: '500px', background: 'var(--primary)', filter: 'blur(150px)', opacity: 0.15, borderRadius: '50%', zIndex: 0 }}></div>
        <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: '400px', height: '400px', background: '#a855f7', filter: 'blur(150px)', opacity: 0.15, borderRadius: '50%', zIndex: 0 }}></div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '4rem', alignItems: 'center', position: 'relative', zIndex: 10 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(99, 102, 255, 0.1)', border: '1px solid rgba(99, 102, 255, 0.2)', borderRadius: '100px', marginBottom: '1.5rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 10px #6366f1' }}></span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#818cf8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Logistique Next-Gen</span>
            </div>
            <h1 style={{ fontSize: 'clamp(3rem, 6vw, 4.5rem)', fontWeight: 950, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
              L'écosystème <br />
              <span style={{ background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>complet de</span><br />
              votre e-commerce.
            </h1>
            <p style={{ fontSize: '1.1rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '2.5rem', maxWidth: '500px' }}>
              Gérez votre stock, pilotez vos coursiers, suivez votre chiffre d'affaires et optimisez votre rentabilité avec GomboSwift. Le centre de contrôle ultime.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/login" className="btn" style={{ padding: '1rem 2rem', borderRadius: '16px', background: 'white', color: '#0f172a', fontWeight: 900, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem' }}>
                ACCÉDER AU LOGICIEL <ArrowRight size={20} />
              </Link>
            </div>
          </div>

          {/* Hero Visual */}
          <div style={{ position: 'relative' }}>
             <div style={{ background: 'linear-gradient(145deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.8) 100%)', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                   <div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profit Réel Net</h4>
                      <h2 style={{ margin: '0.5rem 0 0', fontSize: '2.5rem', fontWeight: 900, color: 'white' }}>1,240,500 <span style={{ fontSize: '1.2rem', color: '#64748b' }}>CFA</span></h2>
                   </div>
                   <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.5rem 1rem', borderRadius: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <TrendingUp size={18} /> +24%
                   </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                   <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Activity size={20} color="#818cf8" style={{ marginBottom: '0.5rem' }} />
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Succès Livraison</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>89.5%</div>
                   </div>
                   <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <Truck size={20} color="#c084fc" style={{ marginBottom: '0.5rem' }} />
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Colis en transit</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>142</div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '5rem 5%', background: '#0b1121' }}>
         <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
               <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem' }}>Fonctionnalités "Elite"</h2>
               <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>Une suite d'outils puissants conçus pour maximiser vos marges et éliminer les frictions.</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
               {[
                 { icon: ShieldCheck, title: 'Sécurité & Contrôle Caissière', desc: 'Gestion stricte des encaissements et retours avec audit financier quotidien.', color: '#10b981' },
                 { icon: Zap, title: 'Call Center Intégré', desc: 'Qualification des commandes en temps réel pour réduire les échecs de livraison.', color: '#f59e0b' },
                 { icon: TrendingUp, title: 'Dashboard Trésorerie Privé', desc: 'Analyse approfondie du profit (COGS, ROI Ads) réservée uniquement à la direction.', color: '#8b5cf6' }
               ].map((f, i) => (
                 <div key={i} style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.05)', padding: '2rem', borderRadius: '24px', transition: 'transform 0.3s' }}>
                    <div style={{ width: '50px', height: '50px', background: `${f.color}15`, color: f.color, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                       <f.icon size={24} />
                    </div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem' }}>{f.title}</h3>
                    <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>{f.desc}</p>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '3rem 5%', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', color: '#64748b' }}>
         <p style={{ margin: 0, fontWeight: 600 }}>© {new Date().getFullYear()} GomboSwift. Tous droits réservés.</p>
         <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Conçu pour l'excellence logistique et la rentabilité.</p>
      </footer>
    </div>
  );
};
