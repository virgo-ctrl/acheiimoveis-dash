const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const TOKEN = process.env.SUPREMO_CRM_TOKEN;
const BASE_URL = 'https://api.supremocrm.com.br/v1/leads';
const MAX_PAGES = 200;
const DELAY_MS = 150;
const DATA_JSON_PATH = path.join(__dirname, 'data.json');

// In-memory cache
let cachedLeads = null;
let cacheTimestamp = null;
let isSyncing = false;

// Load data.json as initial cache
function loadFallback() {
    try {
        const raw = fs.readFileSync(DATA_JSON_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        cachedLeads = Array.isArray(parsed) ? parsed : [];
        cacheTimestamp = new Date().toISOString();
        console.log(`[server] Cache inicializado com data.json (${cachedLeads.length} leads)`);
    } catch (e) {
        cachedLeads = [];
        console.warn('[server] Sem data.json para fallback:', e.message);
    }
}

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

        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 429) { resolve({ rateLimited: true }); return; }
                if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
                try { resolve({ json: JSON.parse(data) }); }
                catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
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

async function syncFromCRM() {
    if (isSyncing) return { already: true };
    if (!TOKEN) throw new Error('SUPREMO_CRM_TOKEN não configurado.');

    isSyncing = true;
    console.log('[server] Iniciando sync com Supremo CRM...');

    const allLeads = [];
    let page = 1;
    let totalPages = 1;

    try {
        while (page <= totalPages && page <= MAX_PAGES) {
            const result = await fetchPage(page);
            if (result.rateLimited) {
                console.log(`[server] Rate limited na página ${page}, aguardando...`);
                await sleep(2000);
                continue;
            }
            const pageData = result.json.data || result.json || [];
            totalPages = result.json.totalPaginas || result.json.total_paginas || 1;
            allLeads.push(...(Array.isArray(pageData) ? pageData : []));
            console.log(`[server] Página ${page}/${totalPages} — ${allLeads.length} leads acumulados`);
            page++;
            if (page <= totalPages) await sleep(DELAY_MS);
        }

        const processed = processLeads(allLeads);
        cachedLeads = processed;
        cacheTimestamp = new Date().toISOString();

        // Persist to data.json
        fs.writeFileSync(DATA_JSON_PATH, JSON.stringify(processed, null, 2));
        console.log(`[server] Sync concluído: ${processed.length} leads. Cache e data.json atualizados.`);
        return { count: processed.length, timestamp: cacheTimestamp };
    } finally {
        isSyncing = false;
    }
}

// Serve static files
app.use(express.static(path.join(__dirname)));

// GET /api/leads — retorna cache imediatamente
app.get('/api/leads', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.json(cachedLeads || []);
});

// GET /api/leads/status — informa estado do cache e se está sincronizando
app.get('/api/leads/status', (req, res) => {
    res.json({
        count: cachedLeads ? cachedLeads.length : 0,
        timestamp: cacheTimestamp,
        syncing: isSyncing,
    });
});

// POST /api/sync — dispara sync em background, responde imediatamente
app.post('/api/sync', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (isSyncing) {
        return res.json({ status: 'already_syncing', message: 'Sincronização já em andamento.' });
    }
    syncFromCRM()
        .then(r => console.log('[server] Sync finalizado:', r))
        .catch(e => console.error('[server] Erro no sync:', e.message));
    res.json({ status: 'started', message: 'Sincronização iniciada em background.' });
});

// Inicializa servidor
loadFallback();
app.listen(PORT, () => {
    console.log(`[server] Dashboard rodando em http://localhost:${PORT}`);
    // Sync automático ao iniciar (em background)
    if (TOKEN) {
        console.log('[server] Iniciando sync automático...');
        syncFromCRM()
            .then(r => console.log('[server] Sync inicial concluído:', r))
            .catch(e => console.error('[server] Erro no sync inicial:', e.message));
    }
});
