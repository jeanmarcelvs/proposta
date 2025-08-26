// --- ARQUIVO app.js COMPLETO E CORRIGIDO -----

import { consultarProposta, atualizarDescricao } from "./api.js";

document.addEventListener('DOMContentLoaded', () => {

    window.scrollTo(0, 0);

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
    let lastEventTime = 0;

    // --- Mapa de Logos ---
    const logoMap = {
        'huawei': 'assets/logos/huawei-logo.png',
        'risen': 'assets/logos/risen-logo.png',
        'ja solar': 'assets/logos/ja-solar-logo.png',
        'byd': 'assets/logos/byd-logo.png',
        'phb': 'assets/logos/phb-logo.png',
        'gdis-premium': 'assets/logos/gdis-premium.png',
        'gdis-economico': 'assets/logos/gdis-economico.png'
    };

    // --- Funções de Segurança ---
    function blockFeatures() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.metaKey && e.altKey && e.key === 'i')) {
                e.preventDefault();
            }
        });
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    blockFeatures();


    // --- Funções de Ajuda ---
    function formatarValor(valor) {
        if (typeof valor !== 'number') return valor;
        return `R$ ${valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    }

    function formatarConsumo(consumo) {
        if (typeof consumo !== 'number') return consumo;
        return `${consumo.toFixed(0)} kWh`;
    }

    function formatarPotencia(potencia) {
        if (typeof potencia !== 'number') return potencia;
        return `${(potencia / 1000).toFixed(2).replace('.', ',')} kWp`;
    }

    // --- Funções de Renderização de UI ---
    function renderizarProposta(proposta) {
        console.log("Renderizando proposta:", proposta);
        
        let htmlContent = '';

        // 1. Título e cabeçalho da proposta
        htmlContent += `
            <div class="proposal-details fadeInUp">
                <div class="proposal-header">
                    <h1>Proposta de Energia Solar</h1>
                    <p>Detalhes técnicos, benefícios e valores para o seu projeto.</p>
                </div>
            `;

        // 2. Seção de Resumo e Dados do Cliente
        htmlContent += `
            <section class="details-grid fadeIn">
                <div class="details-card fadeInUp" style="animation-delay: 0.2s;">
                    <h2>Resumo do Projeto</h2>
                    <ul class="details-list">
                        <li><i class="fas fa-check-circle"></i> Potência do Sistema: <strong>${formatarPotencia(proposta.potencia_sistema)}</strong></li>
                        <li><i class="fas fa-check-circle"></i> Geração Média Mensal: <strong>${formatarConsumo(proposta.geracao_media_mensal)}</strong></li>
                        <li><i class="fas fa-check-circle"></i> Redução na Conta de Energia: <strong>~${proposta.reducao_conta_percentual}%</strong></li>
                    </ul>
                </div>
                <div class="details-card fadeInUp" style="animation-delay: 0.3s;">
                    <h2>Dados do Cliente</h2>
                    <ul class="details-list">
                        <li><i class="fas fa-user"></i> Nome: <strong>${proposta.nome_cliente}</strong></li>
                        <li><i class="fas fa-map-marker-alt"></i> Localização: <strong>${proposta.localizacao}</strong></li>
                        <li><i class="fas fa-bolt"></i> Consumo Médio: <strong>${formatarConsumo(proposta.consumo_medio_mensal)}</strong></li>
                    </ul>
                </div>
            </section>
        `;

        // 3. Seção de Equipamentos (Cards de Comparação)
        htmlContent += `
            <section class="installation-comparison fadeIn" style="animation-delay: 0.4s;">
                <h2 class="section-title slideInLeft">Equipamentos</h2>
                <div class="comparison-card fadeInUp" style="animation-delay: 0.5s;">
                    <div class="comparison-card__flipper">
                        <div class="comparison-card__front">
                            <img src="${logoMap[proposta.inversor.fabricante.toLowerCase()] || 'assets/logos/default-inversor.png'}" alt="Logo do Inversor" class="comparison-card__logo">
                            <h3>Inversor</h3>
                            <p>${proposta.inversor.modelo}</p>
                            <span class="info-box">Clique para saber mais</span>
                        </div>
                        <div class="comparison-card__back">
                            <p>${proposta.inversor.descricao}</p>
                        </div>
                    </div>
                </div>
                <div class="comparison-card fadeInUp" style="animation-delay: 0.6s;">
                    <div class="comparison-card__flipper">
                        <div class="comparison-card__front">
                            <img src="${logoMap[proposta.modulos.fabricante.toLowerCase()] || 'assets/logos/default-modulo.png'}" alt="Logo do Módulo" class="comparison-card__logo">
                            <h3>Módulos</h3>
                            <p>${proposta.modulos.quantidade}x ${proposta.modulos.modelo}</p>
                            <span class="info-box">Clique para saber mais</span>
                        </div>
                        <div class="comparison-card__back">
                            <p>${proposta.modulos.descricao}</p>
                        </div>
                    </div>
                </div>
            </section>
        `;
        
        // 4. Seção de Financiamento (Acordeão)
        htmlContent += `
            <section class="accordion-container fadeIn" style="animation-delay: 0.7s;">
                <h2 class="section-title slideInLeft">Plano de Financiamento</h2>
                <div class="accordion-item fadeInUp" style="animation-delay: 0.8s;">
                    <button class="accordion-button">
                        Opções de Financiamento
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="accordion-content">
                        <h3>Plano Padrão</h3>
                        <p>Valor Total: <strong>${formatarValor(proposta.plano_financiamento.valor_total)}</strong></p>
                        <p>Entrada: <strong>${formatarValor(proposta.plano_financiamento.entrada)}</strong></p>
                        <p>Parcelas: <strong>${proposta.plano_financiamento.parcelas}x</strong> de <strong>${formatarValor(proposta.plano_financiamento.valor_parcela)}</strong></p>
                    </div>
                </div>
            </section>
        `;

        // 5. Botão "Nova Consulta" no final da página
        htmlContent += `<div style="text-align: center; margin-top: 2rem;">
            <button id="back-to-search-btn" class="btn btn--primary"><i class="fas fa-arrow-left"></i> Nova Consulta</button>
        </div>`;


        proposalDetailsSection.innerHTML = htmlContent;

        // Adiciona os event listeners depois que o HTML é renderizado
        document.querySelectorAll('.comparison-card').forEach(card => {
            card.addEventListener('click', () => card.classList.toggle('is-in-view'));
        });
        document.querySelectorAll('.accordion-button').forEach(button => {
            button.addEventListener('click', () => {
                const content = button.nextElementSibling;
                button.classList.toggle('active');
                if (content.style.display === 'block') {
                    content.style.display = 'none';
                } else {
                    content.style.display = 'block';
                }
            });
        });
    }

    // --- Lógica Principal ---
    async function handleSearch() {
        searchMessage.textContent = 'Buscando proposta...';
        searchButton.disabled = true;

        const projectId = projectIdInput.value.trim();
        if (!projectId) {
            searchMessage.textContent = 'Por favor, insira o ID da proposta.';
            searchButton.disabled = false;
            return;
        }

        try {
            const data = await consultarProposta(projectId);
            propostaOriginal = data.proposta_premium;
            propostaEconomica = data.proposta_economica;

            // Apenas exibe a tela de expirada se a API retornar uma data de expiração
            // que já passou. O erro é capturado no catch.
            const today = new Date();
            const expirationDate = new Date(propostaOriginal.expirationDate);

            if (expirationDate < today) {
                searchForm.style.display = 'none';
                expiredProposalSection.style.display = 'flex';
                mainFooter.style.display = 'block';
            } else if (propostaOriginal && propostaEconomica) {
                renderizarProposta(propostaOriginal);
                proposalHeader.style.display = 'block';
                searchForm.style.display = 'none';
                expiredProposalSection.style.display = 'none';
                proposalDetailsSection.style.display = 'flex';
                mainFooter.style.display = 'block';
                document.body.classList.remove('theme-economic');
            } else {
                 searchForm.style.display = 'none';
                 expiredProposalSection.style.display = 'flex';
                 mainFooter.style.display = 'block';
            }
        } catch (error) {
            console.error('Erro na busca:', error);
            searchForm.style.display = 'none';
            expiredProposalSection.style.display = 'flex';
            mainFooter.style.display = 'block';
        } finally {
            searchButton.disabled = false;
        }
    }

    function switchToEconomic() {
        document.body.classList.add('theme-economic');
        document.getElementById('btn-economica').classList.add('active');
        document.getElementById('btn-alta-performance').classList.remove('active');
        renderizarProposta(propostaEconomica);
    }

    function switchToPerformance() {
        document.body.classList.remove('theme-economic');
        document.getElementById('btn-alta-performance').classList.add('active');
        document.getElementById('btn-economica').classList.remove('active');
        renderizarProposta(propostaOriginal);
    }

    // --- Event Listeners ---
    searchButton.addEventListener('click', handleSearch);
    projectIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    backToSearchBtn.addEventListener('click', () => {
        lastEventTime = 0;
        proposalDetailsSection.classList.remove('dynamic-spacing');
        window.location.href = window.location.pathname;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // CORRIGIDO: O código de inicialização do cabeçalho e dos botões foi movido para dentro do DOMContentLoaded
    const btnAltaPerformance = document.getElementById('btn-alta-performance');
    const btnEconomica = document.getElementById('btn-economica');
    if(btnAltaPerformance && btnEconomica) {
        btnAltaPerformance.addEventListener('click', switchToPerformance);
        btnEconomica.addEventListener('click', switchToEconomic);
    }

    const phoneNumber = "5582994255946";
    const whatsappMessage = encodeURIComponent("Olá! Gostaria de mais informações sobre a proposta.");
    const whatsappLink = document.getElementById('whatsapp-link');
    if (whatsappLink) {
        whatsappLink.href = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;
    }
});