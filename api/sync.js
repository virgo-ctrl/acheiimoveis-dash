const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const TOKEN    = process.env.SUPREMO_CRM_TOKEN;
const BASE_URL = 'https://api.supremocrm.com.br/v1/leads';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchPage(page) {
    return new Promise((resolve, reject) => {
        const url = `${BASE_URL}?pagina=${page}`;
        const opts = {
            headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
            rejectUnauthorized: false,
        };
        https.get(url, opts, (res) => {
            let raw = '';
            res.on('data', c => { raw += c; });
            res.on('end', () => {
                if (res.statusCode === 429) { resolve({ rateLimited: true }); return; }
                if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
                try { resolve({ json: JSON.parse(raw) }); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido' }); return; }

    if (!TOKEN) { res.status(500).json({ error: 'SUPREMO_CRM_TOKEN não configurado.' }); return; }

    try {
        const allLeads = [];
        let page = 1;
        let totalPages = 1;
        const MAX_PAGES = 300;

        while (page <= totalPages && page <= MAX_PAGES) {
            const result = await fetchPage(page);
            if (result.rateLimited) { await sleep(2000); continue; }

            const pageData = result.json.data || [];
            totalPages = result.json.totalPaginas || 1;
            allLeads.push(...pageData);
            page++;
            if (page <= totalPages) await sleep(150);
        }

        if (allLeads.length === 0) {
            return res.status(200).json({ ok: true, upserted: 0, message: 'Nenhum lead retornado.' });
        }

        // Upsert em lotes de 500
        const BATCH = 500;
        let upserted = 0;
        for (let i = 0; i < allLeads.length; i += BATCH) {
            const batch = allLeads.slice(i, i + BATCH).map(r => ({
                id:                          r.id,
                id_pessoa:                   r.id_pessoa,
                nome_pessoa:                 r.nome_pessoa,
                ddi_pessoa:                  r.ddi_pessoa,
                telefone_pessoa:             r.telefone_pessoa,
                email_pessoa:                r.email_pessoa,
                id_origem:                   r.id_origem,
                nome_origem:                 r.nome_origem,
                id_campanha:                 r.id_campanha,
                nome_campanha:               r.nome_campanha,
                data_captura:                r.data_captura,
                data_validado:               r.data_validado,
                data_qualificado:            r.data_qualificado,
                data_vendendo:               r.data_vendendo,
                data_com_corretor:           r.data_com_corretor,
                data_ultima_interacao:       r.data_ultima_interacao,
                id_imovel:                   r.id_imovel,
                nome_imovel:                 r.nome_imovel,
                id_empreendimento:           r.id_empreendimento,
                nome_empreendimento:         r.nome_empreendimento,
                id_qualificador:             r.id_qualificador,
                nome_qualificador:           r.nome_qualificador,
                id_corretor:                 r.id_corretor,
                nome_corretor:               r.nome_corretor,
                interesses:                  r.interesses,
                calor:                       r.calor,
                status:                      r.status,
                nome_status:                 r.nome_status,
                etapa:                       r.etapa,
                nome_etapa:                  r.nome_etapa,
                data_vendido_perdido:        r.data_vendido_perdido,
                id_situacao:                 r.id_situacao,
                nome_situacao:               r.nome_situacao,
                anotacoes:                   r.anotacoes,
                id_construtora:              r.id_construtora,
                nome_construtora:            r.nome_construtora,
                valor_vendido:               r.valor_vendido,
                anotacoes_vendido:           r.anotacoes_vendido,
                bloco_vendido:               r.bloco_vendido,
                unidade_vendido:             r.unidade_vendido,
                id_motivo_perda:             r.id_motivo_perda,
                motivo_perda:                r.motivo_perda,
                id_imovel_vendido:           r.id_imovel_vendido,
                nome_imovel_vendido:         r.nome_imovel_vendido,
                id_empreendimento_vendido:   r.id_empreendimento_vendido,
                nome_empreendimento_vendido: r.nome_empreendimento_vendido,
                fl_integracao:               r.fl_integracao,
                synced_at:                   new Date().toISOString(),
            }));

            const { error } = await supabase
                .from('leads')
                .upsert(batch, { onConflict: 'id' });

            if (error) throw new Error(`Supabase upsert erro: ${error.message}`);
            upserted += batch.length;
        }

        res.status(200).json({ ok: true, upserted, total: allLeads.length });
    } catch (err) {
        console.error('[api/sync] Erro:', err.message);
        res.status(502).json({ error: err.message });
    }
};
