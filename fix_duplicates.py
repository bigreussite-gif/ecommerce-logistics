import re
import glob

all_pages = glob.glob('src/pages/*.tsx') + glob.glob('src/components/**/*.tsx', recursive=True)

for page in all_pages:
    with open(page, 'r') as file:
        content = file.read()
    
    # Remove duplicate ', flexWrap: 'wrap', gap: '1rem''
    content = content.replace(", flexWrap: 'wrap', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'", ", flexWrap: 'wrap', gap: '1rem', alignItems: 'center'")
    content = content.replace(", flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'", ", flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center'")
    
    # Specifically fix the ones identified
    content = content.replace(", flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem'", ", flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', marginBottom: '2rem'")
    
    # Fix Admin.tsx line 206
    content = content.replace("flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'", "flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center'")
    
    # Let's just use a regex to clean up duplicate flexWrap: 'wrap' in the same line
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if "flexWrap: 'wrap'" in line:
            # find all instances of "flexWrap: 'wrap'"
            if line.count("flexWrap: 'wrap'") > 1:
                line = line.replace(", flexWrap: 'wrap'", "", line.count("flexWrap: 'wrap'") - 1)
            if line.count("gap: '1rem'") > 1:
                line = line.replace(", gap: '1rem'", "", line.count("gap: '1rem'") - 1)
            lines[i] = line
            
    content = '\n'.join(lines)
    
    with open(page, 'w') as file:
        file.write(content)

