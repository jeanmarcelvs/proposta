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
    const findVar = (proposta, key, useFormatted = false) => {
        const variable = proposta.variables?.find(v => v.key === key);
        if (!variable) return 'N/A';
        return useFormatted && variable.formattedValue ? variable.formattedValue : variable.value;
    };
    const getTimestamp = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

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
                    <span class="spec-card__label">Inversor Solar</span>
                    <span class="spec-card__value">${potencia}<span class="unit-symbol">W</span></span>
                    <span class="spec-card__meta">${qnt} Unidade(s)</span>
                </div>
            `;
        }).join('');

        const modulosHtml = `
            <div class="spec-card">
                <span class="spec-card__label">Painel Solar</span>
                <span class="spec-card__value">${findVar(dados, 'modulo_potencia', true)}<span class="unit-symbol">W</span></span>
                <span class="spec-card__meta">${findVar(dados, 'modulo_quantidade', true)} Unidades</span>
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
            { icon: 'fa-exclamation-triangle', title: 'Estruturas Simples', description: 'Utiliza estruturas de fixação em alumínio simples. <em>(A versão Premium oferece tratamento anticorrosivo superior para maior durabilidade).</em>' },
            { icon: 'fa-exclamation-triangle', title: 'Cabeamento Simples', description: 'Instalação com cabeamento simples. <em>(A versão Premium possui dupla isolação para proteção extra contra falhas).</em>' },
            { icon: 'fa-exclamation-triangle', title: 'Proteção Simples', description: 'A proteção do sistema dependerá das proteções internas da propriedade do cliente, se existir. <em>(A versão Premium inclui Sistema de Proteção Completo para proteger todos os seus equipamentos).</em>' },
            { icon: 'fa-exclamation-triangle', title: 'Conectores Simples', description: 'Utiliza conectores simples. <em>(A versão Premium usa conectores suíços que evitam perdas e superaquecimento, os quais são mais recomendados).</em>' },
            { icon: 'fa-exclamation-triangle', title: 'Ramal da Concessionária', description: 'Mantém o cabo antigo de responsabilidade da concessionária, geralmente de alumínio e já fora dos padrões atuais, que pode apresentar riscos de superaquecimento a longo prazo.' },
        ];

        if (tipoProposta === 'economica') {
            title = '<i class="fas fa-tools"></i> Padrão de Instalação';
            tagHtml = '<span class="section-tag tag-simple">Simples</span>';
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
        } else { // Alta Performance
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

    function renderizarProposta(dados, tipoProposta = 'performance') {
        const clienteNome = document.getElementById('cliente-nome');
        const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
        const dataGeracao = document.getElementById('data-geracao');
        const dataLabel = dataGeracao.parentElement.querySelector('strong');
        const geracaoMensal = document.getElementById('geracao-mensal');
        const potenciaSistema = document.getElementById('potencia-sistema');
        const tipoInstalacao = document.getElementById('tipo-instalacao');
        const contaEnergiaEstimada = document.getElementById('conta-energia-estimada');
        const valorTotal = document.getElementById('valor-total');
        const proposalValidity = document.getElementById('proposal-validity');

        if (dataLabel) dataLabel.textContent = 'Data de Atualização:';
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

    // NOVA FUNÇÃO PARA MOSTRAR RESUMO APRIMORADO
    function mostrarResumoNoCabecalho() {
        if (summaryWasShown) return;
        summaryWasShown = true;

        const headerSummary = document.getElementById('header-summary');
        const precoPerformance = parseFloat(findVar(propostaOriginal, 'preco'));
        const precoEconomica = parseFloat(findVar(propostaEconomica, 'preco'));

        const parcelasPerformance = propostaOriginal.variables.filter(v => v.key.startsWith('f_parcela'));
        const menorParcelaPerformance = parcelasPerformance.reduce((min, p) => Math.min(min, parseFloat(p.value)), Infinity);
        const prazoMenorParcelaP = propostaOriginal.variables.find(v => v.key.replace('prazo', 'parcela') === parcelasPerformance.find(p => parseFloat(p.value) === menorParcelaPerformance)?.key)?.value;

        const parcelasEconomica = propostaEconomica.variables.filter(v => v.key.startsWith('f_parcela'));
        const menorParcelaEconomica = parcelasEconomica.reduce((min, p) => Math.min(min, parseFloat(p.value)), Infinity);
        const prazoMenorParcelaE = propostaEconomica.variables.find(v => v.key.replace('prazo', 'parcela') === parcelasEconomica.find(p => parseFloat(p.value) === menorParcelaEconomica)?.key)?.value;

        // NOVO DESIGN COM CARDS CLICÁVEIS
        headerSummary.innerHTML = `
            <div class="summary-card" id="summary-performance" data-type="performance">
                <div class="summary-card__header">
                    <span class="summary-card__label">Alta Performance</span>
                    <span class="summary-card__badge">Premium</span>
                </div>
                <div class="summary-card__value">
                    <span class="summary-card__currency">R$</span>
                    ${precoPerformance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div class="summary-card__installment">
                    ou <strong>${prazoMenorParcelaP}x</strong> de <strong>R$ ${menorParcelaPerformance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
            </div>
            <div class="summary-card" id="summary-economic" data-type="economic">
                <div class="summary-card__header">
                    <span class="summary-card__label">Opção Econômica</span>
                    <span class="summary-card__badge">Custo-Benefício</span>
                </div>
                <div class="summary-card__value">
                    <span class="summary-card__currency">R$</span>
                    ${precoEconomica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div class="summary-card__installment">
                    ou <strong>${prazoMenorParcelaE}x</strong> de <strong>R$ ${menorParcelaEconomica.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
            </div>
        `;

        headerSummary.style.display = 'flex';

        // ADICIONAR EVENT LISTENERS PARA OS CARDS
        const summaryPerformance = document.getElementById('summary-performance');
        const summaryEconomic = document.getElementById('summary-economic');
        const btnAltaPerformance = document.getElementById('btn-alta-performance');
        const btnEconomica = document.getElementById('btn-economica');

        summaryPerformance.addEventListener('click', () => {
            if (summaryPerformance.classList.contains('active')) return;
            
            // Atualizar estado visual dos cards
            summaryEconomic.classList.remove('active');
            summaryPerformance.classList.add('active');
            
            // Atualizar botões do header
            document.body.classList.remove('theme-economic');
            btnEconomica.classList.remove('active');
            btnAltaPerformance.classList.add('active');
            
            // Renderizar proposta
            if (propostaOriginal) {
                renderizarProposta(propostaOriginal, 'performance');
                criarObservadores(propostaOriginal.project.id, 'performance');
            }
        });

        summaryEconomic.addEventListener('click', () => {
            if (summaryEconomic.classList.contains('active')) return;
            
            // Atualizar estado visual dos cards
            summaryPerformance.classList.remove('active');
            summaryEconomic.classList.add('active');
            
            // Atualizar botões do header
            document.body.classList.add('theme-economic');
            btnAltaPerformance.classList.remove('active');
            btnEconomica.classList.add('active');
            
            // Renderizar proposta
            if (propostaEconomica) {
                renderizarProposta(propostaEconomica, 'economica');
                criarObservadores(propostaEconomica.project.id, 'economica');
            }
        });

        // Definir estado inicial (Performance ativo)
        summaryPerformance.classList.add('active');
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

        let newDescription = descriptionParts.join(' | ');
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

    function criarObservadores(projectId, tipoProposta) {
        if (priceObserver) priceObserver.disconnect();
        if (installationObserver) installationObserver.disconnect();

        const priceTarget = document.getElementById('valor-total');
        const installationTarget = document.getElementById('installation-comparison-container');

        if (priceTarget) {
            priceObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const eventType = tipoProposta === 'economica' ? 'viewedEconomic' : 'viewedPerformance';
                        registrarEvento(projectId, eventType);
                        mostrarResumoNoCabecalho();
                    }
                });
            }, { threshold: 0.5 });
            priceObserver.observe(priceTarget);
        }

        if (installationTarget) {
            installationObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const eventType = tipoProposta === 'economica' ? 'viewedEconomic' : 'viewedPerformance';
                        registrarEvento(projectId, eventType);
                        mostrarResumoNoCabecalho();
                    }
                });
            }, { threshold: 0.3 });
            installationObserver.observe(installationTarget);
        }
    }

    // --- Função Principal de Busca ---
    async function handleSearch(projectId) {
        if (!projectId) {
            searchMessage.textContent = 'Por favor, digite um ID válido.';
            return;
        }

        searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
        searchButton.disabled = true;
        searchMessage.textContent = '';

        try {
            const dados = await consultarProposta(projectId);
            
            if (dados && dados.length >= 2) {
                propostaOriginal = dados[0];
                propostaEconomica = dados[1];

                searchForm.style.display = 'none';
                proposalDetailsSection.style.display = 'block';
                proposalHeader.style.display = 'block';
                mainFooter.style.display = 'block';

                renderizarProposta(propostaOriginal, 'performance');
                criarObservadores(propostaOriginal.project.id, 'performance');
                blockFeatures();
            } else {
                throw new Error('Dados insuficientes');
            }
        } catch (error) {
            console.error('Erro ao buscar proposta:', error);
            searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
            searchButton.disabled = false;
            searchForm.style.display = 'flex';
            searchMessage.textContent = 'Projeto não encontrado ou inválido. Por favor, verifique o ID.';
        }
    }

    // --- Função de Inicialização e Roteamento ---
    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const projectIdFromUrl = urlParams.get('projectId');

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
            window.location.href = window.location.pathname;
        });

        proposalHeader.innerHTML = `
            <div class="header__container">
                <div class="header__logo"><img src="logo.png" alt="Logo da GDIS"></div>
                <div class="header__options">
                    <button id="btn-alta-performance" class="option-button active">Alta Performance</button>
                    <button id="btn-economica" class="option-button">Econômica</button>
                </div>
            </div>
            <div id="header-summary" class="header-summary" style="display: none;"></div>`;

        const btnAltaPerformance = document.getElementById('btn-alta-performance');
        const btnEconomica = document.getElementById('btn-economica');

        btnAltaPerformance.addEventListener('click', () => {
            if (btnAltaPerformance.classList.contains('active')) return;
            
            document.body.classList.remove('theme-economic');
            btnEconomica.classList.remove('active');
            btnAltaPerformance.classList.add('active');
            
            // Atualizar cards do resumo se existirem
            const summaryPerformance = document.getElementById('summary-performance');
            const summaryEconomic = document.getElementById('summary-economic');
            if (summaryPerformance && summaryEconomic) {
                summaryEconomic.classList.remove('active');
                summaryPerformance.classList.add('active');
            }
            
            if (propostaOriginal) {
                renderizarProposta(propostaOriginal, 'performance');
                criarObservadores(propostaOriginal.project.id, 'performance');
            }
        });

        btnEconomica.addEventListener('click', () => {
            if (btnEconomica.classList.contains('active')) return;
            
            document.body.classList.add('theme-economic');
            btnAltaPerformance.classList.remove('active');
            btnEconomica.classList.add('active');
            
            // Atualizar cards do resumo se existirem
            const summaryPerformance = document.getElementById('summary-performance');
            const summaryEconomic = document.getElementById('summary-economic');
            if (summaryPerformance && summaryEconomic) {
                summaryPerformance.classList.remove('active');
                summaryEconomic.classList.add('active');
            }
            
            if (propostaEconomica) {
                renderizarProposta(propostaEconomica, 'economica');
                criarObservadores(propostaEconomica.project.id, 'economica');
            }
        });

        const phoneNumber = "5582994255946";
        const whatsappMessage = encodeURIComponent("Olá! Gostaria de mais informações sobre a proposta.");
        document.getElementById('whatsapp-link').href = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;
    }

    init( );
});
