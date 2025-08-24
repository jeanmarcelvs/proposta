import { consultarProposta, notificarVisualizacao } from "./api.js";
import { consultarProposta } from "./api.js";

document.addEventListener('DOMContentLoaded', () => {

// --- Função para Observar a Seção de Investimento ---
// --- Função para Observar a Seção de Investimento ---
function observarVisualizacaoDePreco(projectId) {
    const investmentSection = document.querySelector('.investment-section');
    if (!investmentSection) return;

    let jaEnviado = false;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !jaEnviado) {
            jaEnviado = true;
            
            console.log("Seção de investimento visível. Notificando backend...");

            // CORREÇÃO: Chama a nova função simplificada
            notificarVisualizacao(projectId)
                .then(response => {
                    console.log('Notificação enviada com sucesso:', response.data);
                })
                .catch(error => {
                    console.error('Falha ao enviar notificação:', error);
                });

            observer.disconnect();
        }
    }, {
        threshold: 0.5
    });

    observer.observe(investmentSection);
}


    // --- Seletores do DOM ---
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
        
        let title, items, tagHtml;

        if (tipoProposta === 'economica') {
            title = '<i class="fas fa-tools"></i> Padrão de Instalação';
            items = [
                { icon: 'fa-check-circle', text: 'Estruturas de fixação em alumínio simples' },
                { icon: 'fa-check-circle', text: 'Cabeamento simples' },
                { icon: 'fa-check-circle', text: 'Dispositivos de proteção residencial simples' },
                { icon: 'fa-check-circle', text: 'Conectores simples' },
                { icon: 'fa-check-circle', text: 'Ramal de conexão mantido conforme padrão da concessionária de energia, geralmente de alumínio e de bitola inferior ao recomendado' },
            ];
            tagHtml = '<span class="section-tag tag-simple">Simples</span>';
        } else { // Alta Performance
            title = '<i class="fas fa-award"></i> Padrão de Instalação';
            items = [
                { icon: 'fa-bolt', text: 'Substituição do ramal de alumínio da concessionária por ramal de cobre e de bitola adequada ao sistema, reduzindo perdas de geração, riscos de superaquecimento e incêndio no medidor' },
                { icon: 'fa-star', text: 'Estruturas reforçadas com tratamento anticorrosivo superior para resistir ao tempo e às intempéries' },
                { icon: 'fa-star', text: 'Cabeamento solar específico com dupla isolação, garantindo durabilidade e proteção extra' },
                { icon: 'fa-star', text: 'DPS (Dispositivo de Proteção contra Surtos) de classe superior, protegendo seus equipamentos de picos de energia' },
                { icon: 'fa-star', text: 'Conectores MC4 originais Stäubli, que minimizam a perda de energia gerada, aumenta a segurança contra incêndios e garantem a máxima eficiência do sistema' },
            ];
            tagHtml = '<span class="section-tag tag-premium">Premium</span>';
        }

        installationTitle.innerHTML = `${title} ${tagHtml}`;
        installationList.innerHTML = items.map(item => `
            <li><i class="fas ${item.icon}"></i><span>${item.text}</span></li>
        `).join('');
    }

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

            // --- CORREÇÃO: LÓGICA DE CÁLCULO MOVEMOS PARA DENTRO DO TRY ---
            propostaOriginal = proposta;
            propostaEconomica = JSON.parse(JSON.stringify(proposta)); // Começa como uma cópia exata

            try {
                const potenciaMin = 2, potenciaMax = 100, descontoMax = 0.097, descontoMin = 0.07;
                const potenciaSistema = parseFloat(findVar(propostaOriginal, 'potencia_sistema'));
                const precoOriginal = parseFloat(findVar(propostaOriginal, 'preco'));

                if (isNaN(potenciaSistema) || isNaN(precoOriginal)) throw new Error("Dados inválidos para cálculo.");

                let percentualDesconto;
                if (potenciaSistema <= potenciaMin) percentualDesconto = descontoMax;
                else if (potenciaSistema >= potenciaMax) percentualDesconto = descontoMin;
                else {
                    const proporcao = (potenciaSistema - potenciaMin) / (potenciaMax - potenciaMin);
                    percentualDesconto = descontoMax - proporcao * (descontoMax - descontoMin);
                }

                const novoPreco = precoOriginal * (1 - percentualDesconto);
                const fatorReducao = novoPreco / precoOriginal;

                const precoVarEco = propostaEconomica.variables.find(v => v.key === 'preco');
                if (precoVarEco) {
                    precoVarEco.value = novoPreco.toString();
                    precoVarEco.formattedValue = novoPreco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                }

                const paybackVarEco = propostaEconomica.variables.find(v => v.key === 'payback');
                if (paybackVarEco) {
                    const partes = paybackVarEco.value.match(/\d+/g);
                    if (partes && partes.length > 0) {
                        const totalMesesOriginal = (parseInt(partes[0], 10) || 0) * 12 + (parseInt(partes[1], 10) || 0);
                        const totalMesesNovo = Math.round(totalMesesOriginal * fatorReducao);
                        paybackVarEco.value = `${Math.floor(totalMesesNovo / 12)} anos e ${totalMesesNovo % 12} meses`;
                        paybackVarEco.formattedValue = paybackVarEco.value;
                    }
                }

                propostaEconomica.variables.filter(v => v.key.startsWith('f_parcela')).forEach(parcelaVar => {
                    const valorOriginal = parseFloat(parcelaVar.value);
                    if (!isNaN(valorOriginal)) {
                        const novoValor = valorOriginal * fatorReducao;
                        parcelaVar.value = novoValor.toString();
                        parcelaVar.formattedValue = novoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                });
                console.log(`Proposta Econômica calculada com ${ (percentualDesconto * 100).toFixed(2) }% de desconto.`);
            } catch (calcError) {
                console.error("Erro ao calcular Proposta Econômica:", calcError);
            }
            // --- FIM DA LÓGICA DE CÁLCULO ---

            searchForm.style.display = 'none';
            proposalHeader.style.display = 'block';
            proposalDetailsSection.style.display = 'flex';
            mainFooter.style.display = 'block';
            
            renderizarProposta(propostaOriginal, 'performance');
            blockFeatures();

            const backToSearchBtn = document.getElementById('back-to-search-btn');
            backToSearchBtn.addEventListener('click', () => {
                proposalDetailsSection.style.display = 'none';
                proposalHeader.style.display = 'none';
                expiredProposalSection.style.display = 'none';
                searchForm.style.display = 'flex';
                projectIdInput.value = '';
                searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
                searchButton.disabled = false;
                document.body.classList.remove('theme-economic');
                document.getElementById('btn-economica').classList.remove('active');
                document.getElementById('btn-alta-performance').classList.add('active');
            });


		// ... (código que mostra as seções e renderiza a proposta) ...
		renderizarProposta(propostaOriginal, 'performance');
		blockFeatures();

		// CORREÇÃO: Inicia o observador passando o ID do projeto e o NOME da proposta
		observarVisualizacaoDePreco(proposta.project.id, proposta.name);

		const backToSearchBtn = document.getElementById('back-to-search-btn');


		// ... (código que mostra as seções e renderiza a proposta) ...
		renderizarProposta(propostaOriginal, 'performance');
		blockFeatures();

		// A chamada continua correta, passando apenas o ID do projeto
		observarVisualizacaoDePreco(proposta.project.id);

		const backToSearchBtn = document.getElementById('back-to-search-btn');



        } catch (err) {
            console.error("Erro na busca:", err);
            searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
            searchButton.disabled = false;
        }
    }

    // --- Inicialização da Página ---
    searchButton.addEventListener('click', handleSearch);

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
        if (propostaOriginal) renderizarProposta(propostaOriginal, 'performance');
    });
    btnEconomica.addEventListener('click', () => {
        if (btnEconomica.classList.contains('active')) return;
        document.body.classList.add('theme-economic');
        btnAltaPerformance.classList.remove('active');
        btnEconomica.classList.add('active');
        if (propostaEconomica) renderizarProposta(propostaEconomica, 'economica');
    });

    const phoneNumber = "5582994255946";
    const whatsappMessage = encodeURIComponent("Olá! Gostaria de mais informações sobre a proposta.");
    document.getElementById('whatsapp-link').href = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;

    searchForm.style.display = 'flex';
    proposalDetailsSection.style.display = 'none';
    expiredProposalSection.style.display = 'none';
    proposalHeader.style.display = 'none';
    mainFooter.style.display = 'block';
} );
