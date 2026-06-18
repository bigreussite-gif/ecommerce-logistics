import { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { createBulkCommandes } from '../../services/commandeService';

export const BulkImportModal = ({ onClose, onSave }: { onClose: () => void, onSave: () => void }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { read, utils } = await import('xlsx');
        const ab = e.target?.result as ArrayBuffer;
        const wb = read(ab, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const worksheet = wb.Sheets[sheetName];
        const data = utils.sheet_to_json(worksheet) as any[];

        // Normalize keys to lowercase to handle variations
        const normalizedData = data.map(item => {
          const newItem: any = {};
          Object.keys(item).forEach(key => {
            newItem[key.trim().toLowerCase()] = item[key];
          });
          return newItem;
        });

        // Map to our expected structure and group by phone
        const ordersMap = new Map<string, any>();
        
        const cleanValue = (val: any) => {
          if (!val) return '';
          const str = String(val).split('\n')[0].split('\r')[0].trim();
          return str;
        };

        normalizedData.forEach(item => {
          const phone = cleanValue(item.telephone || item['téléphone'] || item.phone || item.tel || '');
          if (!phone) return;

          const prodRef = cleanValue(item.reference || item['référence'] || item.ref || item['réf'] || item.sku || item.code || item.produit || item.article || item.item || '').toUpperCase();
          const qte = parseInt(item.quantite || item.qte || item['quantité'] || '1');

          if (ordersMap.has(phone)) {
            // Add line to existing order
            const existingOrder = ordersMap.get(phone);
            existingOrder.lines.push({ produit: prodRef, quantite: qte });
          } else {
            // Create new order entry
            ordersMap.set(phone, {
              client: {
                nom_complet: cleanValue(item.client || item.nom || item['nom complet'] || item.customer || ''),
                telephone: phone,
                telephone_secondaire: cleanValue(item['telephone 2'] || item['téléphone 2'] || item.telephone2 || item.tel2 || item['téléphone secondaire'] || item['telephone secondaire'] || item['numéro secondaire'] || item['numero secondaire'] || item['phone 2'] || item.phone2 || '')
              },
              lines: [
                { produit: prodRef, quantite: qte }
              ],
              source: 'Import Groupé',
              commune: cleanValue(item.commune || item.zone || item.ville || ''),
              quartier: cleanValue(item.quartier || item.secteur || ''),
              adresse: cleanValue(item.adresse || item.localisation || ''),
              notes: cleanValue(item.notes || item.commentaire || item.infos || ''),
              frais_livraison: parseInt(item.frais || item.livraison || item['frais livraison'] || '0')
            });
          }
        });

        setPreview(Array.from(ordersMap.values()));
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la lecture du fichier. Vérifiez le format (Excel .xlsx ou CSV).");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = async () => {
    const data = [
      {
        "Client": "Jean Dupont",
        "Téléphone": "0707070707",
        "Téléphone 2": "0101010101",
        "Commune": "Cocody",
        "Quartier": "Angré 8ème Tranche",
        "Adresse": "Bâtiment A, Porte 12",
        "Référence": "SAV-001",
        "Quantité": 2,
        "Notes": "Livraison matin"
      }
    ];
    const { utils, writeFile } = await import('xlsx');
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Modèle");
    writeFile(wb, "modele_importation_commandes.xlsx");
  };

  const handleSubmit = async () => {
    if (preview.length === 0) return;
    
    // Check stock avant de lancer l'import
    try {
      setLoading(true);
      const { getProduits } = await import('../../services/produitService');
      const catalogue = await getProduits();
      
      for (const order of preview) {
        for (const l of order.lines) {
          const prod = catalogue.find(p => p.sku?.toUpperCase() === l.produit?.toUpperCase());
          if (prod) {
            const dispo = prod.stock_disponible ?? prod.stock_actuel;
            if (l.quantite > dispo) {
              showToast(`Stock insuffisant pour "${prod.nom}" (${prod.sku}). Dispo : ${dispo}. Import annulé.`, "error");
              setLoading(false);
              return;
            }
          }
        }
      }
    } catch (e) {
      console.error("Erreur vérification stock:", e);
    }

    try {
      const result = await createBulkCommandes(preview);
      if (result.count > 0) {
        showToast(`${result.count} commandes importées avec succès ! [Ready]`, "success");
        onSave();
      } else {
        const errorMsg = result.error || "Aucune commande n'a été créée. Vérifiez que les références produits (SKU) existent bien dans votre catalogue.";
        showToast(`${errorMsg} [Ready]`, "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Erreur lors de l'importation groupée. Vérifiez vos données.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card" style={{ maxWidth: '850px', padding: '2.5rem' }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose} 
          style={{ 
            position: 'absolute', 
            top: '1.5rem', 
            right: '1.5rem', 
            background: '#f1f5f9', 
            border: 'none', 
            borderRadius: '12px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer', 
            color: 'var(--text-muted)'
          }}
        >
          <X size={20} strokeWidth={2.5} />
        </button>

        <div style={{ marginBottom: '2.5rem' }}>
          <h2 className="text-premium" style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Importation Excel / CSV</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.4rem', fontWeight: 500 }}>Automatisez la création de vos commandes en masse.</p>
        </div>

        {!file ? (
          <div 
            style={{ 
              border: '2px dashed #e2e8f0', 
              borderRadius: '24px', 
              padding: '4rem 2rem', 
              textAlign: 'center',
              background: '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const droppedFile = e.dataTransfer.files[0];
              if (droppedFile) {
                setFile(droppedFile);
                parseFile(droppedFile);
              }
            }}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input type="file" id="fileInput" hidden accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
            <div style={{ background: 'var(--primary)', color: 'white', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)' }}>
              <Upload size={32} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cliquez ou glissez votre fichier Excel/CSV</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Supporte les formats .xlsx, .xls et .csv</p>
            
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
              style={{ padding: '0.6rem 1.75rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 700 }}
            >
              <Download size={18} /> Télécharger le modèle Excel
            </button>
          </div>
        ) : (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: '#f0fdf4', borderRadius: '18px', border: '1px solid #bbf7d0', marginBottom: '2rem' }}>
              <div style={{ color: '#16a34a' }}><CheckCircle size={24} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#166534' }}>Fichier prêt : {file.name}</div>
                <div style={{ fontSize: '0.85rem', color: '#166534', opacity: 0.8 }}>{preview.length} commandes prêtes à l'import</div>
              </div>
              <button 
                onClick={() => { setFile(null); setPreview([]); }}
                style={{ background: 'transparent', border: 'none', color: '#166534', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                Changer
              </button>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: '#fef2f2', borderRadius: '18px', border: '1px solid #fecaca', marginBottom: '2rem', color: '#dc2626' }}>
                <AlertCircle size={24} />
                <div style={{ fontWeight: 600 }}>{error}</div>
              </div>
            )}

            <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '18px', border: '1px solid #e2e8f0', marginBottom: '2rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
              <div className="table-container">
<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Client</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Téléphone</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Zone / Quartier</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Adresse</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Référence</th>
                    <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Qté</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{item.client.nom_complet}</td>
                      <td style={{ padding: '1rem', color: '#475569' }}>
                        <div>{item.client.telephone}</div>
                        {item.client.telephone_secondaire && (
                          <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{item.client.telephone_secondaire}</div>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>{item.commune} {item.quartier ? `/ ${item.quartier}` : ''}</td>
                      <td style={{ padding: '1rem', fontSize: '0.75rem' }}>{item.adresse}</td>
                      <td style={{ padding: '1rem' }}><span style={{ padding: '0.3rem 0.6rem', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{item.lines[0].produit}</span></td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700 }}>{item.lines[0].quantite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                className="btn btn-outline" 
                onClick={onClose}
                style={{ padding: '0.8rem 2rem', borderRadius: '14px', fontWeight: 700 }}
              >
                Annuler
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSubmit}
                disabled={loading || preview.length === 0}
                style={{ padding: '0.8rem 3rem', borderRadius: '14px', fontWeight: 800, minWidth: '220px', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)' }}
              >
                {loading ? 'Importation en cours...' : 'Vérifier et Importer'}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', gap: '1.25rem' }}>
          <div style={{ background: '#fffbeb', color: '#d97706', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Instructions Importantes</div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <li>Utilisez la <strong>Référence (SKU)</strong> exacte du produit. Si la référence n'existe pas, l'article sera ignoré.</li>
              <li>Le premier numéro de téléphone est obligatoire pour créer ou identifier le client.</li>
              <li>Le système s'adapte automatiquement si vos colonnes s'appellent "Client", "Nom", "Phone" ou "Référence".</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
