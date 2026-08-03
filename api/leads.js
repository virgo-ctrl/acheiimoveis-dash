const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

function transformLead(r) {
    const ddi = r.ddi_pessoa || '55';
    const tel = r.telefone_pessoa || '';
    const fullTel = String(ddi) + String(tel);

    const statusGeral = (r.nome_status || 'ATIVO').toUpperCase();
    let situacao = (r.nome_situacao || '').trim();
    if (!situacao) {
        if (statusGeral === 'VENDIDO') situacao = 'Venda Realizada';
        else if (statusGeral === 'PERDIDO') situacao = 'Venda Desistida';
        else situacao = 'Sem Situação Definida';
    }

    return {
        id:                    String(r.id),
        source:                r.nome_origem || 'CRM Supremo',
        nome:                  r.nome_pessoa || 'Cliente CRM',
        telefone:              fullTel,
        whatsapp_phone:        fullTel.replace(/\D/g, ''),
        email:                 r.email_pessoa || '',
        origem:                r.nome_origem || '',
        campanha:              r.nome_campanha || '',
        data_captura:          r.data_captura || '',
        data_ultima_interacao: r.data_ultima_interacao || r.data_captura || '',
        corretor:              r.nome_corretor || 'Pendente (Não Atribuído)',
        id_corretor:           r.id_corretor,
        status_geral:          statusGeral,
        situacao,
        etapa:                 r.nome_etapa || '',
        calor:                 r.calor,
        motivo_perda:          r.motivo_perda || '',
        valor_oportunidade:    r.valor_vendido || 0,
        interesses:            r.interesses || '',
        anotacoes:             r.anotacoes || '',
        nome_empreendimento:   r.nome_empreendimento || '',
        nome_imovel:           r.nome_imovel || '',
    };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    try {
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

            if (error) throw new Error(error.message);

            allLeads = allLeads.concat(data || []);
            hasMore = data && data.length === PAGE_SIZE;
            from += PAGE_SIZE;
        }

        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(allLeads.map(transformLead));
    } catch (err) {
        console.error('[api/leads] Erro:', err.message);
        res.status(502).json({ error: err.message });
    }
};
