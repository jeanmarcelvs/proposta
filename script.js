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
    // Preenche os campos da proposta
    clienteNome.textContent = proposta.name || 'Nome do Cliente';
    clienteCidadeUf.textContent = `${proposta.project.city || ''}/${proposta.project.uf || ''}`;
    
    // Converte e formata os valores numéricos
    const valorTotal = proposta.pricingTable.find(item => item.category === 'total_valor')?.value || 0;
    const economia = proposta.pricingTable.find(item => item.category === 'economia_mensal')?.value || 0;
    const payback = proposta.payback_anos || 0;

    valorTotalAvista.textContent = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    economiaMensal.textContent = economia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    paybackTempo.textContent = `${payback} Meses`;

    // Dados de inversor e módulo
    const inversor = proposta.inversor || {};
    const modulo = proposta.modulo || {};

    inversorDescricao.textContent = inversor.descricao || 'N/A';
    inversorQuantidade.textContent = inversor.quantidade || 'N/A';
    moduloDescricao.textContent = modulo.descricao || 'N/A';
    moduloQuantidade.textContent = modulo.quantidade || 'N/A';
    
    // Atualiza a barra de navegação superior
    navBarAvistaPrice.textContent = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    navBarMinParcel.textContent = (proposta.valor_parcela || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' });

    // Link para o PDF
    linkPDFNav.href = proposta.linkPdf || '#';
    linkPDFNav.style.display = proposta.linkPdf ? 'inline-block' : 'none';

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
        if (proposta) {
            renderizarProposta(proposta);
        } else {
            messageBox.textContent = 'Proposta não encontrada para o projeto especificado.';
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
