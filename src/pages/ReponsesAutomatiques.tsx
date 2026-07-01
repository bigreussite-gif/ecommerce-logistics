import { useState } from 'react';
import { MessageSquare, Settings, Save, Play, CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { insforge } from '../lib/insforge';

interface AutoReplyRule {
  id: string;
  trigger: string;
  description: string;
  message: string;
  active: boolean;
}

const DEFAULT_RULES: AutoReplyRule[] = [
  {
    id: '1',
    trigger: 'nouvelle_commande',
    description: 'Lorsqu\'une commande est créée (Confirmation)',
    message: 'Bonjour [Nom Client], nous avons bien reçu votre commande d\'un montant de [Montant] FCFA. Elle sera expédiée très bientôt. Merci pour votre confiance !',
    active: true,
  },
  {
    id: '2',
    trigger: 'commande_expediee',
    description: 'Lorsque la commande passe "En cours de livraison"',
    message: 'Bonjour [Nom Client], votre commande est en route ! Notre livreur vous contactera sous peu. Veuillez préparer la somme de [Montant] FCFA.',
    active: false,
  },
  {
    id: '3',
    trigger: 'relance_paiement',
    description: 'Relance pour les paiements en attente',
    message: 'Bonjour [Nom Client], sauf erreur de notre part, votre paiement de [Montant] FCFA est toujours en attente. Contactez-nous si vous avez des questions.',
    active: true,
  }
];

export const ReponsesAutomatiques = () => {
  const { showToast } = useToast();
  
  const [rules, setRules] = useState<AutoReplyRule[]>(() => {
    const saved = localStorage.getItem('auto_reply_rules');
    return saved ? JSON.parse(saved) : DEFAULT_RULES;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const saveRules = (newRules: AutoReplyRule[]) => {
    setRules(newRules);
    localStorage.setItem('auto_reply_rules', JSON.stringify(newRules));
  };

  const handleToggle = (id: string) => {
    saveRules(rules.map(r => r.id === id ? { ...r, active: !r.active } : r));
    showToast('Statut de la règle mis à jour', 'success');
  };

  const handleSave = (id: string) => {
    saveRules(rules.map(r => r.id === id ? { ...r, message: editMessage } : r));
    setEditingId(null);
    showToast('Message automatisé sauvegardé avec succès', 'success');
  };

  const handleEdit = (rule: AutoReplyRule) => {
    setEditingId(rule.id);
    setEditMessage(rule.message);
  };

  const insertVariable = (variable: string) => {
    setEditMessage(prev => prev + ` [${variable}] `);
  };

  const generateAITemplate = async (ruleDescription: string) => {
    try {
      setIsGenerating(true);
      const prompt = `Rédige un message SMS/WhatsApp court, chaleureux et professionnel pour un client e-commerce en Côte d'Ivoire. Le contexte de ce message est: "${ruleDescription}". Utilise le vouvoiement. Inclus absolument les balises [Nom Client] et [Montant] si c'est pertinent. Ne mets pas d'objets, juste le texte du message.`;
      
      const completion = await insforge.ai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [{ role: 'user', content: prompt }]
      });
      
      const generatedText = completion.choices[0].message.content.trim();
      setEditMessage(generatedText);
      showToast('Nouveau message généré par l\'IA !', 'success');
    } catch (error) {
      console.error(error);
      showToast('Erreur lors de la génération IA', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
            Réponses Automatiques
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0' }}>
            Configurez les messages qui seront envoyés automatiquement à vos clients (Bot WhatsApp / SMS).
          </p>
        </div>
        <div style={{ padding: '0.8rem 1.5rem', background: '#ecfdf5', color: '#10b981', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
          <CheckCircle2 size={20} />
          <span>Moteur d'automatisation actif</span>
        </div>
      </div>

      <div className="card glass-effect" style={{ marginBottom: '2rem', padding: '1.5rem', borderLeft: '4px solid #3b82f6', background: 'rgba(59, 130, 246, 0.05)' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <AlertCircle color="#3b82f6" />
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e3a8a' }}>Comment ça marche ?</h4>
            <p style={{ margin: 0, color: '#3b82f6', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Ces règles définissent les messages types envoyés lors d'événements clés. 
              Utilisez les variables disponibles pour personnaliser chaque message. Lorsque la règle est active, 
              le message est préparé pour envoi (soit via l'API connectée, soit en 1-clic pour le gestionnaire).
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {rules.map((rule) => (
          <div key={rule.id} className="card glass-effect hover-lift-shadow" style={{ padding: '2rem', border: '1px solid rgba(255,255,255,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ padding: '0.8rem', background: rule.active ? '#ecfdf5' : '#f1f5f9', color: rule.active ? '#10b981' : '#64748b', borderRadius: '12px' }}>
                  {rule.active ? <Play size={24} /> : <Settings size={24} />}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem 0', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-main)' }}>
                    Événement : {rule.trigger.replace('_', ' ').toUpperCase()}
                  </h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{rule.description}</div>
                </div>
              </div>
              
              <div className="toggle-switch">
                <input 
                  type="checkbox" 
                  id={`toggle-${rule.id}`} 
                  checked={rule.active} 
                  onChange={() => handleToggle(rule.id)}
                  style={{ display: 'none' }}
                />
                <label 
                  htmlFor={`toggle-${rule.id}`} 
                  style={{ 
                    display: 'inline-block', 
                    width: '50px', 
                    height: '26px', 
                    background: rule.active ? '#10b981' : '#cbd5e1', 
                    borderRadius: '26px', 
                    position: 'relative', 
                    cursor: 'pointer',
                    transition: 'background 0.3s'
                  }}
                >
                  <span style={{ 
                    position: 'absolute', 
                    top: '3px', 
                    left: rule.active ? '27px' : '3px', 
                    width: '20px', 
                    height: '20px', 
                    background: 'white', 
                    borderRadius: '50%', 
                    transition: 'left 0.3s' 
                  }} />
                </label>
              </div>
            </div>

            {editingId === rule.id ? (
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Variables disponibles :</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['Nom Client', 'Montant', 'Produit', 'Date'].map(v => (
                      <button key={v} onClick={() => insertVariable(v)} className="btn" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1' }}>
                        + [{v}]
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  style={{ width: '100%', minHeight: '100px', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={() => setEditingId(null)} disabled={isGenerating}>Annuler</button>
                  <button 
                    className="btn" 
                    onClick={() => generateAITemplate(rule.description)}
                    disabled={isGenerating}
                    style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: 'white', border: 'none' }}
                  >
                    {isGenerating ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />} 
                    Générer avec l'IA
                  </button>
                  <button className="btn btn-primary" onClick={() => handleSave(rule.id)} disabled={isGenerating}>
                    <Save size={18} /> Enregistrer
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <MessageSquare size={20} color="#64748b" style={{ marginTop: '0.2rem' }} />
                  <p style={{ margin: 0, color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {rule.message}
                  </p>
                </div>
                <button className="btn btn-secondary" onClick={() => handleEdit(rule)} style={{ padding: '0.5rem 1rem' }}>
                  Modifier
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
