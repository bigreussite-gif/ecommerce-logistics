import re
with open("src/pages/Dashboard.tsx", "r") as f:
    content = f.read()

# remove all JSX comments
content = re.sub(r'\{\/\*.*?\*\/\}', '', content, flags=re.DOTALL)
    
opens = [m.start() for m in re.finditer(r'<div\b', content)]
closes = [m.start() for m in re.finditer(r'</div\b', content)]

print(f"Total opens: {len(opens)}")
print(f"Total closes: {len(closes)}")
