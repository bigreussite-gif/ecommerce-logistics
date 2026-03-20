import { useState, useEffect } from 'react';
import { User, Commune } from '../types';
import { getAdminUsers, createAdminUser, updateAdminUser, getCommunes, createCommune, updateCommune, deleteCommune } from '../services/adminService';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const Admin = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'utilisateurs' | 'communes'>('utilisateurs');

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Administration</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Gestion globale des Utilisateurs et Tarifs de livraison.</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
        <button 
          className={`btn ${activeTab === 'utilisateurs' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('utilisateurs')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px', borderBottom: activeTab === 'utilisateurs' ? 'none' : '' }}
        >
          🧑‍💼 Utilisateurs
        </button>
        <button 
          className={`btn ${activeTab === 'communes' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('communes')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: '-1px', borderBottom: activeTab === 'communes' ? 'none' : '' }}
        >
          📍 Communes & Tarifs
        </button>
      </div>

      <div className="card">
        {activeTab === 'utilisateurs' ? <UsersManager showToast={showToast} /> : <CommunesManager showToast={showToast} />}
      </div>
    </div>
  );
};

// --- USERS MANAGER COMPONENT ---
const UsersManager = ({ showToast }: { showToast: any }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  const loadUsers = async () => setUsers(await getAdminUsers());
  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    try {
      if (!editForm.nom_complet || !editForm.email || !editForm.password || !editForm.role) {
        showToast("Veuillez remplir tous les champs requis.", "error"); return;
      }
      await createAdminUser({
        nom_complet: editForm.nom_complet,
        email: editForm.email,
        password: editForm.password,
        role: editForm.role as any,
        actif: true
      });
      showToast("Utilisateur créé.", "success");
      setEditingId(null); setEditForm({}); loadUsers();
    } catch (e) { showToast("Erreur création.", "error"); }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateAdminUser(id, editForm);
      showToast("Utilisateur mis à jour.", "success");
      setEditingId(null); setEditForm({}); loadUsers();
    } catch (e) { showToast("Erreur modification.", "error"); }
  };

  const handleDeactivate = async (id: string, actif: boolean) => {
    if(window.confirm(actif ? "Désactiver cet utilisateur ?" : "Réactiver cet utilisateur ?")) {
       await updateAdminUser(id, { actif: !actif });
       showToast("Statut modifié.", "success");
       loadUsers();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Comptes Utilisateurs</h3>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditingId('new'); setEditForm({ role: 'LIVREUR' }); }}>
          <Plus size={16} /> Nouvel Utilisateur
        </button>
      </div>
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Nom Complet</th>
              <th>Email</th>
              <th>Mot de passe</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {editingId === 'new' && (
              <tr>
                <td><input className="form-input" placeholder="Nom" value={editForm.nom_complet || ''} onChange={e => setEditForm({...editForm, nom_complet: e.target.value})} /></td>
                <td><input className="form-input" type="email" placeholder="Email" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} /></td>
                <td><input className="form-input" type="text" placeholder="MD Passe" value={editForm.password || ''} onChange={e => setEditForm({...editForm, password: e.target.value})} /></td>
                <td>
                  <select className="form-select" value={editForm.role || 'LIVREUR'} onChange={e => setEditForm({...editForm, role: e.target.value as any})}>
                    <option value="ADMIN">Administrateur</option>
                    <option value="VENDEUR">Vendeur / Call Center</option>
                    <option value="CAISSIER">Caissier / Entrepôt</option>
                    <option value="LIVREUR">Livreur</option>
                  </select>
                </td>
                <td>Actif</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleCreate}><Save size={16}/></button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}><X size={16}/></button>
                </td>
              </tr>
            )}
            {users.map(u => editingId === u.id ? (
              <tr key={u.id}>
                <td><input className="form-input" value={editForm.nom_complet || ''} onChange={e => setEditForm({...editForm, nom_complet: e.target.value})} /></td>
                <td><input className="form-input" type="email" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} /></td>
                <td><input className="form-input" type="text" value={editForm.password || ''} onChange={e => setEditForm({...editForm, password: e.target.value})} /></td>
                <td>
                  <select className="form-select" value={editForm.role || 'LIVREUR'} onChange={e => setEditForm({...editForm, role: e.target.value as any})}>
                    <option value="ADMIN">Administrateur</option>
                    <option value="VENDEUR">Vendeur / Call Center</option>
                    <option value="CAISSIER">Caissier / Entrepôt</option>
                    <option value="LIVREUR">Livreur</option>
                  </select>
                </td>
                <td>{u.actif === false ? 'Bloqué' : 'Actif'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(u.id)}><Save size={16}/></button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}><X size={16}/></button>
                </td>
              </tr>
            ) : (
              <tr key={u.id}>
                <td>{u.nom_complet}</td>
                <td>{u.email}</td>
                <td style={{ color: 'var(--text-secondary)' }}>••••••••</td>
                <td><span className="badge badge-info">{u.role}</span></td>
                <td>
                  <span className={`badge ${u.actif !== false ? 'badge-success' : 'badge-danger'}`}>
                    {u.actif !== false ? '✅ Actif' : '⛔ Bloqué'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => {setEditingId(u.id); setEditForm(u);}}><Edit size={16}/></button>
                  <button className="btn btn-outline btn-sm" style={{ color: u.actif !== false ? 'var(--danger-color)' : 'var(--success-color)' }} onClick={() => handleDeactivate(u.id, u.actif !== false)}>
                    {u.actif !== false ? 'Bloquer' : 'Activer'}
                  </button>
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Commune>>({});

  const loadCommunes = async () => setCommunes(await getCommunes());
  useEffect(() => { loadCommunes(); }, []);

  const handleCreate = async () => {
    if (!editForm.nom || typeof editForm.tarif_livraison !== 'number') {
       showToast("Champ 'Nom' et 'Tarif' obligatoires.", "error"); return;
    }
    await createCommune(editForm as Omit<Commune, 'id'>);
    showToast("Commune créée.", "success");
    setEditingId(null); setEditForm({}); loadCommunes();
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.nom || typeof editForm.tarif_livraison !== 'number') {
       showToast("Veuillez renseigner un Nom valide et un Tarif.", "error"); return;
    }
    await updateCommune(id, editForm);
    showToast("Commune mise à jour.", "success");
    setEditingId(null); setEditForm({}); loadCommunes();
  };

  const handleDelete = async (id: string) => {
    if(window.confirm("Êtes-vous sûr de supprimer cette commune définitivement ?")) {
       await deleteCommune(id);
       showToast("Commune supprimée.", "success");
       loadCommunes();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Zones & Tarifs par défaut</h3>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditingId('new'); setEditForm({ tarif_livraison: 1500 }); }}>
          <Plus size={16} /> Nouvelle Zone
        </button>
      </div>
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table style={{ maxWidth: '600px' }}>
          <thead>
            <tr>
              <th>Nom de la Commune / Quartier</th>
              <th>Tarif Livraison standard (CFA)</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
             {editingId === 'new' && (
              <tr>
                <td><input className="form-input" placeholder="ex: Cocody, Yopougon..." value={editForm.nom || ''} onChange={e => setEditForm({...editForm, nom: e.target.value})} /></td>
                <td><input className="form-input" type="number" value={editForm.tarif_livraison ?? ''} onChange={e => setEditForm({...editForm, tarif_livraison: e.target.value === '' ? '' : Number(e.target.value)} as any)} /></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleCreate}><Save size={16}/></button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}><X size={16}/></button>
                </td>
              </tr>
            )}
            {communes.map(c => editingId === c.id ? (
              <tr key={c.id}>
                <td><input className="form-input" value={editForm?.nom || ''} onChange={e => setEditForm({...editForm, nom: e.target.value})} /></td>
                <td><input className="form-input" type="number" value={editForm?.tarif_livraison ?? ''} onChange={e => setEditForm({...editForm, tarif_livraison: e.target.value === '' ? '' : Number(e.target.value)} as any)} /></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(c.id)}><Save size={16}/></button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}><X size={16}/></button>
                </td>
              </tr>
            ) : (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.nom}</td>
                <td>{c.tarif_livraison.toLocaleString()} CFA</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => {setEditingId(c.id); setEditForm(c);}}><Edit size={16}/></button>
                  <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger-color)' }} onClick={() => handleDelete(c.id)}><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
            {communes.length === 0 && editingId !== 'new' && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Aucune commune configurée.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
