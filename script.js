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
const economiaMensal = document.getElementById('economia-mensal');
const paybackTempo = document.getElementById('payback-tempo');

// Seletores para os detalhes do sistema
const clienteNome = document.getElementById('cliente-nome');
const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
const moduloDescricao = document.getElementById('modulo-descricao');
const moduloQuantidade = document.getElementById('modulo-quantidade');
const inversorDescricao = document.getElementById('inversor-descricao');
const inversorQuantidade = document.getElementById('inversor-quantidade');

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

    // Preenche os campos da proposta
    clienteNome.textContent = dados.name || 'Nome do Cliente';
    clienteCidadeUf.textContent = `${dados.project?.city || ''}/${dados.project?.uf || ''}`;
    
    // CORREÇÃO: Encontra o objeto de Preço Total usando a KEY
    const valorTotalObj = dados.pricingTable.find(item => item.key === "preco");
    const valorTotalFormatado = valorTotalObj ? valorTotalObj.formattedValue : 'N/A';

    // Busca o valor do payback nos project_variables
    const paybackObj = dados.project_variables?.find(v => v.key === 'vc_payback_anos');
    const payback = paybackObj ? paybackObj.formattedValue : 'N/A';
    
    // Busca o valor da parcela nos project_variables
    const valorParcelaObj = dados.project_variables?.find(v => v.key === 'vc_valor_parcela');
    const valorParcela = valorParcelaObj ? valorParcela.formattedValue : 'N/A';

    valorTotalAvista.textContent = valorTotalFormatado;
    // A economia mensal não está no JSON fornecido, definindo como 0
    economiaMensal.textContent = (0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    paybackTempo.textContent = `${payback} Meses`;

    // Acessa as propriedades corretas do inversor e módulo no pricingTable, usando a CATEGORY
    const inversor = dados.pricingTable.find(item => item.category === 'Inversor');
    const modulo = dados.pricingTable.find(item => item.category === 'Módulo');

    inversorDescricao.textContent = inversor?.item || 'N/A';
    inversorQuantidade.textContent = inversor?.qnt || 'N/A';
    moduloDescricao.textContent = modulo?.item || 'N/A';
    moduloQuantidade.textContent = modulo?.qnt || 'N/A';
    
    // Atualiza a barra de navegação superior
    navBarAvistaPrice.textContent = valorTotalFormatado;
    navBarMinParcel.textContent = valorParcela;

    // Link para o PDF
    linkPDFNav.href = dados.linkPdf || '#';
    linkPDFNav.style.display = dados.linkPdf ? 'inline-block' : 'none';

    // Mostra a seção de detalhes e esconde o formulário
    formContainer.style.display = 'none';
    proposalContainer.style.display = 'block';
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
        if (proposta && proposta.data && proposta.data.pricingTable) {
            renderizarProposta(proposta);
        } else {
            messageBox.textContent = 'Proposta não encontrada ou dados incompletos para o projeto especificado.';
            messageBox.style.display = 'block';
            proposalContainer.style.display = 'none';
        }
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
  const proposalHeader = document.getElementById('proposal-header');
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
