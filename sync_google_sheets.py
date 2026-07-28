import subprocess
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

print("=== SINCRONIZANDO DADOS AO VIVO DO CRM SUPREMO E META ADS ===")

try:
    # Run Supremo CRM API sync
    result = subprocess.run([sys.executable, 'sync_supremo_crm_leads.py'], capture_output=True, text=True, encoding='utf-8')
    print(result.stdout)
    if result.stderr:
        print("Log stderr:", result.stderr)
    print("Sincronização com o CRM Supremo finalizada com sucesso!")
except Exception as e:
    print(f"Erro na sincronização: {e}")
