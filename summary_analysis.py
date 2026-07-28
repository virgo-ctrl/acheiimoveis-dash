import csv
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

with open('crm_supremo_leads.csv', 'r', encoding='utf-8') as f:
    raw_crm = list(csv.DictReader(f))

# Deduplicate by 'id'
crm_leads = {}
for r in raw_crm:
    crm_leads[r['id']] = r

crm_list = list(crm_leads.values())

with open('meta_ads_leads.csv', 'r', encoding='utf-8') as f:
    meta_list = list(csv.DictReader(f))

print(f"Deduplicated CRM Leads: {len(crm_list)}")
print(f"Meta Ads Leads: {len(meta_list)}")

print("\n--- CRM DEDUPLICATED LEADS SUMMARY ---")
for r in crm_list:
    print(f"ID: {r['id']} | Nome: {r['nome_pessoa']:<30} | Corretor: {r['nome_corretor']:<35} | Situação: {r['nome_situacao']} | Captura: {r['data_captura']}")

print("\n--- META ADS LEADS SUMMARY ---")
for r in meta_list:
    print(f"Nome: {r['nome']:<30} | Telefone: {r['telefone']} | Valor: {r['Valor da oportunidade']} | Prazo: {r['prazo para compra']}")

# Compare dates
print("\nDates in CRM:")
captura_dates = [r['data_captura'] for r in crm_list]
print("Min captura:", min(captura_dates), "Max captura:", max(captura_dates))

print("\nCorretores after deduplication:")
from collections import Counter
corr_counts = Counter(r['nome_corretor'] for r in crm_list)
for corr, count in corr_counts.most_common():
    print(f"  {corr}: {count} leads")

print("\nSituacoes after deduplication:")
sit_counts = Counter(r['nome_situacao'] for r in crm_list)
for sit, count in sit_counts.most_common():
    print(f"  {sit}: {count} leads")
