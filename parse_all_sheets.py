import zipfile
import xml.etree.ElementTree as ET
import sys

sys.stdout.reconfigure(encoding='utf-8')

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def parse_xlsx(filename):
    print(f"\n==========================================")
    print(f"PARSING ALL SHEETS IN: {filename}")
    print(f"==========================================")
    
    with zipfile.ZipFile(filename, 'r') as z:
        # Get shared strings
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            ss_xml = z.read('xl/sharedStrings.xml')
            ss_root = ET.fromstring(ss_xml)
            for t in ss_root.findall('.//s:t', NS):
                shared_strings.append(t.text or '')

        # Get sheet relationships
        rels = {}
        rels_xml = z.read('xl/_rels/workbook.xml.rels')
        rels_root = ET.fromstring(rels_xml)
        for r in rels_root:
            rels[r.attrib['Id']] = r.attrib['Target']

        # Get workbook sheets
        wb_xml = z.read('xl/workbook.xml')
        wb_root = ET.fromstring(wb_xml)
        sheets = wb_root.findall('.//s:sheet', NS)

        for sheet_elem in sheets:
            sheet_name = sheet_elem.attrib['name']
            r_id = sheet_elem.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = rels[r_id]
            sheet_file = 'xl/' + target if not target.startswith('xl/') else target
            
            sheet_xml = z.read(sheet_file)
            sheet_root = ET.fromstring(sheet_xml)
            rows = sheet_root.findall('.//s:row', NS)
            
            print(f"\n--- Sheet: '{sheet_name}' (Total Rows: {len(rows)}) ---")
            
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

            if parsed_rows:
                print(f"Header: {parsed_rows[0]}")
                if len(parsed_rows) > 1:
                    print(f"Row 1: {parsed_rows[1]}")
                if len(parsed_rows) > 2:
                    print(f"Row 2: {parsed_rows[2]}")

parse_xlsx('crm_supremo_full.xlsx')
parse_xlsx('meta_ads_full.xlsx')
