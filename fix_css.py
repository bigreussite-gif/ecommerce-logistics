with open('src/index.css', 'r') as f:
    content = f.read()

# Make sure padding is reduced on mobile for cards and page content
if '@media (max-width: 640px)' in content:
    content = content.replace('.page-content { padding: 1rem; }', '.page-content { padding: 0.5rem; }')
    content = content.replace('.card {\n    padding: 1rem;', '.card {\n    padding: 1rem;')

with open('src/index.css', 'w') as f:
    f.write(content)
