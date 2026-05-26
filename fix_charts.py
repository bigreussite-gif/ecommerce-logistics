import re

with open("src/pages/Dashboard.tsx", "r") as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,",
    "AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,"
)

# 2. Update historyPoints to include gross
history_old = """    const historyPoints = Array.from({length: dayCount}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (dayCount - 1 - i));
      return { date: d.toISOString().split('T')[0], revenue: 0, count: 0 };
    });"""
history_new = """    const historyPoints = Array.from({length: dayCount}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (dayCount - 1 - i));
      return { date: d.toISOString().split('T')[0], revenue: 0, count: 0, gross: 0 };
    });"""
content = content.replace(history_old, history_new)

# 3. Update filteredCmds to compute gross
gross_old = """      if (match) {
        match.count++;
        if (isSuccess) {"""
gross_new = """      if (match) {
        match.count++;
        match.gross += Number(c.montant_total) || 0;
        if (isSuccess) {"""
content = content.replace(gross_old, gross_new)

# 4. Update historyData to return CABrut
hdata_old = """    const historyData = historyPoints.map(d => ({
      jour: d.date.slice(-5).replace('-', '/'),
      Commandes: d.count,
      CA: d.revenue
    }));"""
hdata_new = """    const historyData = historyPoints.map(d => ({
      jour: d.date.slice(-5).replace('-', '/'),
      Commandes: d.count,
      CA: d.revenue,
      CABrut: d.gross
    }));"""
content = content.replace(hdata_old, hdata_new)

# 5. Replace AreaChart
area_old = """              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} dy={15} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800, padding: '1rem' }}
                  formatter={(v) => [`${Number(v).toLocaleString()} CFA`, 'Revenu Net']}
                />
                <Area type="monotone" dataKey="CA" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorCA)" activeDot={{ r: 8, fill: '#10b981', stroke: 'white', strokeWidth: 3 }} />
              </AreaChart>"""
area_new = """              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCABrut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} dy={15} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800, padding: '1rem' }}
                  formatter={(v, name) => [`${Number(v).toLocaleString()} CFA`, name === 'CA' ? 'Revenu Net' : 'Revenu Brut']}
                />
                <Area type="monotone" dataKey="CABrut" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCABrut)" activeDot={{ r: 6, fill: '#3b82f6', stroke: 'white', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="CA" stroke="#10b981" strokeWidth={5} fillOpacity={1} fill="url(#colorCA)" activeDot={{ r: 8, fill: '#10b981', stroke: 'white', strokeWidth: 3 }} />
              </AreaChart>"""
content = content.replace(area_old, area_new)

# 6. Replace Performance Categorie with BarChart
cat_old = """           <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {(!categoryStats || categoryStats.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '16px' }}>
                  <Tag size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Aucune donnée sur cette période.</p>
                </div>
              ) : categoryStats.map((c, i) => {
                const maxCA = Math.max(...categoryStats.map(cat => cat.ca));
                const percent = maxCA > 0 ? (c.ca / maxCA) * 100 : 0;
                return (
                <div key={c.nom || i} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', transition: 'transform 0.2s ease', cursor: 'default' }} className="hover-lift">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-muted)', width: '24px', background: '#f1f5f9', borderRadius: '8px', textAlign: 'center', padding: '0.2rem' }}>{i+1}</span>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</span>
                    </div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#8b5cf6' }}>
                      {c.ca.toLocaleString()} CFA
                    </span>
                  </div>
                  <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div 
                      style={{ 
                        width: `${percent}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', 
                        borderRadius: '5px',
                        transition: 'width 1s ease-out'
                      }}
                    ></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <span>Articles Vendus:</span>
                    <span>{c.nb_articles} Unités</span>
                  </div>
                </div>
              )})}
           </div>"""
cat_new = """           <div style={{ height: '350px' }}>
              {(!categoryStats || categoryStats.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '16px' }}>
                  <Tag size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                  <p>Aucune donnée sur cette période.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCatCA" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="nom" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: '#64748b'}} width={100} />
                    <Tooltip 
                      cursor={{fill: 'rgba(139, 92, 246, 0.05)'}}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontWeight: 800, padding: '1rem' }}
                      formatter={(v, name) => [name === 'ca' ? `${Number(v).toLocaleString()} CFA` : `${v} Unités`, name === 'ca' ? 'Revenu' : 'Articles']}
                    />
                    <Bar dataKey="ca" fill="url(#colorCatCA)" radius={[0, 6, 6, 0]} barSize={16}>
                      {categoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="url(#colorCatCA)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
           </div>"""
content = content.replace(cat_old, cat_new)

with open("src/pages/Dashboard.tsx", "w") as f:
    f.write(content)
print("Changes applied!")
