const express = require('express');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.SUPREMO_CRM_TOKEN;
const BASE_URL = 'https://api.supremocrm.com.br/v1/leads';
const MAX_PAGES = 200;
const DELAY_MS = 200;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchPage(page) {
    return new Promise((resolve, reject) => {
        const url = `${BASE_URL}?pagina=${page}`;
        const options = {
            headers: {
                Authorization: `Bearer ${TOKEN}`,
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0',
            },
            rejectUnauthorized: false,
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 429) {
                    resolve({ rateLimited: true });
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                try {
                    resolve({ json: JSON.parse(data) });
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function cleanPhone(p) {
    if (!p) return '';
    const digits = String(p).replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) return '55' + digits;
    return digits;
}

function processLeads(rawLeads) {
    const processed = {};
    for (const r of rawLeads) {
        const cid = String(r.id || '');
        if (!cid || processed[cid]) continue;

        const corretor = r.nome_corretor || 'Pendente (Não Atribuído)';
        const statusGeral = (r.nome_status || 'ATIVO').toUpperCase();
        let situacao = (r.nome_situacao || '').trim();
        if (!situacao) {
            if (statusGeral === 'VENDIDO') situacao = 'Venda Realizada';
            else if (statusGeral === 'PERDIDO') situacao = 'Venda Desistida';
            else situacao = 'Sem Situação Definida';
        }

        const telefone = r.telefone_pessoa || '';
        const ddi = r.ddi_pessoa || '55';
        const fullTel = String(ddi) + String(telefone);

        processed[cid] = {
            id: cid,
            source: 'CRM Supremo API',
            nome: r.nome_pessoa || 'Cliente CRM',
            telefone: fullTel,
            whatsapp_phone: cleanPhone(fullTel),
            email: r.email_pessoa || '',
            origem: r.nome_origem || 'CRM Supremo',
            campanha: r.nome_campanha || 'VENTANA',
            data_captura: r.data_captura || '',
            data_ultima_interacao: r.data_ultima_interacao || r.data_captura || '',
            corretor: corretor.trim(),
            status_geral: statusGeral,
            situacao,
            etapa: r.nome_etapa || 'LEADS COM O CORRETOR',
            valor_oportunidade: 218000,
            prazo_compra: 'Não informado',
            calor: r.calor || 'Normal',
            motivo_perda: r.motivo_perda || '',
        };
    }
    return Object.values(processed);
}

// Serve static files
app.use(express.static(path.join(__dirname)));

// API route
app.get('/api/leads', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');

    if (!TOKEN) {
        return res.status(500).json({ error: 'SUPREMO_CRM_TOKEN não configurado.' });
    }

    const allLeads = [];
    let page = 1;
    let totalPages = 1;

    try {
        while (page <= totalPages && page <= MAX_PAGES) {
            const result = await fetchPage(page);
            if (result.rateLimited) {
                await sleep(1500);
                continue;
            }
            const pageData = result.json.data || [];
            totalPages = result.json.totalPaginas || 1;
            allLeads.push(...pageData);
            page++;
            if (page <= totalPages) await sleep(DELAY_MS);
        }

        const processed = processLeads(allLeads);
        return res.status(200).json(processed);
    } catch (err) {
        console.error('[server] Erro ao buscar Supremo CRM:', err.message);
        return res.status(502).json({ error: 'Falha ao buscar dados do Supremo CRM.', detail: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Dashboard rodando em http://localhost:${PORT}`);
});
