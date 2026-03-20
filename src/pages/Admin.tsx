import { useState, useEffect } from 'react';
import { User, Commune } from '../types';
import { getAdminUsers, createAdminUser, updateAdminUser, getCommunes, createCommune, updateCommune, deleteCommune } from '../services/adminService';
import { Plus, Trash2, Users, Map } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { insforge } from '../lib/insforge';

export const Admin = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'utilisateurs' | 'communes'>('utilisateurs');

  return (
    <div className="container">
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Administration</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>Gestion globale du système.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', padding: '0.25rem', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '12px', width: 'fit-content' }}>
        <button 
          className={`btn ${activeTab === 'utilisateurs' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('utilisateurs')}
          style={{ 
            backgroundColor: activeTab === 'utilisateurs' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'utilisateurs' ? '#fff' : 'var(--text-secondary)',
            border: 'none', padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <Users size={18} /> Utilisateurs
        </button>
        <button 
          className={`btn ${activeTab === 'communes' ? 'btn-primary' : ''}`}
          onClick={() => setActiveTab('communes')}
          style={{ 
            backgroundColor: activeTab === 'communes' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'communes' ? '#fff' : 'var(--text-secondary)',
            border: 'none', padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <Map size={18} /> Communes
        </button>
      </div>

      <div className="card" style={{ padding: '0' }}>
        {activeTab === 'utilisateurs' ? <UsersManager showToast={showToast} /> : <CommunesManager showToast={showToast} />}
      </div>
    </div>
  );
};

// --- USERS MANAGER COMPONENT ---
const UsersManager = ({ showToast }: { showToast: any }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<User>>({});

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getAdminUsers();
      setUsers(data || []);
    } catch (e) {
      showToast("Erreur chargement.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);
  const handleSave = async () => {
    const isLivreur = form?.role === 'LIVREUR';
    const email = isLivreur ? `${form.telephone}@livreur.com` : form.email;
    const password = isLivreur ? form.telephone : (form.password || 'Admin123!');

    if (!form?.nom_complet || !email || !form?.role || (isLivreur && !form.telephone)) {
      showToast("Champs obligatoires manquants (Nom et Téléphone pour un livreur).", "error"); return;
    }

    setLoading(true);
    try {
      if (editingId === 'new') {
        const { data: authData, error } = await insforge.auth.signUp({ 
          email: email as string, 
          password: password as string
        });
        if (error) throw error;
        if (!authData?.user?.id) throw new Error("Erreur lors de la création du compte Auth.");
        
        await createAdminUser({
          nom_complet: form.nom_complet || '',
          email: email as string,
          role: form.role as any,
          telephone: form.telephone || '',
          actif: true
        }, authData.user.id);
      } else if (editingId) {
        await updateAdminUser(editingId, form);
      }
      showToast("Enregistré.", "success");
      setEditingId(null); setForm({}); loadUsers();
    } catch (e: any) { 
      showToast(e.message || "Erreur.", "error"); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Utilisateurs</h3>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditingId('new'); setForm({ role: 'LIVREUR', actif: true }); }}>
          <Plus size={16} /> Ajouter
        </button>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email / Tel</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(editingId === 'new') && (
              <tr style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}>
                <td><input className="form-input" placeholder="Nom Complet *" value={form?.nom_complet || ''} onChange={e => setForm({...form, nom_complet: e.target.value})} /></td>
                <td>
                  {form.role === 'LIVREUR' ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Identifiants auto-générés via Tel</div>
                  ) : (
                    <input className="form-input" placeholder="Email *" value={form?.email || ''} onChange={e => setForm({...form, email: e.target.value})} />
                  )}
                  <input className="form-input" placeholder="Numéro Téléphone *" style={{ marginTop: '0.25rem' }} value={form?.telephone || ''} onChange={e => setForm({...form, telephone: e.target.value})} />
                </td>
                <td>
                  <select className="form-select" value={form?.role || 'LIVREUR'} onChange={e => setForm({...form, role: e.target.value as any})}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="GESTIONNAIRE">GESTIONNAIRE</option>
                    <option value="AGENT_APPEL">AGENT APPEL</option>
                    <option value="LOGISTIQUE">LOGISTIQUE</option>
                    <option value="LIVREUR">LIVREUR</option>
                    <option value="CAISSIERE">CAISSIÈRE</option>
                  </select>
                </td>
                <td>-</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" disabled={loading} onClick={handleSave}>Enregistrer</button>
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.25rem' }} onClick={() => setEditingId(null)}>Annuler</button>
                </td>
              </tr>
            )}
            {users.map(u => editingId === u.id ? (
              <tr key={u.id} style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}>
                <td><input className="form-input" value={form?.nom_complet || ''} onChange={e => setForm({...form, nom_complet: e.target.value})} /></td>
                <td>
                  <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>{u.email}</div>
                  <input className="form-input" placeholder="Tel" value={form?.telephone || ''} onChange={e => setForm({...form, telephone: e.target.value})} />
                </td>
                <td>
                  <select className="form-select" value={form?.role || 'LIVREUR'} onChange={e => setForm({...form, role: e.target.value as any})}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="GESTIONNAIRE">GESTIONNAIRE</option>
                    <option value="AGENT_APPEL">AGENT APPEL</option>
                    <option value="LOGISTIQUE">LOGISTIQUE</option>
                    <option value="LIVREUR">LIVREUR</option>
                    <option value="CAISSIERE">CAISSIÈRE</option>
                  </select>
                </td>
                <td>
                  <select className="form-select" value={form?.actif ? 'true' : 'false'} onChange={e => setForm({...form, actif: e.target.value === 'true'})}>
                    <option value="true">Actif</option>
                    <option value="false">Bloqué</option>
                  </select>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" disabled={loading} onClick={handleSave}>Sauver</button>
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.25rem' }} onClick={() => setEditingId(null)}>X</button>
                </td>
              </tr>
            ) : (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.nom_complet}</td>
                <td>
                  {u.email?.endsWith('@livreur.com') ? (
                    <div style={{ color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 500 }}>Compte Tel</div>
                  ) : (
                    <div>{u.email}</div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.telephone || '-'}</div>
                </td>
                <td><span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{u.role}</span></td>
                <td>
                  <span className={`badge ${u.actif !== false ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                    {u.actif !== false ? 'Actif' : 'Bloqué'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => {setEditingId(u.id); setForm(u);}}>Modifier</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- COMMUNES MANAGER COMPONENT ---
const CommunesManager = ({ showToast }: { showToast: any }) => {
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Commune>>({});

  const loadCommunes = async () => {
    setLoading(true);
    try {
      const data = await getCommunes();
      setCommunes(data || []);
    } catch (e) { showToast("Erreur.", "error"); } finally { setLoading(false); }
  };

  useEffect(() => { loadCommunes(); }, []);

  const handleSave = async () => {
    if (!form?.nom || typeof form?.tarif_livraison !== 'number') {
       showToast("Nom et Tarif requis.", "error"); return;
    }
    setLoading(true);
    try {
      if (editingId === 'new') await createCommune(form as Omit<Commune, 'id'>);
      else if (editingId) await updateCommune(editingId, form);
      showToast("Zone sauvée.", "success");
      setEditingId(null); setForm({}); loadCommunes();
    } catch (e: any) { showToast(e.message || "Erreur.", "error"); } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if(window.confirm("Supprimer ?")) {
       try { await deleteCommune(id); showToast("Supprimé."); loadCommunes(); } catch (e) { showToast("Erreur."); }
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Zones & Tarifs</h3>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditingId('new'); setForm({ tarif_livraison: 1500 }); }}>
          <Plus size={16} /> Ajouter
        </button>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Zone / Commune</th>
              <th>Tarif (CFA)</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
             {editingId === 'new' && (
              <tr style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}>
                <td><input className="form-input" placeholder="Nom" value={form?.nom || ''} onChange={e => setForm({...form, nom: e.target.value})} /></td>
                <td><input className="form-input" type="number" value={form?.tarif_livraison ?? ''} onChange={e => setForm({...form, tarif_livraison: e.target.value === '' ? '' : Number(e.target.value)} as any)} /></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" disabled={loading} onClick={handleSave}>OK</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Annuler</button>
                </td>
              </tr>
            )}
            {communes.map(c => editingId === c.id ? (
              <tr key={c.id} style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}>
                <td><input className="form-input" value={form?.nom || ''} onChange={e => setForm({...form, nom: e.target.value})} /></td>
                <td><input className="form-input" type="number" value={form?.tarif_livraison ?? ''} onChange={e => setForm({...form, tarif_livraison: e.target.value === '' ? '' : Number(e.target.value)} as any)} /></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" disabled={loading} onClick={handleSave}>Sauver</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>X</button>
                </td>
              </tr>
            ) : (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.nom}</td>
                <td style={{ color: 'var(--primary-color)', fontWeight: 700 }}>{c.tarif_livraison?.toLocaleString()} CFA</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => {setEditingId(c.id); setForm(c);}}>Modifier</button>
                  <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger-color)', marginLeft: '0.5rem' }} onClick={() => handleDelete(c.id)}><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
            {communes.length === 0 && editingId !== 'new' && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Aucune zone configurée.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
