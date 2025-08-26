// --- ARQUIVO app.js COMPLETO E CORRIGIDO ---

import { consultarProposta, atualizarDescricao } from "./api.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- Seletores do DOM ---
    const searchForm = document.getElementById('search-form');
    const proposalDetailsSection = document.getElementById('proposal-details');
    const expiredProposalSection = document.getElementById('expired-proposal-section');
    const proposalHeader = document.getElementById('proposal-header');
    const projectIdInput = document.getElementById('project-id');
    const searchButton = document.getElementById('search-button');
    const mainFooter = document.getElementById('main-footer');
    const backToSearchBtn = document.getElementById('back-to-search-btn');
if (backToSearchBtn) {
        backToSearchBtn.addEventListener('click', () => {
            expiredProposalSection.style.display = 'none';
            searchForm.style.display = 'flex';
        });
    }
    const searchMessage = document.getElementById('search-message');

    // --- Variáveis de Estado ---
    let propostaOriginal, propostaEconomica;
    let priceObserver, installationObserver;
    let debounceTimer;
    let trackingStatus = { viewedPerformance: null, viewedEconomic: null };
    let summaryWasShown = false;
    const DESCRIPTION_LIMIT = 100;

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

    const formatarValorInteiro = (valor) => {
        const num = parseFloat(valor);
        if (isNaN(num)) return 'N/A';
        const formatted = Math.trunc(num).toLocaleString('pt-BR');
        return `<span class="currency-symbol">R$</span>${formatted}`;
    };

    const findVar = (proposta, key, useFormatted = false) => {
        const variable = proposta.variables?.find(v => v.key === key);
        if (!variable) return 'N/A';
        return useFormatted && variable.formattedValue ? variable.formattedValue : variable.value;
    };
    const getTimestamp = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // --- Funções de Renderização (sem alterações, mantidas como estavam) ---
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

        const ultimaOpcao = opcoes[opcoes.length - 1];
        const deveDestacar = melhorOpcao.prazo !== ultimaOpcao.prazo;

        financingOptionsContainer.innerHTML = opcoes.map(opt => `
            <div class="financing-option ${deveDestacar && opt.prazo === melhorOpcao.prazo ? 'highlight' : ''}">
                ${deveDestacar && opt.prazo === melhorOpcao.prazo ? '<div class="highlight-tag">Equilibrado</div>' : ''}
                <div class="prazo">${opt.prazo}<span>x</span></div>
                <div class="valor">${formatarMoeda(opt.valorParcela)}</div>
            </div>
        `).join('');
    }

    // DENTRO DE app.js, SUBSTITUA A FUNÇÃO INTEIRA

// DENTRO DE app.js, SUBSTITUA A FUNÇÃO INTEIRA

function renderizarEquipamentos(dados, tipoProposta) {
    const equipmentContainer = document.getElementById('equipment-container');
    const equipmentTitle = document.getElementById('equipment-title');
    
    equipmentTitle.innerHTML = tipoProposta === 'economica' 
        ? '<i class="fas fa-shield-alt"></i> Econômica' 
        : '<i class="fas fa-rocket"></i> Equipamentos Premium';

    const inversores = dados.variables.filter(v => v.key.startsWith('inversor_modelo_') && v.value);
    const fabricante = findVar(dados, 'inversor_fabricante').toLowerCase().split(' ')[0];
    const logoFileName = tipoProposta === 'economica' ? 'logo2.png' : logoMap[fabricante];
    
    let logoHtml = logoFileName 
        ? `<img src="${logoFileName}" alt="Logo do equipamento">`
        : `<p><strong>${findVar(dados, 'inversor_fabricante', true)}</strong></p>`;

    // CORREÇÃO: Formata a quantidade como "Qtd: [número]"
    let inversoresHtml = inversores.map(inv => {
        const index = inv.key.split('_').pop();
        const qnt = findVar(dados, `inversor_quantidade_${index}`, true);
        const potencia = findVar(dados, `inversor_potencia_nominal_${index}`, true);
        return `
            <div class="spec-card">
                <span class="spec-card__label">Inversor Solar</span>
                <span class="spec-card__value">${potencia}<span class="unit-symbol">W</span></span>
                <span class="spec-card__meta">Qtd: ${qnt}</span>
            </div>
        `;
    }).join('');

    // CORREÇÃO: Formata a quantidade como "Qtd: [número]"
    const modulosHtml = `
        <div class="spec-card">
            <span class="spec-card__label">Painel Solar</span>
            <span class="spec-card__value">${findVar(dados, 'modulo_potencia', true)}<span class="unit-symbol">W</span></span>
            <span class="spec-card__meta">Qtd: ${findVar(dados, 'modulo_quantidade', true)}</span>
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
        const container = document.getElementById('installation-comparison-container');
        
        let title, tagHtml;
        
        const itensPremium = [
            { icon: 'fa-bolt', title: 'Ramal de Cobre Seguro', description: 'Substituímos o cabo de alumínio da concessionária por cobre puro, eliminando riscos de superaquecimento e incêndio no seu medidor.' },
            { icon: 'fa-shield-alt', title: 'Estruturas Super-reforçadas', description: 'Nossas estruturas possuem tratamento anticorrosivo superior para resistir ao tempo e às intempéries, garantindo a longevidade do seu investimento.' },
            { icon: 'fa-layer-group', title: 'Cabeamento Dupla Isolação', description: 'Utilizamos cabeamento solar específico com dupla camada de proteção, garantindo máxima durabilidade e segurança contra falhas elétricas.' },
            { icon: 'fa-tachometer-alt', title: 'Sistema de Proteção Coordenado', description: 'Instalamos um Sistema de Proteção contra Surtos com coordenação de classes para proteger seus equipamentos e eletrodomésticos de picos de energia.' },
            { icon: 'fa-gem', title: 'Conectores MC4 Stäubli', description: 'Usamos conectores MC4 originais da marca suíça Stäubli, que minimizam a perda de energia e garantem a máxima eficiência do sistema por décadas.' },
        ];

        const itensSimples = [
    { icon: 'fa-check-circle', title: 'Estruturas Simples', description: 'Utiliza estruturas de fixação simples em alumínio.' },
    { icon: 'fa-check-circle', title: 'Cabeamento Simples', description: 'Instalação com cabeamento solar simples para sistemas residenciais.' },
    { icon: 'fa-check-circle', title: 'Proteção Simples', description: 'Utiliza dispositivos de proteção simples para a segurança do sistema.' },
    { icon: 'fa-check-circle', title: 'Conectores Simples', description: 'Utiliza conectores simples do tipo MC4.' },
    { icon: 'fa-check-circle', title: 'Ramal da Concessionária', description: 'Mantém o ramal de conexão existente, de responsabilidade da concessionária.' },
];

        if (tipoProposta === 'economica') {
            title = '<i class="fas fa-tools"></i> Padrão de Instalação';
            tagHtml = '<span class="section-tag tag-simple">Econômica</span>';
            container.innerHTML = itensSimples.map(item => `
                <div class="comparison-card">
                    <div class="comparison-card__flipper">
                        <div class="comparison-card__front">
                            <i class="fas ${item.icon} comparison-card__icon"></i>
                            <h3 class="comparison-card__title">${item.title}</h3>
                        </div>
                        <div class="comparison-card__back">
                            <p>${item.description}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        } else { // Alta Performance -> Premium
            title = '<i class="fas fa-award"></i> Padrão de Instalação';
            tagHtml = '<span class="section-tag tag-premium">Premium</span>';
            container.innerHTML = itensPremium.map(item => `
                <div class="comparison-card">
                    <div class="comparison-card__flipper">
                        <div class="comparison-card__front">
                            <i class="fas ${item.icon} comparison-card__icon"></i>
                            <h3 class="comparison-card__title">${item.title}</h3>
                        </div>
                        <div class="comparison-card__back">
                            <p>${item.description}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        installationTitle.innerHTML = `${title} ${tagHtml}`;
    }

    // DENTRO DE app.js, SUBSTITUA A FUNÇÃO INTEIRA

// DENTRO DE app.js, SUBSTITUA A FUNÇÃO INTEIRA

// DENTRO DE app.js, SUBSTITUA A FUNÇÃO INTEIRA

// DENTRO DE app.js, SUBSTITUA A FUNÇÃO INTEIRA

// DENTRO DE app.js, SUBSTITUA A FUNÇÃO INTEIRA

// DENTRO DE app.js, SUBSTITUA A FUNÇÃO INTEIRA

function renderizarProposta(dados, tipoProposta = 'performance') {
    // --- Seletores dos elementos ---
    const clienteNome = document.getElementById('cliente-nome');
    const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
    const dataProposta = document.getElementById('data-proposta');
    
    const geracaoMensal = document.getElementById('geracao-mensal');
    const potenciaSistema = document.getElementById('potencia-sistema');
    const tipoInstalacao = document.getElementById('tipo-instalacao');
    
    const contaEnergiaEstimada = document.getElementById('conta-energia-estimada');
    
    // Seletores para as seções reintegradas
    const investimentoTotal = document.getElementById('investimento-total');
    const proposalValidity = document.getElementById('proposal-validity');

    // --- Renderização dos dados ---
    clienteNome.textContent = findVar(dados, 'cliente_nome', true);
    clienteCidadeUf.textContent = `${findVar(dados, 'cidade', true)} - ${findVar(dados, 'estado', true)}`;
    
    const dataGeracaoCompleta = findVar(dados, 'data_geracao', true);
    dataProposta.textContent = dataGeracaoCompleta.split(' ')[0];

    geracaoMensal.innerHTML = `${findVar(dados, 'geracao_mensal', true)}<span class="unit-symbol">kWh</span>`;
    potenciaSistema.innerHTML = `${findVar(dados, 'potencia_sistema', true)}<span class="unit-symbol">kWp</span>`;
    tipoInstalacao.textContent = findVar(dados, 'vc_tipo_de_estrutura', true);
    
    const geracaoValor = parseFloat(findVar(dados, 'geracao_mensal'));
    const tarifaValor = parseFloat(findVar(dados, 'tarifa_distribuidora'));
    if (!isNaN(geracaoValor) && !isNaN(tarifaValor)) {
        const contaAtual = geracaoValor * tarifaValor;
        contaEnergiaEstimada.innerHTML = `Ideal para contas de energia de até <strong>${formatarMoeda(contaAtual)}</strong>`;
    } else {
        contaEnergiaEstimada.innerHTML = '';
    }
    
    // Lógica para preencher as seções reintegradas
    investimentoTotal.innerHTML = formatarMoeda(findVar(dados, 'preco'));
    proposalValidity.innerHTML = `Esta proposta é exclusiva para você e válida por <strong>3 dias</strong>, sujeita à disponibilidade de estoque.`;

    // Chama as outras funções de renderização
    renderizarEquipamentos(dados, tipoProposta);
    renderizarPadraoInstalacao(tipoProposta);
    renderizarFinanciamento(dados);
}







    function mostrarResumoNoCabecalho() {
        if (summaryWasShown) return;
        summaryWasShown = true;

        const headerSummary = document.getElementById('header-summary');
        const proposalDetailsSection = document.getElementById('proposal-details');

        const precoPerformance = parseFloat(findVar(propostaOriginal, 'preco'));
        const precoEconomica = parseFloat(findVar(propostaEconomica, 'preco'));

        const opcoesPerformance = propostaOriginal.variables
            .filter(v => v.key.startsWith('f_prazo_'))
            .map(prazoVar => {
                const prazo = parseInt(prazoVar.value, 10);
                const parcelaVar = propostaOriginal.variables.find(v => v.key.includes(`f_parcela_`) && v.key.includes(prazoVar.key.split('_')[2]));
                const valorParcela = parcelaVar ? parseFloat(parcelaVar.value) : 0;
                return { prazo, valorParcela };
            }).sort((a, b) => a.prazo - b.prazo);

        const opcoesEconomica = propostaEconomica.variables
            .filter(v => v.key.startsWith('f_prazo_'))
            .map(prazoVar => {
                const prazo = parseInt(prazoVar.value, 10);
                const parcelaVar = propostaEconomica.variables.find(v => v.key.includes(`f_parcela_`) && v.key.includes(prazoVar.key.split('_')[2]));
                const valorParcela = parcelaVar ? parseFloat(parcelaVar.value) : 0;
                return { prazo, valorParcela };
            }).sort((a, b) => a.prazo - b.prazo);

        const ultimaOpcaoP = opcoesPerformance[opcoesPerformance.length - 1];
        const ultimaOpcaoE = opcoesEconomica[opcoesEconomica.length - 1];
        
        headerSummary.innerHTML = `
            <div id="summary-card-performance" class="summary-card summary-card--premium">
                <span class="card-title">Premium</span>
                <div class="price-container">
                    <span class="main-price">${formatarValorInteiro(precoPerformance)}</span>
                </div>
                <span class="installment-info">ou até ${ultimaOpcaoP.prazo}x de ${formatarMoeda(ultimaOpcaoP.valorParcela)}</span>
            </div>
            <div id="summary-card-economica" class="summary-card summary-card--economic">
                <span class="card-title">Econômica</span>
                <div class="price-container">
                    <span class="main-price">${formatarValorInteiro(precoEconomica)}</span>
                </div>
                <span class="installment-info">ou até ${ultimaOpcaoE.prazo}x de ${formatarMoeda(ultimaOpcaoE.valorParcela)}</span>
            </div>
        `;
        
        headerSummary.style.display = 'flex';
        proposalDetailsSection.classList.add('dynamic-spacing');

        const summaryCardPerformance = document.getElementById('summary-card-performance');
        const summaryCardEconomica = document.getElementById('summary-card-economica');
        
        if (summaryCardPerformance) {
            summaryCardPerformance.addEventListener('click', switchToPerformance);
        }
        if (summaryCardEconomica) {
            summaryCardEconomica.addEventListener('click', switchToEconomic);
        }
        
        const btnAltaPerformance = document.getElementById('btn-alta-performance');
        if(btnAltaPerformance.classList.contains('active')) {
            summaryCardPerformance.classList.add('active-card');
            summaryCardEconomica.classList.remove('active-card');
        } else {
            summaryCardPerformance.classList.remove('active-card');
            summaryCardEconomica.classList.add('active-card');
        }
    }

    // --- LÓGICA DE TRACKING E ANIMAÇÃO ---
    function registrarEvento(projectId, eventType) {
        const timestamp = getTimestamp();
        
        if (eventType === 'viewedPerformance') {
            trackingStatus.viewedPerformance = timestamp;
        } else if (eventType === 'viewedEconomic') {
            trackingStatus.viewedEconomic = timestamp;
        } else {
            return; 
        }

        let descriptionParts = [];
        if (trackingStatus.viewedPerformance) {
            descriptionParts.push(`Viu Preço P: ${trackingStatus.viewedPerformance.split(', ')[1]}`);
        }
        if (trackingStatus.viewedEconomic) {
            descriptionParts.push(`Viu Preço E: ${trackingStatus.viewedEconomic.split(', ')[1]}`);
        }

        let newDescription = descriptionParts.map(part => {
    // Ex: Transforma "Viu Preço P: 25/08/2025, 10:30:00" em "Viu P: 25/08 10:30"
    const [tipo, dataHora] = part.split(': ');
    const [data, hora] = dataHora.split(', ');
    const dataCurta = data.substring(0, 5); // Pega DD/MM
    const horaCurta = hora.substring(0, 5); // Pega HH:MM
    return `${tipo.replace('Preço ', '')}: ${dataCurta} ${horaCurta}`;
}).join(' | ');

        if (newDescription.length > DESCRIPTION_LIMIT) {
            newDescription = newDescription.substring(0, DESCRIPTION_LIMIT);
        }

        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            console.log(`Enviando status atualizado: "${newDescription}"`);
            atualizarDescricao(projectId, newDescription)
                .then(response => console.log('Status atualizado com sucesso:', response.data.description))
                .catch(error => console.error('Falha ao atualizar status:', error));
        }, 2500);
    }

    // DENTRO DE app.js, SUBSTITUA A FUNÇÃO INTEIRA

function criarObservadores(projectId, tipoProposta) {

const investmentSection = document.querySelector('.investment-section');
    if (investmentSection) {
        let hasBeenVisible = false;
        priceObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !hasBeenVisible) {
                hasBeenVisible = true;
                const eventType = tipoProposta === 'performance' ? 'viewedPerformance' : 'viewedEconomic';
                registrarEvento(projectId, eventType);
                
                // ADICIONE ESTA LINHA DE VOLTA - ESTA É A CORREÇÃO PRINCIPAL
                mostrarResumoNoCabecalho(); 
                
                priceObserver.unobserve(investmentSection);
            }
        }, { threshold: 0.75 });
        priceObserver.observe(investmentSection);
    }


    // Desconecta observadores antigos para evitar duplicação
    if (priceObserver) priceObserver.disconnect();
    if (installationObserver) installationObserver.disconnect();

    // Observador para a seção de investimento (preço)

    // Observador para os cards de instalação
    const installationCards = document.querySelectorAll('.comparison-card');
    if (installationCards.length > 0) {
        installationObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-in-view');
                } else {
                    entry.target.classList.remove('is-in-view');
                }
            });
        }, { threshold: 0.6, rootMargin: "-40% 0px -40% 0px" });
        
        installationCards.forEach(card => {
            installationObserver.observe(card);
            
            // ADIÇÃO DA LÓGICA DE CLIQUE
            card.addEventListener('click', () => {
                // 'toggle' adiciona a classe se não existir, e remove se já existir.
                card.classList.toggle('is-flipped');
            });
        });
    }
}


    // --- Lógica Principal e Eventos ---
    async function handleSearch(projectId) {
        if (!projectId) return;
        searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        searchButton.disabled = true;
        searchMessage.textContent = '';
        proposalDetailsSection.classList.remove('dynamic-spacing');

        try {
            const proposta = await consultarProposta(projectId);
            if (!proposta || !proposta.id) throw new Error('Proposta não encontrada.');

            const expirationDate = new Date(proposta.expirationDate);
            if (expirationDate < new Date()) {
                searchForm.style.display = 'none';
                expiredProposalSection.style.display = 'flex';
                expiredProposalSection.innerHTML = `<div class="search-card"><h1 class="search-card__title">Proposta Expirada</h1><p class="search-card__subtitle">Por favor, solicite uma nova proposta.</p><button class="btn btn--primary" onclick="location.reload()">Nova Consulta</button></div>`;
                return;
            }

            trackingStatus = { viewedPerformance: null, viewedEconomic: null };
            summaryWasShown = false;
            document.getElementById('header-summary').style.display = 'none';

            propostaOriginal = proposta;
            propostaEconomica = JSON.parse(JSON.stringify(proposta));

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

            searchForm.style.display = 'none';
            proposalHeader.style.display = 'block';
            proposalDetailsSection.style.display = 'flex';
            mainFooter.style.display = 'block';
            
            renderizarProposta(propostaOriginal, 'performance');
            blockFeatures();
            criarObservadores(proposta.project.id, 'performance');

        } catch (err) {
            console.error("Erro na busca:", err);
            searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
            searchButton.disabled = false;
            searchForm.style.display = 'flex';
            searchMessage.textContent = 'Projeto não encontrado ou inválido. Por favor, verifique o ID.';
        }
    }

    // --- Funções de troca de proposta ---
    function switchToPerformance() {
        const btnAltaPerformance = document.getElementById('btn-alta-performance');
        if (btnAltaPerformance.classList.contains('active')) return;
        document.body.classList.remove('theme-economic');
        document.getElementById('btn-economica').classList.remove('active');
        btnAltaPerformance.classList.add('active');
        const summaryCardPerformance = document.getElementById('summary-card-performance');
        const summaryCardEconomica = document.getElementById('summary-card-economica');
        if (summaryCardPerformance && summaryCardEconomica) {
            summaryCardEconomica.classList.remove('active-card');
            summaryCardPerformance.classList.add('active-card');
        }
        if (propostaOriginal) {
            renderizarProposta(propostaOriginal, 'performance');
            criarObservadores(propostaOriginal.project.id, 'performance');
        }
    }

    function switchToEconomic() {
        const btnEconomica = document.getElementById('btn-economica');
        if (btnEconomica.classList.contains('active')) return;
        document.body.classList.add('theme-economic');
        document.getElementById('btn-alta-performance').classList.remove('active');
        btnEconomica.classList.add('active');
        const summaryCardPerformance = document.getElementById('summary-card-performance');
        const summaryCardEconomica = document.getElementById('summary-card-economica');
        if (summaryCardPerformance && summaryCardEconomica) {
            summaryCardPerformance.classList.remove('active-card');
            summaryCardEconomica.classList.add('active-card');
        }
        if (propostaEconomica) {
            renderizarProposta(propostaEconomica, 'economica');
            criarObservadores(propostaEconomica.project.id, 'economica');
        }
    }

    // --- Função de Inicialização e Roteamento ---
    function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectIdFromUrl = urlParams.get('projectId');

    // --- CORREÇÃO APLICADA AQUI ---
    // A variável 'investmentSection' agora é declarada APENAS UMA VEZ.
    const investmentSection = document.querySelector('.investment-section');

    if (projectIdFromUrl) {
        projectIdInput.value = projectIdFromUrl;
        handleSearch(projectIdFromUrl);
    } else {
        searchForm.style.display = 'flex';
        proposalDetailsSection.style.display = 'none';
        expiredProposalSection.style.display = 'none';
        proposalHeader.style.display = 'none';
        mainFooter.style.display = 'block';
    }

    searchButton.addEventListener('click', () => handleSearch(projectIdInput.value.trim()));

    backToSearchBtn.addEventListener('click', () => {
        proposalDetailsSection.classList.remove('dynamic-spacing');
        window.location.href = window.location.pathname;
    });

    proposalHeader.innerHTML = `
        <div class="header__container">
            <div class="header__logo"><img src="logo.png" alt="Logo da GDIS"></div>
            <div class="header__options">
                <button id="btn-alta-performance" class="option-button active">Premium</button>
                <button id="btn-economica" class="option-button">Econômica</button>
            </div>
        </div>
        <div id="header-summary" class="header-summary" style="display: none;"></div>`;
    
    const btnAltaPerformance = document.getElementById('btn-alta-performance');
    const btnEconomica = document.getElementById('btn-economica');

    btnAltaPerformance.addEventListener('click', switchToPerformance);
    btnEconomica.addEventListener('click', switchToEconomic);

    const phoneNumber = "5582994255946";
    const whatsappMessage = encodeURIComponent("Olá! Gostaria de mais informações sobre a proposta.");
    document.getElementById('whatsapp-link').href = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;

    // A lógica do IntersectionObserver foi movida para a função criarObservadores,
    // então não há mais declaração duplicada aqui.
}

    init( );
});
