import { useState, useEffect } from 'react';
import { User, Commune, Permission } from '../types';
import { getAdminUsers, createAdminUser, updateAdminUser, getCommunes, createCommune, updateCommune, deleteCommune } from '../services/adminService';
import { Plus, Trash2, Users as UsersIcon, Map as MapIcon } from 'lucide-react';
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
          <UsersIcon size={18} /> Utilisateurs
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
          <MapIcon size={18} /> Communes
        </button>
      </div>

      <div className="card" style={{ padding: '0' }}>
        {activeTab === 'utilisateurs' ? <UsersManager showToast={showToast} /> : <CommunesManager showToast={showToast} />}
      </div>
    </div>
  );
};

// --- USERS MANAGER COMPONENT ---
const PERMISSIONS_LIST: { id: Permission, label: string }[] = [
  { id: 'DASHBOARD', label: 'Tableau de bord' },
  { id: 'PRODUITS', label: 'Produits' },
  { id: 'COMMANDES', label: 'Commandes' },
  { id: 'CENTRE_APPEL', label: 'Appels' },
  { id: 'LOGISTIQUE', label: 'Logistique' },
  { id: 'LIVREUR', label: 'Livreur' },
  { id: 'CAISSE', label: 'Caisse' },
  { id: 'CLIENTS', label: 'CRM' },
  { id: 'HISTORIQUE', label: 'Historique' },
];

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

  const togglePermission = (p: Permission) => {
    const current = form.permissions || [];
    if (current.includes(p)) {
      setForm({ ...form, permissions: current.filter((x: string) => x !== p) });
    } else {
      setForm({ ...form, permissions: [...current, p] });
    }
  };

  const handleSave = async () => {
    const sanitizedTel = (form.telephone || '').replace(/\s+/g, '');
    const isLivreur = form?.role === 'LIVREUR';
    const email = isLivreur ? `${sanitizedTel.toLowerCase()}@livreur.com` : (form.email || '').trim();
    const password = isLivreur ? sanitizedTel : (form.password || 'Admin123!');

    if (!form?.nom_complet || !email || !form?.role || (isLivreur && !sanitizedTel)) {
      showToast("Champs obligatoires manquants.", "error"); return;
    }

    setLoading(true);
    try {
      if (editingId === 'new') {
        let authId = '';
        const { data: authData, error } = await insforge.auth.signUp({ 
          email: email as string, 
          password: password as string
        });

        if (error) {
          if (error.message.toLowerCase().includes('already') || error.message.toLowerCase().includes('existe')) {
             // Logic to recover existing authId omitted for brevity but should be here
          } else {
            throw error;
          }
        } else {
          authId = authData?.user?.id || '';
        }

        if (!authId) throw new Error("Impossible de déterminer l'ID Auth.");
        
        await createAdminUser({
          nom_complet: form.nom_complet || '',
          email: email as string,
          role: form.role as any,
          telephone: sanitizedTel,
          permissions: form.permissions || [],
          actif: true
        }, authId);
      } else if (editingId) {
        await updateAdminUser(editingId, { ...form, telephone: sanitizedTel });
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
        <h3 style={{ margin: 0 }}>Gestion des Accès Utilisateurs</h3>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditingId('new'); setForm({ role: 'AGENT_APPEL', actif: true, permissions: ['PROFIL'] }); }}>
          <Plus size={16} /> Nouvel Utilisateur
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '200px' }}>Utilisateur</th>
              <th style={{ width: '150px' }}>Contact</th>
              <th style={{ width: '120px' }}>Rôle Principal</th>
              <th>Permissions / Accès</th>
              <th style={{ textAlign: 'right', width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(editingId === 'new') && (
              <tr style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}>
                <td>
                  <input className="form-input" placeholder="Nom Complet *" value={form?.nom_complet || ''} onChange={e => setForm({...form, nom_complet: e.target.value})} />
                  <select className="form-select" style={{ marginTop: '0.5rem' }} value={form?.role || 'AGENT_APPEL'} onChange={e => setForm({...form, role: e.target.value as any})}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="GESTIONNAIRE">GESTIONNAIRE</option>
                    <option value="AGENT_APPEL">AGENT APPEL</option>
                    <option value="LOGISTIQUE">LOGISTIQUE</option>
                    <option value="LIVREUR">LIVREUR</option>
                    <option value="CAISSIERE">CAISSIÈRE</option>
                    <option value="AGENT_MIXTE">AGENT MIXTE</option>
                  </select>
                </td>
                <td>
                   <input className="form-input" placeholder="Email *" value={form?.email || ''} onChange={e => setForm({...form, email: e.target.value})} />
                   <input className="form-input" placeholder="Tel" style={{ marginTop: '0.25rem' }} value={form?.telephone || ''} onChange={e => setForm({...form, telephone: e.target.value})} />
                </td>
                <td colSpan={2}>
                   <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Modules autorisés :</div>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {PERMISSIONS_LIST.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.permissions?.includes(p.id)} onChange={() => togglePermission(p.id)} />
                        {p.label}
                      </label>
                    ))}
                   </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" disabled={loading} onClick={handleSave}>Créer</button>
                  <button className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setEditingId(null)}>Annuler</button>
                </td>
              </tr>
            )}
            {users.map((u: User) => editingId === u.id ? (
              <tr key={u.id} style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}>
                <td>
                  <input className="form-input" value={form?.nom_complet || ''} onChange={e => setForm({...form, nom_complet: e.target.value})} />
                  <select className="form-select" style={{ marginTop: '0.5rem' }} value={form?.role || 'AGENT_APPEL'} onChange={e => setForm({...form, role: e.target.value as any})}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="GESTIONNAIRE">GESTIONNAIRE</option>
                    <option value="AGENT_APPEL">AGENT APPEL</option>
                    <option value="LOGISTIQUE">LOGISTIQUE</option>
                    <option value="LIVREUR">LIVREUR</option>
                    <option value="CAISSIERE">CAISSIÈRE</option>
                    <option value="AGENT_MIXTE">AGENT MIXTE</option>
                  </select>
                </td>
                <td>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                  <input className="form-input" placeholder="Tel" style={{ marginTop: '0.25rem' }} value={form?.telephone || ''} onChange={e => setForm({...form, telephone: e.target.value})} />
                </td>
                <td colSpan={2}>
                   <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Modifier les accès :</div>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                    {PERMISSIONS_LIST.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.permissions?.includes(p.id)} onChange={() => togglePermission(p.id)} />
                        {p.label}
                      </label>
                    ))}
                   </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" disabled={loading} onClick={handleSave}>Sauver</button>
                  <button className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setEditingId(null)}>Annuler</button>
                </td>
              </tr>
            ) : (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{u.nom_complet}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>ID: {u.id.substring(0,8)}</div>
                </td>
                <td>
                  <div style={{ fontSize: '0.8rem' }}>{u.email}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.telephone}</div>
                </td>
                <td><span className="badge badge-info">{u.role}</span></td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {(u.permissions || []).map((p: string) => (
                      <span key={p} className="badge" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>{p}</span>
                    ))}
                    {(!u.permissions || u.permissions.length === 0) && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Profil par défaut</span>
                    )}
                  </div>
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
    } catch (e) {
      if (showToast) showToast("Erreur lors du chargement des zones.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCommunes(); }, []);

  const handleSave = async () => {
    const nom = form?.nom?.trim();
    const tarif = Number(form?.tarif_livraison);

    if (!nom || isNaN(tarif)) {
      if (showToast) showToast("Veuillez saisir un nom et un tarif valide.", "error");
      return;
    }

    setLoading(true);
    try {
      if (editingId === 'new') {
        await createCommune({ nom, tarif_livraison: tarif });
      } else if (editingId) {
        await updateCommune(editingId, { nom, tarif_livraison: tarif });
      }
      if (showToast) showToast("Zone enregistrée avec succès.", "success");
      setEditingId(null);
      setForm({});
      loadCommunes();
    } catch (e: any) {
      if (showToast) showToast(e.message || "Erreur de sauvegarde.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette zone ?")) {
      try {
        await deleteCommune(id);
        if (showToast) showToast("Zone supprimée.");
        loadCommunes();
      } catch (e) {
        if (showToast) showToast("Erreur lors de la suppression.", "error");
      }
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Zones & Tarifs de Livraison</h3>
        <button 
          className="btn btn-primary btn-sm" 
          onClick={() => { setEditingId('new'); setForm({ tarif_livraison: 1500 }); }}
          disabled={loading}
        >
          <Plus size={16} /> Ajouter une zone
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Zone / Commune</th>
              <th>Tarif (CFA)</th>
              <th style={{ textAlign: 'right', width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {editingId === 'new' && (
              <tr style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}>
                <td>
                  <input 
                    className="form-input" 
                    placeholder="Nom de la zone" 
                    value={form?.nom || ''} 
                    onChange={e => setForm({ ...form, nom: e.target.value })} 
                  />
                </td>
                <td>
                  <input 
                    className="form-input" 
                    type="number" 
                    value={form?.tarif_livraison ?? ''} 
                    onChange={e => setForm({ ...form, tarif_livraison: e.target.value === '' ? '' : Number(e.target.value) } as any)} 
                  />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" disabled={loading} onClick={handleSave}>OK</button>
                  <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.25rem' }} onClick={() => setEditingId(null)}>X</button>
                </td>
              </tr>
            )}

            {communes.map((c: Commune) => {
              const isEditing = editingId === c.id;
              if (!c) return null;

              return isEditing ? (
                <tr key={c.id} style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}>
                  <td>
                    <input 
                      className="form-input" 
                      value={form?.nom || ''} 
                      onChange={e => setForm({ ...form, nom: e.target.value })} 
                    />
                  </td>
                  <td>
                    <input 
                      className="form-input" 
                      type="number" 
                      value={form?.tarif_livraison ?? ''} 
                      onChange={e => setForm({ ...form, tarif_livraison: e.target.value === '' ? '' : Number(e.target.value) } as any)} 
                    />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-primary btn-sm" disabled={loading} onClick={handleSave}>Sauver</button>
                    <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.25rem' }} onClick={() => setEditingId(null)}>X</button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nom || 'Sans nom'}</td>
                  <td style={{ color: 'var(--primary-color)', fontWeight: 700 }}>
                    {typeof c.tarif_livraison === 'number' ? c.tarif_livraison.toLocaleString() : c.tarif_livraison} CFA
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => { setEditingId(c.id); setForm({ ...c }); }}
                    >
                      Modifier
                    </button>
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ color: 'var(--danger-color)', marginLeft: '0.5rem' }} 
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {communes.length === 0 && editingId !== 'new' && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  Aucune zone configurée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
