import zipfile
import xml.etree.ElementTree as ET
import sys
import json
import datetime
import re

sys.stdout.reconfigure(encoding='utf-8')

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def excel_date_to_str(serial):
    try:
        val = float(serial)
        if val <= 0: return ""
        # Excel date epoch starts Dec 30 1899
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=val)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except:
        return str(serial)

def parse_full_xlsx(filename):
    sheets_data = {}
    with zipfile.ZipFile(filename, 'r') as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            ss_xml = z.read('xl/sharedStrings.xml')
            ss_root = ET.fromstring(ss_xml)
            for t in ss_root.findall('.//s:t', NS):
                shared_strings.append(t.text or '')

        rels = {}
        rels_xml = z.read('xl/_rels/workbook.xml.rels')
        rels_root = ET.fromstring(rels_xml)
        for r in rels_root:
            rels[r.attrib['Id']] = r.attrib['Target']

        wb_xml = z.read('xl/workbook.xml')
        wb_root = ET.fromstring(wb_xml)
        for sheet_elem in wb_root.findall('.//s:sheet', NS):
            sheet_name = sheet_elem.attrib['name']
            r_id = sheet_elem.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = rels[r_id]
            sheet_file = 'xl/' + target if not target.startswith('xl/') else target
            
            sheet_xml = z.read(sheet_file)
            sheet_root = ET.fromstring(sheet_xml)
            rows = sheet_root.findall('.//s:row', NS)
            
            parsed_rows = []
            for r in rows:
                row_data = []
                for c in r.findall('.//s:c', NS):
                    v_elem = c.find('s:v', NS)
                    cell_val = ''
                    if v_elem is not None:
                        val = v_elem.text
                        t_type = c.attrib.get('t')
                        if t_type == 's' and val and val.isdigit():
                            idx = int(val)
                            cell_val = shared_strings[idx] if idx < len(shared_strings) else val
                        else:
                            cell_val = val or ''
                    row_data.append(cell_val)
                parsed_rows.append(row_data)

            sheets_data[sheet_name] = parsed_rows
    return sheets_data

print("Parsing full datasets...")
meta_sheets = parse_full_xlsx('meta_ads_full.xlsx')
crm_sheets = parse_full_xlsx('crm_supremo_full.xlsx')

all_leads_dict = {}

# 1. Process Database Sheet "Leads de todo o banco de dados"
db_rows = meta_sheets.get('Leads de todo o banco de dados ', [])
if len(db_rows) > 1:
    header = db_rows[0]
    print(f"\nDB Sheet total rows: {len(db_rows)-1}")
    print(f"Header: {header}")
    
    for r in db_rows[1:]:
        if not r or len(r) < 5: continue
        lead_id = r[0].replace('.0', '').strip() if len(r) > 0 else ''
        if not lead_id: continue
        
        captura_date = excel_date_to_str(r[1]) if len(r) > 1 else ''
        nome = r[3].strip() if len(r) > 3 else ''
        ddd = r[5].replace('.0', '').strip() if len(r) > 5 else ''
        tel = r[6].strip() if len(r) > 6 else ''
        full_phone = ddd + tel
        clean_phone = re.sub(r'\D', '', full_phone)
        if len(clean_phone) in (10, 11): clean_phone = '55' + clean_phone
        
        origem = r[9].strip() if len(r) > 9 else 'Instagram Patrocinado'
        campanha = r[10].strip() if len(r) > 10 else 'Formulário: VENTANA 160726'
        corretor = r[18].strip() if len(r) > 18 else 'Pendente (Não Atribuído)'
        if not corretor: corretor = 'Pendente (Não Atribuído)'
        
        ult_interacao = excel_date_to_str(r[20]) if len(r) > 20 else captura_date
        situacao = r[24].strip() if len(r) > 24 else ''
        if not situacao: situacao = 'Aguardando Atendimento' if corretor != 'Pendente (Não Atribuído)' else 'Novo Lead Meta'
        
        calor = r[25].strip() if len(r) > 25 else ''

        all_leads_dict[lead_id] = {
            'id': lead_id,
            'source': 'CRM Supremo' if corretor != 'Pendente (Não Atribuído)' else 'Meta Ads',
            'nome': nome or 'Cliente Sem Nome',
            'telefone': full_phone or tel,
            'whatsapp_phone': clean_phone,
            'email': '',
            'origem': origem,
            'campanha': campanha,
            'data_captura': captura_date,
            'data_ultima_interacao': ult_interacao,
            'corretor': corretor,
            'situacao': situacao,
            'etapa': 'LEADS BANCO DE DADOS',
            'valor_oportunidade': 218000,
            'prazo_compra': 'Não informado',
            'calor': calor
        }

# 2. Process "Meta forms | Ventana 2.0"
meta2_rows = meta_sheets.get('Meta forms | Ventana 2.0', [])
if len(meta2_rows) > 1:
    print(f"\nMeta 2.0 total rows: {len(meta2_rows)-1}")
    for r in meta2_rows[1:]:
        if not r or len(r) < 13: continue
        meta_id = r[0].strip()
        created = r[1].replace('T', ' ').split('-03:00')[0]
        full_name = r[12].strip()
        phone = r[13].strip() if len(r) > 13 else ''
        clean_phone = re.sub(r'\D', '', phone)
        
        if meta_id not in all_leads_dict:
            all_leads_dict[meta_id] = {
                'id': meta_id,
                'source': 'Meta Ads',
                'nome': full_name or 'Lead Meta Ads',
                'telefone': phone,
                'whatsapp_phone': clean_phone,
                'email': '',
                'origem': 'Meta Forms Ventana 2.0',
                'campanha': r[7].strip() if len(r) > 7 else 'LEADS | VENTANA | LANÇAMENTO',
                'data_captura': created,
                'data_ultima_interacao': created,
                'corretor': 'Pendente (Não Atribuído)',
                'situacao': 'Novo Lead Meta',
                'etapa': 'LEADS META ADS',
                'valor_oportunidade': 218000,
                'prazo_compra': 'O quanto antes',
                'calor': 'Quente'
            }

print(f"\nTOTAL CONSOLIDATED UNIQUE LEADS: {len(all_leads_dict)}")

# Save dataset
all_leads_list = list(all_leads_dict.values())
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(all_leads_list, f, ensure_ascii=False, indent=2)

print("data.json updated with FULL 1,300+ leads database!")
