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
        // A API retorna um objeto com a propriedade 'data' que contém a proposta.
        // Acessamos o valor dessa propriedade para usar no frontend.
        return data.data;
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
    // Acessa o nome do cliente a partir de proposta.project
    clienteNome.textContent = proposta.project?.name || 'N/A';
    
    // Acessa a cidade e UF do array 'variables'
    const cidadeItem = proposta.variables?.find(item => item.key === 'cidade');
    const estadoItem = proposta.variables?.find(item => item.key === 'estado');
    const cidade = cidadeItem ? cidadeItem.value : 'N/A';
    const estado = estadoItem ? estadoItem.value : 'N/A';
    clienteCidadeUf.textContent = `${cidade}/${estado}`;

    // Acessa a data de geração a partir de proposta.generatedAt
    if (proposta.generatedAt) {
        const data = new Date(proposta.generatedAt);
        dataGeracao.textContent = data.toLocaleDateString('pt-BR');
    } else {
        dataGeracao.textContent = 'N/A';
    }

    // Busca o inversor e o módulo no array pricingTable
    const inversorItem = proposta.pricingTable?.find(item => item.category === 'Inversor');
    const moduloItem = proposta.pricingTable?.find(item => item.category === 'Módulo');
    
    // Acessa os dados do inversor
    inversorDescricao.textContent = inversorItem?.item || 'N/A';
    inversorQuantidade.textContent = inversorItem?.qnt || 'N/A';

    // Acessa os dados do módulo
    moduloDescricao.textContent = moduloItem?.item || 'N/A';
    moduloQuantidade.textContent = moduloItem?.qnt || 'N/A';
    
    // Acessa o valor total e o formata
    const valorTotalItem = proposta.variables?.find(item => item.key === 'vc_total_bruto');
    const valorTotalValue = valorTotalItem ? parseFloat(valorTotalItem.value) : 0;
    valorTotal.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalValue);

    // Acessa o valor da economia mensal e o formata
    const economiaItem = proposta.variables?.find(item => item.key === 'vc_economia_total');
    const economiaValue = economiaItem ? parseFloat(economiaItem.value) : 0;
    economiaMensal.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(economiaValue);

    // Acessa o tempo de payback
    const paybackItem = proposta.variables?.find(item => item.key === 'payback_meses');
    const paybackValue = paybackItem ? parseFloat(paybackItem.value) : 0;
    paybackTempo.textContent = `${paybackValue} meses`;

    // Atualiza o link do PDF
    if (proposta.linkPdf) {
        linkPDF.href = proposta.linkPdf;
        linkPDF.style.display = 'inline-flex';
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
