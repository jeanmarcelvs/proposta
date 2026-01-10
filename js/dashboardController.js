import db from './databaseService.js';

// Trava de Segurança
if (!sessionStorage.getItem('auth_belenergy')) {
    window.location.href = 'central-belenergy.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa na tela de Dashboard
    navegar('dashboard');
    
    // Atualiza nome do usuário (mock)
    const userArea = document.querySelector('.user-name');
    if(userArea) userArea.innerText = "Eng. Jean Marcel";

});

// Torna a função global para ser usada no onclick do HTML
window.navegar = function(modulo) {
    // 1. Atualiza Menu Ativo
    document.querySelectorAll('.item-menu').forEach(item => item.classList.remove('active'));
    const menuItem = document.querySelector(`[onclick="navegar('${modulo}')"]`);
    if (menuItem) menuItem.classList.add('active');

    // 2. Renderiza Conteúdo
    const container = document.getElementById('area_dinamica');
    
    switch(modulo) {
        case 'dashboard':
            renderizarDashboard(container);
            break;
        case 'clientes':
            renderizarModuloClientes(container); // Mantém a tela de clientes no menu "Clientes"
            break;
        case 'premissas':
            renderizarPremissas(container);
            break;
        default:
            renderizarDashboard(container);
    }
}

function renderizarDashboard(container) {
    container.innerHTML = `
        <div class="area-trabalho-engenharia" style="margin-top: 20px;">
            <div class="header-modulo">
                <h2><i class="fas fa-chart-line"></i> Visão Geral de Engenharia</h2>
            </div>

            <div class="grid-resumo-dashboard">
                <div class="card-indicador">
                    <div class="icon-indicador icon-clientes"><i class="fas fa-users"></i></div>
                    <div class="info-indicador">
                        <span>Clientes Ativos</span>
                        <strong id="contagem_clientes">0</strong>
                    </div>
                </div>
                <div class="card-indicador">
                    <div class="icon-indicador icon-projetos"><i class="fas fa-solar-panel"></i></div>
                    <div class="info-indicador">
                        <span>Projetos Criados</span>
                        <strong id="contagem_projetos">0</strong>
                    </div>
                </div>
                <div class="card-indicador">
                    <div class="icon-indicador icon-financeiro"><i class="fas fa-file-invoice-dollar"></i></div>
                    <div class="info-indicador">
                        <span>Propostas Geradas</span>
                        <strong id="contagem_propostas">0</strong>
                    </div>
                </div>
                <div class="card-indicador">
                    <div class="icon-indicador icon-financeiro" style="background: rgba(255, 100, 100, 0.1); color: #ff6464;"><i class="fas fa-bolt"></i></div>
                    <div class="info-indicador">
                        <span>Potência Total</span>
                        <strong id="soma_kwp">0.00</strong>
                    </div>
                </div>
            </div>

            <div class="card-tecnico">
                <div class="secao-header">
                    <span><i class="fas fa-clock" style="color: var(--primaria);"></i> Propostas Recentes</span>
                    <button class="btn-novo-atalho" onclick="window.novoDoc('proposta')">+ Nova Proposta</button>
                </div>
                <table class="tabela-tecnica">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Potência</th>
                            <th>Projeto Relacionado</th>
                            <th>Cliente</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="corpo_propostas_diretas"></tbody>
                </table>
            </div>

            <div class="card-tecnico">
                <div class="secao-header">
                    <span><i class="fas fa-project-diagram" style="color: var(--primaria);"></i> Projetos Ativos</span>
                </div>
                <table class="tabela-tecnica">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Projeto</th>
                            <th>Cliente Responsável</th>
                            <th>Cidade/UF</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="corpo_projetos_diretos"></tbody>
                </table>
            </div>
        </div>
    `;

    // Após renderizar a estrutura, popula com os dados
    carregarDadosDashboard();
}

function carregarDadosDashboard() {
    const propostas = db.listar('propostas');
    const projetos = db.listar('projetos');
    const clientes = db.listar('clientes');

    // 1. Popula Indicadores
    document.getElementById('contagem_clientes').innerText = clientes.length;
    document.getElementById('contagem_projetos').innerText = projetos.length;
    document.getElementById('contagem_propostas').innerText = propostas.length;
    const totalKwp = propostas.reduce((soma, p) => soma + (p.potenciaKwp || 0), 0);
    document.getElementById('soma_kwp').innerText = totalKwp.toFixed(2);

    // 2. Popula Tabela de Propostas
    const containerPropostas = document.getElementById('corpo_propostas_diretas');
    if (containerPropostas) {
        const propostasOrdenadas = [...propostas].sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
        containerPropostas.innerHTML = propostasOrdenadas.map(prop => {
            const projeto = db.buscarPorId('projetos', prop.projetoId) || { nome_projeto: 'N/A', clienteId: null };
            const cliente = db.buscarPorId('clientes', projeto.clienteId) || { nome: 'N/A' };
            return `
                <tr class="linha-busca">
                    <td>${new Date(prop.dataCriacao).toLocaleDateString()}</td>
                    <td><strong>${(prop.potenciaKwp || 0).toFixed(2)} kWp</strong></td>
                    <td><i class="fas fa-folder"></i> ${projeto.nome_projeto}</td>
                    <td style="color: #475569;">${cliente.nome}</td>
                    <td style="text-align: right;">
                        <button class="btn-icon" onclick="window.visualizarProposta('${prop.id}')" title="Visualizar Proposta"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" onclick="window.editarProposta('${prop.id}')" title="Editar Proposta"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn-icon" onclick="window.excluirProposta('${prop.id}')" title="Excluir Proposta"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 3. Popula Tabela de Projetos
    const containerProjetos = document.getElementById('corpo_projetos_diretos');
    if (containerProjetos) {
        const projetosOrdenados = [...projetos].sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
        containerProjetos.innerHTML = projetosOrdenados.map(proj => {
            const cliente = db.buscarPorId('clientes', proj.clienteId) || { nome: 'N/A' };
            return `
                <tr class="linha-busca">
                    <td>${new Date(proj.dataCriacao).toLocaleDateString()}</td>
                    <td><strong>${proj.nome_projeto}</strong></td>
                    <td><i class="fas fa-user"></i> ${cliente.nome}</td>
                    <td>${proj.cidade}/${proj.uf}</td>
                    <td style="text-align: right;">
                        <button class="btn-icon" onclick="window.visualizarProjeto('${proj.id}')" title="Visualizar Detalhes do Projeto"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" onclick="window.editarProjeto('${proj.id}')" title="Editar/Dimensionar Projeto"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn-icon" onclick="window.excluirProjeto('${proj.id}')" title="Excluir Projeto"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

// Busca Global que filtra qualquer texto nas tabelas
window.executarBuscaGlobal = function() {
    const termo = document.getElementById('input_busca_global').value.toLowerCase();
    const linhas = document.querySelectorAll('.linha-busca');

    linhas.forEach(linha => {
        linha.style.display = linha.innerText.toLowerCase().includes(termo) ? "" : "none";
    });
}

// Atalho para criação de documentos
window.novoDoc = function(tipo) {
    if (tipo === 'proposta') {
        alert("Para criar uma nova proposta, vá para a lista de Clientes, selecione um cliente e inicie um novo projeto.");
        // Navega para a aba de clientes para iniciar o fluxo correto
        window.navegar('clientes');
    }
}

/**
 * Renderiza o módulo completo de gestão de clientes (para a aba "Clientes").
 * @param {HTMLElement} container O elemento onde o módulo será renderizado.
 */
function renderizarModuloClientes(container) {
	container.innerHTML = `
        <div id="modulo_clientes" class="painel-modulo">
            <div class="header-modulo">
                <h2><i class="fas fa-users"></i> Gestão de Clientes</h2>
                <div class="acoes-header">
                    <button class="btn-primary btn-auto-width" onclick="window.location.href='cadastro-cliente.html'">
                        <i class="fas fa-plus"></i> Novo Cliente
                    </button>
                </div>
            </div>

            <div class="card-tecnico card-lista">
                <div class="busca-interna">
                    <i class="fas fa-search"></i>
                    <input type="text" id="busca_cliente_lista" placeholder="Filtrar por nome, cidade ou documento..." onkeyup="window.filtrarTabelaLocal('tabela_clientes', this.value)">
                </div>
                <table id="tabela_clientes" class="tabela-transversal">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Localização</th>
                            <th>Documento</th>
                            <th>Projetos</th>
                            <th style="text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="corpo_lista_clientes">
                        <!-- Conteúdo injetado por popularTabelaClientes -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

	// Popula a tabela com os dados existentes
	popularTabelaClientes();
}

function popularTabelaClientes() {
    const clientes = db.listar('clientes').sort((a, b) => a.nome.localeCompare(b.nome));
    const tbody = document.getElementById('corpo_lista_clientes');
    if (!tbody) return;

    if (clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nenhum cliente cadastrado. Clique em "+ Novo Cliente" para começar.</td></tr>`;
        return;
    }

    tbody.innerHTML = clientes.map(cli => `
        <tr>
            <td><strong>${cli.nome}</strong></td>
            <td>${cli.endereco?.cidade || 'N/A'} / ${cli.endereco?.uf || 'N/A'}</td>
            <td>${cli.documento || '---'}</td>
            <td><span class="tag-projeto">${db.buscarPorRelacao('projetos', 'clienteId', cli.id).length}</span></td>
            <td class="coluna-acoes">
                <button class="btn-icon" onclick="window.abrirPerfil('${cli.id}')" title="Ver Detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon btn-add-proj" onclick="window.iniciarNovoProjeto('${cli.id}')" title="Novo Projeto">
                    <i class="fas fa-plus"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

window.filtrarTabelaLocal = function(tableId, searchTerm) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const filter = searchTerm.toLowerCase();
    const rows = table.querySelector("tbody").getElementsByTagName("tr");

    for (const row of rows) {
        row.style.display = row.textContent.toLowerCase().includes(filter) ? "" : "none";
    }
};

window.abrirPerfil = function(id) {
    alert(`Funcionalidade "Ver Perfil" para o cliente ID: ${id} em desenvolvimento.`);
};

function renderizarPremissas(container) {
    // Busca configuração salva ou usa padrão
    const config = db.buscarConfiguracao('premissas_globais') || {
        engenharia: { 
            eficienciaInversor: 98,
            perdaTempInversor: 1.5,
            perdaTempModulos: 10.13,
            cabos: 2.0,
            outros: 2.0,
            indisponibilidade: 0.5,
            azimute: 0, 
            inclinacao: 10
        },
        // Adicionando valores padrão para materiais premium se não existirem
        materiaisPremium: {
            va_diaria_instalador: 390.00,
            va_qdg_mono_premium: 150.00,
            va_qdg_trif_premum: 300.00,
            va_eletrocalha_50: 85.00,
            va_eletrocalha_100: 158.00,
            va_bloco_distribuicao: 90.00,
            va_tampa_acrilico: 335.00
        },
        // Configuração de Estruturas Especiais (Solo/Laje)
        estruturas: {
            va_estrutura_solo: 125.00,
            diaria_extra_solo: 0.2,
            va_estrutura_laje: 55.00,
            diaria_extra_laje: 0.1
        },
        financeiro: { fatorLucroStandard: 1.1, fatorLucroPremium: 1.2, lucroMinimo: 2500, imposto: 15, precoCombustivel: 6.10, consumoVeiculo: 8.5, kmSuprimentos: 15, modulosPorDia: 12, tempoExtraInversor: 0.5, kmAlmoco: 5, diasMinimosObra: 2 },
        tabelas: {
            materiais: [
                { limite: 20, custo: 1100 }, { limite: 25, custo: 1550 }, { limite: 30, custo: 2000 },
                { limite: 40, custo: 2450 }, { limite: 50, custo: 2750 }, { limite: 270, custo: 7700 }
            ],
            maoDeObra: [
                { limite: 10, unitario: 150 }, { limite: 18, unitario: 110 },
                { limite: 30, unitario: 100 }, { limite: 90, unitario: 85 }
            ]
        }
    };

    container.innerHTML = `
        <div class="painel-modulo">
            <div class="header-modulo">
                <div>
                    <h2><i class="fas fa-sliders-h"></i> Centro de Inteligência</h2>
                </div>
                
                <button class="btn-primary" onclick="window.salvarPremissas()" style="width: auto; padding: 0.8rem 1.5rem;">
                    <i class="fas fa-save"></i> Salvar Alterações Globais
                </button>
            </div>

            <div class="layout-premissas">
                
                <!-- Coluna Esquerda: Parâmetros -->
                <div class="coluna-parametros">
                    
                    <!-- NOVA SEÇÃO: COMPOSIÇÃO PREMIUM -->
                    <div class="card-premissas-tecnicas">
                        <div class="secao-header">
                            <i class="fas fa-gem" style="color: var(--primaria-dark);"></i>
                            <span>Composição de Infraestrutura Premium</span>
                        </div>
                        <p class="instrucao-tecnica">Defina os custos unitários dos materiais e da mão de obra especializada.</p>

                        <div class="grid-inputs-config">
                            <div class="grupo-form-config" style="grid-column: span 2;">
                                <label for="va_diaria_instalador">Valor da Diária Técnica (R$)</label>
                                <input type="number" id="va_diaria_instalador" value="${config.materiaisPremium?.va_diaria_instalador ?? 390.00}" class="input-config">
                                <small class="nota-alerta">
                                    <i class="fas fa-info-circle"></i> 
                                    <strong>Impacto Premium:</strong> Na aba Premium, soma-se <strong>+1 diária por inversor</strong> ao tempo base, multiplicando este valor e os custos de logística.
                                </small>
                            </div>

                            <div class="grupo-form-config">
                                <label>QDG Monofásico (R$)</label>
                                <input type="number" id="va_qdg_mono_premium" value="${config.materiaisPremium?.va_qdg_mono_premium ?? 150.00}" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>QDG Trifásico (R$)</label>
                                <input type="number" id="va_qdg_trif_premum" value="${config.materiaisPremium?.va_qdg_trif_premum ?? 300.00}" class="input-config">
                            </div>

                            <div class="grupo-form-config">
                                <label>Eletrocalha 50mm (R$/3m)</label>
                                <input type="number" id="va_eletrocalha_50" value="${config.materiaisPremium?.va_eletrocalha_50 ?? 85.00}" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Eletrocalha 100mm (R$/3m)</label>
                                <input type="number" id="va_eletrocalha_100" value="${config.materiaisPremium?.va_eletrocalha_100 ?? 158.00}" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Bloco Distribuição (R$/un)</label>
                                <input type="number" id="va_bloco_distribuicao" value="${config.materiaisPremium?.va_bloco_distribuicao ?? 90.00}" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Tampa Acrílico (R$/un)</label>
                                <input type="number" id="va_tampa_acrilico" value="${config.materiaisPremium?.va_tampa_acrilico ?? 335.00}" class="input-config">
                            </div>
                        </div>
                    </div>

                    <!-- NOVA SEÇÃO: ESTRUTURAS ESPECIAIS -->
                    <div class="card-premissas-tecnicas">
                        <div class="secao-header">
                            <i class="fas fa-layer-group" style="color: var(--primaria-dark);"></i>
                            <span>Estruturas Especiais (Solo / Laje)</span>
                        </div>
                        <p class="instrucao-tecnica">Defina custos e impacto no cronograma para estruturas próprias.</p>

                        <div class="grid-inputs-config">
                            <div class="grupo-form-config">
                                <label>Material Solo (R$/mód)</label>
                                <input type="number" id="va_estrutura_solo" value="${config.estruturas?.va_estrutura_solo ?? 125.00}" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>M.O. Solo (Dia/mód)</label>
                                <input type="number" id="diaria_extra_solo" value="${config.estruturas?.diaria_extra_solo ?? 0.2}" step="0.01" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Material Laje (R$/mód)</label>
                                <input type="number" id="va_estrutura_laje" value="${config.estruturas?.va_estrutura_laje ?? 55.00}" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>M.O. Laje (Dia/mód)</label>
                                <input type="number" id="diaria_extra_laje" value="${config.estruturas?.diaria_extra_laje ?? 0.1}" step="0.01" class="input-config">
                            </div>
                        </div>
                    </div>

                    <!-- Engenharia -->
                    <div class="card-tecnico card-config">
                        <div class="secao-header">
                            <i class="fas fa-sun"></i>
                            <span>Engenharia Solar</span>
                        </div>
                        <div class="grid-inputs-config">
                            <div class="grupo-form-config">
                                <label>Eficiência Inversor (%)</label>
                                <input type="number" id="p_eficiencia_inversor" value="${config.engenharia.eficienciaInversor ?? 98}" step="0.1" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Perda Temp. Inv. (%)</label>
                                <input type="number" id="p_perda_temp_inversor" value="${config.engenharia.perdaTempInversor ?? 1.5}" step="0.1" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Perda Temp. Mód. (%)</label>
                                <input type="number" id="p_perda_temp_modulos" value="${config.engenharia.perdaTempModulos ?? 10.13}" step="0.01" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Perdas Cabos (%)</label>
                                <input type="number" id="p_cabos" value="${config.engenharia.cabos ?? 2.0}" step="0.1" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Perdas Externas (%)</label>
                                <input type="number" id="p_outros" value="${config.engenharia.outros ?? 2.0}" step="0.1" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Indisponibilidade (%)</label>
                                <input type="number" id="p_indisponibilidade" value="${config.engenharia.indisponibilidade ?? 0.5}" step="0.1" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Azimute Padrão (°)</label>
                                <input type="number" id="p_azimute" value="${config.engenharia.azimute}" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Inclinação Padrão (°)</label>
                                <input type="number" id="p_inclinacao" value="${config.engenharia.inclinacao}" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Oversizing DC/AC Padrão (%)</label>
                                <input type="number" id="p_oversizing" value="${config.engenharia.oversizingPadrao || 50}" class="input-config">
                                <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Este valor será aplicado automaticamente em novas propostas.</small>
                            </div>
                        </div>
                    </div>

                    <!-- Logística e Instalação (REFORMULADO) -->
                    <div class="card-tecnico card-config">
                        <div class="secao-header">
                            <i class="fas fa-truck-pickup"></i>
                            <span>Logística e Deslocamento</span>
                        </div>
                        <div class="grid-inputs-config">
                            <div class="grupo-form-config">
                                <label>Preço Combustível (R$/L)</label>
                                <input type="number" id="p_preco_combustivel" value="${config.financeiro.precoCombustivel ?? 6.10}" step="0.01" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Consumo Veículo (km/L)</label>
                                <input type="number" id="p_consumo_veiculo" value="${config.financeiro.consumoVeiculo ?? 8.5}" step="0.1" class="input-config">
                                <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Carro carregado + equipe</small>
                            </div>
                            <div class="grupo-form-config">
                                <label>KM Suprimentos (Fixo)</label>
                                <input type="number" id="p_km_suprimentos" value="${config.financeiro.kmSuprimentos ?? 15}" step="1" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>KM Desvio Diário (Almoço)</label>
                                <input type="number" id="p_km_almoco" value="${config.financeiro.kmAlmoco ?? 5}" step="1" class="input-config">
                            </div>
                            <div class="grupo-form-config">
                                <label>Capacidade (Módulos/Dia)</label>
                                <input type="number" id="p_modulos_dia" value="${config.financeiro.modulosPorDia || 12}" class="input-config">
                                <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Define a quantidade de diárias.</small>
                            </div>
                            <div class="grupo-form-config">
                                <label>Tempo Extra p/ Inversor (Dias)</label>
                                <input type="number" id="p_tempo_inv_extra" value="${config.financeiro.tempoExtraInversor ?? 0.5}" step="0.1" class="input-config">
                                <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Complexidade SEP adicional.</small>
                            </div>
                            <div class="grupo-form-config">
                                <label>Dias Mínimos de Obra</label>
                                <input type="number" id="p_dias_minimos" value="${config.financeiro.diasMinimosObra || 2}" class="input-config">
                                <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Piso de segurança para mobilização.</small>
                            </div>
                        </div>
                    </div>

                    <!-- Financeiro -->
                    <div class="card-tecnico card-config">
                        <div class="secao-header">
                            <i class="fas fa-balance-scale"></i>
                            <span>Financeiro e Tributário</span>
                        </div>
                        <div class="grid-inputs-config">
                            <div class="grupo-form-config">
                                <label>Fator Lucro Standard</label>
                                <input type="number" id="p_fator_lucro_std" value="${config.financeiro.fatorLucroStandard || 1.1}" step="0.01" class="input-config">
                                <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Sobre M.O. Base</small>
                            </div>
                            <div class="grupo-form-config">
                                <label>Fator Lucro Premium</label>
                                <input type="number" id="p_fator_lucro_prm" value="${config.financeiro.fatorLucroPremium || 1.2}" step="0.01" class="input-config">
                                <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Sobre M.O. Total</small>
                            </div>
                            <div class="grupo-form-config">
                                <label>Lucro Mínimo (Trava R$)</label>
                                <input type="number" id="p_lucro_minimo" value="${config.financeiro.lucroMinimo || 2500}" class="input-config">
                                <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px;">Piso de segurança para obras pequenas.</small>
                            </div>
                            <div class="grupo-form-config">
                                <label>Alíquota de Imposto (%)</label>
                                <input type="number" id="p_imposto" value="${config.financeiro.imposto}" class="input-config">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Coluna Direita: Tabelas -->
                <div class="coluna-tabelas">
                    <!-- Tabela Mão de Obra -->
                    <div class="card-tecnico card-config">
                        <div class="secao-header">
                            <i class="fas fa-tools"></i>
                            <span>Mão de Obra (Custo Base)</span>
                            <button class="btn-icon-action" onclick="window.adicionarLinhaTabela('corpo_mo', 'mo')" title="Adicionar Faixa">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div class="table-responsive">
                            <table class="tabela-config">
                                <thead>
                                    <tr>
                                        <th>Até (Módulos)</th>
                                        <th>Valor (R$/mod)</th>
                                        <th style="width: 40px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="corpo_mo">
                                    ${config.tabelas.maoDeObra.map(f => `
                                        <tr>
                                            <td><input type="number" value="${f.limite}" class="input-tabela-config"></td>
                                            <td><input type="number" value="${f.unitario}" class="input-tabela-config"></td>
                                            <td><button onclick="window.removerLinhaTabela(this)" class="btn-icon-remove"><i class="fas fa-times"></i></button></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Tabela Materiais -->
                    <div class="card-tecnico card-config">
                        <div class="secao-header">
                            <i class="fas fa-box-open"></i>
                            <span>Materiais (Custo Fixo)</span>
                            <button class="btn-icon-action" onclick="window.adicionarLinhaTabela('corpo_materiais', 'mat')" title="Adicionar Faixa">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <div class="table-responsive">
                            <table class="tabela-config">
                                <thead>
                                    <tr>
                                        <th>Até (Módulos)</th>
                                        <th>Custo Total (R$)</th>
                                        <th style="width: 40px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="corpo_materiais">
                                    ${config.tabelas.materiais.map(f => `
                                        <tr>
                                            <td><input type="number" value="${f.limite}" class="input-tabela-config"></td>
                                            <td><input type="number" value="${f.custo}" class="input-tabela-config"></td>
                                            <td><button onclick="window.removerLinhaTabela(this)" class="btn-icon-remove"><i class="fas fa-times"></i></button></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// --- Funções Auxiliares Globais para o Painel de Premissas ---

window.adicionarLinhaTabela = function(tbodyId, tipo) {
    const tbody = document.getElementById(tbodyId);
    const tr = document.createElement('tr');
    if (tipo === 'mo') {
        tr.innerHTML = `
            <td><input type="number" value="0" class="input-tabela-config"></td>
            <td><input type="number" value="0" class="input-tabela-config"></td>
            <td><button onclick="window.removerLinhaTabela(this)" class="btn-icon-remove"><i class="fas fa-times"></i></button></td>
        `;
    } else {
        tr.innerHTML = `
            <td><input type="number" value="0" class="input-tabela-config"></td>
            <td><input type="number" value="0" class="input-tabela-config"></td>
            <td><button onclick="window.removerLinhaTabela(this)" class="btn-icon-remove"><i class="fas fa-times"></i></button></td>
        `;
    }
    tbody.appendChild(tr);
};

window.removerLinhaTabela = function(btn) {
    btn.closest('tr').remove();
};

window.salvarPremissas = function() {
    const lerTabela = (id, campos) => {
        const linhas = document.querySelectorAll(`#${id} tr`);
        return Array.from(linhas).map(tr => {
            const inputs = tr.querySelectorAll('input');
            const obj = {};
            campos.forEach((campo, i) => obj[campo] = parseFloat(inputs[i].value) || 0);
            return obj;
        }).sort((a, b) => a.limite - b.limite); // Ordena por limite para garantir a lógica de faixas
    };

    const config = {
        engenharia: {
            eficienciaInversor: parseFloat(document.getElementById('p_eficiencia_inversor').value) || 98,
            perdaTempInversor: parseFloat(document.getElementById('p_perda_temp_inversor').value) || 1.5,
            perdaTempModulos: parseFloat(document.getElementById('p_perda_temp_modulos').value) || 10.13,
            cabos: parseFloat(document.getElementById('p_cabos').value) || 2.0,
            outros: parseFloat(document.getElementById('p_outros').value) || 2.0,
            indisponibilidade: parseFloat(document.getElementById('p_indisponibilidade').value) || 0.5,
            azimute: parseFloat(document.getElementById('p_azimute').value) || 0,
            inclinacao: parseFloat(document.getElementById('p_inclinacao').value) || 0,
            oversizingPadrao: parseFloat(document.getElementById('p_oversizing').value) || 50
        },
        // Captura os novos valores Premium
        materiaisPremium: {
            va_diaria_instalador: parseFloat(document.getElementById('va_diaria_instalador').value) || 0,
            va_qdg_mono_premium: parseFloat(document.getElementById('va_qdg_mono_premium').value) || 0,
            va_qdg_trif_premum: parseFloat(document.getElementById('va_qdg_trif_premum').value) || 0,
            va_eletrocalha_50: parseFloat(document.getElementById('va_eletrocalha_50').value) || 0,
            va_eletrocalha_100: parseFloat(document.getElementById('va_eletrocalha_100').value) || 0,
            va_bloco_distribuicao: parseFloat(document.getElementById('va_bloco_distribuicao').value) || 0,
            va_tampa_acrilico: parseFloat(document.getElementById('va_tampa_acrilico').value) || 0
        },
        estruturas: {
            va_estrutura_solo: parseFloat(document.getElementById('va_estrutura_solo').value) || 0,
            diaria_extra_solo: parseFloat(document.getElementById('diaria_extra_solo').value) || 0,
            va_estrutura_laje: parseFloat(document.getElementById('va_estrutura_laje').value) || 0,
            diaria_extra_laje: parseFloat(document.getElementById('diaria_extra_laje').value) || 0
        },
        financeiro: {
            fatorLucroStandard: parseFloat(document.getElementById('p_fator_lucro_std').value) || 1.1,
            fatorLucroPremium: parseFloat(document.getElementById('p_fator_lucro_prm').value) || 1.2,
            lucroMinimo: parseFloat(document.getElementById('p_lucro_minimo').value) || 2500,
            imposto: parseFloat(document.getElementById('p_imposto').value) || 0,
            precoCombustivel: parseFloat(document.getElementById('p_preco_combustivel').value) || 6.10,
            consumoVeiculo: parseFloat(document.getElementById('p_consumo_veiculo').value) || 8.5,
            kmSuprimentos: parseFloat(document.getElementById('p_km_suprimentos').value) || 15,
            kmAlmoco: parseFloat(document.getElementById('p_km_almoco').value) || 5,
            modulosPorDia: parseFloat(document.getElementById('p_modulos_dia').value) || 12,
            tempoExtraInversor: parseFloat(document.getElementById('p_tempo_inv_extra').value) || 0.5,
            diasMinimosObra: parseFloat(document.getElementById('p_dias_minimos').value) || 2
        },
        tabelas: {
            maoDeObra: lerTabela('corpo_mo', ['limite', 'unitario']),
            materiais: lerTabela('corpo_materiais', ['limite', 'custo'])
        }
    };

    db.salvarConfiguracao('premissas_globais', config);
    alert('Premissas globais atualizadas com sucesso! Novos projetos utilizarão estes valores.');
};

// Ação de Negócio: Iniciar Projeto (Vincula Cliente e Redireciona)
window.iniciarNovoProjeto = function(clienteId) {
    sessionStorage.setItem('cliente_ativo_id', clienteId);
    window.location.href = 'cadastro-projeto.html';
}

// ======================================================================
// AÇÕES DE EDIÇÃO (PLACEHOLDERS)
// ======================================================================

window.visualizarProjeto = function(id) {
    window.location.href = `projeto-detalhes.html?id=${id}`;
};

window.editarProjeto = function(id) {
    const projeto = db.buscarPorId('projetos', id);
    if (!projeto) {
        alert('Erro: Projeto não encontrado.');
        return;
    }
    // Prepara a sessão para a tela de dimensionamento
    sessionStorage.setItem('cliente_ativo_id', projeto.clienteId);
    sessionStorage.setItem('projeto_ativo_id', projeto.id);
    window.location.href = 'gerador-proposta.html';
};

window.excluirProjeto = function(id) {
    const projeto = db.buscarPorId('projetos', id);
    if (!projeto) {
        alert('Erro: Projeto não encontrado.');
        return;
    }
    if (confirm(`Tem certeza que deseja excluir o projeto "${projeto.nome_projeto}"? TODAS as propostas associadas a ele também serão removidas.`)) {
        // Excluir propostas relacionadas
        const propostasRelacionadas = db.buscarPorRelacao('propostas', 'projetoId', id);
        propostasRelacionadas.forEach(prop => {
            db.excluir('propostas', prop.id);
        });

        // Excluir o projeto
        db.excluir('projetos', id);

        // Recarregar o dashboard
        carregarDadosDashboard();
        alert('Projeto e propostas relacionadas foram excluídos.');
    }
};

window.visualizarProposta = function(id) {
    const proposta = db.buscarPorId('propostas', id);
    if (!proposta) return alert('Proposta não encontrada.');
    
    const projeto = db.buscarPorId('projetos', proposta.projetoId);
    if (!projeto) return alert('Projeto associado não encontrado.');

    const cliente = db.buscarPorId('clientes', projeto.clienteId);
    if (!cliente) return alert('Cliente associado não encontrado.');

    const primeiroNome = cliente.nome.split(' ')[0];
    window.location.href = `proposta.html?id=${projeto.id}&nome=${primeiroNome}`;
};

window.editarProposta = function(id) {
    const proposta = db.buscarPorId('propostas', id);
    if (!proposta) return alert('Proposta não encontrada.');
    
    const projeto = db.buscarPorId('projetos', proposta.projetoId);
    if (!projeto) return alert('Projeto associado não encontrado.');

    // Funciona da mesma forma que editar o projeto, levando para o dimensionador
    window.editarProjeto(projeto.id);
};

window.excluirProposta = function(id) {
    if (confirm('Tem certeza que deseja excluir esta proposta?')) {
        db.excluir('propostas', id);
        carregarDadosDashboard();
        alert('Proposta excluída.');
    }
};

// ======================================================================