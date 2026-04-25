import { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { insforge } from '../../lib/insforge';
import { read, utils, writeFile } from 'xlsx';

export const BulkImportProduitModal = ({ onClose, onSave }: { onClose: () => void, onSave: () => void }) => {
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
    reader.onload = (e) => {
      try {
        const ab = e.target?.result as ArrayBuffer;
        const wb = read(ab, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const worksheet = wb.Sheets[sheetName];
        const data = utils.sheet_to_json(worksheet) as any[];

        const formatted = data.map(item => ({
          nom: String(item.Nom || item.Désignation || item.Name || '').trim(),
          sku: String(item.SKU || item.Référence || item.Ref || '').trim().toUpperCase(),
          prix_achat: Number(item['Prix Achat'] || item.Achat || 0),
          prix_vente: Number(item['Prix Vente'] || item.Vente || 0),
          stock_actuel: Number(item.Stock || item.Quantité || 0),
          stock_minimum: Number(item['Stock Min'] || item.Alerte || 5),
          categorie_nom: String(item.Catégorie || item.Category || '').trim()
        })).filter(p => p.nom && p.sku);

        setPreview(formatted);
        setError(null);
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la lecture du fichier.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const data = [{
      "Nom": "iPhone 15 Pro",
      "SKU": "IP15PRO",
      "Prix Achat": 800000,
      "Prix Vente": 950000,
      "Stock": 10,
      "Stock Min": 2,
      "Catégorie": "Smartphones"
    }];
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Produits");
    writeFile(wb, "modele_import_produits.xlsx");
  };

  const handleSubmit = async () => {
    if (preview.length === 0) return;
    setLoading(true);
    try {
      // 1. Get or create categories
      const { data: categories } = await insforge.database.from('categories').select('*');
      const catMap = new Map<string, string>();
      categories?.forEach(c => catMap.set(c.nom.toLowerCase(), c.id));

      const finalProducts: any[] = [];
      for (const p of preview) {
        let catId = catMap.get(p.categorie_nom.toLowerCase());
        if (!catId && p.categorie_nom) {
          const { data: newCat } = await insforge.database
            .from('categories')
            .insert([{ nom: p.categorie_nom }])
            .select()
            .single();
          if (newCat) {
            catId = newCat.id;
            catMap.set(p.categorie_nom.toLowerCase(), catId);
          }
        }

        finalProducts.push({
          nom: p.nom,
          sku: p.sku,
          prix_achat: p.prix_achat,
          prix_vente: p.prix_vente,
          stock_actuel: p.stock_actuel,
          stock_minimum: p.stock_minimum,
          categorie_id: catId,
          actif: true,
          created_at: new Date().toISOString()
        });
      }

      const { error: insertErr } = await insforge.database
        .from('produits')
        .upsert(finalProducts, { onConflict: 'sku' });

      if (insertErr) throw insertErr;

      showToast(`${finalProducts.length} produits importés/mis à jour !`, "success");
      onSave();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Erreur lors de l'importation.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content card" style={{ maxWidth: '800px', padding: '2.5rem' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: '#f1f5f9', border: 'none', borderRadius: '12px', width: '40px', height: '40px', cursor: 'pointer' }}>
          <X size={20} />
        </button>

        <h2 className="text-premium">Importation Catalogue Produits</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Ajoutez ou mettez à jour vos articles en masse via Excel.</p>

        {!file ? (
          <div 
            style={{ border: '2px dashed #e2e8f0', borderRadius: '24px', padding: '4rem', textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }}
            onClick={() => document.getElementById('fileInputProd')?.click()}
          >
            <input type="file" id="fileInputProd" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
            <Upload size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
            <h3 style={{ margin: 0 }}>Glissez votre fichier ici</h3>
            <button type="button" className="btn btn-outline" onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }} style={{ marginTop: '1.5rem' }}>
              <Download size={18} /> Télécharger le modèle
            </button>
          </div>
        ) : (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '14px', marginBottom: '1.5rem' }}>
              <CheckCircle size={20} color="#16a34a" />
              <div style={{ flex: 1, fontWeight: 700 }}>{file.name} - {preview.length} articles détectés</div>
              <button className="btn btn-sm" onClick={() => setFile(null)}>Changer</button>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>SKU</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Désignation</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Prix Vente</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 700 }}>{p.sku}</td>
                      <td style={{ padding: '0.75rem' }}>{p.nom}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{p.prix_vente.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{p.stock_actuel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-outline" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ minWidth: '200px' }}>
                {loading ? 'Importation...' : 'Lancer l\'importation'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
