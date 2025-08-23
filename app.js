import { consultarProposta } from "./api.js";

// --- Seletores do DOM (declarados fora para escopo global) ---
const searchForm = document.getElementById('search-form');
const proposalDetailsSection = document.getElementById('proposal-details');
const proposalHeader = document.getElementById('proposal-header');
const projectIdInput = document.getElementById('project-id');
const searchButton = document.getElementById('search-button');
const clienteNome = document.getElementById('cliente-nome');
const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
const dataGeracao = document.getElementById('data-geracao');
const geracaoMensal = document.getElementById('geracao-mensal');
const potenciaSistema = document.getElementById('potencia-sistema');
const tipoInstalacao = document.getElementById('tipo-instalacao');
const contaEnergiaEstimada = document.getElementById('conta-energia-estimada');
const equipmentTitle = document.getElementById('equipment-title');
const equipmentLogoContainer = document.getElementById('equipment-logo-container');
const inversorPotencia = document.getElementById('inversor-potencia');
const moduloPotencia = document.getElementById('modulo-potencia');
const financingOptionsContainer = document.getElementById('financing-options');
const valorTotal = document.getElementById('valor-total');
const mainFooter = document.getElementById('main-footer');
const proposalValidity = document.getElementById('proposal-validity');

// --- Variáveis de Estado ---
let propostaOriginal;
let propostaEconomica;
// CORREÇÃO: Variáveis dos botões declaradas, mas não atribuídas ainda
let btnAltaPerformance;
let btnEconomica;

// --- Mapa de Logos ---
const logoMap = {
    'huawei': 'logo1.png', // CORREÇÃO: Mapeia 'huawei' para 'logo1.png'
    // Adicione outros fabricantes e seus respectivos arquivos de logo aqui
    // 'fronius': 'fronius_logo.png', 
};

// --- Funções de Segurança ---
function blockFeatures() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) e.preventDefault();
        if (e.key === 'PrintScreen') {
            navigator.clipboard.writeText('');
            e.preventDefault();
        }
    });
}

// --- Funções Utilitárias ---
const formatarMoeda = (valor) => `R$ ${parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const findVar = (proposta, key, useFormatted = false) => {
    const variable = proposta.variables?.find(v => v.key === key);
    if (!variable) return 'N/A';
    return useFormatted && variable.formattedValue ? variable.formattedValue : variable.value;
};

// --- Funções de Renderização ---
function renderizarFinanciamento(dados) {
    // (A lógica de financiamento da versão anterior pode ser mantida aqui)
}

function renderizarProposta(dados, tipoProposta = 'performance') {
    dataGeracao.textContent = findVar(dados, 'data_geracao', true).split(' ')[0];
    const contaAtual = (parseFloat(findVar(dados, 'geracao_mensal')) || 0) * (parseFloat(findVar(dados, 'tarifa_distribuidora')) || 0);
    contaEnergiaEstimada.innerHTML = `Ideal para contas de até <strong>${formatarMoeda(contaAtual)}</strong>`;

    equipmentTitle.innerHTML = tipoProposta === 'economica' 
        ? '<i class="fas fa-shield-alt"></i> Opção Custo-Benefício' 
        : '<i class="fas fa-rocket"></i> Equipamentos de Ponta';

    // LÓGICA DE LOGO CORRIGIDA
    let logoFileName;
    if (tipoProposta === 'economica') {
        logoFileName = 'logo2.png';
    } else {
        const fabricante = findVar(dados, 'inversor_fabricante').toLowerCase().split(' ')[0];
        logoFileName = logoMap[fabricante] || null; // Procura no mapa
    }

    if (logoFileName) {
        equipmentLogoContainer.innerHTML = `<img src="${logoFileName}" alt="Logo do equipamento">`;
    } else {
        equipmentLogoContainer.innerHTML = `<p><strong>${findVar(dados, 'inversor_fabricante', true)}</strong></p>`; // Fallback para texto
    }

    clienteNome.textContent = findVar(dados, 'cliente_nome', true);
    clienteCidadeUf.textContent = `${findVar(dados, 'cidade', true)} - ${findVar(dados, 'estado', true)}`;
    geracaoMensal.textContent = `${findVar(dados, 'geracao_mensal', true)} kWh`;
    potenciaSistema.textContent = `${findVar(dados, 'potencia_sistema', true)} kWp`;
    tipoInstalacao.textContent = findVar(dados, 'vc_tipo_de_estrutura', true);
    inversorPotencia.textContent = `${findVar(dados, 'inversor_potencia_nominal', true)} W`;
    moduloPotencia.textContent = `${findVar(dados, 'modulo_potencia', true)} W`;
    valorTotal.textContent = formatarMoeda(findVar(dados, 'preco'));
    proposalValidity.innerHTML = `Esta proposta é exclusiva para você e válida por <strong>3 dias</strong>, sujeita à disponibilidade de estoque.`;

    renderizarFinanciamento(dados);
}

// --- Lógica Principal e Eventos ---
async function handleSearch() {
    if (!/^[0-9]{1,6}$/.test(projectIdInput.value.trim())) return;
    searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    searchButton.disabled = true;

    try {
        const proposta = await consultarProposta(projectIdInput.value.trim());
        if (!proposta || !proposta.id) throw new Error('Proposta não encontrada.');

        propostaOriginal = proposta;
        propostaEconomica = JSON.parse(JSON.stringify(proposta));

        searchForm.style.display = 'none';
        proposalHeader.style.display = 'block';
        proposalDetailsSection.style.display = 'flex';
        mainFooter.style.display = 'block';
        
        renderizarProposta(propostaOriginal, 'performance');
        blockFeatures();

    } catch (err) {
        console.error("Erro na busca:", err);
        searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
        searchButton.disabled = false;
    }
}

// --- Inicialização da Página ---
function init() {
    // Cria o cabeçalho dinamicamente
    proposalHeader.innerHTML = `
        <div class="header__container">
            <div class="header__logo"><img src="logo.png" alt="Logo da GDIS"></div>
            <div class="header__options">
                <button id="btn-alta-performance" class="option-button active">Alta Performance</button>
                <button id="btn-economica" class="option-button">Econômica</button>
            </div>
        </div>`;
    
    // CORREÇÃO: Atribui as variáveis DEPOIS de criar os elementos
    btnAltaPerformance = document.getElementById('btn-alta-performance');
    btnEconomica = document.getElementById('btn-economica');

    // Adiciona os listeners DEPOIS de garantir que os botões existem
    searchButton.addEventListener('click', handleSearch);
    btnAltaPerformance.addEventListener('click', () => {
        if (btnAltaPerformance.classList.contains('active')) return;
        document.body.classList.remove('theme-economic');
        btnEconomica.classList.remove('active');
        btnAltaPerformance.classList.add('active');
        if (propostaOriginal) renderizarProposta(propostaOriginal, 'performance');
    });
    btnEconomica.addEventListener('click', () => {
        if (btnEconomica.classList.contains('active')) return;
        document.body.classList.add('theme-economic');
        btnAltaPerformance.classList.remove('active');
        btnEconomica.classList.add('active');
        if (propostaEconomica) renderizarProposta(propostaEconomica, 'economica');
    });

    // Configuração inicial da visibilidade
    searchForm.style.display = 'flex';
    proposalDetailsSection.style.display = 'none';
    proposalHeader.style.display = 'none';
    mainFooter.style.display = 'block'; // Rodapé sempre visível
}

// Inicia a aplicação
init();
