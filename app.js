import { consultarProposta } from "./api.js";

// --- Seletores do DOM (apenas os que existem no carregamento inicial) ---
const searchForm = document.getElementById('search-form');
const proposalDetailsSection = document.getElementById('proposal-details');
const proposalHeader = document.getElementById('proposal-header');
const projectIdInput = document.getElementById('project-id');
const searchButton = document.getElementById('search-button');
const mainFooter = document.getElementById('main-footer');

// --- Variáveis de Estado ---
let propostaOriginal;
let propostaEconomica;

// --- Funções de Segurança ---
function blockFeatures() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's')) e.preventDefault();
        if (e.key === 'PrintScreen') { navigator.clipboard.writeText(''); e.preventDefault(); }
    });
}

// --- Funções Utilitárias ---
const formatarMoeda = (valor) => `R$ ${parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const findVar = (proposta, key, useFormatted = false) => {
    const variable = proposta.variables?.find(v => v.key === key);
    if (!variable) return 'N/A';
    return useFormatted && variable.formattedValue ? variable.formattedValue : variable.value;
};

// --- Funções de Renderização (simplificadas para clareza) ---
function renderizarProposta(dados, tipoProposta = 'performance') {
    // Seletores dos campos de dados (só são necessários aqui)
    const clienteNome = document.getElementById('cliente-nome');
    const clienteCidadeUf = document.getElementById('cliente-cidade-uf');
    // ... (adicione todos os outros seletores de campos de dados aqui)

    clienteNome.textContent = findVar(dados, 'cliente_nome', true);
    // ... (resto da lógica de renderização)
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

        // LÓGICA DO BOTÃO DE VOLTAR - SEGURA E NO LUGAR CERTO
        const backToSearchBtn = document.getElementById('back-to-search-btn');
        backToSearchBtn.addEventListener('click', () => {
            proposalDetailsSection.style.display = 'none';
            proposalHeader.style.display = 'none';
            searchForm.style.display = 'flex';
            projectIdInput.value = '';
            searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
            searchButton.disabled = false;
        });

    } catch (err) {
        console.error("Erro na busca:", err);
        searchButton.innerHTML = '<i class="fas fa-arrow-right"></i> Visualizar Proposta';
        searchButton.disabled = false;
    }
}

// --- Inicialização da Página ---
function init() {
    // A função init agora só precisa configurar os eventos da tela inicial
    searchButton.addEventListener('click', handleSearch);

    // Configuração inicial da visibilidade
    searchForm.style.display = 'flex';
    proposalDetailsSection.style.display = 'none';
    proposalHeader.style.display = 'none';
    mainFooter.style.display = 'block'; // Rodapé sempre visível
}

init();
