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

// NOVO: Exibe o popup de erro com a mensagem fornecida
function exibirMensagemDeErro(mensagem) {
    popupMessage.textContent = mensagem;
    errorPopup.style.display = 'flex'; // Torna o popup visível
}

// Funções de formatação
function formatarMoeda(valor) {
    return `R$ ${parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarNumero(valor) {
    return parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(dataISO) {
    if (!dataISO) return 'N/A';
    const data = new Date(dataISO);
    return `${data.toLocaleDateString('pt-BR')} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Renderiza as opções de financiamento
function renderizarOpcoesFinanciamento(opcoes) {
    financingOptionsContainer.innerHTML = '';
    opcoes.forEach(opcao => {
        const div = document.createElement('div');
        div.className = 'financing-option';
        if (opcao.recommended) {
            div.classList.add('recommended');
        }
        div.innerHTML = `
            <h3>${opcao.label}</h3>
            <p>${formatarMoeda(opcao.value)}</p>
            <p style="font-size: 0.8rem; color: #999;">${opcao.description}</p>
        `;
        financingOptionsContainer.appendChild(div);
    });
}

// Renderiza a parcela equilibrada
function renderizarParcelaEquilibrada(parcela) {
    if (parcela) {
        parcelaEquilibradaContainer.innerHTML = `
            <div class="financing-option recommended" style="margin-top: 2rem;">
                <h3>Sua Parcela Equilibrada</h3>
                <p>${formatarMoeda(parcela.value)}</p>
                <p class="balanced-text">${parcela.description}</p>
            </div>
        `;
    } else {
        parcelaEquilibradaContainer.innerHTML = '';
    }
}

// Exibe os detalhes da proposta
function exibirDetalhesProposta(proposta) {
    propostaAtual = proposta;
    ocultarTodasAsTelas();
    proposalHeader.style.display = 'flex';
    proposalDetailsSection.style.display = 'block';

    const dados = proposta.propostaPrincipal;

    // Preenche as informações da proposta
    clienteNome.textContent = dados.cliente.nome;
    clienteCidadeUf.textContent = `${dados.cliente.cidade} - ${dados.cliente.uf}`;
    dataGeracao.textContent = formatarData(dados.geradaEm);
    inversorDescricao.textContent = dados.inversor.descricao;
    moduloDescricao.textContent = dados.modulo.descricao;
    potenciaSistema.textContent = `${formatarNumero(dados.potenciaSistema)} kWp`;
    geracaoMensal.textContent = `${formatarNumero(dados.geracaoEstimada)} kWh/mês`;
    tarifaDistribuidora.textContent = formatarMoeda(dados.tarifaDistribuidora);
    tipoInstalacao.textContent = dados.tipoInstalacao;
    valorTotal.textContent = formatarMoeda(dados.valorTotal);
    payback.textContent = `${formatarNumero(dados.payback)} anos`;
    contaEnergiaEstimada.textContent = formatarMoeda(dados.contaEnergiaEstimada);
    linkPDF.href = dados.linkPdf;

    // Renderiza as opções de financiamento
    renderizarOpcoesFinanciamento(dados.opcoesFinanciamento);
    renderizarParcelaEquilibrada(dados.parcelaEquilibrada);
}

// Lógica de manipulação de eventos do botão (agora por clique)
searchButton.addEventListener('click', async () => {
    const projectId = projectIdInput.value.trim();
    
    // Validação do ID do projeto
    if (!/^\d{4}$/.test(projectId)) {
        exibirMensagemDeErro('Por favor, digite um ID de projeto válido de 4 dígitos numéricos.');
        return;
    }

    searchButton.textContent = 'Consultando...';
    searchButton.disabled = true;

    try {
        const proposta = await consultarProposta(projectId);
        
        if (!proposta || !proposta.propostaPrincipal) {
            exibirMensagemDeErro('Proposta não encontrada. Verifique o ID do projeto e tente novamente.');
            resetarBotao();
            return;
        }

        // Verifica a validade da proposta
        const expirationDate = new Date(proposta.propostaPrincipal.expirationDate);
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
    if (propostaAtual && propostaAtual.propostaPrincipal) {
        propostaAtualTipo = 'altaPerformance';
        exibirDetalhesProposta(propostaAtual);
        btnAltaPerformance.classList.add('active');
        btnEconomica.classList.remove('active');
    }
});

btnEconomica.addEventListener('click', () => {
    if (propostaAtual && propostaAtual.propostaEconomica) {
        propostaAtualTipo = 'economica';
        const propostaEconomica = {
            propostaPrincipal: propostaAtual.propostaEconomica,
            propostaEconomica: propostaAtual.propostaEconomica
        };
        exibirDetalhesProposta(propostaEconomica);
        btnEconomica.classList.add('active');
        btnAltaPerformance.classList.remove('active');
    }
});

// Ações iniciais ao carregar a página
ocultarTodasAsTelas();
searchForm.style.display = 'flex';