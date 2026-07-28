/**
 * ACHEI IMÓVEIS - DASHBOARD ENGINE & INTERACTIVE ANALYTICS
 * Full Integration with Supremo CRM API & Meta Ads
 * Matches exact Supremo CRM Kanban Board & Conversion Metrics (Visitas, Documentos, Vendas, Desistências)
 */

document.addEventListener('DOMContentLoaded', () => {
    let leadsData = [];
    let corretoresList = [];
    
    // Pagination state for Leads table
    let currentPage = 1;
    const pageSize = 50;

    // Chart instances
    let chartFunnelInstance = null;
    let chartIntentInstance = null;
    let chartCorretoresInstance = null;

    // Broker Short Display Names Map (Matching Spreadsheet reference)
    const brokerShortNames = {
        'BRUNO FERRARI': 'Bruno',
        'WILLYELSON PAULO VIEIRA DA SILVA': 'Will',
        'RENATO BARBOSA DA SILVA': 'Renato',
        'LIVIA ESTEPHANYE DA SILVA': 'Livia',
        'NATIETE PRICILA DE MORAIS LIMA': 'Nati',
        'SAULO JOSE DA SILVA MELO': 'Saulo Melo',
        'FÁBIO FÉLIX SANTOS SOUZA': 'Fabio',
        'AMARA CRISTIANE FERREIRA TEODORO': 'Amara',
        'SAULO CAVALCANTE SILVA': 'Saulo Cavalcante',
        'Cibely Queiros Brito dos Anjos': 'Cibelly',
        'TACIANA CRISTINA ELOI': 'Taciana',
        'Katiucia Maria da Silva': 'Katiucia',
        'Mario Sergio da Silva Sales': 'Mario',
        'FERNANDO SOUZA': 'Fernando',
        'JULIO GOMES DA SILVA NETO': 'Julio',
        'Felipe de Souza Silva': 'Felipe',
        'VICTOR': 'Victor'
    };

    function getBrokerShortName(fullName) {
        if (!fullName) return 'Indefinido';
        if (brokerShortNames[fullName]) return brokerShortNames[fullName];
        const parts = fullName.trim().split(' ');
        return parts[0];
    }

    // Broker Real Photos Map
    const brokerPhotos = {
        'AMARA CRISTIANE FERREIRA TEODORO': 'fotos dos corretores/Amara Cristiane.jpeg',
        'BRUNO FERRARI': 'fotos dos corretores/Bruno Ferrari.jpeg',
        'KATIUCIA MARIA DA SILVA': 'fotos dos corretores/Katyucia Silva.jpeg',
        'NATIETE PRICILA DE MORAIS LIMA': 'fotos dos corretores/Nati Morais.jpeg',
        'RENATO BARBOSA DA SILVA': 'fotos dos corretores/Renato Barbosa.jpeg',
        'SAULO JOSE DA SILVA MELO': 'fotos dos corretores/Saulo Melo.jpeg',
        'TACIANA CRISTINA ELOI': 'fotos dos corretores/Taciana Eloi.jpeg',
        'WILLYELSON PAULO VIEIRA DA SILVA': 'fotos dos corretores/Will Vieira.jpeg',
        'FABIO FELIX SANTOS SOUZA': 'fotos dos corretores/fabio felix.jpeg',
        'FÁBIO FÉLIX SANTOS SOUZA': 'fotos dos corretores/fabio felix.jpeg'
    };

    function renderBrokerAvatarHtml(fullName, customClass = '') {
        if (!fullName) return `<div class="corretor-avatar ${customClass}">??</div>`;
        const normalizedKey = fullName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        
        let photoPath = null;
        for (const [key, val] of Object.entries(brokerPhotos)) {
            if (key.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === normalizedKey) {
                photoPath = val;
                break;
            }
        }

        const initials = getInitials(fullName);
        if (photoPath) {
            return `
                <div class="corretor-avatar-wrap ${customClass}">
                    <img src="${encodeURI(photoPath)}" alt="${fullName}" class="corretor-photo-img" onerror="this.onerror=null; this.parentElement.outerHTML='<div class=\\'corretor-avatar ${customClass}\\'>${initials}</div>';">
                </div>
            `;
        }
        return `<div class="corretor-avatar ${customClass}">${initials}</div>`;
    }

    // Helper functions
    function formatCurrency(val) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
    }

    function getInitials(name) {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // Load Data Async
    async function loadDataset() {
        try {
            const res = await fetch('data.json?v=' + Date.now());
            leadsData = await res.json();
            
            // Extract unique Corretores
            const corrSet = new Set(leadsData.map(l => l.corretor).filter(c => c && c !== 'Pendente (Não Atribuído)'));
            corretoresList = Array.from(corrSet).sort();

            populateBrokerSelects();
            initCharts();
            setupEventListeners();
            populateDistributionModalCorretores();
            renderDashboard();
        } catch (err) {
            console.error('Error loading dataset:', err);
        }
    }

    // Populate broker selects dynamically
    function populateBrokerSelects() {
        const globalBrokerSelect = document.getElementById('global-filter-corretor');
        const tableBrokerSelect = document.getElementById('filter-corretor');

        const optionsHtml = `
            <option value="ALL">Todos os Corretores (${corretoresList.length})</option>
            <option value="Pendente (Não Atribuído)">Pendente (Meta Ads)</option>
            ${corretoresList.map(c => `<option value="${c}">${c}</option>`).join('')}
        `;

        globalBrokerSelect.innerHTML = optionsHtml;
        tableBrokerSelect.innerHTML = optionsHtml;
    }

    // Get Filtered Dataset based on Global Broker Filter & Date of Last Update Filter
    function getFilteredLeads() {
        const corrFilter = document.getElementById('global-filter-corretor').value;
        const datePreset = document.getElementById('global-filter-date-preset').value;
        const startDate = document.getElementById('filter-date-start').value;
        const endDate = document.getElementById('filter-date-end').value;

        return leadsData.filter(r => {
            // Broker filter
            if (corrFilter !== 'ALL' && r.corretor !== corrFilter) {
                return false;
            }

            // Last update date filter
            const lastUpdate = r.data_ultima_interacao || r.data_captura;
            const dateStr = lastUpdate ? lastUpdate.split(' ')[0] : '';

            if (datePreset === 'TODAY') {
                if (dateStr !== '2026-07-27') return false;
            } else if (datePreset === 'YESTERDAY') {
                if (dateStr !== '2026-07-26') return false;
            } else if (datePreset === 'CUSTOM') {
                if (startDate && dateStr < startDate) return false;
                if (endDate && dateStr > endDate) return false;
            }

            return true;
        });
    }

    // Main Update Dashboard Trigger
    function renderDashboard() {
        const currentFilteredLeads = getFilteredLeads();

        updateKPIs(currentFilteredLeads);
        renderRankingCorretores(currentFilteredLeads);
        renderMatrizDesempenho(currentFilteredLeads);
        renderFunnelBoard(currentFilteredLeads);
        renderCorretoresTable(currentFilteredLeads);
        renderLeadsTable(currentFilteredLeads);
        updateCharts(currentFilteredLeads);
    }

    // Helper: Compute Complete Broker Metrics Dataset
    function getBrokersCalculatedStats(dataset) {
        return corretoresList.map(corr => {
            const corrLeads = dataset.filter(r => r.corretor === corr);
            const totalLeads = corrLeads.length;

            const agendamentos = corrLeads.filter(r => 
                ['Visita Agendada', 'Pré Atendimento', 'Atendimento', 'Elaborando Proposta', 'Em Atendimento', 'Primeiro Contato'].includes(r.situacao)
            ).length;

            const visitas = corrLeads.filter(r => 
                ['Visita Realizada', 'Em Atendimento', 'Elaborando Proposta', 'Venda Realizada', 'Contrato Assinado Cliente'].includes(r.situacao) || r.status_geral === 'VENDIDO'
            ).length;

            const vendas = corrLeads.filter(r => 
                r.status_geral === 'VENDIDO' || r.situacao === 'Venda Realizada' || r.situacao === 'Contrato Assinado Cliente'
            ).length;

            const desistidas = corrLeads.filter(r => 
                r.status_geral === 'PERDIDO' || r.situacao === 'Venda Desistida'
            ).length;

            const taxaConversao = totalLeads > 0 ? ((vendas / totalLeads) * 100).toFixed(1) : '0.0';
            const vgvTotal = vendas * 218000;

            return {
                fullName: corr,
                shortName: getBrokerShortName(corr),
                totalLeads,
                agendamentos,
                visitas,
                vendas,
                desistidas,
                taxaConversao: parseFloat(taxaConversao),
                vgvTotal
            };
        });
    }

    // Render 🏆 Ranking dos Melhores Corretores (Dash Geral Podium + Leaderboard)
    function renderRankingCorretores(dataset) {
        const stats = getBrokersCalculatedStats(dataset);
        
        // Sort: Vendas DESC > Visitas DESC > Agendamentos DESC > Total Leads DESC
        stats.sort((a, b) => {
            if (b.vendas !== a.vendas) return b.vendas - a.vendas;
            if (b.visitas !== a.visitas) return b.visitas - a.visitas;
            if (b.agendamentos !== a.agendamentos) return b.agendamentos - a.agendamentos;
            return b.totalLeads - a.totalLeads;
        });

        const podiumContainer = document.getElementById('ranking-podium');
        const leaderboardList = document.getElementById('ranking-leaderboard-list');

        if (!podiumContainer || !leaderboardList) return;

        podiumContainer.innerHTML = '';
        leaderboardList.innerHTML = '';

        if (stats.length === 0) return;

        // Top 3 Podium Cards
        const top3 = stats.slice(0, 3);
        const ranks = [
            { rank: 1, medal: '🥇', class: 'rank-1', label: '1º LUGAR' },
            { rank: 2, medal: '🥈', class: 'rank-2', label: '2º LUGAR' },
            { rank: 3, medal: '🥉', class: 'rank-3', label: '3º LUGAR' }
        ];

        top3.forEach((item, index) => {
            const rInfo = ranks[index];
            const card = document.createElement('div');
            card.className = `podium-card ${rInfo.class}`;
            card.innerHTML = `
                <div class="podium-rank-badge">${rInfo.medal}</div>
                ${renderBrokerAvatarHtml(item.fullName, 'podium-avatar')}
                <h3 class="podium-name">${item.shortName}</h3>
                <span class="podium-subtitle">${item.fullName}</span>

                <div class="podium-metrics-grid">
                    <div class="podium-metric">
                        <span class="podium-metric-val text-success">${item.vendas} Venda(s)</span>
                        <span class="podium-metric-lbl">${formatCurrency(item.vgvTotal)}</span>
                    </div>
                    <div class="podium-metric">
                        <span class="podium-metric-val text-primary">${item.totalLeads} Leads</span>
                        <span class="podium-metric-lbl">${item.taxaConversao}% Conv.</span>
                    </div>
                    <div class="podium-metric">
                        <span class="podium-metric-val text-warning">${item.agendamentos}</span>
                        <span class="podium-metric-lbl">Agendamentos</span>
                    </div>
                    <div class="podium-metric">
                        <span class="podium-metric-val text-info">${item.visitas}</span>
                        <span class="podium-metric-lbl">Visitas</span>
                    </div>
                </div>
            `;
            podiumContainer.appendChild(card);
        });

        // Leaderboard List (Rank 4+)
        const rest = stats.slice(3);
        rest.forEach((item, index) => {
            const rankPos = index + 4;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'leaderboard-item';
            itemDiv.innerHTML = `
                <div class="leaderboard-left">
                    <div class="leaderboard-position">${rankPos}º</div>
                    <div class="leaderboard-broker">
                        ${renderBrokerAvatarHtml(item.fullName, 'leaderboard-avatar')}
                        <div>
                            <div class="leaderboard-name">${item.shortName}</div>
                            <div style="font-size: 11px; color: var(--text-dim);">${item.fullName}</div>
                        </div>
                    </div>
                </div>

                <div class="leaderboard-stats-pills">
                    <div class="stat-pill-group">
                        <span class="stat-pill-val">${item.totalLeads}</span>
                        <span class="stat-pill-lbl">Leads</span>
                    </div>
                    <div class="stat-pill-group">
                        <span class="stat-pill-val text-warning">${item.agendamentos}</span>
                        <span class="stat-pill-lbl">Agend.</span>
                    </div>
                    <div class="stat-pill-group">
                        <span class="stat-pill-val text-info">${item.visitas}</span>
                        <span class="stat-pill-lbl">Visitas</span>
                    </div>
                    <div class="stat-pill-group">
                        <span class="stat-pill-val text-success">${item.vendas}</span>
                        <span class="stat-pill-lbl">Vendas</span>
                    </div>
                    <div class="stat-pill-group">
                        <span class="stat-pill-val text-gold">${item.taxaConversao}%</span>
                        <span class="stat-pill-lbl">Taxa %</span>
                    </div>
                </div>
            `;
            leaderboardList.appendChild(itemDiv);
        });
    }

    // Render Matriz de Desempenho por Corretor (Exact Spreadsheet Reference Match!)
    function renderMatrizDesempenho(dataset) {
        const stats = getBrokersCalculatedStats(dataset);
        const searchInput = document.getElementById('search-corretor-matriz');
        const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';

        // Sort by total leads to maintain clean spreadsheet flow
        stats.sort((a, b) => b.totalLeads - a.totalLeads);

        const tbody = document.getElementById('matriz-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        let countCorretores = 0;
        let sumLeads = 0;
        let sumAgendamentos = 0;
        let sumVisitas = 0;
        let sumVendas = 0;
        let sumDesistidas = 0;

        stats.forEach(item => {
            if (searchText) {
                const matchFull = item.fullName.toLowerCase().includes(searchText);
                const matchShort = item.shortName.toLowerCase().includes(searchText);
                if (!matchFull && !matchShort) return;
            }

            countCorretores++;
            sumLeads += item.totalLeads;
            sumAgendamentos += item.agendamentos;
            sumVisitas += item.visitas;
            sumVendas += item.vendas;
            sumDesistidas += item.desistidas;

            // Row Highlighting matching user reference spreadsheet:
            let rowHighlightClass = '';
            if (item.vendas > 0) rowHighlightClass = 'row-highlight-won';
            else if (item.desistidas > 0) rowHighlightClass = 'row-highlight-lost';
            else if (item.agendamentos > 0) rowHighlightClass = 'row-highlight-appointment';

            // Cell formatting:
            const cellAgendamentos = item.agendamentos > 0 
                ? `<span class="cell-yellow-warn">${item.agendamentos}</span>` 
                : `<span class="cell-zero-dim">0</span>`;

            const cellVisitas = item.visitas > 0 
                ? `<span class="badge badge-info">${item.visitas}</span>` 
                : `<span class="cell-zero-dim">0</span>`;

            const cellVendas = item.vendas > 0 
                ? `<span class="cell-won-green">${item.vendas}</span>` 
                : `<span class="cell-zero-dim">0</span>`;

            const cellDesistidas = item.desistidas > 0 
                ? `<span class="cell-lost-red">${item.desistidas}</span>` 
                : `<span class="cell-zero-dim">0</span>`;

            const tr = document.createElement('tr');
            tr.className = rowHighlightClass;
            tr.innerHTML = `
                <td>
                    <div class="corretor-tag">
                        ${renderBrokerAvatarHtml(item.fullName)}
                        <div>
                            <span class="corretor-name" style="font-weight:700; font-size:14px; color:#0f172a;">${item.shortName}</span>
                            <div style="font-size:11px; color: var(--text-muted);">${item.fullName}</div>
                        </div>
                    </div>
                </td>
                <td class="text-center font-bold" style="font-size:15px; color:#0f172a;">${item.totalLeads}</td>
                <td class="text-center">${cellAgendamentos}</td>
                <td class="text-center">${cellVisitas}</td>
                <td class="text-center">${cellVendas}</td>
                <td class="text-center">${cellDesistidas}</td>
                <td class="text-center"><span class="badge badge-gold">${item.taxaConversao}%</span></td>
                <td class="text-right font-bold ${item.vgvTotal > 0 ? 'text-success' : 'text-muted'}">${formatCurrency(item.vgvTotal)}</td>
                <td class="text-center">
                    <button class="btn btn-outline" style="padding: 4px 10px; font-size: 11px;" onclick="filterByCorretorDirect('${item.fullName}')">
                        <i class="fa-solid fa-filter"></i> Leads
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Update Mini KPI strip
        if (document.getElementById('matriz-total-corretores')) document.getElementById('matriz-total-corretores').textContent = countCorretores;
        if (document.getElementById('matriz-total-leads')) document.getElementById('matriz-total-leads').textContent = sumLeads.toLocaleString('pt-BR');
        if (document.getElementById('matriz-total-agendamentos')) document.getElementById('matriz-total-agendamentos').textContent = sumAgendamentos.toLocaleString('pt-BR');
        if (document.getElementById('matriz-total-visitas')) document.getElementById('matriz-total-visitas').textContent = sumVisitas.toLocaleString('pt-BR');
        if (document.getElementById('matriz-total-vendas')) document.getElementById('matriz-total-vendas').textContent = sumVendas.toLocaleString('pt-BR');
        if (document.getElementById('matriz-total-desistidas')) document.getElementById('matriz-total-desistidas').textContent = sumDesistidas.toLocaleString('pt-BR');
        if (document.getElementById('desempenho-active-badge')) document.getElementById('desempenho-active-badge').textContent = `${countCorretores} Corretores Exibidos`;
    }

    // Direct Broker Filter Trigger
    window.filterByCorretorDirect = function(corrName) {
        document.getElementById('global-filter-corretor').value = corrName;
        document.getElementById('filter-corretor').value = corrName;
        currentPage = 1;
        renderDashboard();
        document.getElementById('section-leads').scrollIntoView({ behavior: 'smooth' });
    };

    // Update KPI Cards with Conversion Metrics
    function updateKPIs(dataset) {
        const totalLeads = dataset.length;
        
        // Vendas Realizadas (Status VENDIDO or Venda Realizada)
        const salesLeads = dataset.filter(r => r.status_geral === 'VENDIDO' || r.situacao === 'Venda Realizada' || r.situacao === 'Contrato Assinado Cliente');
        const vgvWon = salesLeads.reduce((acc, r) => acc + (r.valor_oportunidade || 218000), 0);
        
        // Vendas Desistidas / Perdas (Status PERDIDO or Venda Desistida)
        const lostLeads = dataset.filter(r => r.status_geral === 'PERDIDO' || r.situacao === 'Venda Desistida');

        // Aguardando Atendimento (SLA) (Status ATIVO & Aguardando Atendimento or Novo Lead Meta)
        const waitingLeads = dataset.filter(r => (r.status_geral === 'ATIVO' || !r.status_geral) && (r.situacao === 'Aguardando Atendimento' || r.situacao === 'Novo Lead Meta'));

        // Conversion Milestones
        const visitLeads = dataset.filter(r => ['Em Atendimento', 'Atendimento', 'Visita Agendada', 'Visita Realizada', 'Elaborando Proposta', 'Venda Realizada'].includes(r.situacao) || r.status_geral === 'VENDIDO');
        const docLeads = dataset.filter(r => ['Elaborando Proposta', 'Contrato Assinado Cliente', 'Venda Realizada'].includes(r.situacao) || r.status_geral === 'VENDIDO');
        const activeLeads = dataset.filter(r => (r.status_geral === 'ATIVO' || !r.status_geral) && ['Em Atendimento', 'Atendimento'].includes(r.situacao));

        // Rates calculation
        const rateVisit = totalLeads > 0 ? ((visitLeads.length / totalLeads) * 100).toFixed(1) : '0.0';
        const rateDocs = totalLeads > 0 ? ((docLeads.length / totalLeads) * 100).toFixed(1) : '0.0';
        const rateVendas = totalLeads > 0 ? ((salesLeads.length / totalLeads) * 100).toFixed(1) : '0.0';
        const rateLost = totalLeads > 0 ? ((lostLeads.length / totalLeads) * 100).toFixed(1) : '0.0';

        document.getElementById('kpi-total-leads').textContent = totalLeads.toLocaleString('pt-BR');
        document.getElementById('kpi-total-vgv').textContent = formatCurrency(vgvWon);
        document.getElementById('kpi-waiting-leads').textContent = waitingLeads.length.toLocaleString('pt-BR');
        document.getElementById('kpi-lost-leads').textContent = lostLeads.length.toLocaleString('pt-BR');

        document.getElementById('kpi-rate-visit').textContent = `${rateVisit}%`;
        document.getElementById('kpi-subtext-visit').textContent = `${visitLeads.length} de ${totalLeads} com Visita/Atendimento`;

        document.getElementById('kpi-rate-docs').textContent = `${rateDocs}%`;
        document.getElementById('kpi-subtext-docs').textContent = `${docLeads.length} de ${totalLeads} com Proposta/Docs`;

        document.getElementById('kpi-rate-vendas').textContent = `${rateVendas}%`;
        document.getElementById('kpi-subtext-vendas').textContent = `${salesLeads.length} Vendas Concluídas`;

        document.getElementById('kpi-active-leads').textContent = activeLeads.length.toLocaleString('pt-BR');
        document.getElementById('kpi-subtext-lost').textContent = `${rateLost}% Taxa de Desistência`;

        // Subtext updates
        const crmCount = dataset.filter(r => r.source.includes('CRM')).length;
        const metaCount = dataset.filter(r => r.source === 'Meta Ads').length;
        document.getElementById('kpi-subtext-leads').textContent = `${crmCount.toLocaleString('pt-BR')} CRM | ${metaCount.toLocaleString('pt-BR')} Meta Ads`;
        
        const totalMetaUnassigned = leadsData.filter(r => r.corretor === 'Pendente (Não Atribuído)').length;
        document.getElementById('meta-badge-count').textContent = totalMetaUnassigned.toLocaleString('pt-BR');
    }

    // Render Clear Visual Funnel Flow Board (Matches CRM Kanban exact stage counts & mathematically precise step conversion rates!)
    function renderFunnelBoard(dataset) {
        // Filter ATIVO leads for active Kanban stages
        const ativoDataset = dataset.filter(r => r.status_geral === 'ATIVO' || !r.status_geral);

        const aguardando = ativoDataset.filter(r => r.situacao === 'Aguardando Atendimento');
        const pre = ativoDataset.filter(r => r.situacao === 'Pré Atendimento' || r.situacao === 'Primeiro Contato');
        const emAtendimento = ativoDataset.filter(r => r.situacao === 'Em Atendimento' || r.situacao === 'Atendimento');
        const proposta = ativoDataset.filter(r => r.situacao === 'Elaborando Proposta' || r.situacao === 'Contrato Assinado Cliente');
        const vendas = dataset.filter(r => r.status_geral === 'VENDIDO' || r.situacao === 'Venda Realizada');

        const vgvAguardando = aguardando.reduce((a, b) => a + b.valor_oportunidade, 0);
        const vgvPre = pre.reduce((a, b) => a + b.valor_oportunidade, 0);
        const vgvActive = emAtendimento.reduce((a, b) => a + b.valor_oportunidade, 0);
        const vgvProposal = proposta.reduce((a, b) => a + b.valor_oportunidade, 0);
        const vgvWon = vendas.reduce((a, b) => a + b.valor_oportunidade, 0);

        document.getElementById('funnel-count-waiting').textContent = aguardando.length.toLocaleString('pt-BR');
        document.getElementById('funnel-vgv-waiting').textContent = formatCurrency(vgvAguardando);

        document.getElementById('funnel-count-pre').textContent = pre.length.toLocaleString('pt-BR');
        document.getElementById('funnel-vgv-pre').textContent = formatCurrency(vgvPre);

        document.getElementById('funnel-count-active').textContent = emAtendimento.length.toLocaleString('pt-BR');
        document.getElementById('funnel-vgv-active').textContent = formatCurrency(vgvActive);

        document.getElementById('funnel-count-proposal').textContent = proposta.length.toLocaleString('pt-BR');
        document.getElementById('funnel-vgv-proposal').textContent = formatCurrency(vgvProposal);

        document.getElementById('funnel-count-won').textContent = vendas.length.toLocaleString('pt-BR');
        document.getElementById('funnel-vgv-won').textContent = formatCurrency(vgvWon);

        // DIRECT STEP CONVERSION RATES (Exact ratio between visible stage numbers!)
        // Arrow 1: Pré Atendimento (69) / Aguardando Atendimento (126)
        const rate1Val = aguardando.length > 0 ? ((pre.length / aguardando.length) * 100).toFixed(1) : '0.0';
        
        // Arrow 2: Em Atendimento (64) / Pré Atendimento (69)
        const rate2Val = pre.length > 0 ? ((emAtendimento.length / pre.length) * 100).toFixed(1) : '0.0';
        
        // Arrow 3: Proposta / Documentos (3) / Em Atendimento (64) -> EXACT: 3 / 64 = 4.7%
        const rate3Val = emAtendimento.length > 0 ? ((proposta.length / emAtendimento.length) * 100).toFixed(1) : '0.0';
        
        // Arrow 4: Vendas Realizadas (5) / Total Propostas (Proposta (3) + Vendas (5) = 8) -> EXACT: 5 / 8 = 62.5%
        const totalPropostasEVendas = proposta.length + vendas.length;
        const rate4Val = totalPropostasEVendas > 0 ? ((vendas.length / totalPropostasEVendas) * 100).toFixed(1) : '0.0';

        const elemConv1 = document.getElementById('conv-rate-1');
        const elemConv2 = document.getElementById('conv-rate-2');
        const elemConv3 = document.getElementById('conv-rate-3');
        const elemConv4 = document.getElementById('conv-rate-4');

        elemConv1.textContent = `${rate1Val}%`;
        elemConv1.title = `${pre.length} de ${aguardando.length} em Pré Atendimento (${rate1Val}%)`;

        elemConv2.textContent = `${rate2Val}%`;
        elemConv2.title = `${emAtendimento.length} de ${pre.length} em Atendimento Ativo (${rate2Val}%)`;

        elemConv3.textContent = `${rate3Val}%`;
        elemConv3.title = `${proposta.length} de ${emAtendimento.length} avançaram para Proposta (${rate3Val}%)`;

        elemConv4.textContent = `${rate4Val}%`;
        elemConv4.title = `${vendas.length} de ${totalPropostasEVendas} propostas convertidas em Venda (${rate4Val}%)`;

        // Badge showing active global filter name
        const currentCorr = document.getElementById('global-filter-corretor').value;
        const filterBadge = document.getElementById('funnel-active-filter-badge');
        if (currentCorr === 'ALL') {
            filterBadge.textContent = `Exibindo ${dataset.length.toLocaleString('pt-BR')} Leads Integrados`;
            filterBadge.className = 'badge badge-info';
        } else {
            filterBadge.textContent = `Filtrado por: ${currentCorr.split(' ')[0]} (${dataset.length} leads)`;
            filterBadge.className = 'badge badge-gold';
        }
    }

    // Render Corretores Leaderboard Table with All Conversion Milestones
    function renderCorretoresTable(dataset) {
        const tbody = document.getElementById('corretores-table-body');
        tbody.innerHTML = '';

        // Sort corretores by total leads descending
        const sortedCorretores = [...corretoresList].sort((a, b) => {
            return dataset.filter(r => r.corretor === b).length - dataset.filter(r => r.corretor === a).length;
        });

        sortedCorretores.forEach(corr => {
            const corrLeads = dataset.filter(r => r.corretor === corr);
            const total = corrLeads.length;
            if (total === 0 && document.getElementById('global-filter-corretor').value !== 'ALL') return;

            const ativoLeads = corrLeads.filter(r => r.status_geral === 'ATIVO' || !r.status_geral);
            
            const emAtendimento = ativoLeads.filter(r => r.situacao === 'Em Atendimento' || r.situacao === 'Atendimento').length;
            const preAtendimento = ativoLeads.filter(r => r.situacao === 'Pré Atendimento' || r.situacao === 'Primeiro Contato').length;
            const proposta = ativoLeads.filter(r => r.situacao === 'Elaborando Proposta' || r.situacao === 'Contrato Assinado Cliente').length;
            const aguardando = ativoLeads.filter(r => r.situacao === 'Aguardando Atendimento').length;

            const visitas = emAtendimento + proposta + corrLeads.filter(r => r.situacao === 'Visita Agendada' || r.situacao === 'Visita Realizada' || r.status_geral === 'VENDIDO').length;
            const vendas = corrLeads.filter(r => r.status_geral === 'VENDIDO' || r.situacao === 'Venda Realizada' || r.situacao === 'Contrato Assinado Cliente').length;
            const perdas = corrLeads.filter(r => r.status_geral === 'PERDIDO' || r.situacao === 'Venda Desistida').length;

            const taxaVisita = total > 0 ? ((visitas / total) * 100).toFixed(1) : '0.0';
            const taxaDocs = total > 0 ? (((proposta + vendas) / total) * 100).toFixed(1) : '0.0';
            const taxaVenda = total > 0 ? ((vendas / total) * 100).toFixed(1) : '0.0';
            const vgvConcluido = vendas * 218000;

            let statusBadge = '';
            if (vendas > 0) {
                statusBadge = `<span class="badge badge-success"><i class="fa-solid fa-trophy"></i> ${vendas} Venda(s) Fechada(s)</span>`;
            } else if (proposta > 0) {
                statusBadge = `<span class="badge badge-gold"><i class="fa-solid fa-file-signature"></i> Em Proposta</span>`;
            } else if (emAtendimento > 0) {
                statusBadge = `<span class="badge badge-purple"><i class="fa-solid fa-circle-check"></i> Em Atendimento</span>`;
            } else if (preAtendimento > 0) {
                statusBadge = `<span class="badge badge-info"><i class="fa-solid fa-spinner"></i> Pré Atendimento</span>`;
            } else if (aguardando > 0) {
                statusBadge = `<span class="badge badge-warning"><i class="fa-solid fa-triangle-exclamation"></i> Aguardando (${aguardando})</span>`;
            } else {
                statusBadge = `<span class="badge badge-gold"><i class="fa-solid fa-clock"></i> Sem Ativos</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="corretor-tag">
                        ${renderBrokerAvatarHtml(corr)}
                        <span class="corretor-name">${corr}</span>
                    </div>
                </td>
                <td class="text-center font-bold">${total}</td>
                <td class="text-center"><span class="badge badge-purple">${emAtendimento + preAtendimento}</span></td>
                <td class="text-center"><strong>${visitas}</strong> <span class="text-muted" style="font-size:11px;">(${taxaVisita}%)</span></td>
                <td class="text-center"><strong>${proposta}</strong> <span class="text-muted" style="font-size:11px;">(${taxaDocs}%)</span></td>
                <td class="text-center"><span class="badge badge-success">${vendas}</span> <span class="text-success" style="font-size:11px; font-weight:700;">(${taxaVenda}%)</span></td>
                <td class="text-center"><span class="badge badge-danger">${perdas}</span></td>
                <td class="text-right font-bold text-success">${formatCurrency(vgvConcluido)}</td>
                <td class="text-center">${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Render Integrated Leads Table with Pagination & Filters
    function renderLeadsTable(dataset) {
        const tbody = document.getElementById('leads-table-body');
        tbody.innerHTML = '';

        const tableCorrFilter = document.getElementById('filter-corretor').value;
        const sitFilter = document.getElementById('filter-situacao').value;
        const fontFilter = document.getElementById('filter-fonte').value;
        const searchText = document.getElementById('global-search').value.toLowerCase().trim();

        const filtered = dataset.filter(r => {
            if (tableCorrFilter !== 'ALL' && r.corretor !== tableCorrFilter) return false;
            if (sitFilter !== 'ALL' && r.situacao !== sitFilter) return false;
            if (fontFilter !== 'ALL' && r.source !== fontFilter) return false;
            if (searchText) {
                const matchName = r.nome.toLowerCase().includes(searchText);
                const matchPhone = r.telefone.includes(searchText);
                const matchCorr = r.corretor.toLowerCase().includes(searchText);
                const matchId = String(r.id).toLowerCase().includes(searchText);
                if (!matchName && !matchPhone && !matchCorr && !matchId) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center" style="padding: 32px; color: var(--text-muted);">
                        <i class="fa-solid fa-folder-open" style="font-size: 24px; margin-bottom: 8px;"></i><br>
                        Nenhum lead encontrado com os filtros selecionados.
                    </td>
                </tr>
            `;
            return;
        }

        // Pagination slicing (display pageSize per view)
        const startIndex = (currentPage - 1) * pageSize;
        const paginatedLeads = filtered.slice(startIndex, startIndex + pageSize);

        paginatedLeads.forEach(r => {
            let sitBadge = '';
            if (r.status_geral === 'VENDIDO' || r.situacao === 'Venda Realizada') sitBadge = `<span class="badge badge-success"><i class="fa-solid fa-trophy"></i> Venda Realizada</span>`;
            else if (r.status_geral === 'PERDIDO' || r.situacao === 'Venda Desistida') sitBadge = `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Desistência</span>`;
            else if (r.situacao === 'Elaborando Proposta') sitBadge = `<span class="badge badge-gold">Elaborando Proposta</span>`;
            else if (r.situacao === 'Em Atendimento' || r.situacao === 'Atendimento') sitBadge = `<span class="badge badge-purple">Em Atendimento</span>`;
            else if (r.situacao === 'Pré Atendimento' || r.situacao === 'Primeiro Contato') sitBadge = `<span class="badge badge-info">Pré Atendimento</span>`;
            else if (r.situacao === 'Novo Lead Meta') sitBadge = `<span class="badge badge-gold">Novo Meta</span>`;
            else sitBadge = `<span class="badge badge-warning">Aguardando Atendimento</span>`;

            let statusGeralBadge = '';
            if (r.status_geral === 'VENDIDO') statusGeralBadge = `<span class="badge badge-success">VENDIDO</span>`;
            else if (r.status_geral === 'PERDIDO') statusGeralBadge = `<span class="badge badge-danger">PERDIDO</span>`;
            else statusGeralBadge = `<span class="badge badge-info">ATIVO</span>`;

            const fontBadge = r.source === 'Meta Ads' 
                ? `<span class="badge badge-meta"><i class="fa-brands fa-meta"></i> Meta Ads</span>` 
                : `<span class="badge badge-crm"><i class="fa-solid fa-database"></i> CRM Supremo</span>`;

            const waUrl = `https://wa.me/${r.whatsapp_phone}?text=${encodeURIComponent('Olá ' + r.nome + ', tudo bem? Aqui é da Achei Imóveis! Gostaria de conversar sobre o empreendimento Ventana.')}`;
            const displayDate = r.data_ultima_interacao || r.data_captura || '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; color: #0f172a;">${r.nome}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">ID: ${r.id}</div>
                </td>
                <td>${fontBadge}</td>
                <td>${r.telefone || '-'}</td>
                <td>
                    <select class="filter-select select-reassign" data-lead-id="${r.id}" style="padding: 4px 8px; font-size: 11px; max-width: 180px;">
                        <option value="Pendente (Não Atribuído)" ${r.corretor === 'Pendente (Não Atribuído)' ? 'selected' : ''}>Pendente (Não Atribuído)</option>
                        ${corretoresList.map(c => `<option value="${c}" ${r.corretor === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </td>
                <td>${sitBadge}</td>
                <td>${statusGeralBadge}</td>
                <td style="font-size: 12px; color: var(--text-muted);">${displayDate}</td>
                <td class="text-center">
                    <a href="${waUrl}" target="_blank" class="btn-whatsapp">
                        <i class="fa-brands fa-whatsapp"></i> WhatsApp
                    </a>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners for direct reassign dropdowns
        document.querySelectorAll('.select-reassign').forEach(select => {
            select.addEventListener('change', (e) => {
                const leadId = e.target.getAttribute('data-lead-id');
                const newCorr = e.target.value;
                const lead = leadsData.find(l => String(l.id) === String(leadId));
                if (lead) {
                    lead.corretor = newCorr;
                    renderDashboard();
                }
            });
        });
    }

    // Chart Render Functions
    function initCharts() {
        const dataset = getFilteredLeads();

        // Funnel Chart
        const ctxFunnel = document.getElementById('chart-funnel').getContext('2d');
        chartFunnelInstance = new Chart(ctxFunnel, {
            type: 'bar',
            data: getFunnelChartData(dataset),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#cbd5e1' }
                },
                scales: {
                    x: { grid: { color: 'rgba(0, 0, 0, 0.06)' }, ticks: { color: '#64748b' } },
                    y: { grid: { color: 'rgba(0, 0, 0, 0.06)' }, ticks: { color: '#64748b', precision: 0 } }
                }
            }
        });

        // Status Pie Chart
        const ctxIntent = document.getElementById('chart-intent').getContext('2d');
        chartIntentInstance = new Chart(ctxIntent, {
            type: 'doughnut',
            data: getIntentChartData(dataset),
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#334155', font: { size: 11 } } }
                },
                cutout: '70%'
            }
        });

        // Corretores Comparative Bar Chart
        const ctxCorretores = document.getElementById('chart-corretores-performance');
        if (ctxCorretores) {
            chartCorretoresInstance = new Chart(ctxCorretores.getContext('2d'), {
                type: 'bar',
                data: getCorretoresChartData(dataset),
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top', labels: { color: '#334155', font: { size: 11 } } },
                        tooltip: { backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#cbd5e1' }
                    },
                    scales: {
                        x: { grid: { color: 'rgba(0, 0, 0, 0.06)' }, ticks: { color: '#64748b' } },
                        y: { grid: { color: 'rgba(0, 0, 0, 0.06)' }, ticks: { color: '#64748b', precision: 0 } }
                    }
                }
            });
        }
    }

    function updateCharts(dataset) {
        if (chartFunnelInstance) {
            chartFunnelInstance.data = getFunnelChartData(dataset);
            chartFunnelInstance.update();
        }
        if (chartIntentInstance) {
            chartIntentInstance.data = getIntentChartData(dataset);
            chartIntentInstance.update();
        }
        if (chartCorretoresInstance) {
            chartCorretoresInstance.data = getCorretoresChartData(dataset);
            chartCorretoresInstance.update();
        }
    }

    function getFunnelChartData(dataset) {
        const ativoDataset = dataset.filter(r => r.status_geral === 'ATIVO' || !r.status_geral);
        const aguardando = ativoDataset.filter(r => r.situacao === 'Aguardando Atendimento').length;
        const pre = ativoDataset.filter(r => r.situacao === 'Pré Atendimento' || r.situacao === 'Primeiro Contato').length;
        const emAtendimento = ativoDataset.filter(r => r.situacao === 'Em Atendimento' || r.situacao === 'Atendimento').length;
        const proposta = ativoDataset.filter(r => r.situacao === 'Elaborando Proposta').length;
        const vendas = dataset.filter(r => r.status_geral === 'VENDIDO' || r.situacao === 'Venda Realizada').length;

        return {
            labels: ['Aguardando', 'Pré Atendimento', 'Em Atendimento', 'Elaborando Proposta', 'Venda Realizada'],
            datasets: [{
                label: 'Quantidade de Leads',
                data: [aguardando, pre, emAtendimento, proposta, vendas],
                backgroundColor: ['#d4af37', '#e6d7c3', '#8b5e3c', '#f5d061', '#10b981'],
                borderRadius: 8
            }]
        };
    }

    function getIntentChartData(dataset) {
        const ativos = dataset.filter(r => r.status_geral === 'ATIVO' || !r.status_geral).length;
        const vendidos = dataset.filter(r => r.status_geral === 'VENDIDO' || r.situacao === 'Venda Realizada').length;
        const perdidos = dataset.filter(r => r.status_geral === 'PERDIDO' || r.situacao === 'Venda Desistida').length;

        return {
            labels: ['Ativos no Pipeline 🔄', 'Vendas Realizadas 🏆', 'Vendas Desistidas ❌'],
            datasets: [{
                data: [ativos, vendidos, perdidos],
                backgroundColor: ['#d4af37', '#10b981', '#ef4444'],
                borderWidth: 0
            }]
        };
    }

    function getCorretoresChartData(dataset) {
        const stats = getBrokersCalculatedStats(dataset);
        stats.sort((a, b) => b.totalLeads - a.totalLeads);
        const top8 = stats.slice(0, 8);

        return {
            labels: top8.map(b => b.shortName),
            datasets: [
                {
                    label: 'Leads Recebidos',
                    data: top8.map(b => b.totalLeads),
                    backgroundColor: '#e6d7c3',
                    borderRadius: 4
                },
                {
                    label: 'Agendamentos',
                    data: top8.map(b => b.agendamentos),
                    backgroundColor: '#d4af37',
                    borderRadius: 4
                },
                {
                    label: 'Visitas Realizadas',
                    data: top8.map(b => b.visitas),
                    backgroundColor: '#8b5e3c',
                    borderRadius: 4
                },
                {
                    label: 'Vendas Efetivadas',
                    data: top8.map(b => b.vendas),
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }
            ]
        };
    }

    // Global Filter by Stage Trigger
    window.filterByStage = function(stageName) {
        document.getElementById('filter-situacao').value = stageName;
        currentPage = 1;
        renderLeadsTable(getFilteredLeads());
        document.getElementById('section-leads').scrollIntoView({ behavior: 'smooth' });
    };

    // Setup Event Listeners
    function setupEventListeners() {
        // Global Broker Filter
        const globalBrokerSelect = document.getElementById('global-filter-corretor');
        const tableBrokerSelect = document.getElementById('filter-corretor');

        globalBrokerSelect.addEventListener('change', () => {
            tableBrokerSelect.value = globalBrokerSelect.value;
            currentPage = 1;
            renderDashboard();
        });

        tableBrokerSelect.addEventListener('change', () => {
            globalBrokerSelect.value = tableBrokerSelect.value;
            currentPage = 1;
            renderDashboard();
        });

        // Global Last Update Date Presets
        const datePresetSelect = document.getElementById('global-filter-date-preset');
        const customDateContainer = document.getElementById('custom-date-container');
        const startDateInput = document.getElementById('filter-date-start');
        const endDateInput = document.getElementById('filter-date-end');

        datePresetSelect.addEventListener('change', () => {
            if (datePresetSelect.value === 'CUSTOM') {
                customDateContainer.style.display = 'inline-flex';
            } else {
                customDateContainer.style.display = 'none';
                currentPage = 1;
                renderDashboard();
            }
        });

        startDateInput.addEventListener('change', () => { currentPage = 1; renderDashboard(); });
        endDateInput.addEventListener('change', () => { currentPage = 1; renderDashboard(); });

        // Table filters & Search
        document.getElementById('global-search').addEventListener('input', () => { currentPage = 1; renderLeadsTable(getFilteredLeads()); });
        document.getElementById('filter-situacao').addEventListener('change', () => { currentPage = 1; renderLeadsTable(getFilteredLeads()); });
        document.getElementById('filter-fonte').addEventListener('change', () => { currentPage = 1; renderLeadsTable(getFilteredLeads()); });

        // Search input for Desempenho Matriz table
        const searchMatriz = document.getElementById('search-corretor-matriz');
        if (searchMatriz) {
            searchMatriz.addEventListener('input', () => {
                renderMatrizDesempenho(getFilteredLeads());
            });
        }

        // View Matriz Button from Overview Ranking
        const btnViewMatriz = document.getElementById('btn-view-matriz-desempenho');
        if (btnViewMatriz) {
            btnViewMatriz.addEventListener('click', () => {
                window.switchToTab('desempenho');
            });
        }

        // Reset Filters Button
        document.getElementById('btn-reset-filters').addEventListener('click', () => {
            globalBrokerSelect.value = 'ALL';
            tableBrokerSelect.value = 'ALL';
            datePresetSelect.value = 'ALL';
            startDateInput.value = '';
            endDateInput.value = '';
            customDateContainer.style.display = 'none';
            document.getElementById('filter-situacao').value = 'ALL';
            document.getElementById('filter-fonte').value = 'ALL';
            document.getElementById('global-search').value = '';
            if (searchMatriz) searchMatriz.value = '';
            currentPage = 1;
            renderDashboard();
        });

        // Global Tab Switcher
        window.switchToTab = function(tab) {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            const activeNav = document.querySelector(`.nav-item[data-tab="${tab}"]`);
            if (activeNav) activeNav.classList.add('active');

            if (tab === 'desempenho') {
                document.getElementById('section-desempenho').scrollIntoView({ behavior: 'smooth' });
            } else if (tab === 'funnel') {
                document.getElementById('section-funnel').scrollIntoView({ behavior: 'smooth' });
            } else if (tab === 'corretores') {
                document.getElementById('section-corretores').scrollIntoView({ behavior: 'smooth' });
            } else if (tab === 'leads') {
                document.getElementById('filter-fonte').value = 'ALL';
                currentPage = 1;
                renderLeadsTable(getFilteredLeads());
                document.getElementById('section-leads').scrollIntoView({ behavior: 'smooth' });
            } else if (tab === 'meta-ads') {
                document.getElementById('filter-fonte').value = 'Meta Ads';
                currentPage = 1;
                renderLeadsTable(getFilteredLeads());
                document.getElementById('section-leads').scrollIntoView({ behavior: 'smooth' });
            } else if (tab === 'distribuicao') {
                openDistributionModal();
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        // Sidebar Navigation click tabs
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.getAttribute('data-tab');
                window.switchToTab(tab);
            });
        });

        // Distribution Modal
        document.getElementById('btn-distribute-modal').addEventListener('click', openDistributionModal);
        document.getElementById('btn-close-modal').addEventListener('click', closeDistributionModal);
        document.getElementById('btn-cancel-dist').addEventListener('click', closeDistributionModal);
        document.getElementById('btn-confirm-dist').addEventListener('click', executeBatchDistribution);

        document.querySelectorAll('.dist-option-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.dist-option-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
        });

        // Export CSV Button
        document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);

        // Live Sync Button
        const btnSync = document.getElementById('btn-sync-sheets');
        if (btnSync) {
            btnSync.addEventListener('click', syncGoogleSheetsLive);
        }
    }

    // Live Sync Functionality
    async function syncGoogleSheetsLive() {
        const btnSync = document.getElementById('btn-sync-sheets');
        const originalText = btnSync.innerHTML;
        btnSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...`;
        btnSync.disabled = true;

        try {
            await loadDataset();
            btnSync.innerHTML = `<i class="fa-solid fa-check"></i> Dados Atualizados!`;
            setTimeout(() => {
                btnSync.innerHTML = originalText;
                btnSync.disabled = false;
            }, 3000);
        } catch (e) {
            btnSync.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Erro na sincronização`;
            setTimeout(() => {
                btnSync.innerHTML = originalText;
                btnSync.disabled = false;
            }, 3000);
        }
    }

    // Distribution Modal Logic
    function openDistributionModal() {
        document.getElementById('modal-distribution').classList.add('active');
    }

    function closeDistributionModal() {
        document.getElementById('modal-distribution').classList.remove('active');
    }

    function populateDistributionModalCorretores() {
        const container = document.getElementById('dist-corretores-list');
        container.innerHTML = '';
        const topCorretores = corretoresList.slice(0, 8);
        topCorretores.forEach((c, idx) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" id="dist-corr-${idx}" value="${c}" checked>
                <label for="dist-corr-${idx}">${c}</label>
            `;
            container.appendChild(div);
        });
    }

    function executeBatchDistribution() {
        const selectedCorretores = [];
        document.querySelectorAll('#dist-corretores-list input[type="checkbox"]:checked').forEach(cb => {
            selectedCorretores.push(cb.value);
        });

        if (selectedCorretores.length === 0) {
            alert('Por favor, selecione ao menos um corretor para receber os leads!');
            return;
        }

        const unassignedLeads = leadsData.filter(r => r.corretor === 'Pendente (Não Atribuído)');
        if (unassignedLeads.length === 0) {
            alert('Não há mais leads pendentes do Meta Ads para atribuir!');
            closeDistributionModal();
            return;
        }

        unassignedLeads.forEach((lead, index) => {
            const corr = selectedCorretores[index % selectedCorretores.length];
            lead.corretor = corr;
            lead.situacao = 'Aguardando Atendimento';
            lead.status_geral = 'ATIVO';
        });

        closeDistributionModal();
        renderDashboard();

        alert(`Sucesso! ${unassignedLeads.length} leads do Meta Ads foram distribuídos entre os corretores selecionados!`);
    }

    // Export CSV Logic
    function exportToCSV() {
        const currentFiltered = getFilteredLeads();
        const headers = ['ID', 'Fonte', 'Nome', 'Telefone', 'Corretor', 'Situação', 'Status Geral', 'Última Atualização', 'VGV (R$)'];
        const rows = currentFiltered.map(l => [
            l.id,
            l.source,
            `"${l.nome}"`,
            `"${l.telefone}"`,
            `"${l.corretor}"`,
            `"${l.situacao}"`,
            `"${l.status_geral}"`,
            `"${l.data_ultima_interacao || l.data_captura}"`,
            l.valor_oportunidade
        ]);

        let csvContent = 'data:text/csv;charset=utf-8-sig,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `achei_imoveis_leads_export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Start App
    loadDataset();
});
