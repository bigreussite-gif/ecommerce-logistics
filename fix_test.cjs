const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');
content = content.replace(/lowStockProducts\.map\([\s\S]*?\)\)}/m, '<div>test</div>\n            )}');
fs.writeFileSync('src/pages/Dashboard.tsx', content);
