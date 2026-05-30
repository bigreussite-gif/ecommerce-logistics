import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# I will use regex to extract the 6 specific blocks:
# 1. Revenue Trend
# 2. Status Distribution (Pie Chart)
# 3. Zone Risk Heatmap
# 4. Best Sellers Section
# 5. Category Performance Section
# 6. Meilleures Zones Section
# 7. Recent Activity Feed

# Finding the boundaries
# 1. Status Distribution
idx_status = content.find('{/* Status Distribution (Pie Chart) */}')
# 2. Risk Heatmap
idx_risk = content.find('{/* Zone Risk Heatmap */}')
# 3. Revenue Trend
idx_revenue = content.find('{/* Revenue Trend */}')
# 4. Best Sellers
idx_best_sellers = content.find('{/* Best Sellers Section */}')
# 5. Category Performance
idx_category = content.find('{/* Category Performance Section */}')
# 6. Meilleures Zones
idx_best_zones = content.find('{/* Meilleures Zones Section */}')
# 7. Recent Activity
idx_recent = content.find('{/* Recent Activity Feed */}')

# The end is the first </div> that closes the second res-grid-2col
idx_end = content.rfind('  );\n};')

# Extract the blocks! We know exactly what is between these indexes except for closing tags.
block_status = content[idx_status:idx_risk].strip()
block_risk_full = content[idx_risk:idx_revenue].strip()
# remove the closing </div> of the first res-grid-2col
block_risk = block_risk_full.rsplit('</div>', 1)[0].strip()

block_revenue = content[idx_revenue:idx_best_sellers].strip()
block_best_sellers = content[idx_best_sellers:idx_category].strip()
block_category = content[idx_category:idx_best_zones].strip()
block_best_zones = content[idx_best_zones:idx_recent].strip()

block_recent_full = content[idx_recent:idx_end].strip()
# recent full has 5 closing divs at the end.
# We want to keep the closing divs for the page-content and app-container, etc.
# Usually:
#   </div> {/* card */}
#   </div> {/* res-grid-2col */}
# </div> {/* outer padding div? */}
# </div> {/* page-content */}
# </div> {/* app-container/layout */}
# Let's just find the last </div> of the card.
# A card ends with </div>.
card_end_idx = block_recent_full.find('Aucune activité récente.')
if card_end_idx != -1:
    card_end_idx = block_recent_full.find('</div>', card_end_idx)
    card_end_idx = block_recent_full.find('</div>', card_end_idx + 1)
    card_end_idx = block_recent_full.find('</div>', card_end_idx + 1)
else:
    # fallback
    pass

# A simpler approach: Just do a string replace!
# I will rewrite the grid structure from the point where `<div className="res-grid-2col" style={{ marginBottom: '2.5rem' }}>` starts.
top_part = content[:content.find('<div className="res-grid-2col" style={{ marginBottom: \'2.5rem\' }}>')]

# I will extract just the cards themselves by matching their comments and the next comment.
def extract_card(start_comment, end_comment):
    s = content.find(start_comment)
    e = content.find(end_comment) if end_comment else idx_end
    snippet = content[s:e].strip()
    # If the snippet contains '</div>\n      <div className="res-grid-2col"', we remove it
    snippet = re.sub(r'</div>\s*<div className="res-grid-2col"[^>]*>', '', snippet)
    # Also remove trailing closing divs if it's the last element before an end marker that had grid closing
    return snippet

card_status = extract_card('{/* Status Distribution (Pie Chart) */}', '{/* Zone Risk Heatmap */}')
card_risk = extract_card('{/* Zone Risk Heatmap */}', '{/* Revenue Trend */}')
if card_risk.endswith('</div>\n      </div>'):
    card_risk = card_risk[:-13].strip()

card_revenue = extract_card('{/* Revenue Trend */}', '{/* Best Sellers Section */}')
card_best_sellers = extract_card('{/* Best Sellers Section */}', '{/* Category Performance Section */}')
card_category = extract_card('{/* Category Performance Section */}', '{/* Meilleures Zones Section */}')
card_best_zones = extract_card('{/* Meilleures Zones Section */}', '{/* Recent Activity Feed */}')
card_recent = extract_card('{/* Recent Activity Feed */}', None)

# card_recent contains the end of the file.
# Let's split card_recent at `          )}\n        </div>` (the end of the card)
end_of_recent_card = card_recent.find('          )}\n        </div>') + len('          )}\n        </div>')
actual_card_recent = card_recent[:end_of_recent_card]
tail = card_recent[end_of_recent_card:].strip()

# Now reassemble the perfect layout!
new_layout = f"""
      <div style={{{{ display: 'flex', flexDirection: 'column', gap: '2.5rem', marginBottom: '2.5rem' }}}}>
        {card_revenue}

        <div className="res-grid-2col" style={{{{ alignItems: 'start', gap: '2.5rem' }}}}>
          {card_status}
          {card_risk}
        </div>

        <div className="res-grid-2col" style={{{{ alignItems: 'start', gap: '2.5rem' }}}}>
          {card_best_sellers}
          {card_category}
        </div>

        {card_best_zones}

        {actual_card_recent}
      </div>
      {tail}
"""

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(top_part + new_layout)
print("Layout fixed!")
