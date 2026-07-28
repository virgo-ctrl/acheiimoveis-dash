import csv
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('crm_supremo_leads.csv', 'r', encoding='utf-8') as f:
    crm_rows = list(csv.DictReader(f))

michelle_rows = [r for r in crm_rows if r['nome_pessoa'] == 'Michelle Porfirio']
print(f"Total rows for Michelle Porfirio: {len(michelle_rows)}")
for i, r in enumerate(michelle_rows):
    print(f"Row {i:2d} | id={r['id']} | capt={r['data_captura']} | ult_int={r['data_ultima_interacao']} | corr={r['nome_corretor']} | sit={r['nome_situacao']}")

# Check if there are any differences between these 15 rows except maybe nothing? Or id?
print("\nChecking field differences across Michelle's rows:")
keys = list(michelle_rows[0].keys())
for k in keys:
    vals = set(r[k] for r in michelle_rows)
    if len(vals) > 1:
        print(f"Field '{k}' has multiple values: {vals}")
