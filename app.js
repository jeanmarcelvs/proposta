import { consultarProposta } from "./api.js";

// Seletores dos elementos do DOM
const searchForm = document.getElementById('search-form');
const proposalDetailsSection = document.getElementById('proposal-details');
const expiredProposalSection = document.getElementById('expired-proposal-section');
const projectIdInput = document.getElementById('project-id');
const searchButton = document.getElementById('search-button');
const proposalHeader = document.getElementById('proposal-header');

// Seletores do NOVO POPUP
const errorPopup = document.getElementById('error-popup');
const popupMessage = document.getElementById('popup-message');
const popupCloseBtn = document.getElementById('popup-close-btn');

// Seletores para os elementos da proposta
const clienteNome = document.getElementById('cliente-nome');
const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
const dataGeracao = document.getElementById('data-geracao');
const inversorDescricao = document.getElementById('inversor-descricao');
const moduloDescricao = document.getElementById('modulo-descricao');
const potenciaSistema = document.getElementById('potencia-sistema');
const geracaoMensal = document.getElementById('geracao-mensal');
const tarifaDistribuidora = document.getElementById('tarifa-distribuidora');
const tipoInstalacao = document.getElementById('tipo-instalacao');
const valorTotal = document.getElementById('valor-total');
const payback = document.getElementById('payback');
const contaEnergiaEstimada = document.getElementById('conta-energia-estimada');
const linkPDF = document.getElementById('link-pdf');
const financingOptionsContainer = document.getElementById('financing-options');
const parcelaEquilibradaContainer = document.getElementById('parcela-equilibrada');

const btnAltaPerformance = document.getElementById('btn-alta-performance');
const btnEconomica = document.getElementById('btn-economica');

let propostaAtual;
let propostaAtualTipo = 'altaPerformance';

// Oculta todas as telas, exceto a de busca
function ocultarTodasAsTelas() {
    searchForm.style.display = 'none';
    proposalDetailsSection.style.display = 'none';
    expiredProposalSection.style.display = 'none';
    proposalHeader.style.display = 'none';
}

// Reseta o estado do botão
function resetarBotao() {
    searchButton.textContent = 'Visualizar Proposta';
    searchButton.disabled = false;
}

// Exibe o popup de erro com a mensagem fornecida
function exibirMensagemDeErro(mensagem) {
    popupMessage.textContent = mensagem;
    errorPopup.style.display = 'flex'; // Torna o popup visível
}

// Funções de formatação
function formatarMoeda(valor) {
    const num = parseFloat(valor);
    if (isNaN(num)) return 'N/A';
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarNumero(valor) {
    const num = parseFloat(valor);
    if (isNaN(num)) return 'N/A';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(dataISO) {
    if (!dataISO) return 'N/A';
    const data = new Date(dataISO);
    return `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Renderiza as opções de financiamento
function renderizarOpcoesFinanciamento(opcoes) {
    financingOptionsContainer.innerHTML = '';
    // Como a sua API não retorna opções de financiamento, esta parte permanece como placeholder
}

// Renderiza a parcela equilibrada
function renderizarParcelaEquilibrada(parcela) {
    // Como a sua API não retorna a parcela equilibrada, esta parte permanece como placeholder
    parcelaEquilibradaContainer.innerHTML = '';
}

// Exibe os detalhes da proposta
function exibirDetalhesProposta(proposta) {
    propostaAtual = proposta;
    ocultarTodasAsTelas();
    proposalHeader.style.display = 'flex';
    proposalDetailsSection.style.display = 'block';

    // AQUI ESTÁ A CORREÇÃO: Usamos a estrutura do JSON que você me forneceu.
    // Mapeamos os dados para os elementos da página de forma segura.
    clienteNome.textContent = proposta.project?.name || 'N/A';
    clienteCidadeUf.textContent = `${proposta.project?.city || 'N/A'} - ${proposta.project?.uf || 'N/A'}`;
    dataGeracao.textContent = formatarData(proposta.generatedAt);
    
    // As informações de inversor e módulo são extraídas do array `pricingTable`.
    const inversorItem = proposta.pricingTable?.find(item => item.category === 'Inversor');
    const moduloItem = proposta.pricingTable?.find(item => item.category === 'Módulo');
    
    inversorDescricao.textContent = inversorItem?.item || 'N/A';
    moduloDescricao.textContent = moduloItem?.item || 'N/A';

    // ATENÇÃO: Os campos abaixo não existem no JSON que você me forneceu.
    // Eles permanecerão com 'N/A' até que você os adicione no retorno da sua API.
    potenciaSistema.textContent = 'N/A';
    geracaoMensal.textContent = 'N/A';
    tarifaDistribuidora.textContent = 'N/A';
    tipoInstalacao.textContent = 'N/A';
    valorTotal.textContent = 'N/A';
    payback.textContent = 'N/A';
    contaEnergiaEstimada.textContent = 'N/A';
    
    // O link do PDF é pego diretamente do JSON
    linkPDF.href = proposta.linkPdf;

    // As funções de renderização de financiamento são chamadas, mas estarão vazias.
    renderizarOpcoesFinanciamento(proposta.financingOptions);
    renderizarParcelaEquilibrada(proposta.balancedInstallment);
}

// Lógica de manipulação de eventos do botão
searchButton.addEventListener('click', async () => {
    const projectId = projectIdInput.value.trim();
    
    if (!/^\d{4}$/.test(projectId)) {
        exibirMensagemDeErro('Por favor, digite um ID de projeto válido de 4 dígitos numéricos.');
        return;
    }

    searchButton.textContent = 'Consultando...';
    searchButton.disabled = true;

    try {
        const proposta = await consultarProposta(projectId);
        
        // A lógica de verificação foi simplificada para a nova estrutura.
        if (!proposta || !proposta.id) {
            exibirMensagemDeErro('Proposta não encontrada. Verifique o ID do projeto e tente novamente.');
            resetarBotao();
            return;
        }

        const expirationDate = new Date(proposta.expirationDate);
        if (expirationDate < new Date()) {
            ocultarTodasAsTelas();
            expiredProposalSection.style.display = 'flex';
            resetarBotao();
            return;
        }

        propostaAtualTipo = 'altaPerformance';
        exibirDetalhesProposta(proposta);
        resetarBotao();

    } catch (err) {
        exibirMensagemDeErro('Ocorreu um erro de comunicação. Por favor, tente novamente mais tarde ou entre em contato conosco.');
        resetarBotao();
    }
});

// Evento para fechar o popup de erro
popupCloseBtn.addEventListener('click', () => {
    errorPopup.style.display = 'none';
});

btnAltaPerformance.addEventListener('click', () => {
    // ATENÇÃO: Esta parte do código assume que a API pode ter uma 'proposta econômica'
    // que não está presente no JSON fornecido.
    if (propostaAtual) {
        exibirDetalhesProposta(propostaAtual);
        btnAltaPerformance.classList.add('active');
        btnEconomica.classList.remove('active');
    }
});

btnEconomica.addEventListener('click', () => {
    // ATENÇÃO: Esta parte do código ainda precisa ser ajustada quando você tiver o JSON da proposta econômica.
    // Atualmente, ela não tem dados para exibir.
    exibirMensagemDeErro("Não há uma proposta econômica disponível para este projeto.");
    btnEconomica.classList.add('active');
    btnAltaPerformance.classList.remove('active');
});

// Ações iniciais ao carregar a página
ocultarTodasAsTelas();
searchForm.style.display = 'flex';