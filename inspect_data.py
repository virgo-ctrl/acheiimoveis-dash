import csv
import sys
from collections import defaultdict, Counter

sys.stdout.reconfigure(encoding='utf-8')

with open('crm_supremo_leads.csv', 'r', encoding='utf-8') as f:
    crm_rows = list(csv.DictReader(f))

with open('meta_ads_leads.csv', 'r', encoding='utf-8') as f:
    meta_rows = list(csv.DictReader(f))

print(f"=== CRM SUPREMO: {len(crm_rows)} rows ===")
by_person = defaultdict(list)
for r in crm_rows:
    by_person[r['nome_pessoa']].append(r)

print(f"Unique person names in CRM: {len(by_person)}")

for name, rows in by_person.items():
    corretores_set = set(r['nome_corretor'] for r in rows)
    situacoes_set = set(r['nome_situacao'] for r in rows)
    print(f"Lead: '{name}' | Count: {len(rows)} | Corretores: {corretores_set} | Situacoes: {situacoes_set}")

print("\n=== META ADS: {} rows ===".format(len(meta_rows)))
for r in meta_rows:
    print(f"Meta Lead: '{r['nome']}' | Telefone: {r['telefone']} | Valor: {r['Valor da oportunidade']} | Prazo: {r['prazo para compra']}")

# Match meta leads with crm leads by phone number or name
print("\n=== CROSS MATCHING META AND CRM LEADS ===")
def clean_phone(p):
    if not p: return ''
    digits = ''.join(c for c in p if c.isdigit())
    if digits.startswith('55'):
        digits = digits[2:]
    return digits

crm_phones = {}
for r in crm_rows:
    cp = clean_phone(r['telefone_pessoa'])
    if cp:
        crm_phones[cp] = r

for m in meta_rows:
    mp = clean_phone(m['telefone'])
    matched = crm_phones.get(mp)
    if matched:
        print(f"MATCH! Meta: '{m['nome']}' ({m['telefone']}) <-> CRM: '{matched['nome_pessoa']}' ({matched['telefone_pessoa']}) | Corretor: {matched['nome_corretor']}")
    else:
        print(f"NO MATCH Meta: '{m['nome']}' ({m['telefone']})")
