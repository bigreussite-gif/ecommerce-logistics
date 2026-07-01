const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Insert products state
code = code.replace(
  'const [filteredCmdsPrev, setFilteredCmdsPrev] = useState<Commande[]>([]);',
  'const [filteredCmdsPrev, setFilteredCmdsPrev] = useState<Commande[]>([]);\n  const [produitsData, setProduitsData] = useState<any[]>([]);'
);

// Insert fetch products
code = code.replace(
  'getProduits()\n      ]);\n      setExpenses(allExpenses);',
  'getProduits()\n      ]);\n      setExpenses(allExpenses);\n      setProduitsData(allProds);'
);

// Insert lucide icons
code = code.replace(
  ', TrendingDown } from \'lucide-react\';',
  ', TrendingDown, Package } from \'lucide-react\';'
);

// Insert useMemo
code = code.replace(
  'const { metrics, previousMetrics, logStats, croissanceCA, statusData, heatmapData, bestZonesData, historyData, pendingCount } = filteredData;',
  'const { metrics, previousMetrics, logStats, croissanceCA, statusData, heatmapData, bestZonesData, historyData, pendingCount } = filteredData;\n\n  const lowStockProducts = useMemo(() => {\n    return produitsData\n      .filter(p => (p.stock_disponible ?? p.stock_actuel ?? 0) <= (p.stock_minimum ?? 0) && p.actif !== false)\n      .sort((a, b) => (a.stock_disponible ?? a.stock_actuel) - (b.stock_disponible ?? b.stock_actuel));\n  }, [produitsData]);'
);

// Insert the widget exactly before the last 4 closing divs.
const widgetCode = `
        {/* Widget Alertes Stock */}
        <div className="card glass-effect" style={{ padding: '2.5rem', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
            <div style={{ padding: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', display: 'flex' }}>
              <AlertCircle size={22} color="#ef4444" />
            </div>
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem' }}>Alertes de Stock</h3>
            {lowStockProducts.length > 0 && (
              <span style={{ background: '#ef4444', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 800 }}>
                {lowStockProducts.length} alerte(s)
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            {lowStockProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#dcfce7', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <ShoppingBag size={24} />
                </div>
                <p style={{ fontWeight: 600 }}>Tous vos produits sont suffisamment approvisionnés.</p>
              </div>
            ) : (
              lowStockProducts.map(p => {
                const stock = p.stock_disponible ?? p.stock_actuel ?? 0;
                const isRupture = stock <= 0;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', background: isRupture ? '#fef2f2' : 'white', borderRadius: '16px', border: \`1px solid \${isRupture ? '#fecaca' : '#f1f5f9'}\`, transition: 'transform 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} className="hover-lift-shadow">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isRupture ? '#ef4444' : '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div>
                        <div style={{ fontSize: '0.8rem', color: isRupture ? '#ef4444' : '#d97706', fontWeight: 700, marginTop: '0.2rem' }}>
                          {isRupture ? 'RUPTURE DE STOCK' : 'STOCK BAS'}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 900, fontSize: '1.2rem', color: isRupture ? '#ef4444' : '#d97706' }}>{stock} u.</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Min: {p.stock_minimum || 0}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
`;

code = code.replace('          )}\n        </div>\n      </div>\n    </div>\n  </div>\n  );\n};', '          )}\n        </div>\n' + widgetCode + '      </div>\n    </div>\n  </div>\n  );\n};');

fs.writeFileSync('src/pages/Dashboard.tsx', code);
