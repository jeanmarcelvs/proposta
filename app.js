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

// Campos da proposta (mantidos para referência)
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
    if (!variable || variable.value === null) return 'N/A';
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

// Adicione este novo seletor no início do seu app.js, junto com os outros
const equipmentLogoContainer = document.getElementById('equipment-logo-container');

// Agora, substitua a função renderizarProposta inteira por esta:
function renderizarProposta(dados) {
    // --- Lógica de formatação de dados ---
    const dataCompleta = findVariable(dados, 'data_geracao', true);
    const dataFormatada = dataCompleta.split(' ')[0];

    const geracaoMensalValor = parseFloat(findVariable(dados, 'geracao_mensal')) || 0;
    const tarifaValor = parseFloat(findVariable(dados, 'tarifa_distribuidora')) || 0;
    const contaAtual = geracaoMensalValor * tarifaValor;
    const textoContaEnergia = `Ideal para contas de energia de até ${formatarMoeda(contaAtual)}`;

    // --- Lógica da Logo Dinâmica ---
    const fabricanteInversor = findVariable(dados, 'inversor_fabricante', false).toLowerCase();
    // Cria um nome de arquivo de imagem simples a partir do nome do fabricante.
    // Ex: "HUAWEI" -> "huawei.png", "FRONIUS" -> "fronius.png"
    const logoFileName = `${fabricanteInversor.split(' ')[0]}.png`; // Pega só o primeiro nome

    // Limpa o container da logo e insere a nova imagem
    equipmentLogoContainer.innerHTML = ''; // Limpa qualquer logo anterior
    const logoImg = document.createElement('img');
    logoImg.src = logoFileName;
    logoImg.alt = `Logo ${fabricanteInversor}`;
    // Adiciona um tratamento de erro caso a imagem não seja encontrada
    logoImg.onerror = () => { 
        equipmentLogoContainer.innerHTML = `<p><strong>Inversor:</strong> ${findItem(dados, 'Inversor')}</p>`;
    };
    equipmentLogoContainer.appendChild(logoImg);


    // --- Renderização dos dados nos elementos HTML ---
    clienteNome.textContent = findVariable(dados, 'cliente_nome', true) || 'Cliente GDIS';
    const cidade = findVariable(dados, 'cidade');
    const uf = findVariable(dados, 'estado');
    clienteCidadeUf.textContent = (cidade !== 'N/A' && uf !== 'N/A') ? `${cidade} - ${uf}` : 'Localidade não informada';
    dataGeracao.textContent = dataFormatada;
    
    geracaoMensal.textContent = `${findVariable(dados, 'geracao_mensal', true)} kWh`;
    contaEnergiaEstimada.textContent = textoContaEnergia;
    potenciaSistema.textContent = `${findVariable(dados, 'potencia_sistema', true)} kWp`;
    tipoInstalacao.textContent = findVariable(dados, 'vc_tipo_de_estrutura', true);
    
    valorTotal.textContent = formatarMoeda(findVariable(dados, 'preco'));
    payback.textContent = findVariable(dados, 'payback', true);
    
    linkPDF.href = dados.linkPdf;
    
    renderizarOpcoesFinanciamento(dados);
    renderizarParcelaEquilibrada(dados.balancedInstallment);
}



// ---- Eventos ----
searchButton.addEventListener('click', async () => {
    const projectId = projectIdInput.value.trim();
    if (!/^[0-9]{1,6}$/.test(projectId)) {
        exibirMensagemDeErro('Por favor, digite um ID de projeto válido.');
        return;
    }
    searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando...';
    searchButton.disabled = true;

    try {
        // --- CORREÇÃO APLICADA AQUI ---
        // A função consultarProposta JÁ RETORNA o objeto da proposta, não um objeto {data: ...}
        const proposta = await consultarProposta(projectId);

        // Adicionamos um log para depuração futura. Você pode vê-lo no console do navegador (F12).
        console.log("Objeto da proposta recebido:", proposta);

        // Valida a proposta recebida diretamente.
        if (!proposta || !proposta.id) {
            exibirMensagemDeErro('Proposta não encontrada. Verifique o ID e tente novamente.');
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
        propostaEconomica = JSON.parse(JSON.stringify(proposta));

        ocultarTodasAsTelas();
        renderizarProposta(propostaOriginal); // 'propostaOriginal' agora tem a estrutura correta.
        proposalHeader.style.display = 'block';
        proposalDetailsSection.style.display = 'flex';
        
        resetarBotao();

    } catch (err) {
        console.error("Erro detalhado na busca da proposta:", err);
        exibirMensagemDeErro('Erro de comunicação. Verifique o console para mais detalhes.');
        resetarBotao();
    }
});



popupCloseBtn.addEventListener('click', () => {
    errorPopup.style.display = 'none';
});

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
    btnEconomica.classList.add('active');
    if (propostaEconomica) renderizarProposta(propostaEconomica);
});

// ---- Inicialização ----
ocultarTodasAsTelas();
searchForm.style.display = 'flex';
