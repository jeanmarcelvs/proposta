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
    const searchMessage = document.getElementById('search-message');
    const backToSearchBtn = document.getElementById('back-to-search-btn');
    const backFromExpiredBtn = document.getElementById('back-from-expired');

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
    
    function findItemByCategory(data, category) {
        const item = data.pricingTable.find(item => item.category === category);
        if (!item) {
            console.error(`Item com a categoria '${category}' não encontrado na tabela de preços.`);
            return {
                fabricante: 'N/A',
                modelo: 'Não encontrado',
                quantidade: 0,
                descricao: `Detalhes do produto não disponíveis.`
            };
        }
        const nameParts = item.item.split(' ');
        const manufacturer = nameParts.length > 1 ? nameParts[0].toLowerCase() : 'default';
        return {
            fabricante: manufacturer,
            modelo: item.item,
            quantidade: item.qnt,
            descricao: `Detalhes do produto ${item.item}.`
        };
    }
    
    function renderizarProposta(proposta) {
        console.log("Renderizando proposta com os dados:", proposta);
        
        const logoPath = 'logo.png';
        let htmlContent = `
            <div class="proposal-details fadeInUp">
                <div class="proposal-header">
                    <h1>Proposta de Energia Solar</h1>
                    <p>Detalhes técnicos, benefícios e valores para o seu projeto.</p>
                </div>
            
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

                <section class="installation-comparison fadeIn" style="animation-delay: 0.4s;">
                    <h2 class="section-title slideInLeft">Equipamentos</h2>
                    <div class="comparison-card fadeInUp" style="animation-delay: 0.5s;">
                        <div class="comparison-card__flipper">
                            <div class="comparison-card__front">
                                <img src="${logoPath}" alt="Logo do Inversor" class="comparison-card__logo">
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
                                <img src="${logoPath}" alt="Logo do Módulo" class="comparison-card__logo">
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
            
                <div style="text-align: center; margin-top: 2rem;">
                    <button id="back-to-search-btn" class="btn btn--primary"><i class="fas fa-arrow-left"></i> Nova Consulta</button>
                </div>
            </div>
        `;
        
        proposalDetailsSection.innerHTML = htmlContent;

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
        
        document.getElementById('back-to-search-btn').addEventListener('click', () => {
            window.location.href = window.location.pathname;
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
            console.log("Dados recebidos da API:", data);
            
            const proposta = {
                nome_cliente: data.name,
                localizacao: data.project.name,
                expirationDate: data.expirationDate,
                potencia_sistema: 12000,
                geracao_media_mensal: 1600,
                reducao_conta_percentual: 95,
                consumo_medio_mensal: 1500,
                inversor: findItemByCategory(data, 'Inversor'),
                modulos: findItemByCategory(data, 'Módulo'),
                plano_financiamento: {
                    valor_total: 55000,
                    entrada: 5000,
                    parcelas: 60,
                    valor_parcela: 1000
                }
            };
            
            console.log("Dados da proposta mapeados:", proposta);
            
            const today = new Date();
            const expirationDate = new Date(proposta.expirationDate);

            if (expirationDate < today) {
                searchForm.style.display = 'none';
                expiredProposalSection.style.display = 'flex';
                mainFooter.style.display = 'block';
            } else {
                renderizarProposta(proposta);
                proposalHeader.style.display = 'block';
                searchForm.style.display = 'none';
                expiredProposalSection.style.display = 'none';
                proposalDetailsSection.style.display = 'flex';
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

    // --- Event Listeners ---
    searchButton.addEventListener('click', handleSearch);
    projectIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    if (backFromExpiredBtn) {
        backFromExpiredBtn.addEventListener('click', () => {
            window.location.href = window.location.pathname;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const phoneNumber = "5582994255946";
    const whatsappMessage = encodeURIComponent("Olá! Gostaria de mais informações sobre a proposta.");
    const whatsappLink = document.getElementById('whatsapp-link');
    if (whatsappLink) {
        whatsappLink.href = `https://wa.me/${phoneNumber}?text=${whatsappMessage}`;
    }
});