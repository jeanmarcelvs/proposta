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

// Função migrada do antigo clientesController.js
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
    // Busca todas as configurações ou define valores padrão para não dar erro
    const config = db.buscarConfiguracao('premissas_globais') || {
        engenharia: { 
            eficienciaInversor: 98, perdaTempInversor: 1.5, perdaTempModulos: 10.13, 
            cabos: 2.0, outros: 2.0, indisponibilidade: 0.5, azimute: 0, inclinacao: 10, oversizingPadrao: 50 
        },
        materiaisPremium: {
            va_diaria_instalador: 390.00, va_qdg_mono_premium: 150.00, va_qdg_trif_premum: 300.00,
            va_eletrocalha_50: 85.00, va_eletrocalha_100: 158.00, va_bloco_distribuicao: 90.00, va_tampa_acrilico: 335.00
        },
        estruturas: {
            va_estrutura_solo: 125.00, diaria_extra_solo: 0.2, va_estrutura_laje: 55.00, diaria_extra_laje: 0.1
        },
        financeiro: { 
            imposto: 15, taxasComissao: { indicador: 3, representante: 5 }, 
            fatorLucroStandard: 1.1, fatorLucroPremium: 1.2, lucroMinimo: 2500,
            modulosPorDia: 10, tempoExtraInversor: 0.5, diasMinimosObra: 2, kmAlmoco: 5
        },
        logistica: {
            precoCombustivel: 6.29, consumoVeiculo: 8.7, kmSuprimentos: 12, adicionalLogistica: 20
        },
        tabelas: {
            materiais: [
                { limite: 20, custo: 1100 }, { limite: 25, custo: 1550 }, { limite: 30, custo: 2000 },
                { limite: 40, custo: 2450 }, { limite: 50, custo: 2750 }, { limite: 270, custo: 7700 }
            ],
            maoDeObra: [
                { limite: 10, unitario: 150 }, { limite: 11, unitario: 140 }, { limite: 12, unitario: 130 },
                { limite: 13, unitario: 120 }, { limite: 14, unitario: 115 }, { limite: 18, unitario: 110 },
                { limite: 22, unitario: 107 }, { limite: 26, unitario: 104 }, { limite: 30, unitario: 100 },
                { limite: 50, unitario: 95 }, { limite: 70, unitario: 90 }, { limite: 90, unitario: 85 },
                { limite: 9999, unitario: 80 }
            ]
        }
    };

    container.innerHTML = `
        <div class="card-tecnico">
            <div class="header-modulo">
                <h2><i class="fas fa-sliders-h"></i> Painel de Premissas de Engenharia</h2>
                <button class="btn-primary" onclick="salvarNovasPremissas()">
                    <i class="fas fa-save"></i> SALVAR TODAS AS CONFIGURAÇÕES
                </button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                
                <!-- COLUNA ESQUERDA: PARÂMETROS -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    
                    <!-- Componentes Premium -->
                    <div class="secao-config">
                        <h3 style="color:var(--primaria); border-bottom: 2px solid #eee; padding-bottom:10px;">
                            <i class="fas fa-gem"></i> Componentes Premium
                        </h3>
                        <div class="grid-inputs">
                            <div class="form-group">
                                <label>QDG Trifásico (R$)</label>
                                <input type="number" id="va_qdg_trif_premum" value="${config.materiaisPremium?.va_qdg_trif_premum || 300}" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>QDG Monofásico (R$)</label>
                                <input type="number" id="va_qdg_mono_premium" value="${config.materiaisPremium?.va_qdg_mono_premium || 150}" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Eletrocalha 100mm (R$)</label>
                                <input type="number" id="va_eletrocalha_100" value="${config.materiaisPremium?.va_eletrocalha_100 || 158}" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Eletrocalha 50mm (R$)</label>
                                <input type="number" id="va_eletrocalha_50" value="${config.materiaisPremium?.va_eletrocalha_50 || 85}" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Tampa Acrílico (R$)</label>
                                <input type="number" id="va_tampa_acrilico" value="${config.materiaisPremium?.va_tampa_acrilico || 335}" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Bloco Distribuição (R$)</label>
                                <input type="number" id="va_bloco_distribuicao" value="${config.materiaisPremium?.va_bloco_distribuicao || 90}" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Diária Instalador (R$)</label>
                                <input type="number" id="va_diaria_instalador" value="${config.materiaisPremium?.va_diaria_instalador || 390}" class="input-estilizado">
                            </div>
                        </div>
                    </div>

                    <!-- Logística -->
                    <div class="secao-config">
                        <h3 style="color:var(--primaria); border-bottom: 2px solid #eee; padding-bottom:10px;">
                            <i class="fas fa-truck"></i> Logística e Deslocamento
                        </h3>
                        <div class="grid-inputs">
                            <div class="form-group">
                                <label>Preço Combustível (R$/L)</label>
                                <input type="number" id="p_preco_combustivel" value="${config.logistica?.precoCombustivel || 6.29}" step="0.01" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Consumo Veículo (km/L)</label>
                                <input type="number" id="p_consumo_veiculo" value="${config.logistica?.consumoVeiculo || 8.7}" step="0.1" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Adicional Fixo (R$)</label>
                                <input type="number" id="p_adicional_logistica" value="${config.logistica?.adicionalLogistica || 20}" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Produtividade (Mód/Dia)</label>
                                <input type="number" id="p_modulos_dia" value="${config.financeiro?.modulosPorDia || 10}" class="input-estilizado">
                            </div>
                        </div>
                    </div>

                    <!-- Financeiro & Comissões -->
                    <div class="secao-config">
                        <h3 style="color:var(--primaria); border-bottom: 2px solid #eee; padding-bottom:10px;">
                            <i class="fas fa-hand-holding-usd"></i> Financeiro & Comissões
                        </h3>
                        <div class="grid-inputs">
                            <div class="form-group">
                                <label>Fator Lucro Standard</label>
                                <input type="number" id="p_lucro_standard" value="${config.financeiro?.fatorLucroStandard || 1.1}" step="0.01" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Fator Lucro Premium</label>
                                <input type="number" id="p_lucro_premium" value="${config.financeiro?.fatorLucroPremium || 1.2}" step="0.01" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Piso de Lucro (R$)</label>
                                <input type="number" id="p_lucro_minimo" value="${config.financeiro?.lucroMinimo || 0}" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Imposto (%)</label>
                                <input type="number" id="p_imposto" value="${config.financeiro?.imposto || 15}" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Comissão Indicação (%)</label>
                                <input type="number" id="p_comissao_indicador" value="${config.financeiro?.taxasComissao?.indicador || 3}" step="0.1" class="input-estilizado">
                            </div>
                            <div class="form-group">
                                <label>Comissão Representante (%)</label>
                                <input type="number" id="p_comissao_representante" value="${config.financeiro?.taxasComissao?.representante || 5}" step="0.1" class="input-estilizado">
                            </div>
                        </div>
                    </div>

                </div>

                <!-- COLUNA DIREITA: TABELAS -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    
                    <!-- Tabela Mão de Obra (Terceirizada) -->
                    <div class="secao-config">
                        <div class="secao-header" style="display:flex; justify-content:space-between; align-items:center;">
                            <h3 style="margin:0; color:var(--primaria);"><i class="fas fa-users-cog"></i> Tabela M.O. (Terceirizada)</h3>
                            <button class="btn-icon" onclick="window.adicionarLinhaTabela('corpo_mo', 'mo')" title="Adicionar Faixa"><i class="fas fa-plus"></i></button>
                        </div>
                        <div class="tabela-container" style="max-height: 300px; overflow-y: auto;">
                            <table class="tabela-tecnica">
                                <thead>
                                    <tr><th>Até (Módulos)</th><th>Valor (R$/mód)</th><th></th></tr>
                                </thead>
                                <tbody id="corpo_mo">
                                    ${(config.tabelas?.maoDeObra || []).map(f => `
                                        <tr>
                                            <td><input type="number" value="${f.limite}" class="input-estilizado" style="height:28px; padding:4px;"></td>
                                            <td><input type="number" value="${f.unitario}" class="input-estilizado" style="height:28px; padding:4px;"></td>
                                            <td><button onclick="window.removerLinhaTabela(this)" class="btn-icon"><i class="fas fa-times"></i></button></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Tabela Materiais -->
                    <div class="secao-config">
                        <div class="secao-header" style="display:flex; justify-content:space-between; align-items:center;">
                            <h3 style="margin:0; color:var(--primaria);"><i class="fas fa-box-open"></i> Tabela Materiais Base</h3>
                            <button class="btn-icon" onclick="window.adicionarLinhaTabela('corpo_materiais', 'mat')" title="Adicionar Faixa"><i class="fas fa-plus"></i></button>
                        </div>
                        <div class="tabela-container" style="max-height: 300px; overflow-y: auto;">
                            <table class="tabela-tecnica">
                                <thead>
                                    <tr><th>Até (Módulos)</th><th>Custo Total (R$)</th><th></th></tr>
                                </thead>
                                <tbody id="corpo_materiais">
                                    ${(config.tabelas?.materiais || []).map(f => `
                                        <tr>
                                            <td><input type="number" value="${f.limite}" class="input-estilizado" style="height:28px; padding:4px;"></td>
                                            <td><input type="number" value="${f.custo}" class="input-estilizado" style="height:28px; padding:4px;"></td>
                                            <td><button onclick="window.removerLinhaTabela(this)" class="btn-icon"><i class="fas fa-times"></i></button></td>
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

// --- Funções Auxiliares para Tabelas ---
window.adicionarLinhaTabela = function(tbodyId, tipo) {
    const tbody = document.getElementById(tbodyId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" value="0" class="input-estilizado" style="height:28px; padding:4px;"></td>
        <td><input type="number" value="0" class="input-estilizado" style="height:28px; padding:4px;"></td>
        <td><button onclick="window.removerLinhaTabela(this)" class="btn-icon"><i class="fas fa-times"></i></button></td>
    `;
    tbody.appendChild(tr);
};

window.removerLinhaTabela = function(btn) {
    btn.closest('tr').remove();
};

window.salvarNovasPremissas = function() {
    // Busca a configuração atual para não perder dados de outras seções (ex: engenharia, tabelas)
    const configAtual = db.buscarConfiguracao('premissas_globais') || {};

    // Helper para ler tabelas
    const lerTabela = (id, campos) => {
        const linhas = document.querySelectorAll(`#${id} tr`);
        return Array.from(linhas).map(tr => {
            const inputs = tr.querySelectorAll('input');
            const obj = {};
            campos.forEach((campo, i) => obj[campo] = parseFloat(inputs[i].value) || 0);
            return obj;
        }).sort((a, b) => a.limite - b.limite);
    };
    
    const novasPremissas = {
        ...configAtual,
        financeiro: {
            ...configAtual.financeiro,
            imposto: parseFloat(document.getElementById('p_imposto').value) || 0,
            fatorLucroStandard: parseFloat(document.getElementById('p_lucro_standard').value) || 1.1,
            fatorLucroPremium: parseFloat(document.getElementById('p_lucro_premium').value) || 1.1,
            lucroMinimo: parseFloat(document.getElementById('p_lucro_minimo').value) || 0,
            modulosPorDia: parseFloat(document.getElementById('p_modulos_dia').value) || 10,
            taxasComissao: {
                indicador: parseFloat(document.getElementById('p_comissao_indicador').value) || 0,
                representante: parseFloat(document.getElementById('p_comissao_representante').value) || 0
            }
        },
        logistica: {
            ...configAtual.logistica,
            precoCombustivel: parseFloat(document.getElementById('p_preco_combustivel').value) || 6.29,
            consumoVeiculo: parseFloat(document.getElementById('p_consumo_veiculo').value) || 8.7,
            adicionalLogistica: parseFloat(document.getElementById('p_adicional_logistica').value) || 20
        },
        materiaisPremium: {
            va_diaria_instalador: parseFloat(document.getElementById('va_diaria_instalador').value) || 0,
            va_qdg_mono_premium: parseFloat(document.getElementById('va_qdg_mono_premium').value) || 0,
            va_qdg_trif_premum: parseFloat(document.getElementById('va_qdg_trif_premum').value) || 0,
            va_eletrocalha_50: parseFloat(document.getElementById('va_eletrocalha_50').value) || 0,
            va_eletrocalha_100: parseFloat(document.getElementById('va_eletrocalha_100').value) || 0,
            va_bloco_distribuicao: parseFloat(document.getElementById('va_bloco_distribuicao').value) || 0,
            va_tampa_acrilico: parseFloat(document.getElementById('va_tampa_acrilico').value) || 0
        },
        tabelas: {
            maoDeObra: lerTabela('corpo_mo', ['limite', 'unitario']),
            materiais: lerTabela('corpo_materiais', ['limite', 'custo'])
        }
    };

    if (db.salvarConfiguracao('premissas_globais', novasPremissas)) {
        alert("Configurações atualizadas com sucesso!");
        navegar('premissas');
    }
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
    sessionStorage.setItem('proposta_ativa_id', id); // Adiciona o ID da proposta
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