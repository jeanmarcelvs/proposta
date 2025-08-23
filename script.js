// Seleciona os elementos do DOM
const searchForm = document.getElementById('search-form');
const proposalDetailsSection = document.getElementById('proposal-details');
const projectIdInput = document.getElementById('project-id');
const messageBox = document.getElementById('message-box');

// Seletores para os elementos da proposta
const clienteNome = document.getElementById('cliente-nome');
const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
const dataGeracao = document.getElementById('data-geracao');
const inversorDescricao = document.getElementById('inversor-descricao');
const inversorQuantidade = document.getElementById('inversor-quantidade');
const moduloDescricao = document.getElementById('modulo-descricao');
const moduloQuantidade = document.getElementById('modulo-quantidade');
const valorTotal = document.getElementById('valor-total');
const linkPDF = document.getElementById('link-pdf');

// Seletor para as opções de financiamento
const financingOptionsContainer = document.getElementById('financing-options');

// Seletores para os botões de tema
const highPerformanceOptionForm = document.getElementById('high-performance-option');
const economicOptionForm = document.getElementById('economic-option');

// Oculta a seção de detalhes da proposta por padrão ao carregar a página
proposalDetailsSection.style.display = 'none';

/**
 * Define o tema do site.
 * @param {string} themeName O nome do tema ('alta_performance' ou 'economico').
 */
function setTheme(themeName) {
    document.body.classList.toggle('economic-theme', themeName === 'economico');
    highPerformanceOptionForm.classList.toggle('active', themeName === 'alta_performance');
    economicOptionForm.classList.toggle('active', themeName === 'economico');
}

highPerformanceOptionForm.addEventListener('click', () => setTheme('alta_performance'));
economicOptionForm.addEventListener('click', () => setTheme('economico'));


/**
 * Consulta a proposta ativa do projeto chamando o backend.
 * @param {string} projectId - O ID do projeto.
 * @returns {Promise<Object|null>} Um objeto com a proposta ou null em caso de falha.
 */
async function consultarProposta(projectId) {
    // URL simulada do backend, substitua pela sua API
    const backendUrl = `https://gdissolarproposta.vercel.app/api/proposta?projectId=${projectId}`;
    try {
        const res = await fetch(backendUrl);
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(`Erro HTTP: ${res.status} - ${errorData.message || 'Erro desconhecido'}`);
        }
        const dados = await res.json();
        return dados;
    } catch (err) {
        console.error("Erro ao consultar proposta:", err);
        throw err;
    }
}

/**
 * Renderiza os dados da proposta na interface.
 * @param {Object} proposta - O objeto da proposta recebido do backend.
 */
function renderizarProposta(proposta) {
    if (!proposta || !proposta.pricingTable) {
        console.error('Dados da proposta ou pricingTable não encontrados.');
        return;
    }
    
    console.log('Dados da proposta recebidos:', proposta);

    // Limpa as opções de financiamento existentes
    financingOptionsContainer.innerHTML = '';

    // Encontra os objetos na pricingTable usando as chaves e categorias corretas
    const valorTotalObj = proposta.pricingTable.find(item => item.key === "vc_valor_total_sugerido");
    const paybackObj = proposta.pricingTable.find(item => item.key === "vc_payback_sugerido");
    const geracaoMensalObj = proposta.pricingTable.find(item => item.key === "vc_geracao_mensal_sugerido");
    const potenciaSistemaObj = proposta.pricingTable.find(item => item.key === "vc_potencia_sistema_sugerido");
    const inversorObj = proposta.pricingTable.find(item => item.category === "Inversor");
    const moduloObj = proposta.pricingTable.find(item => item.category === "Módulo");
    const clienteCidadeUfObj = proposta.pricingTable.find(item => item.key === "cidade"); // Adiciona este item se ele existir

    // Atualiza o HTML com os valores encontrados
    clienteNome.textContent = proposta.project?.name || 'Nome do Cliente';
    clienteCidadeUf.textContent = clienteCidadeUfObj?.formattedValue || 'Cidade/UF';
    
    // Converte a data de geração para o formato local
    if (proposta.generatedAt) {
      const data = new Date(proposta.generatedAt);
      dataGeracao.textContent = data.toLocaleDateString('pt-BR');
    }

    // Atualiza os cards de valor
    valorTotal.textContent = valorTotalObj?.formattedValue || 'N/A';
    paybackTempo.textContent = paybackObj?.formattedValue || 'N/A';
    geracaoMensal.textContent = `${geracaoMensalObj?.formattedValue || 'N/A'} kWh`;
    potenciaSistema.textContent = `${potenciaSistemaObj?.formattedValue || 'N/A'} kWp`;
    
    // Atualiza os detalhes do sistema
    inversorDescricao.textContent = inversorObj?.item || 'N/A';
    inversorQuantidade.textContent = inversorObj?.qnt || 'N/A';
    moduloDescricao.textContent = moduloObj?.item || 'N/A';
    moduloQuantidade.textContent = moduloObj?.qnt || 'N/A';

    // Renderiza as opções de financiamento
    renderFinancingOptions(proposta.pricingTable);

    // Link para o PDF
    linkPDF.href = proposta.linkPdf || '#';
    linkPDF.style.display = proposta.linkPdf ? 'inline-block' : 'none';

    // Mostra a seção de detalhes e esconde o formulário
    searchForm.style.display = 'none';
    proposalDetailsSection.style.display = 'block';
}

/**
 * Renderiza dinamicamente os cards de financiamento.
 * @param {Array<Object>} pricingTable - O array de itens da pricingTable.
 */
function renderFinancingOptions(pricingTable) {
  // Cria um mapa para agrupar valor e prazo pela numeração
  const financingMap = new Map();
  pricingTable.forEach(item => {
    // Adiciona uma verificação para garantir que 'item' e 'item.key' existam
    if (item && typeof item.key === 'string') {
        const match = item.key.match(/f_(valor|prazo)_(\d+)/);
        if (match) {
            const type = match[1];
            const index = match[2];
            if (!financingMap.has(index)) {
                financingMap.set(index, {});
            }
            financingMap.get(index)[type] = item.formattedValue;
        }
    }
  });

  // Cria os elementos HTML para cada opção de financiamento
  financingMap.forEach(option => {
    if (option.valor && option.prazo) {
      const card = document.createElement('div');
      card.className = 'financing-card';
      card.innerHTML = `
        <h4>${option.prazo} Meses</h4>
        <span class="value">${option.valor}</span>
      `;
      financingOptionsContainer.appendChild(card);
    }
  });
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
    const searchButton = searchForm.querySelector('button');
    searchButton.textContent = 'Consultando...';
    searchButton.disabled = true;

    try {
        const proposta = await consultarProposta(projectId);
        
        // Verifica se a estrutura de dados é a esperada
        if (!proposta || !proposta.pricingTable) {
            messageBox.textContent = 'Proposta não encontrada ou dados incompletos. Verifique o ID do projeto.';
            messageBox.style.display = 'block';
            proposalDetailsSection.style.display = 'none';
            searchForm.style.display = 'block';
            return;
        }

        renderizarProposta(proposta);
    } catch (err) {
        messageBox.textContent = `Erro ao carregar proposta: ${err.message}`;
        messageBox.style.display = 'block';
        proposalDetailsSection.style.display = 'none';
        searchForm.style.display = 'block';
    } finally {
        searchButton.textContent = 'Consultar Proposta';
        searchButton.disabled = false;
    }
});
