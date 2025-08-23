import { consultarProposta } from "./api.js";

// --- Seletores do DOM ---
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
const btnAltaPerformance = document.getElementById('btn-alta-performance');
const btnEconomica = document.getElementById('btn-economica');
const mainFooter = document.getElementById('main-footer');

// --- Variáveis de Estado ---
let propostaOriginal;
let propostaEconomica;

// --- Funções de Segurança ---
function blockFeatures() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) {
            e.preventDefault();
        }
        if (e.key === 'PrintScreen') {
            e.preventDefault();
        }
    }, false);
}

// --- Funções Utilitárias ---
const formatarMoeda = (valor) => {
    const num = parseFloat(valor);
    return isNaN(num) ? 'N/A' : `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const findVariable = (proposta, key) => proposta.variables?.find(v => v.key === key)?.value || 'N/A';

// --- Funções de Renderização ---
function renderizarFinanciamento(dados) {
    const todasVariaveis = dados.variables;
    const todasAsParcelas = todasVariaveis.filter(v => v.key.startsWith('f_parcela'));

    let opcoesFinanciamento = todasAsParcelas.map(parcelaVar => {
        const prazoKey = parcelaVar.key.replace('parcela', 'prazo');
        const prazoVar = todasVariaveis.find(v => v.key === prazoKey);
        if (prazoVar?.value && parcelaVar?.value) {
            return { prazo: parseInt(prazoVar.value, 10), valorParcela: parseFloat(parcelaVar.value) };
        }
        return null;
    }).filter(Boolean);

    if (opcoesFinanciamento.length === 0) {
        financingOptionsContainer.innerHTML = "<p>Nenhuma opção de financiamento disponível.</p>";
        return;
    }

    opcoesFinanciamento.sort((a, b) => a.prazo - b.prazo);

    const economiaMensal = parseFloat(findVariable(dados, 'economia_mensal')) || 0;
    const custoDisponibilidade = parseFloat(findVariable(dados, 'custo_disponibilidade_valor')) || 0;
    let melhorOpcao = null;
    let menorDiferenca = Infinity;

    opcoesFinanciamento.forEach(opt => {
        const custoFuturo = opt.valorParcela + custoDisponibilidade;
        const diferenca = Math.abs(economiaMensal - custoFuturo);
        if (diferenca < menorDiferenca) {
            menorDiferenca = diferenca;
            melhorOpcao = opt;
        }
    });

    financingOptionsContainer.innerHTML = '';
    opcoesFinanciamento.forEach(opcao => {
        const div = document.createElement('div');
        div.className = 'financing-option';
        if (melhorOpcao && opcao.prazo === melhorOpcao.prazo) {
            div.classList.add('highlight');
        }
        div.innerHTML = `<div class="prazo">${opcao.prazo}<span>x</span></div><div class="valor">${formatarMoeda(opcao.valorParcela)}</div>`;
        financingOptionsContainer.appendChild(div);
    });
}

function renderizarProposta(dados, tipoProposta = 'performance') {
    const dataCompleta = findVariable(dados, 'data_geracao');
    dataGeracao.textContent = dataCompleta.split(' ')[0];

    const geracaoMensalValor = parseFloat(findVariable(dados, 'geracao_mensal')) || 0;
    const tarifaValor = parseFloat(findVariable(dados, 'tarifa_distribuidora')) || 0;
    const contaAtual = geracaoMensalValor * tarifaValor;
    contaEnergiaEstimada.innerHTML = `Ideal para contas de energia de até <strong>${formatarMoeda(contaAtual)}</strong>`;

    equipmentTitle.innerHTML = tipoProposta === 'economica' 
        ? '<i class="fas fa-cogs"></i> Equipamentos Eficientes' 
        : '<i class="fas fa-cogs"></i> Equipamentos de Ponta';

    const logoFileName = tipoProposta === 'economica' ? 'logo2.png' : `${findVariable(dados, 'inversor_fabricante').toLowerCase().split(' ')[0]}.png`;
    equipmentLogoContainer.innerHTML = `<img src="${logoFileName}" alt="Logo do equipamento">`;

    clienteNome.textContent = findVariable(dados, 'cliente_nome');
    clienteCidadeUf.textContent = `${findVariable(dados, 'cidade')} - ${findVariable(dados, 'estado')}`;
    geracaoMensal.textContent = `${findVariable(dados, 'geracao_mensal')} kWh`;
    potenciaSistema.textContent = `${findVariable(dados, 'potencia_sistema')} kWp`;
    tipoInstalacao.textContent = findVariable(dados, 'vc_tipo_de_estrutura');
    inversorPotencia.textContent = `${findVariable(dados, 'inversor_potencia_nominal')} W`;
    moduloPotencia.textContent = `${findVariable(dados, 'modulo_potencia')} W`;
    valorTotal.textContent = formatarMoeda(findVariable(dados, 'preco'));

    renderizarFinanciamento(dados);
}

// --- Lógica Principal e Eventos ---
async function handleSearch() {
    const projectId = projectIdInput.value.trim();
    if (!/^[0-9]{1,6}$/.test(projectId)) {
        // Exibir erro
        return;
    }
    searchButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    searchButton.disabled = true;

    try {
        const proposta = await consultarProposta(projectId);
        if (!proposta || !proposta.id) {
            // Exibir erro
            searchButton.innerHTML = '<i class="fas fa-arrow-right"></i>';
            searchButton.disabled = false;
            return;
        }

        propostaOriginal = proposta;
        propostaEconomica = JSON.parse(JSON.stringify(proposta)); // Placeholder

        searchForm.style.display = 'none';
        proposalHeader.style.display = 'block';
        proposalDetailsSection.style.display = 'flex';
        mainFooter.style.display = 'block';
        
        renderizarProposta(propostaOriginal, 'performance');
        blockFeatures();

    } catch (err) {
        console.error("Erro na busca:", err);
        // Exibir erro
        searchButton.innerHTML = '<i class="fas fa-arrow-right"></i>';
        searchButton.disabled = false;
    }
}

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
    if
