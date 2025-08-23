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

// ---- Utilidades ----
function ocultarTodasAsTelas() {
    searchForm.style.display = 'none';
    proposalDetailsSection.style.display = 'none';
    expiredProposalSection.style.display = 'none';
    proposalHeader.style.display = 'none';
}

function resetarBotao() {
    searchButton.textContent = 'Visualizar Proposta';
    searchButton.disabled = false;
}

function exibirMensagemDeErro(mensagem) {
    popupMessage.textContent = mensagem;
    errorPopup.style.display = 'flex';
}

function formatarMoeda(valor) {
    const num = parseFloat(valor);
    if (isNaN(num)) return valor || 'N/A';
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarNumero(valor) {
    const num = parseFloat(valor);
    if (isNaN(num)) return valor || 'N/A';
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

    // 1. Encontramos todas as variáveis de PARCELA, que contêm o valor que queremos exibir.
    // Isso nos dará f_parcela, f_parcela_2, f_parcela_3, etc.
    const todasAsParcelas = todasVariaveis.filter(v => v.key.startsWith('f_parcela'));

    // 2. Para cada variável de parcela encontrada, buscamos o seu prazo correspondente.
    const opcoesFinanciamento = todasAsParcelas.map(parcelaVar => {
        // Montamos a chave do prazo correspondente.
        // Se a chave da parcela for "f_parcela_3", a chave do prazo será "f_prazo_3".
        // Se for "f_parcela", a chave do prazo será "f_prazo".
        const prazoKey = parcelaVar.key.replace('parcela', 'prazo');
        
        // Buscamos a variável do prazo no array original.
        const prazoVar = todasVariaveis.find(v => v.key === prazoKey);

        // Se encontramos ambos (parcela e prazo), retornamos um objeto limpo.
        if (prazoVar && prazoVar.value && parcelaVar.value) {
            return {
                prazo: parseInt(prazoVar.value, 10),
                valorParcela: parseFloat(parcelaVar.value)
            };
        }
        // Se não encontrar o par, retorna null para ser filtrado depois.
        return null; 
    }).filter(opt => opt !== null && !isNaN(opt.prazo) && !isNaN(opt.valorParcela)); // Remove nulos e inválidos

    // 3. Verificamos se encontramos alguma opção válida.
    if (opcoesFinanciamento.length === 0) {
        financingOptionsContainer.textContent = "Nenhuma opção de financiamento disponível.";
        return;
    }

    // 4. Ordenamos as opções pelo prazo (número de parcelas).
    opcoesFinanciamento.sort((a, b) => a.prazo - b.prazo);

    // 5. Renderizamos cada opção na tela.
    opcoesFinanciamento.forEach(opcao => {
        const div = document.createElement('div');
        div.className = 'financing-option';
        div.textContent = `${opcao.prazo}x de ${formatarMoeda(opcao.valorParcela)}`;
        financingOptionsContainer.appendChild(div);
    });
}

function renderizarParcelaEquilibrada(parcela) {
    parcelaEquilibradaContainer.innerHTML = '';
    if (!parcela) return;

    parcelaEquilibradaContainer.textContent =
        `Parcela Equilibrada: ${formatarMoeda(parcela.value)} em ${parcela.installments}x`;
}

function renderizarProposta(dados) {
    clienteNome.textContent = findVariable(dados, 'cliente_nome', true);

    const cidade = findVariable(dados, 'cidade');
    const uf = findVariable(dados, 'estado');
    clienteCidadeUf.textContent = `${cidade} - ${uf}`;

    dataGeracao.textContent = findVariable(dados, 'data_geracao', true);

    inversorDescricao.textContent = findItem(dados, 'Inversor');
    moduloDescricao.textContent = findItem(dados, 'Módulo');

    const geracaoMensalValor = parseFloat(findVariable(dados, 'geracao_mensal')) || 0;
    const tarifaValor = parseFloat(findVariable(dados, 'tarifa_distribuidora')) || 0;

    potenciaSistema.textContent = `${findVariable(dados, 'potencia_sistema', true)} kWp`;
    geracaoMensal.textContent = `${findVariable(dados, 'geracao_mensal', true)} kWh`;
    tarifaDistribuidora.textContent = formatarNumero(tarifaValor);
    tipoInstalacao.textContent = findVariable(dados, 'vc_tipo_de_estrutura', true);

    valorTotal.textContent = formatarMoeda(findVariable(dados, 'preco'));

    payback.textContent = findVariable(dados, 'payback', true);

    // 🔥 Cálculo da Conta Atual = geração mensal × tarifa
    const contaAtual = geracaoMensalValor * tarifaValor;
    contaEnergiaEstimada.textContent = `Para contas de energia de ${formatarMoeda(contaAtual)}`;

    linkPDF.href = dados.linkPdf;

    renderizarOpcoesFinanciamento(dados);
    renderizarParcelaEquilibrada(dados.balancedInstallment);
}

// ---- Eventos ----
searchButton.addEventListener('click', async () => {
    const projectId = projectIdInput.value.trim();

    if (!/^[0-9]{1,6}$/.test(projectId)) {
        exibirMensagemDeErro('Por favor, digite um ID de projeto válido (até 6 dígitos numéricos).');
        return;
    }

    searchButton.textContent = 'Consultando...';
    searchButton.disabled = true;

    try {
        // A resposta da API já é o objeto da proposta
        const proposta = await consultarProposta(projectId);

        // A verificação agora funciona corretamente
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

        // Armazena a proposta diretamente
        propostaOriginal = proposta;
        propostaEconomica = JSON.parse(JSON.stringify(proposta)); // placeholder

        ocultarTodasAsTelas();
        proposalHeader.style.display = 'flex';
        // A renderização usará o objeto correto
        renderizarProposta(propostaOriginal);
        proposalDetailsSection.style.display = 'block'; // 🔥 ADICIONEI ESTA LINHA
        resetarBotao();

    } catch (err) {
        console.error("Erro na busca da proposta:", err);
        exibirMensagemDeErro('Erro de comunicação. Tente novamente mais tarde.');
        resetarBotao();
    }
});

// Fechar popup
popupCloseBtn.addEventListener('click', () => {
    errorPopup.style.display = 'none';
});

// Alternar propostas
btnAltaPerformance.addEventListener('click', () => {
    if (propostaOriginal) renderizarProposta(propostaOriginal);
});

btnEconomica.addEventListener('click', () => {
    if (propostaEconomica) renderizarProposta(propostaEconomica);
});

// Inicialização
ocultarTodasAsTelas();
searchForm.style.display = 'flex';
