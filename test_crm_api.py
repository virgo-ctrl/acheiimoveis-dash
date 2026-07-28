import urllib.request
import json
import ssl
import sys

sys.stdout.reconfigure(encoding='utf-8')

token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhcGktY3JtIiwic3ViIjo3NDksIm5vbWUiOiJBRE0gQUNIRUkiLCJlbWFpbCI6ImZpbmFuY2Vpcm9AYWNoZWlpbW92ZWlzY2FydWFydS5jb20iLCJkZGQiOm51bGwsInBob25lIjpudWxsLCJzaXRfaWQiOjE0Mywic2l0X25vbWUiOiJBY2hlaSBJbVx1MDBmM3ZlaXMiLCJpZF9jaGF2ZSI6MjMwLCJpYXQiOjE3ODQ2NTY3OTQsImV4cCI6MjEwMDAxNjc5NH0.HRDiKVM2vC34etwUreu5Z6fPlkHissi73-1abjOoem0'

headers = {
    'Authorization': f'Bearer {token}',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0'
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

endpoints = [
    'https://api.supremocrm.com.br/v1/corretores',
    'https://api.supremocrm.com.br/v1/usuarios',
    'https://api.supremocrm.com.br/v1/situacoes',
    'https://api.supremocrm.com.br/v1/etapas',
    'https://api.supremocrm.com.br/v1/campanhas',
    'https://api.supremocrm.com.br/v1/origens'
]

for ep in endpoints:
    req = urllib.request.Request(ep, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            raw = resp.read().decode('utf-8')
            data = json.loads(raw)
            items = data.get('data', data)
            count = len(items) if isinstance(items, list) else 'dict'
            print(f"SUCCESS {ep} -> {count} items")
            if isinstance(items, list) and items:
                print("  Sample:", items[0])
    except Exception as e:
        print(f"Failed {ep}: {e}")
