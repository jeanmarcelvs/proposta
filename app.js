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

// AQUI ESTÁ A ÚLTIMA CORREÇÃO:
const geracaoMensal = document.getElementById('geracao-mensal');
// A linha acima estava com um erro de sintaxe.

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

let propostaOriginal; // Armazena a proposta original da API
let propostaEconomica; // Armazena a proposta econômica calculada

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
    errorPopup.style.display = 'flex';
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
    // A sua API não retorna opções de financiamento, esta parte permanece como placeholder
}

// Renderiza a parcela equilibrada
function renderizarParcelaEquilibrada(parcela) {
    // A sua API não retorna a parcela equilibrada, esta parte permanece como placeholder
    parcelaEquilibradaContainer.innerHTML = '';
}

// Função para calcular a proposta econômica com base na proposta original
function calcularPropostaEconomica(proposta) {
    const propostaEconomica = JSON.parse(JSON.stringify(proposta)); 
    
    const DESCONTO_ECONOMICA = 0.85;

    propostaEconomica.pricingTable = proposta.pricingTable.map(item => ({
        ...item,
        totalCost: item.totalCost * DESCONTO_ECONOMICA,
        unitCost: item.unitCost * DESCONTO_ECONOMICA
    }));

    propostaEconomica.financial.totalValue = proposta.financial.totalValue ? proposta.financial.totalValue * DESCONTO_ECONOMICA : 'N/A';
    propostaEconomica.financial.payback = proposta.financial.payback ? proposta.financial.payback * 1.2 : 'N/A';
    
    const inversor = propostaEconomica.pricingTable.find(item => item.category === 'Inversor');
    if (inversor) {
        inversor.item = "Inversor Econômico ABC";
    }
    const modulo = propostaEconomica.pricingTable.find(item => item.category === 'Módulo');
    if (modulo) {
        modulo.item = "Módulo Padrão Custo-Benefício";
    }

    return propostaEconomica;
}

// Função para alternar entre as propostas e os temas
function toggleProposalView(proposta, tema) {
    proposalDetailsSection.style.display = 'block';
    renderizarProposta(proposta);
    document.body.className = `${tema}-theme`;

    if (tema === 'alta-performance') {
        btnAltaPerformance.classList.add('active');
        btnEconomica.classList.remove('active');
    } else if (tema === 'economic') {
        btnEconomica.classList.add('active');
        btnAltaPerformance.classList.remove('active');
    }
}

// Função de renderização principal
function renderizarProposta(dados) {
    clienteNome.textContent = dados.project?.name || 'N/A';
    clienteCidadeUf.textContent = `${dados.project?.city || 'N/A'} - ${dados.project?.uf || 'N/A'}`;
    dataGeracao.textContent = formatarData(dados.generatedAt);
    
    const inversorItem = dados.pricingTable?.find(item => item.category === 'Inversor');
    const moduloItem = dados.pricingTable?.find(item => item.category === 'Módulo');
    
    inversorDescricao.textContent = inversorItem?.item || 'N/A';
    moduloDescricao.textContent = moduloItem?.item || 'N/A';
    
    potenciaSistema.textContent = dados.system?.power || 'N/A';
    geracaoMensal.textContent = dados.system?.generation || 'N/A';
    tarifaDistribuidora.textContent = dados.financial?.distributorTariff || 'N/A';
    tipoInstalacao.textContent = dados.installationType || 'N/A';
    valorTotal.textContent = formatarMoeda(dados.financial?.totalValue);
    payback.textContent = `${formatarNumero(dados.financial?.payback)} anos`;
    contaEnergiaEstimada.textContent = formatarMoeda(dados.financial?.estimatedEnergyBill);

    linkPDF.href = dados.linkPdf;

    renderizarOpcoesFinanciamento(dados.financingOptions);
    renderizarParcelaEquilibrada(dados.balancedInstallment);
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

        propostaOriginal = proposta;
        propostaEconomica = calcularPropostaEconomica(proposta);
        
        ocultarTodasAsTelas();
        proposalHeader.style.display = 'flex';
        toggleProposalView(propostaOriginal, 'alta-performance');
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

// Eventos para os botões de opção de proposta
btnAltaPerformance.addEventListener('click', () => {
    if (propostaOriginal) {
        toggleProposalView(propostaOriginal, 'alta-performance');
    }
});

btnEconomica.addEventListener('click', () => {
    if (propostaEconomica) {
        toggleProposalView(propostaEconomica, 'economic');
    }
});

// Ações iniciais ao carregar a página
ocultarTodasAsTelas();
searchForm.style.display = 'flex';