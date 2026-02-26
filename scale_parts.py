#!/usr/bin/env python3
import json
import re
import math

# Read the HTML file
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find PARTS_DATA_EMBEDDED start

# Find the complete JSON by counting braces
start = content.index('const PARTS_DATA_EMBEDDED = {')
brace_count = 0
in_string = False
escape_next = False
i = start + len('const PARTS_DATA_EMBEDDED = ')

while i < len(content):
    c = content[i]
    
    if escape_next:
        escape_next = False
    elif c == '\\':
        escape_next = True
    elif c == '"' and not escape_next:
        in_string = not in_string
    elif c == '{' and not in_string:
        brace_count += 1
    elif c == '}' and not in_string:
        brace_count -= 1
        if brace_count == 0:
            json_str = content[start + len('const PARTS_DATA_EMBEDDED = '):i+1]
            break
    i += 1

# Parse the JSON
try:
    data = json.loads(json_str)
except json.JSONDecodeError as e:
    print(f"JSON parse error: {e}")
    exit(1)

print(f"Loaded {len(data['parts'])} parts")

# Analyze current stats
parts_by_slot = {}
for part in data['parts']:
    slot = part['slot']
    if slot not in parts_by_slot:
        parts_by_slot[slot] = []
    parts_by_slot[slot].append(part)

# Calculate averages per slot
for slot, parts in parts_by_slot.items():
    avg_stats = {}
    for stat in ['hp', 'atk', 'def', 'spd', 'luck']:
        avg = sum(p['stats'][stat] for p in parts) / len(parts)
        avg_stats[stat] = avg
    print(f"{slot.upper():10} (n={len(parts):2}): HP={avg_stats['hp']:6.2f}, ATK={avg_stats['atk']:6.2f}, DEF={avg_stats['def']:6.2f}, SPD={avg_stats['spd']:6.2f}, LUCK={avg_stats['luck']:6.2f}")

# Calculate total from average of each slot
total_stats = {}
for stat in ['hp', 'atk', 'def', 'spd', 'luck']:
    total = sum(
        sum(p['stats'][stat] for p in parts_by_slot[slot]) / len(parts_by_slot[slot])
        for slot in parts_by_slot
    )
    total_stats[stat] = total

print(f"\nCURRENT ASSEMBLED HONKER (slot averages summed):")
print(f"  HP={total_stats['hp']:.1f}, ATK={total_stats['atk']:.1f}, DEF={total_stats['def']:.1f}, SPD={total_stats['spd']:.1f}, LUCK={total_stats['luck']:.1f}")

# Target and multipliers
targets = {'hp': 125, 'atk': 80, 'def': 72, 'spd': 75, 'luck': 50}
multipliers = {stat: targets[stat] / total_stats[stat] for stat in targets}

print(f"\nSCALING MULTIPLIERS:")
for stat, mult in multipliers.items():
    print(f"  {stat.upper():5} {mult:.3f}x")

print(f"\nPOST-SCALING ESTIMATE:")
for stat, target in targets.items():
    print(f"  {stat.upper():5} {total_stats[stat] * multipliers[stat]:.1f} (target {target})")

# Apply scaling to all parts
for part in data['parts']:
    for stat in targets:
        part['stats'][stat] = max(1, round(part['stats'][stat] * multipliers[stat]))
    
    # Update powerScore: rough estimate based on stats
    stats = part['stats']
    part['powerScore'] = stats['hp'] * 0.15 + stats['atk'] * 1.6 + stats['def'] * 1.4 + stats['spd'] * 0.8 + stats['luck'] * 0.5

# Verify
print(f"\nPOST-SCALING VERIFICATION:")
total_stats_post = {}
for stat in ['hp', 'atk', 'def', 'spd', 'luck']:
    total = sum(
        sum(p['stats'][stat] for p in parts_by_slot[slot]) / len(parts_by_slot[slot])
        for slot in parts_by_slot
    )
    total_stats_post[stat] = total

for stat in targets:
    print(f"  {stat.upper():5} {total_stats_post[stat]:.1f}")

# Verify ranges by rarity
print(f"\nHEAD STATS BY RARITY:")
heads = [p for p in data['parts'] if p['slot'] == 'head']
for rarity in ['common', 'rare', 'legendary']:
    parts = [p for p in heads if p['rarity'] == rarity]
    if parts:
        avg_atk = sum(p['stats']['atk'] for p in parts) / len(parts)
        print(f"  {rarity:10} n={len(parts):2} avg ATK={avg_atk:.1f}")

# Output the new JSON
output = f"const PARTS_DATA_EMBEDDED = {json.dumps(data)}"
print(f"\nOutput length: {len(output)} characters")
print("Ready to write to file")

# Write back
with open('index_rebalanced.json', 'w', encoding='utf-8') as f:
    f.write(output)

print("Saved to index_rebalanced.json")
