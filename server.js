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

// Converte o formato do Supabase (n8n) para o formato esperado pelo app.js
function transformLead(r) {
    return {
        id:                         r.id,
        nome:                       r.nome_pessoa,
        telefone:                   r.telefone_pessoa,
        whatsapp_phone:             r.ddi_pessoa ? `${r.ddi_pessoa}${r.telefone_pessoa}` : r.telefone_pessoa,
        email:                      r.email_pessoa,
        origem:                     r.nome_origem,
        campanha:                   r.nome_campanha,
        source:                     r.nome_origem,
        data_captura:               r.data_captura,
        data_ultima_interacao:      r.data_ultima_interacao,
        corretor:                   r.nome_corretor || 'Pendente (Não Atribuído)',
        id_corretor:                r.id_corretor,
        status_geral:               r.nome_status,
        situacao:                   r.nome_situacao,
        etapa:                      r.nome_etapa,
        calor:                      r.calor,
        motivo_perda:               r.motivo_perda,
        valor_oportunidade:         r.valor_vendido,
        interesses:                 r.interesses,
        anotacoes:                  r.anotacoes,
        nome_empreendimento:        r.nome_empreendimento,
        nome_imovel:                r.nome_imovel,
        nome_construtora:           r.nome_construtora,
        nome_qualificador:          r.nome_qualificador,
        fl_integracao:              r.fl_integracao,
    };
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
            .order('data_captura', { ascending: false });

        if (error) throw new Error(`Supabase error: ${error.message}`);

        allLeads = allLeads.concat(data || []);
        hasMore = (data && data.length === PAGE_SIZE);
        from += PAGE_SIZE;
    }

    return allLeads.map(transformLead);
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
