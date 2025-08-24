import { consultarProposta } from "./api.js";

// A única coisa que faremos é esperar o HTML carregar completamente.
document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores do DOM (Agora é seguro pegar todos) ---
    const searchForm = document.getElementById('search-form');
    const proposalDetailsSection = document.getElementById('proposal-details');
    const expiredProposalSection = document.getElementById('expired-proposal-section');
    const proposalHeader = document.getElementById('proposal-header');
    const projectIdInput = document.getElementById('project-id');
    const searchButton = document.getElementById('search-button');
    const mainFooter = document.getElementById('main-footer');

    // --- Variáveis de Estado ---
    let propostaOriginal, propostaEconomica;

    // --- Mapa de Logos ---
    const logoMap = { 'huawei': 'logo1.png' };

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

    // No seu app.js, substitua a função renderizarEquipamentos por esta:
// No seu app.js, substitua a função renderizarEquipamentos por esta:
function renderizarEquipamentos(dados, tipoProposta) {
    const equipmentContainer = document.getElementById('equipment-container');
    const equipmentTitle = document.getElementById('equipment-title');
    
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
                <span class="spec-label">Inversor</span>
                <span class="spec-value">${potencia}<span class="unit-symbol">W</span></span>
                <span class="spec-label">${qnt} Unidade(s)</span>
            </div>
        `;
    }).join('');

    const modulosHtml = `
        <div class="spec-card">
            <span class="spec-label">Módulos</span>
            <span class="spec-value">${findVar(dados, 'modulo_potencia', true)}<span class="unit-symbol">W</span></span>
            <span class="spec-label">${findVar(dados, 'modulo_quantidade', true)} Unidades</span>
        </div>
    `;

    equipmentContainer.innerHTML = `
        <div class="equipment-logo-wrapper">${logoHtml}</div>
        ${inversoresHtml}
        ${modulosHtml}
    `;
}

// Adicione esta nova função logo após a função renderizarEquipamentos
function renderizarPadraoInstalacao(tipoProposta) {
    const installationTitle = document.getElementById('installation-title');
    const installationList = document.getElementById('installation-standard-list');
    
    let title, items, tagHtml;

    if (tipoProposta === 'economica') {
        title = '<i class="fas fa-tools"></i> Padrão de Instalação';
        // Textos simplificados para a proposta econômica
        items = [
            { icon: 'fa-check-circle', text: 'Estruturas de fixação em alumínio' },
            { icon: 'fa-check-circle', text: 'Cabeamento simples' },
            { icon: 'fa-check-circle', text: 'Dispositivos de proteção residencial simples' },
            { icon: 'fa-check-circle', text: 'Conectores simples' },
        ];
        // Etiqueta "Simples"
        tagHtml = '<span class="section-tag tag-simple">Simples</span>';
    } else { // Alta Performance
        title = '<i class="fas fa-award"></i> Padrão de Instalação';
        items = [
            { icon: 'fa-star', text: ' Estruturas reforçadas com tratamento anticorrosivo superior para resistir ao tempo e às intempéries' },
            { icon: 'fa-star', text: 'Cabeamento solar específico com dupla isolação, garantindo durabilidade e proteção extra' },
            { icon: 'fa-star', text: 'DPS (Dispositivo de Proteção contra Surtos) de classe superior, protegendo seus eletrodomésticos/equipamentos de picos de energia' },
            { icon: 'fa-star', text: 'Conectores MC4 originais Stäubli, que minimizam a perda de energia e evitam o superaquecimento, garantindo a eficiência do seu sistema por muito mais tempo' },
            
        ];
        // Etiqueta "Premium"
        tagHtml = '<span class="section-tag tag-premium">Premium</span>';
    }

    installationTitle.innerHTML = `${title} ${tagHtml}`;
    installationList.innerHTML = items.map(item => `
        <li><i class="fas ${item.icon}"></i> ${item.text}</li>
    `).join('');
}



// No seu app.js, substitua a função renderizarPadraoInstalacao por esta versão atualizada:
function renderizarPadraoInstalacao(tipoProposta) {
    const installationTitle = document.getElementById('installation-title');
    const installationList = document.getElementById('installation-standard-list');
    
    let title, items, tagHtml;

    if (tipoProposta === 'economica') {
        title = '<i class="fas fa-tools"></i> Padrão de Instalação';
        items = [
            { icon: 'fa-check-circle', text: 'Estruturas de fixação em alumínio simples' },
            { icon: 'fa-check-circle', text: 'Cabeamento simples' },
            { icon: 'fa-check-circle', text: 'Dispositivos de proteção residencial simples' },
            { icon: 'fa-check-circle', text: 'Conectores simples' },
            { icon: 'fa-check-circle', text: 'Ramal de conexão mantido conforme padrão da concessionária de energia, geralmente de alumínio' }, // Adicionado para clareza
        ];
        tagHtml = '<span class="section-tag tag-simple">Simples</span>';
    } else { // Alta Performance
        title = '<i class="fas fa-award"></i> Padrão de Instalação';
        items = [
            // NOVO ITEM ADICIONADO AQUI
            { icon: 'fa-star', text: 'Estruturas reforçadas com tratamento anticorrosivo superior para resistir ao tempo e às intempéries' },
            { icon: 'fa-star', text: 'Cabeamento solar específico com dupla isolação, garantindo durabilidade e proteção extra' },
            { icon: 'fa-bolt', text: 'Substituição do ramal de alumínio da concessionária de energia por ramal de cobre, reduzindo riscos de superaquecimento nos terminais do medidor, reduzindo a possibilidade de incêndio' },
            { icon: 'fa-star', text: 'DPS (Dispositivo de Proteção contra Surtos) de classe superior, protegendo seus equipamentos de picos de energia' },
            { icon: 'fa-star', text: 'Conectores MC4 originais Stäubli, que minimizam a perda de energia e garantem a máxima eficiência' },
        ];
        tagHtml = '<span class="section-tag tag-premium">Premium</span>';
    }

    installationTitle.innerHTML = `${title} ${tagHtml}`;
    installationList.innerHTML = items.map(item => `
        <li><i class="fas ${item.icon}"></i><span>${item.text}</span></li>
    `).join('');
}


// Agora, substitua a função renderizarProposta para adicionar a formatação das unidades:
function renderizarProposta(dados, tipoProposta = 'performance') {
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
    
    // CORREÇÃO: Adiciona a classe 'unit-symbol' às unidades
    geracaoMensal.innerHTML = `${findVar(dados, 'geracao_mensal', true)}<span class="unit-symbol">kWh</span>`;
    potenciaSistema.innerHTML = `${findVar(dados, 'potencia_sistema', true)}<span class="unit-symbol">kWp</span>`;
    tipoInstalacao.textContent = findVar(dados, 'vc_tipo_de_estrutura', true);
    
    valorTotal.innerHTML = formatarMoeda(findVar(dados, 'preco'));
    proposalValidity.innerHTML = `Esta proposta é exclusiva para você e válida por <strong>3 dias</strong>, sujeita à disponibilidade de estoque.`;

    renderizarEquipamentos(dados, tipoProposta);
    renderizarPadraoInstalacao(tipoProposta);
    renderizarFinanciamento(dados);
}

    // --- Lógica Principal e Eventos ---
    async function handleSearch() {
        if (!/^[0-9]{1,6}$/.test(projectIdInput.value.trim())) return;
        searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        searchButton.disabled = true;

        try {
            const proposta = await consultarProposta(projectIdInput.value.trim());
            if (!proposta || !proposta.id) throw new Error('Proposta não encontrada.');

            const expirationDate = new Date(proposta.expirationDate);
            if (expirationDate < new Date()) {
                searchForm.style.display = 'none';
                expiredProposalSection.style.display = 'flex';
                expiredProposalSection.innerHTML = `<div class="search-card"><h1 class="search-card__title">Proposta Expirada</h1><p class="search-card__subtitle">Por favor, solicite uma nova proposta.</p><button class="btn btn--primary" onclick="location.reload()">Nova Consulta</button></div>`;
                return;
            }

            // Dentro da função handleSearch, substitua as duas linhas acima por este bloco:

propostaOriginal = proposta;
propostaEconomica = JSON.parse(JSON.stringify(proposta)); // Começa como uma cópia exata

// --- LÓGICA DE CÁLCULO DINÂMICO DA PROPOSTA ECONÔMICA ---
try {
    // --- 1. Parâmetros da Lógica de Negócio ---
    const potenciaMin = 2;    // kWp
    const potenciaMax = 100;  // kWp
    const descontoMax = 0.097; // 9.7% para sistemas menores
    const descontoMin = 0.07;  // 7.0% para sistemas maiores

    // --- 2. Obter Dados da Proposta Original ---
    const potenciaSistema = parseFloat(findVar(propostaOriginal, 'potencia_sistema'));
    const precoOriginal = parseFloat(findVar(propostaOriginal, 'preco'));

    if (isNaN(potenciaSistema) || isNaN(precoOriginal)) {
        throw new Error("Potência do sistema ou preço original inválidos.");
    }

    // --- 3. Calcular o Percentual de Desconto Dinâmico (Interpolação Linear) ---
    let percentualDesconto;
    if (potenciaSistema <= potenciaMin) {
        percentualDesconto = descontoMax;
    } else if (potenciaSistema >= potenciaMax) {
        percentualDesconto = descontoMin;
    } else {
        // Calcula a proporção da potência dentro da faixa
        const proporcao = (potenciaSistema - potenciaMin) / (potenciaMax - potenciaMin);
        // Interpola o desconto
        percentualDesconto = descontoMax - proporcao * (descontoMax - descontoMin);
    }

    // --- 4. Calcular o Novo Preço e o Fator de Redução ---
    const novoPreco = precoOriginal * (1 - percentualDesconto);
    const fatorReducao = novoPreco / precoOriginal;

    // --- 5. Atualizar o Preço na Proposta Econômica ---
    const precoVarEco = propostaEconomica.variables.find(v => v.key === 'preco');
    if (precoVarEco) {
        precoVarEco.value = novoPreco.toString();
        precoVarEco.formattedValue = novoPreco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // --- 6. Recalcular e Atualizar o Payback ---
    const paybackVarEco = propostaEconomica.variables.find(v => v.key === 'payback');
    if (paybackVarEco) {
        // O payback é uma string como "2 anos e 5 meses". Vamos ajustar os meses.
        const partes = paybackVarEco.value.match(/\d+/g); // Extrai os números
        if (partes && partes.length > 0) {
            const anos = parseInt(partes[0], 10) || 0;
            const meses = parseInt(partes[1], 10) || 0;
            const totalMesesOriginal = (anos * 12) + meses;
            const totalMesesNovo = Math.round(totalMesesOriginal * fatorReducao);
            
            const novosAnos = Math.floor(totalMesesNovo / 12);
            const novosMeses = totalMesesNovo % 12;
            
            paybackVarEco.value = `${novosAnos} anos e ${novosMeses} meses`;
            paybackVarEco.formattedValue = paybackVarEco.value;
        }
    }

    // --- 7. Recalcular e Atualizar TODAS as Parcelas de Financiamento ---
    const parcelasVarsEco = propostaEconomica.variables.filter(v => v.key.startsWith('f_parcela'));
    parcelasVarsEco.forEach(parcelaVar => {
        const valorOriginal = parseFloat(parcelaVar.value);
        if (!isNaN(valorOriginal)) {
            const novoValor = valorOriginal * fatorReducao;
            parcelaVar.value = novoValor.toString();
            parcelaVar.formattedValue = novoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    });

    console.log(`Proposta Econômica: Potência de ${potenciaSistema}kWp resultou em ${ (percentualDesconto * 100).toFixed(2) }% de desconto.`);
    console.log(`Novo Preço: ${formatarMoeda(novoPreco)}`);

} catch (calcError) {
    console.error("Erro ao calcular a Proposta Econômica:", calcError);
    // Em caso de erro, a proposta econômica permanece uma cópia da original, garantindo que a aplicação não quebre.
}
// --- FIM DA LÓGICA DE CÁLCULO ---

    }

    // --- Inicialização da Página ---
    
    // Adiciona o listener ao botão de busca principal. Agora é seguro.
    searchButton.addEventListener('click', handleSearch);

    // Cria o cabeçalho dinamicamente
    proposalHeader.innerHTML = `
        <div class="header__container">
            <div class="header__logo"><img src="logo.png" alt="Logo da GDIS"></div>
            <div class="header__options">
                <button id="btn-alta-performance" class="option-button active">Alta Performance</button>
                <button id="btn-economica" class="option-button">Econômica</button>
            </div>
        </div>`;
    
    // Atribui e adiciona eventos aos botões do cabeçalho
    const btnAltaPerformance = document.getElementById('btn-alta-performance');
    const btnEconomica = document.getElementById('btn-economica');

    btnAltaPerformance.addEventListener('click', () => {
        if (btnAltaPerformance.classList.contains('active')) return;
        document.body.classList.remove('theme-economic');
        btnEconomica.classList.remove('active');
        btnAltaPerformance.classList.add('active');
        if (propostaOriginal) renderizarProposta(propostaOriginal, 'performance');
    });
    btnEconomica.addEventListener('click', () => {
        if (btnEconomica.classList.contains('active')) return;
        document.body.classList.add('theme-economic');
        btnAltaPerformance.classList.remove('active');
        btnEconomica.classList.add('active');
        if (propostaEconomica) renderizarProposta(propostaEconomica, 'economica');
    });

    // Adiciona o link do WhatsApp dinamicamente
    const phoneNumber = "5582994255946";
    const whatsappMessage = encodeURIComponent("Olá! Gostaria de mais informações sobre a proposta.");
    document.getElementById('whatsapp-link').href = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;

    // Configura a visibilidade inicial das seções
    searchForm.style.display = 'flex';

    // Configura a visibilidade inicial das seções
    searchForm.style.display = 'flex';
    proposalDetailsSection.style.display = 'none';
    expiredProposalSection.style.display = 'none';
    proposalHeader.style.display = 'none';
    mainFooter.style.display = 'block';
});
