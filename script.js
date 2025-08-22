// Seleciona os elementos do DOM
const searchForm = document.getElementById('search-form');
const projectIdInput = document.getElementById('project-id');
const messageBox = document.getElementById('message-box');
const proposalDetailsSection = document.getElementById('proposal-details');
const highPerformanceOption = document.getElementById('high-performance-option');
const economicOption = document.getElementById('economic-option');

// Campos de dados
const clienteNome = document.getElementById('cliente-nome');
const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
const dataGeracao = document.getElementById('data-geracao');
const inversorDescricao = document.getElementById('inversor-descricao');
const inversorQuantidade = document.getElementById('inversor-quantidade');
const moduloDescricao = document.getElementById('modulo-descricao');
const moduloQuantidade = document.getElementById('modulo-quantidade');
const valorTotal = document.getElementById('valor-total');
const linkPDF = document.getElementById('link-pdf');

// Mapeamento de temas
function setTheme(themeName) {
    document.body.classList.toggle('economic-theme', themeName === 'economico');
    highPerformanceOption.classList.toggle('active', themeName === 'alta_performance');
    economicOption.classList.toggle('active', themeName === 'economico');
}

highPerformanceOption.addEventListener('click', () => setTheme('alta_performance'));
economicOption.addEventListener('click', () => setTheme('economico'));
setTheme('alta_performance'); // Define o tema inicial

/**
 * Consulta a proposta ativa de um cliente chamando o backend.
 * @param {string} projectId - O ID do projeto.
 * @returns {Promise<Object|null>} Um objeto com a proposta ou null em caso de falha.
 */
async function consultarProposta(projectId) {
    const backendUrl = `https://gdissolarproposta.vercel.app/api/proposta?projectId=${projectId}`;

    try {
        const res = await fetch(backendUrl);

        if (!res.ok) {
            let errorMessage = `Erro HTTP: ${res.status}`;
            try {
                const errorBody = await res.json();
                if (errorBody && errorBody.error) {
                    errorMessage = `Erro: ${errorBody.error}`;
                } else if (errorBody && errorBody.message) {
                    errorMessage = `Erro: ${errorBody.message}`;
                }
            } catch (e) {
                // Se não for um JSON válido, a mensagem genérica será mantida
            }
            throw new Error(errorMessage);
        }

        const dados = await res.json();
        return dados;
    } catch (err) {
        console.error("Erro ao consultar proposta:", err);
        throw err;
    }
}

/**
 * Renderiza os detalhes da proposta na página, preenchendo os campos específicos.
 * @param {Object} proposta - O objeto da proposta recebido do backend.
 */
function renderizarProposta(proposta) {
    // Limpa conteúdo anterior e mostra a seção de detalhes
    proposalDetailsSection.style.display = 'block';

    // Preenche os campos de informações gerais do cliente e da proposta
    // Acesso seguro a valores aninhados, já que o JSON não tem 'cliente' direto.
    // Assumindo que a API da SolarMarket fornece os dados do cliente em 'project' e que 'name' inclui o nome do cliente.
    // Se a cidade/UF não estiverem disponíveis, exibe um valor padrão.
    clienteNome.textContent = proposta.project?.name || 'Não disponível';
    clienteCidadeUf.textContent = 'Não disponível'; // Não há campo de cidade/UF no JSON de exemplo
    dataGeracao.textContent = proposta.generatedAt ? new Date(proposta.generatedAt).toLocaleString() : 'Não disponível';

    // Preenche os detalhes do inversor e do módulo fotovoltaico
    const inversor = proposta.pricingTable?.find(item => item.category === 'Inversor');
    const modulo = proposta.pricingTable?.find(item => item.category === 'Módulo');

    inversorDescricao.textContent = inversor?.item || 'Não disponível';
    inversorQuantidade.textContent = inversor?.qnt || '0';
    
    moduloDescricao.textContent = modulo?.item || 'Não disponível';
    moduloQuantidade.textContent = modulo?.qnt || '0';

    // Calcula e preenche o valor total da proposta
    const totalValue = proposta.pricingTable?.reduce((sum, item) => sum + item.totalCost, 0) || 0;
    valorTotal.textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;

    // Preenche o link para o PDF
    if (proposta.linkPdf) {
        linkPDF.href = proposta.linkPdf;
        linkPDF.style.display = 'inline-block';
    } else {
        linkPDF.style.display = 'none';
    }
}

// Lida com o envio do formulário
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const projectId = projectIdInput.value.trim();
    
    // Limpa a caixa de mensagens
    messageBox.style.display = 'none';
    messageBox.textContent = '';
    
    if (!projectId) {
        messageBox.textContent = 'Por favor, digite um ID de projeto.';
        messageBox.style.display = 'block';
        return;
    }

    // Simula um estado de carregamento
    searchForm.querySelector('button').textContent = 'Consultando...';
    searchForm.querySelector('button').disabled = true;

    try {
        const proposta = await consultarProposta(projectId);
        if (proposta) {
            renderizarProposta(proposta);
        } else {
            messageBox.textContent = 'Proposta não encontrada para o projeto especificado.';
            messageBox.style.display = 'block';
            proposalDetailsSection.style.display = 'none';
        }
    } catch (err) {
        messageBox.textContent = `Erro ao carregar proposta: ${err.message}`;
        messageBox.style.display = 'block';
        proposalDetailsSection.style.display = 'none';
    } finally {
        searchForm.querySelector('button').textContent = 'Consultar Proposta';
        searchForm.querySelector('button').disabled = false;
    }
});
