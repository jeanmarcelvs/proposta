import { consultarProposta } from "./api.js";

// Seletores dos elementos do DOM
const searchForm = document.getElementById('search-form');
const proposalDetailsSection = document.getElementById('proposal-details');
const expiredProposalSection = document.getElementById('expired-proposal-section');
const projectIdInput = document.getElementById('project-id');
const searchButton = document.getElementById('search-button');
const proposalHeader = document.getElementById('proposal-header');

// Popup de erro
const errorPopup = document.getElementById('error-popup');
const popupMessage = document.getElementById('popup-message');
const popupCloseBtn = document.getElementById('popup-close-btn');

// Campos da proposta
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

// Botões de escolha de proposta
const btnAltaPerformance = document.getElementById('btn-alta-performance');
const btnEconomica = document.getElementById('btn-economica');

let propostaOriginal;
let propostaEconomica;

// ---- Efeitos e Animações ----
function setupScrollAnimations() {
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    animatedElements.forEach(el => observer.observe(el));
}

// ---- Utilidades ----
function ocultarTodasAsTelas() {
    searchForm.style.display = 'none';
    proposalDetailsSection.style.display = 'none';
    expiredProposalSection.style.display = 'none';
    proposalHeader.style.display = 'none';
}

function resetarBotao() {
    searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
    searchButton.disabled = false;
}

function exibirMensagemDeErro(mensagem) {
    popupMessage.textContent = mensagem;
    errorPopup.style.display = 'flex';
}

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

// ---- Acesso ao JSON ----
function findVariable(proposta, key, usarFormatado = false) {
    const variable = proposta.variables?.find(v => v.key === key);
    if (!variable) return 'N/A';
    return usarFormatado && variable.formattedValue ? variable.formattedValue : variable.value;
}

function findItem(proposta, category) {
    const item = proposta.pricingTable?.find(i => i.category === category);
    return item ? item.item : 'N/A';
}

// ---- Renderização ----
function renderizarOpcoesFinanciamento(dados) {
    financingOptionsContainer.innerHTML = '';
    const todasVariaveis = dados.variables;
    const todasAsParcelas = todasVariaveis.filter(v => v.key.startsWith('f_parcela'));

    const opcoesFinanciamento = todasAsParcelas.map(parcelaVar => {
        const prazoKey = parcelaVar.key.replace('parcela', 'prazo');
        const prazoVar = todasVariaveis.find(v => v.key === prazoKey);
        if (prazoVar && prazoVar.value && parcelaVar.value) {
            return {
                prazo: parseInt(prazoVar.value, 10),
                valorParcela: parseFloat(parcelaVar.value)
            };
        }
        return null;
    }).filter(opt => opt !== null && !isNaN(opt.prazo) && !isNaN(opt.valorParcela));

    if (opcoesFinanciamento.length === 0) {
        financingOptionsContainer.innerHTML = "<p>Nenhuma opção de financiamento disponível.</p>";
        return;
    }

    opcoesFinanciamento.sort((a, b) => a.prazo - b.prazo);

    opcoesFinanciamento.forEach(opcao => {
        const div = document.createElement('div');
        div.className = 'financing-option';
        div.innerHTML = `<strong>${opcao.prazo}x</strong> de ${formatarMoeda(opcao.valorParcela)}`;
        financingOptionsContainer.appendChild(div);
    });
}

function renderizarParcelaEquilibrada(parcela) {
    parcelaEquilibradaContainer.innerHTML = '';
    if (!parcela) return;
    parcelaEquilibradaContainer.innerHTML = `<p class="info-card__subtext"><strong>Parcela Equilibrada:</strong> ${formatarMoeda(parcela.value)} em ${parcela.installments}x</p>`;
}

function renderizarProposta(dados) {
    clienteNome.textContent = findVariable(dados, 'cliente_nome', true) || 'Cliente GDIS';
    const cidade = findVariable(dados, 'cidade');
    const uf = findVariable(dados, 'estado');
    clienteCidadeUf.textContent = (cidade && uf && cidade !== 'N/A' && uf !== 'N/A') ? `${cidade} - ${uf}` : 'Localidade não informada';
    dataGeracao.textContent = findVariable(dados, 'data_geracao', true);
    inversorDescricao.textContent = findItem(dados, 'Inversor');
    moduloDescricao.textContent = findItem(dados, 'Módulo');
    const geracaoMensalValor = parseFloat(findVariable(dados, 'geracao_mensal')) || 0;
    const tarifaValor = parseFloat(findVariable(dados, 'tarifa_distribuidora')) || 0;
    potenciaSistema.textContent = `${findVariable(dados, 'potencia_sistema', true)} kWp`;
    geracaoMensal.textContent = `${findVariable(dados, 'geracao_mensal', true)} kWh`;
    tarifaDistribuidora.textContent = formatarMoeda(tarifaValor);
    tipoInstalacao.textContent = findVariable(dados, 'vc_tipo_de_estrutura', true);
    valorTotal.textContent = formatarMoeda(findVariable(dados, 'preco'));
    payback.textContent = findVariable(dados, 'payback', true);
    const contaAtual = geracaoMensalValor * tarifaValor;
    contaEnergiaEstimada.textContent = `Ideal para contas de energia a partir de ${formatarMoeda(contaAtual)}`;
    linkPDF.href = dados.linkPdf;
    renderizarOpcoesFinanciamento(dados);
    renderizarParcelaEquilibrada(dados.balancedInstallment);
    // Re-inicia as animações de scroll para a nova tela
    setTimeout(setupScrollAnimations, 100);
}

// ---- Eventos ----
// ---- Eventos ----
// ---- Eventos ----
searchButton.addEventListener('click', async () => {
    const projectId = projectIdInput.value.trim();
    if (!/^[0-9]{1,6}$/.test(projectId)) {
        exibirMensagemDeErro('Por favor, digite um ID de projeto válido (até 6 dígitos).');
        return;
    }
    searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando...';
    searchButton.disabled = true;

    try {
        // 1. Busca os dados da proposta
        const proposta = await consultarProposta(projectId);

        // 2. Valida a resposta da API
        if (!proposta || !proposta.id) {
            exibirMensagemDeErro('Proposta não encontrada. Verifique o ID e tente novamente.');
            resetarBotao();
            return;
        }

        // 3. Valida a data de expiração
        const expirationDate = new Date(proposta.expirationDate);
        if (expirationDate < new Date()) {
            ocultarTodasAsTelas();
            expiredProposalSection.style.display = 'flex';
            resetarBotao();
            return;
        }

        // 4. Armazena os dados da proposta
        propostaOriginal = proposta;
        propostaEconomica = JSON.parse(JSON.stringify(proposta)); // Placeholder

        // --- LÓGICA DE TRANSIÇÃO DE TELA (SIMPLIFICADA E CORRIGIDA) ---

        // 5. Esconde TODAS as telas para garantir um estado limpo.
        ocultarTodasAsTelas();

        // 6. Renderiza os dados na tela de detalhes (que ainda está invisível).
        renderizarProposta(propostaOriginal);

        // 7. TORNA A TELA DE DETALHES E O CABEÇALHO VISÍVEIS.
        // Esta é a etapa crucial. Ao mudar o 'display', a tela passa a existir no layout.
        proposalHeader.style.display = 'block';
        proposalDetailsSection.style.display = 'flex';
        
        // 8. Reseta o botão para o estado original.
        resetarBotao();

    } catch (err) {
        // Em caso de erro de rede ou outro problema
        console.error("Erro na busca da proposta:", err);
        exibirMensagemDeErro('Erro de comunicação. Tente novamente mais tarde.');
        resetarBotao();
    }
});

popupCloseBtn.addEventListener('click', () => {
    errorPopup.style.display = 'none';
});

// Alternar propostas com troca de tema
btnAltaPerformance.addEventListener('click', () => {
    if (btnAltaPerformance.classList.contains('active')) return;
    document.body.classList.remove('theme-economic');
    btnEconomica.classList.remove('active');
    btnAltaPerformance.classList.add('active');
    if (propostaOriginal) renderizarProposta(propostaOriginal);
});

btnEconomica.addEventListener('click', () => {
    if (btnEconomica.classList.contains('active')) return;
    document.body.classList.add('theme-economic');
    btnAltaPerformance.classList.remove('active');
    btn
