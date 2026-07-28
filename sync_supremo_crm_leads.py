import urllib.request
import json
import ssl
import sys
import os
import re
import time

sys.stdout.reconfigure(encoding='utf-8')

TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGktY3JtIiwic3ViIjo3NDksIm5vbWUiOiJBRE0gQUNIRUkiLCJlbWFpbCI6ImZpbmFuY2Vpcm9AYWNoZWlpbW92ZWlzY2FydWFydS5jb20iLCJkZGQiOm51bGwsInBob25lIjpudWxsLCJzaXRfaWQiOjE0Mywic2l0X25vbWUiOiJBY2hlaSBJbVx1MDBmM3ZlaXMiLCJpZF9jaGF2ZSI6MjMwLCJpYXQiOjE3ODQ2NTY3OTQsImV4cCI6MjEwMDAxNjc5NH0.HRDiKVM2vC34etwUreu5Z6fPlkHissi73-1abjOoem0'

HEADERS = {
    'Authorization': f'Bearer {TOKEN}',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0'
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_crm_leads_live(max_pages=200):
    print("=== BUSCANDO DADOS COMPLETOS DA API DO SUPREMO CRM ===")
    all_crm_leads = []
    page = 1
    total_pages = 1
    
    while page <= total_pages and page <= max_pages:
        url = f'https://api.supremocrm.com.br/v1/leads?pagina={page}'
        req = urllib.request.Request(url, headers=HEADERS)
        success = False
        retries = 3
        
        while retries > 0 and not success:
            try:
                with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
                    res_json = json.loads(resp.read().decode('utf-8'))
                    page_data = res_json.get('data', [])
                    total_pages = res_json.get('totalPaginas', 1)
                    total_leads = res_json.get('total', len(page_data))
                    
                    all_crm_leads.extend(page_data)
                    if page % 10 == 0 or page == total_pages:
                        print(f"Página {page}/{min(total_pages, max_pages)} baixada ({len(all_crm_leads)} de {total_leads} leads)")
                    
                    success = True
                    page += 1
                    time.sleep(0.2)
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    print(f"Rate limit na página {page}. Aguardando 1.5s...")
                    time.sleep(1.5)
                    retries -= 1
                else:
                    print(f"Erro HTTP {e.code} na página {page}: {e}")
                    break
            except Exception as e:
                print(f"Erro na página {page}: {e}")
                break
                
        if not success:
            print(f"Pausa concluída na página {page}.")
            break
            
    print(f"Total de registros obtidos da API: {len(all_crm_leads)}")
    return all_crm_leads

def clean_phone(p):
    if not p: return ''
    digits = re.sub(r'\D', '', str(p))
    if len(digits) in (10, 11):
        return '55' + digits
    return digits

def build_unified_dataset():
    crm_raw = fetch_crm_leads_live(max_pages=200)
    
    processed_leads = {}
    
    for r in crm_raw:
        cid = str(r.get('id', ''))
        if not cid or cid in processed_leads: continue
        
        corretor = r.get('nome_corretor') or 'Pendente (Não Atribuído)'
        status_geral = (r.get('nome_status') or 'ATIVO').upper() # ATIVO, VENDIDO, PERDIDO
        situacao = (r.get('nome_situacao') or '').strip()
        
        # Exact mapping for situation
        if not situacao:
            if status_geral == 'VENDIDO': situacao = 'Venda Realizada'
            elif status_geral == 'PERDIDO': situacao = 'Venda Desistida'
            else: situacao = 'Sem Situação Definida'
            
        telefone = r.get('telefone_pessoa') or ''
        ddi = r.get('ddi_pessoa') or '55'
        full_tel = (ddi if ddi else '') + str(telefone)
        
        processed_leads[cid] = {
            'id': cid,
            'source': 'CRM Supremo API',
            'nome': r.get('nome_pessoa') or 'Cliente CRM',
            'telefone': full_tel,
            'whatsapp_phone': clean_phone(full_tel),
            'email': r.get('email_pessoa') or '',
            'origem': r.get('nome_origem') or 'CRM Supremo',
            'campanha': r.get('nome_campanha') or 'VENTANA',
            'data_captura': r.get('data_captura') or '',
            'data_ultima_interacao': r.get('data_ultima_interacao') or r.get('data_captura') or '',
            'corretor': corretor.strip(),
            'status_geral': status_geral, # ATIVO, VENDIDO, PERDIDO
            'situacao': situacao, # Aguardando Atendimento, Pré Atendimento, Em Atendimento, Elaborando Proposta, etc.
            'etapa': r.get('nome_etapa') or 'LEADS COM O CORRETOR',
            'valor_oportunidade': 218000,
            'prazo_compra': 'Não informado',
            'calor': r.get('calor') or 'Normal',
            'motivo_perda': r.get('motivo_perda') or ''
        }
        
    # Merge Meta Ads Leads if available
    if os.path.exists('meta_ads_leads.csv'):
        import csv
        with open('meta_ads_leads.csv', 'r', encoding='utf-8') as f:
            meta_raw = list(csv.DictReader(f))
            for i, r in enumerate(meta_raw, start=1001):
                mid = f"META-{i}"
                if mid not in processed_leads:
                    processed_leads[mid] = {
                        'id': mid,
                        'source': 'Meta Ads',
                        'nome': r.get('nome', '').strip(),
                        'telefone': r.get('telefone', '').strip(),
                        'whatsapp_phone': clean_phone(r.get('telefone', '')),
                        'email': '',
                        'origem': r.get('origem', '').strip(),
                        'campanha': 'ventana-shopping-indianopolis',
                        'data_captura': '2026-07-27 10:00:00',
                        'data_ultima_interacao': '2026-07-27 10:00:00',
                        'corretor': 'Pendente (Não Atribuído)',
                        'status_geral': 'ATIVO',
                        'situacao': 'Novo Lead Meta',
                        'etapa': 'LEADS META ADS',
                        'valor_oportunidade': 218000,
                        'prazo_compra': r.get('prazo para compra', '').strip(),
                        'calor': 'Quente' if r.get('prazo para compra') == 'O quanto antes' else 'Morno',
                        'motivo_perda': ''
                    }

    final_list = list(processed_leads.values())
    print(f"\nTOTAL CONSOLIDADO FINAL DE LEADS: {len(final_list)}")
    
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(final_list, f, ensure_ascii=False, indent=2)
        
    print("data.json atualizado com status_geral e situações exatas do CRM Supremo!")

if __name__ == '__main__':
    build_unified_dataset()
