// Seleciona os elementos do DOM
const formContainer = document.getElementById('form-container');
const proposalContainer = document.getElementById('proposal-container');
const searchForm = document.getElementById('search-form');
const projectIdInput = document.getElementById('project-id');
const messageBox = document.getElementById('message-box');

// Seletores para os elementos da proposta
const navBar = document.querySelector('.nav-bar');
const navBarAvistaPrice = document.getElementById('nav-bar-avista-price');
const navBarMinParcel = document.getElementById('nav-bar-min-parcel');
const linkPDFNav = document.getElementById('link-pdf-nav');

// Seletores para os cards de valor
const valorTotalAvista = document.getElementById('valor-total-avista');
const paybackTempo = document.getElementById('payback-tempo');
const geracaoMensal = document.getElementById('geracao-mensal');
const potenciaSistema = document.getElementById('potencia-sistema');

// Seletores para os detalhes do sistema
const clienteNome = document.getElementById('cliente-nome');
const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
const moduloDescricao = document.getElementById('modulo-descricao');
const moduloQuantidade = document.getElementById('modulo-quantidade');
const inversorDescricao = document.getElementById('inversor-descricao');
const inversorQuantidade = document.getElementById('inversor-quantidade');

// Seletor para as opções de financiamento
const financingOptionsContainer = document.getElementById('financing-options');

// Seletores para os botões de tema (agora em duas telas)
const highPerformanceOptionForm = document.getElementById('high-performance-option-form');
const economicOptionForm = document.getElementById('economic-option-form');
const highPerformanceOptionNav = document.getElementById('high-performance-option-nav');
const economicOptionNav = document.getElementById('economic-option-nav');

/**
 * Define o tema do site.
 * @param {string} themeName O nome do tema ('alta_performance' ou 'economico').
 */
function setTheme(themeName) {
    document.body.classList.toggle('economic-theme', themeName === 'economico');
    highPerformanceOptionForm.classList.toggle('active', themeName === 'alta_performance');
    economicOptionForm.classList.toggle('active', themeName === 'economico');
    highPerformanceOptionNav.classList.toggle('active', themeName === 'alta_performance');
    economicOptionNav.classList.toggle('active', themeName === 'economico');
}

highPerformanceOptionForm.addEventListener('click', () => setTheme('alta_performance'));
economicOptionForm.addEventListener('click', () => setTheme('economico'));
highPerformanceOptionNav.addEventListener('click', () => setTheme('alta_performance'));
economicOptionNav.addEventListener('click', () => setTheme('economico'));


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
    const dados = proposta.data;
    if (!dados || !dados.pricingTable) {
        console.error('Dados da proposta ou pricingTable não encontrados.');
        return;
    }

    // Limpa as opções de financiamento existentes
    financingOptionsContainer.innerHTML = '';

    // Encontra os objetos na pricingTable usando as chaves e categorias corretas
    const valorTotalObj = dados.pricingTable.find(item => item.key === "preco");
    const paybackObj = dados.pricingTable.find(item => item.key === "payback");
    const geracaoMensalObj = dados.pricingTable.find(item => item.key === "geracao_mensal");
    const potenciaSistemaObj = dados.pricingTable.find(item => item.key === "potencia_sistema");
    const inversorObj = dados.pricingTable.find(item => item.category === "Inversor");
    const moduloObj = dados.pricingTable.find(item => item.category === "Módulo");
    
    // Atualiza o HTML com os valores encontrados
    valorTotalAvista.textContent = valorTotalObj?.formattedValue || 'N/A';
    paybackTempo.textContent = paybackObj?.formattedValue || 'N/A';
    geracaoMensal.textContent = `${geracaoMensalObj?.formattedValue || 'N/A'} kWh`;
    potenciaSistema.textContent = `${potenciaSistemaObj?.formattedValue || 'N/A'} kWp`;
    
    inversorDescricao.textContent = inversorObj?.item || 'N/A';
    inversorQuantidade.textContent = inversorObj?.qnt || 'N/A';
    moduloDescricao.textContent = moduloObj?.item || 'N/A';
    moduloQuantidade.textContent = moduloObj?.qnt || 'N/A';

    // Renderiza as opções de financiamento
    renderFinancingOptions(dados.pricingTable);
    
    // Encontra o valor da primeira parcela para a barra de navegação
    const primeiraParcelaObj = dados.pricingTable.find(item => item.key === 'f_valor_1');
    
    // Atualiza a barra de navegação superior
    navBarAvistaPrice.textContent = valorTotalObj?.formattedValue || 'N/A';
    navBarMinParcel.textContent = primeiraParcelaObj?.formattedValue || 'N/A';

    // Link para o PDF
    const linkPDF = document.getElementById('link-pdf');
    linkPDFNav.href = dados.linkPdf || '#';
    linkPDF.href = dados.linkPdf || '#';
    linkPDFNav.style.display = dados.linkPdf ? 'inline-block' : 'none';
    linkPDF.style.display = dados.linkPdf ? 'inline-block' : 'none';

    // Mostra a seção de detalhes e esconde o formulário
    formContainer.style.display = 'none';
    proposalContainer.style.display = 'block';
}

/**
 * Renderiza dinamicamente os cards de financiamento.
 * @param {Array<Object>} pricingTable - O array de itens da pricingTable.
 */
function renderFinancingOptions(pricingTable) {
  // Cria um mapa para agrupar valor e prazo pela numeração
  const financingMap = new Map();
  pricingTable.forEach(item => {
    const match = item.key.match(/f_(valor|prazo)_(\d+)/);
    if (match) {
      const type = match[1];
      const index = match[2];
      if (!financingMap.has(index)) {
        financingMap.set(index, {});
      }
      financingMap.get(index)[type] = item.formattedValue;
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
        // Adicionando um console.log para inspecionar os dados recebidos
        console.log('Dados recebidos do backend:', proposta);
        
        // Verifica se a estrutura de dados é a esperada
        if (!proposta) {
            messageBox.textContent = 'Proposta não encontrada. Verifique o ID do projeto.';
            messageBox.style.display = 'block';
            proposalContainer.style.display = 'none';
            return;
        }

        if (!proposta.data) {
            messageBox.textContent = 'A estrutura da resposta da API está incompleta. O objeto "data" está faltando.';
            messageBox.style.display = 'block';
            proposalContainer.style.display = 'none';
            return;
        }

        if (!proposta.data.pricingTable) {
            messageBox.textContent = 'A resposta da API está incompleta. O "pricingTable" está faltando.';
            messageBox.style.display = 'block';
            proposalContainer.style.display = 'none';
            return;
        }

        renderizarProposta(proposta);
    } catch (err) {
        messageBox.textContent = `Erro ao carregar proposta: ${err.message}`;
        messageBox.style.display = 'block';
        proposalContainer.style.display = 'none';
    } finally {
        searchButton.textContent = 'Consultar Proposta';
        searchButton.disabled = false;
    }
});

// Listener de scroll para a barra de navegação
window.addEventListener('scroll', () => {
  const proposalHeader = document.querySelector('.proposal-header');
  if (proposalHeader) {
    const scrollPosition = window.scrollY;
    const headerBottom = proposalHeader.offsetTop + proposalHeader.offsetHeight;

    if (scrollPosition > headerBottom) {
      navBar.classList.add('visible', 'show-prices');
    } else {
      navBar.classList.remove('visible', 'show-prices');
    }
  }
});
