with open("src/pages/Dashboard.tsx", "r") as f:
    content = f.read()

# Replace the excessive divs at the end with the correct closing syntax
content = content.strip()
# remove trailing divs
while content.endswith('</div>'):
    content = content[:-6].strip()

# Now we need to figure out how many divs need to be closed.
# We are inside the main return statement:
# return (
#   <div className="page-content">
#     ...
#     <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', marginBottom: '2.5rem' }}>
#       ...
#     </div>
#   </div>
# );

# Let's count open vs closed divs in the file
open_divs = content.count('<div')
closed_divs = content.count('</div')

missing_divs = open_divs - closed_divs

if missing_divs > 0:
    content += '\n' + '  </div>\n' * missing_divs

content += '  );\n};\n'

with open("src/pages/Dashboard.tsx", "w") as f:
    f.write(content)
