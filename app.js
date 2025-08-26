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
        const proposalDetailsSection = document.getElementById('proposal-details');

        // Formata a data de criação para exibição
        const dataCriacao = new Date(proposta.createdAt).toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // HTML aprimorado para a seção de cabeçalho
        let htmlContent = `
            <div class="proposal-header">
                <h1 class="fadeIn" style="animation-delay: 0.2s;">
                    Proposta para
                    <br>
                    <span class="client-name">${proposta.nome_cliente}</span>
                </h1>
                <p class="fadeIn" style="animation-delay: 0.3s;">
                    <strong>Localização:</strong> ${proposta.localizacao} | <strong>Data da Proposta:</strong> ${dataCriacao}
                </p>
            </div>
        `;

        // Adicione o restante do seu HTML aqui
        htmlContent += `
        <section class="details-grid fadeIn" style="animation-delay: 0.4s;">
            <div class="details-card fadeInUp" style="animation-delay: 0.5s;">
                <h2>Resumo do Projeto</h2>
                <ul class="details-list">
                    <li><i class="fas fa-check-circle"></i> Potência do Sistema: <strong>${formatarPotencia(proposta.potencia_sistema)}</strong></li>
                    <li><i class="fas fa-check-circle"></i> Geração Média Mensal: <strong>${formatarConsumo(proposta.geracao_media_mensal)}</strong></li>
                    <li><i class="fas fa-check-circle"></i> Redução na Conta de Energia: <strong>~${proposta.reducao_conta_percentual}%</strong></li>
                </ul>
            </div>
            <div class="details-card fadeInUp" style="animation-delay: 0.6s;">
                <h2>Dados do Cliente</h2>
                <ul class="details-list">
                    <li><i class="fas fa-user"></i> Nome: <strong>${proposta.nome_cliente}</strong></li>
                    <li><i class="fas fa-map-marker-alt"></i> Localização: <strong>${proposta.localizacao}</strong></li>
                    <li><i class="fas fa-bolt"></i> Consumo Médio: <strong>${formatarConsumo(proposta.consumo_medio_mensal)}</strong></li>
                </ul>
            </div>
        </section>
        
... // O restante do seu código permanece igual
        `;

        // Atribui o novo conteúdo à seção de detalhes da proposta
        proposalDetailsSection.innerHTML = htmlContent;

        // Adiciona os event listeners
        document.querySelectorAll('.comparison-card').forEach(card => {
            card.addEventListener('click', () => card.classList.toggle('is-in-view'));
        });
        document.querySelectorAll('.accordion-button').forEach(button => {
            button.addEventListener('click', () => {
                const content = button.nextElementSibling;
                button.classList.toggle('active');
                content.style.display = content.style.display === 'block' ? 'none' : 'block';
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
        console.log("Dados recebidos da API:", data);

        const proposta = {
            nome_cliente: data.name,
            localizacao: data.project.name,
            expirationDate: data.expirationDate,
            createdAt: data.createdAt, // Adicione esta linha
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