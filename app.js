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
}

// Renderiza a parcela equilibrada
function renderizarParcelaEquilibrada(parcela) {
    parcelaEquilibradaContainer.innerHTML = '';
}

// Função para buscar um valor no array 'variables' da API
function findVariable(proposta, key) {
    const variable = proposta.variables.find(v => v.key === key);
    return variable ? variable.value : 'N/A';
}

// Função para buscar um item no array 'pricingTable' da API
function findItem(proposta, category) {
    const item = proposta.pricingTable.find(i => i.category === category);
    return item ? item.item : 'N/A';
}

// Função para calcular a proposta econômica com base na proposta original
function calcularPropostaEconomica(proposta) {
    const propostaEconomica = JSON.parse(JSON.stringify(proposta));
    
    const DESCONTO_ECONOMICA = 0.85;

    propostaEconomica.pricingTable = propostaEconomica.pricingTable.map(item => ({
        ...item,
        totalCost: item.totalCost * DESCONTO_ECONOMICA,
        unitCost: item.unitCost * DESCONTO_ECONOMICA
    }));

    const totalValueVar = propostaEconomica.variables.find(v => v.key === 'f_valor_1');
    if (totalValueVar) {
        totalValueVar.value = totalValueVar.value * DESCONTO_ECONOMICA;
    }
    
    const paybackVar = propostaEconomica.variables.find(v => v.key === 'payback');
    if (paybackVar) {
        paybackVar.value = paybackVar.value * 1.2;
    }
    
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

// Função de renderização principal
function renderizarProposta(dados) {
    clienteNome.textContent = dados.project?.name || 'N/A';
    
    const cidade = findVariable(dados, 'cidade');
    const uf = findVariable(dados, 'estado');
    clienteCidadeUf.textContent = `${cidade} - ${uf}`;
    
    dataGeracao.textContent = formatarData(dados.generatedAt);
    
    inversorDescricao.textContent = findItem(dados, 'Inversor');
    moduloDescricao.textContent = findItem(dados, 'Módulo');
    
    potenciaSistema.textContent = findVariable(dados, 'potencia_sistema');
    geracaoMensal.textContent = findVariable(dados, 'geracao_mensal');
    tarifaDistribuidora.textContent = findVariable(dados, 'tarifa_distribuidora');
    tipoInstalacao.textContent = findVariable(dados, 'topologia');
    
    valorTotal.textContent = formatarMoeda(findVariable(dados, 'f_valor_1'));
    payback.textContent = `${formatarNumero(findVariable(dados, 'payback'))} anos`;
    contaEnergiaEstimada.textContent = formatarMoeda(findVariable(dados, 'estimativa_conta_luz_antes'));

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
        const respostaDaApi = await consultarProposta(projectId);
        
        // CORREÇÃO: Acessa o primeiro item do array 'data', como você explicou.
        const proposta = respostaDaApi?.data[0];

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
        console.error("Erro na busca da proposta:", err);
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