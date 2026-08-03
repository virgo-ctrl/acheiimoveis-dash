const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8080;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const DATA_JSON_PATH = path.join(__dirname, 'data.json');

const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

if (!supabase) {
    console.warn('[server] AVISO: SUPABASE_URL ou SUPABASE_ANON_KEY não configurados. Usando apenas data.json.');
}

// In-memory cache
let cachedLeads = null;
let cacheTimestamp = null;
let isSyncing = false;

// Fallback: carrega data.json no cache inicial
function loadFallback() {
    try {
        const raw = fs.readFileSync(DATA_JSON_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        cachedLeads = Array.isArray(parsed) ? parsed : [];
        cacheTimestamp = new Date().toISOString();
        console.log(`[server] Cache inicializado com data.json (${cachedLeads.length} leads)`);
    } catch (e) {
        cachedLeads = [];
        console.warn('[server] Sem data.json para fallback.');
    }
}

// Busca todos os leads do Supabase paginando de 1000 em 1000
async function fetchFromSupabase() {
    if (!supabase) throw new Error('Supabase não configurado.');

    const PAGE_SIZE = 1000;
    let from = 0;
    let allLeads = [];
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .range(from, from + PAGE_SIZE - 1)
            .order('data_ultima_interacao', { ascending: false });

        if (error) throw new Error(`Supabase error: ${error.message}`);

        allLeads = allLeads.concat(data || []);
        hasMore = (data && data.length === PAGE_SIZE);
        from += PAGE_SIZE;
    }

    return allLeads;
}

async function refreshCache() {
    if (isSyncing) return { already: true };
    isSyncing = true;
    console.log('[server] Atualizando cache do Supabase...');
    try {
        const leads = await fetchFromSupabase();
        cachedLeads = leads;
        cacheTimestamp = new Date().toISOString();
        console.log(`[server] Cache atualizado: ${leads.length} leads do Supabase.`);
        return { count: leads.length, timestamp: cacheTimestamp };
    } finally {
        isSyncing = false;
    }
}

// Serve static files
app.use(express.static(path.join(__dirname)));

// GET /api/leads — retorna cache imediatamente
app.get('/api/leads', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(cachedLeads || []);
});

// GET /api/leads/status
app.get('/api/leads/status', (req, res) => {
    res.json({
        count: cachedLeads ? cachedLeads.length : 0,
        timestamp: cacheTimestamp,
        syncing: isSyncing,
        source: supabase ? 'supabase' : 'data.json',
    });
});

// POST /api/sync — atualiza cache do Supabase em background
app.post('/api/sync', (req, res) => {
    if (isSyncing) {
        return res.json({ status: 'already_syncing', message: 'Atualização já em andamento.' });
    }
    refreshCache()
        .then(r => console.log('[server] Refresh concluído:', r))
        .catch(e => console.error('[server] Erro no refresh:', e.message));
    res.json({ status: 'started', message: 'Atualizando dados do Supabase em background.' });
});

// Inicializa
loadFallback();

app.listen(PORT, () => {
    console.log(`[server] Dashboard rodando em http://localhost:${PORT}`);
    // Tenta atualizar cache do Supabase ao iniciar
    if (supabase) {
        refreshCache()
            .then(r => console.log('[server] Cache inicial do Supabase:', r))
            .catch(e => console.warn('[server] Supabase indisponível, usando data.json:', e.message));
    }
});
