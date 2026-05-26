import os
import re

files_to_fix = [
    'src/components/produits/ProduitList.tsx',
    'src/components/produits/BulkImportProduitModal.tsx',
    'src/components/commandes/BulkImportModal.tsx',
    'src/pages/Caisse.tsx',
    'src/pages/Logistique.tsx',
    'src/pages/Clients.tsx',
    'src/pages/FinancialReport.tsx',
    'src/components/commandes/CommandeList.tsx'
]

# 1. Add table-container wrapper where missing
for f in files_to_fix:
    if not os.path.exists(f): continue
    with open(f, 'r') as file:
        content = file.read()
    
    if 'className="table-container"' not in content and '<table' in content:
        # Wrap <table ...> ... </table> in <div className="table-container">
        # using regex. This is tricky with nested tags, but most files only have one top-level table structure
        # A simpler replace:
        content = re.sub(r'(<table\b[^>]*>)', r'<div className="table-container">\n\1', content)
        content = re.sub(r'(</table>)', r'\1\n</div>', content)
        with open(f, 'w') as file:
            file.write(content)
        print(f"Added table-container to {f}")

# 2. Fix flex wraps in all pages
import glob
all_pages = glob.glob('src/pages/*.tsx') + glob.glob('src/components/**/*.tsx', recursive=True)
for page in all_pages:
    with open(page, 'r') as file:
        content = file.read()
    
    # Replace common non-wrapping flex containers that should wrap on mobile
    content = content.replace("display: 'flex', gap: '1rem', marginBottom: '2rem'", "display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem'")
    content = content.replace("display: 'flex', gap: '1rem', marginBottom: '1rem'", "display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem'")
    content = content.replace("display: 'flex', justifyContent: 'space-between', marginBottom: '2rem'", "display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', marginBottom: '2rem'")
    content = content.replace("display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'", "display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'")
    
    with open(page, 'w') as file:
        file.write(content)

