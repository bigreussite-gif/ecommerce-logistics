import re
with open("src/pages/Dashboard.tsx", "r") as f:
    content = f.read()
    
# Remove self-closing elements so they don't confuse us
# but divs shouldn't be self-closing usually.
open_divs = []
lines = content.split('\n')
for i, line in enumerate(lines):
    # Count open and close
    opens = len(re.findall(r'<div\b[^>]*>', line))
    closes = len(re.findall(r'</div\b[^>]*>', line))
    for _ in range(opens):
        open_divs.append(i + 1)
    for _ in range(closes):
        if open_divs:
            open_divs.pop()
        else:
            print(f"Extra closing div on line {i + 1}")

print(f"Unclosed divs opened on lines: {open_divs}")
