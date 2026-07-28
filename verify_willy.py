import json
import sys
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

willy = [r for r in data if 'WILLYELSON' in (r.get('corretor') or '').upper()]
print(f"Total Willyelson in data.json: {len(willy)}")

willy_ativo = [r for r in willy if r.get('status_geral') == 'ATIVO']
print(f"\nWillyelson ATIVO ({len(willy_ativo)} leads):")
sit_ativo = Counter(r.get('situacao') for r in willy_ativo)
for s, c in sit_ativo.most_common():
    print(f"  {s}: {c}")

print("\nWillyelson VENDIDO / PERDIDO:")
sit_other = Counter(f"{r.get('status_geral')}: {r.get('situacao')}" for r in willy if r.get('status_geral') != 'ATIVO')
for s, c in sit_other.most_common():
    print(f"  {s}: {c}")
