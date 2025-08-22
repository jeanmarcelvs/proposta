// Seleciona os elementos do DOM
const searchForm = document.getElementById('search-form');
const projectIdInput = document.getElementById('project-id');
const messageBox = document.getElementById('message-box');
const formSection = document.getElementById('form-section');
const proposalSection = document.getElementById('proposal-section');
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
const economiaMensal = document.getElementById('economia-mensal');
const paybackTempo = document.getElementById('payback-tempo');

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
            } catch (jsonError) {
                // A resposta não era JSON, usa a mensagem padrão
            }
            throw new Error(errorMessage);
        }

        const data = await res.json();
        return data;
    } catch (err) {
        console.error('Erro ao consultar a API do backend:', err);
        return null;
    }
}

/**
 * Renderiza os dados da proposta na interface.
 * @param {Object} proposta - O objeto da proposta.
 */
function renderizarProposta(proposta) {
    // Campos do cliente
    clienteNome.textContent = proposta.cliente?.nome || 'N/A';
    clienteCidadeUf.textContent = `${proposta.cliente?.cidade || ''}/${proposta.cliente?.uf || ''}`;

    // Campo de data de geração
    if (proposta.geracaoInfo?.dataGeracao) {
        const data = new Date(proposta.geracaoInfo.dataGeracao);
        dataGeracao.textContent = data.toLocaleDateString('pt-BR');
    } else {
        dataGeracao.textContent = 'N/A';
    }

    // Campos do inversor
    inversorDescricao.textContent = proposta.inversor?.descricao || 'N/A';
    inversorQuantidade.textContent = proposta.inversor?.quantidade || 'N/A';

    // Campos do módulo
    moduloDescricao.textContent = proposta.modulo?.descricao || 'N/A';
    moduloQuantidade.textContent = proposta.modulo?.quantidade || 'N/A';
    
    // Calcula a economia mensal e o payback
    const valorProjeto = proposta.payback?.valorProjeto || 0;
    const economia = proposta.payback?.economia || 0;
    const payback = proposta.payback?.payback || 0;

    valorTotal.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorProjeto);
    economiaMensal.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(economia);
    paybackTempo.textContent = `${payback} meses`;

    // Atualiza o link do PDF
    if (proposta.linkPdf) {
        linkPDF.href = proposta.linkPdf;
        linkPDF.style.display = 'inline-flex'; // Use inline-flex para exibir
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
    const originalButtonText = searchForm.querySelector('button').textContent;
    searchForm.querySelector('button').textContent = 'Consultando...';
    searchForm.querySelector('button').disabled = true;

    try {
        const proposta = await consultarProposta(projectId);
        if (proposta) {
            renderizarProposta(proposta);
            // Transiciona da seção do formulário para a seção da proposta
            formSection.style.display = 'none';
            proposalSection.style.display = 'flex';
        } else {
            messageBox.textContent = 'Proposta não encontrada para o projeto especificado.';
            messageBox.style.display = 'block';
            proposalSection.style.display = 'none';
            formSection.style.display = 'flex'; // Garante que a seção do formulário esteja visível em caso de erro
        }
    } catch (err) {
        messageBox.textContent = `Erro ao carregar proposta: ${err.message}`;
        messageBox.style.display = 'block';
        proposalSection.style.display = 'none';
        formSection.style.display = 'flex'; // Garante que a seção do formulário esteja visível em caso de erro
    } finally {
        searchForm.querySelector('button').textContent = originalButtonText;
        searchForm.querySelector('button').disabled = false;
    }
});

// Adiciona um ouvinte para o evento de redimensionamento da janela
window.addEventListener('resize', () => {
  // Se a largura da janela for menor que 768px e a seção de proposta estiver visível,
  // ajusta o layout se necessário (neste caso, o CSS lida com a maior parte)
});

// Exibe a seção de formulário por padrão
document.addEventListener('DOMContentLoaded', () => {
    formSection.style.display = 'flex';
    proposalSection.style.display = 'none';
});
