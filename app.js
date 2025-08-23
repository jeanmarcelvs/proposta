import { consultarProposta } from "./api.js";

// --- Deixamos a função principal acessível globalmente para o onclick ---
window.handleSearchClick = async function() {
    const projectIdInput = document.getElementById('project-id');
    const searchButton = document.getElementById('search-button');

    if (!/^[0-9]{1,6}$/.test(projectIdInput.value.trim())) return;
    searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    searchButton.disabled = true;

    try {
        const proposta = await consultarProposta(projectIdInput.value.trim());
        if (!proposta || !proposta.id) throw new Error('Proposta não encontrada.');

        const expirationDate = new Date(proposta.expirationDate);
        if (expirationDate < new Date()) {
            document.getElementById('search-form').style.display = 'none';
            const expiredSection = document.getElementById('expired-proposal-section');
            expiredSection.style.display = 'flex';
            expiredSection.innerHTML = `<div class="search-card"><h1 class="search-card__title">Proposta Expirada</h1><p class="search-card__subtitle">Por favor, solicite uma nova proposta.</p><button class="btn btn--primary" onclick="location.reload()">Nova Consulta</button></div>`;
            return;
        }

        // Armazena as propostas globalmente para os outros botões usarem
        window.propostaOriginal = proposta;
        window.propostaEconomica = JSON.parse(JSON.stringify(proposta));

        document.getElementById('search-form').style.display = 'none';
        document.getElementById('proposal-header').style.display = 'block';
        document.getElementById('proposal-details').style.display = 'flex';
        document.getElementById('main-footer').style.display = 'block';
        
        renderizarProposta(proposta, 'performance');
        blockFeatures();

        const backToSearchBtn = document.getElementById('back-to-search-btn');
        backToSearchBtn.addEventListener('click', () => {
            document.getElementById('proposal-details').style.display = 'none';
            document.getElementById('proposal-header').style.display = 'none';
            document.getElementById('expired-proposal-section').style.display = 'none';
            document.getElementById('search-form').style.display = 'flex';
            projectIdInput.value = '';
            searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
            searchButton.disabled = false;
        });

    } catch (err) {
        console.error("Erro na busca:", err);
        searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
        searchButton.disabled = false;
    }
}

// --- O restante do código permanece o mesmo, mas dentro do DOMContentLoaded para segurança ---

document.addEventListener('DOMContentLoaded', () => {

    // --- Funções de Segurança ---
    function blockFeatures() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) e.preventDefault();
            if (e.key === 'PrintScreen') { navigator.clipboard.writeText(''); e.preventDefault(); }
        });
    }

    // --- Funções Utilitárias ---
    const formatarMoeda = (valor) => {
        const num = parseFloat(valor);
        if (isNaN(num)) return 'N/A';
        const [integer, decimal] = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(',');
        return `<span class="currency-symbol">R$</span>${integer},${decimal}`;
    };
    const findVar = (proposta, key, useFormatted = false) => {
        const variable = proposta.variables?.find(v => v.key === key);
        if (!variable) return 'N/A';
        return useFormatted && variable.formattedValue ? variable.formattedValue : variable.value;
    };

    // --- Funções de Renderização ---
    window.renderizarProposta = function(dados, tipoProposta = 'performance') {
        const clienteNome = document.getElementById('cliente-nome');
        const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
        const dataGeracao = document.getElementById('data-geracao');
        const geracaoMensal = document.getElementById('geracao-mensal');
        const potenciaSistema = document.getElementById('potencia-sistema');
        const tipoInstalacao = document.getElementById('tipo-instalacao');
        const contaEnergiaEstimada = document.getElementById('conta-energia-estimada');
        const valorTotal = document.getElementById('valor-total');
        const proposalValidity = document.getElementById('proposal-validity');

        dataGeracao.textContent = findVar(dados, 'data_geracao', true).split(' ')[0];
        const contaAtual = (parseFloat(findVar(dados, 'geracao_mensal')) || 0) * (parseFloat(findVar(dados, 'tarifa_distribuidora')) || 0);
        contaEnergiaEstimada.innerHTML = `Ideal para contas de até <strong>${formatarMoeda(contaAtual)}</strong>`;

        clienteNome.textContent = findVar(dados, 'cliente_nome', true);
        clienteCidadeUf.textContent = `${findVar(dados, 'cidade', true)} - ${findVar(dados, 'estado', true)}`;
        geracaoMensal.textContent = `${findVar(dados, 'geracao_mensal', true)} kWh`;
        potenciaSistema.textContent = `${findVar(dados, 'potencia_sistema', true)} kWp`;
        tipoInstalacao.textContent = findVar(dados, 'vc_tipo_de_estrutura', true);
        valorTotal.innerHTML = formatarMoeda(findVar(dados, 'preco'));
        proposalValidity.innerHTML = `Esta proposta é exclusiva para você e válida por <strong>3 dias</strong>, sujeita à disponibilidade de estoque.`;

        renderizarEquipamentos(dados, tipoProposta);
        renderizarPadraoInstalacao(tipoProposta);
        renderizarFinanciamento(dados);
    }

    function renderizarFinanciamento(dados) {
        const financingOptionsContainer = document.getElementById('financing-options');
        const todasAsParcelas = dados.variables.filter(v => v.key.startsWith('f_parcela'));
        let opcoes = todasAsParcelas.map(pVar => {
            const prazoVar = dados.variables.find(v => v.key === pVar.key.replace('parcela', 'prazo'));
            return prazoVar ? { prazo: parseInt(prazoVar.value, 10), valorParcela: parseFloat(pVar.value) } : null;
        }).filter(Boolean).sort((a, b) => a.prazo - b.prazo);

        if (opcoes.length === 0) {
            financingOptionsContainer.innerHTML = "<p>Nenhuma opção de financiamento disponível.</p>";
            return;
        }

        const economiaMensal = parseFloat(findVar(dados, 'economia_mensal')) || 0;
        const custoDisponibilidade = parseFloat(findVar(dados, 'custo_disponibilidade_valor')) || 0;
        const melhorOpcao = opcoes.reduce((best, current) => {
            const diff = Math.abs(economiaMensal - (current.valorParcela + custoDisponibilidade));
            return diff < best.diff ? { ...current, diff } : best;
        }, { diff: Infinity });

        financingOptionsContainer.innerHTML = opcoes.map(opt => `
            <div class="financing-option ${opt.prazo === melhorOpcao.prazo ? 'highlight' : ''}">
                ${opt.prazo === melhorOpcao.prazo ? '<div class="highlight-tag">Equilibrado</div>' : ''}
                <div class="prazo">${opt.prazo}<span>x</span></div>
                <div class="valor">${formatarMoeda(opt.valorParcela)}</div>
            </div>
        `).join('');
    }

    function renderizarEquipamentos(dados, tipoProposta) {
        const equipmentContainer = document.getElementById('equipment-container');
        const equipmentTitle = document.getElementById('equipment-title');
        const logoMap = { 'huawei': 'logo1.png' };
        
        equipmentTitle.innerHTML = tipoProposta === 'economica' 
            ? '<i class="fas fa-shield-alt"></i> Opção Custo-Benefício' 
            : '<i class="fas fa-rocket"></i> Equipamentos de Ponta';

        const inversores = dados.variables.filter(v => v.key.startsWith('inversor_modelo_') && v.value);
        const fabricante = findVar(dados, 'inversor_fabricante').toLowerCase().split(' ')[0];
        const logoFileName = tipoProposta === 'economica' ? 'logo2.png' : logoMap[fabricante];
        
        let logoHtml = logoFileName 
            ? `<img src="${logoFileName}" alt="Logo do equipamento">`
            : `<p><strong>${findVar(dados, 'inversor_fabricante', true)}</strong></p>`;

        let inversoresHtml = inversores.map(inv => {
            const index = inv.key.split('_').pop();
            const qnt = findVar(dados, `inversor_quantidade_${index}`, true);
            const potencia = findVar(dados, `inversor_potencia_nominal_${index}`, true);
            return `
                <div class="spec-card">
                    <span class="spec-label">Inversor ${inv.value}</span>
                    <span class="spec-value">${potencia} W</span>
                    <span class="spec-label">${qnt} Unidade(s)</span>
                </div>
            `;
        }).join('');

        const modulosHtml = `
            <div class="spec-card">
                <span class="spec-label">Módulos</span>
                <span class="spec-value">${findVar(dados, 'modulo_potencia', true)} W</span>
                <span class="spec-label">${findVar(dados, 'modulo_quantidade', true)} Unidades</span>
            </div>
        `;

        equipmentContainer.innerHTML = `
            <div class="equipment-logo-wrapper">${logoHtml}</div>
            ${inversoresHtml}
            ${modulosHtml}
        `;
    }

    function renderizarPadraoInstalacao(tipoProposta) {
        const installationTitle = document.getElementById('installation-title');
        const installationList = document.getElementById('installation-standard-list');
        
        let title, items;

        if (tipoProposta === 'economica') {
            title = '<i class="fas fa-tools"></i> Padrão de Instalação Eficiente';
            items = [
                { icon: 'fa-check-circle', text: 'Estruturas de fixação em alumínio e aço inox' },
                { icon: 'fa-check-circle', text: 'Cabeamento solar com proteção UV padrão' },
                { icon: 'fa-check-circle', text: 'Dispositivos de proteção (DPS) padrão de mercado' },
                { icon: 'fa-check-circle', text: 'Conectores MC4 com boa vedação' },
            ];
        } else { // Alta Performance
            title = '<i class="fas fa-award"></i> Padrão de Instalação Premium';
            items = [
                { icon: 'fa-star', text: 'Estruturas reforçadas com tratamento anticorrosivo superior' },
                { icon: 'fa-star', text: 'Cabeamento solar com dupla isolação e alta durabilidade' },
                { icon: 'fa-star', text: 'DPS de classe superior para máxima proteção contra surtos' },
                { icon: 'fa-star', text: 'Conectores MC4 originais Stäubli para perdas mínimas' },
                { icon: 'fa-star', text: 'Organização e acabamento premium do cabeamento' },
            ];
        }

        installationTitle.innerHTML = title;
        installationList.innerHTML = items.map(item => `
            <li><i class="fas ${item.icon}"></i> ${item.text}</li>
        `).join('');
    }

    // --- Inicialização da Página ---
    function init() {
        const proposalHeader = document.getElementById('proposal-header');
        
        proposalHeader.innerHTML = `
            <div class="header__container">
                <div class="header__logo"><img src="logo.png" alt="Logo da GDIS"></div>
                <div class="header__options">
                    <button id="btn-alta-performance" class="option-button active">Alta Performance</button>
                    <button id="btn-economica" class="option-button">Econômica</button>
                </div>
            </div>`;
        
        const btnAltaPerformance = document.getElementById('btn-alta-performance');
        const btnEconomica = document.getElementById('btn-economica');
    
        btnAltaPerformance.addEventListener('click', () => {
            if (btnAltaPerformance.classList.contains('active')) return;
            document.body.classList.remove('theme-economic');
            btnEconomica.classList.remove('active');
            btnAltaPerformance.classList.add('active');
            if (window.propostaOriginal) renderizarProposta(window.propostaOriginal, 'performance');
        });
        btnEconomica.addEventListener('click', () => {
            if (btnEconomica.classList.contains('active')) return;
            document.body.classList.add('theme-economic');
            btnAltaPerformance.classList.remove('active');
            btnEconomica.classList.add('active');
            if (window.propostaEconomica) renderizarProposta(window.propostaEconomica, 'economica');
        });
    
        document.getElementById('search-form').style.display = 'flex';
        document.getElementById('proposal-details').style.display = 'none';
        document.getElementById('expired-proposal-section').style.display = 'none';
        proposalHeader.style.display = 'none';
        document.getElementById('main-footer').style.display = 'block';
    }

    init();
});
