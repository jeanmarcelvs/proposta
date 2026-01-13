import db from './databaseService.js';
import { baseDadosAlagoas, obterHSPBruto, calcularRendimentoCientifico, dimensionarSistema, post, MODELOS_FOCO, calcularCustoMateriaisBasicos, calcularMaoObraBase, calcularCustoLogistica, calcularExpansaoInversor, CATALOGO_INVERSORES_HUAWEI } from './model.js';
import { coordenadasEstados } from './coordenadasEstados.js'; // Mantido para fallback
import { higienizarParaCalculo } from './utils.js';

// Trava de Segurança
if (!sessionStorage.getItem('auth_belenergy')) {
    window.location.href = 'central-belenergy.html';
}

const inversoresHuawei = CATALOGO_INVERSORES_HUAWEI;

document.addEventListener('DOMContentLoaded', async () => {
    // --- LÓGICA DE CARGA RELACIONAL ---
    const clienteId = sessionStorage.getItem('cliente_ativo_id');
    const projetoId = sessionStorage.getItem('projeto_ativo_id');

    if (!clienteId || !projetoId) {
        alert("Dados do cliente ou projeto não encontrados. Retornando para a lista.");
        window.location.href = 'clientes-lista.html';
        return;
    }

    const cliente = db.listar('clientes').find(c => c.id === clienteId);
    const projeto = db.listar('projetos').find(p => p.id === projetoId);

    // Monta o objeto completo para o dimensionamento
    const projetoCompleto = { ...cliente, projeto: projeto };

    if (!projetoCompleto) {
        alert("Dados do projeto não encontrados. Reinicie o processo.");
        window.location.href = 'cadastro-cliente.html';
        return;
    }

    // --- Elementos da Interface ---
    const inputConsumo = document.getElementById('uc_consumo');
    const inputHSPBruto = document.getElementById('hsp_bruto');
    const pEficiInv = document.getElementById('p_efici_inv'); // Eficiência do Inversor
    const pTempInv = document.getElementById('p_temp_inv'); // Perda por Temperatura no Inversor
    const pTempMod = document.getElementById('p_temp_mod'); // Perda Temp. Módulos
    const pCabosTotal = document.getElementById('p_cabos_total'); // Perdas em Cabos
    const pExtras = document.getElementById('p_extras'); // Outras perdas (Sujidade, Sombreamento)
    const pIndisp = document.getElementById('p_indisp'); // Indisponibilidade
    const selectModulo = document.getElementById('select_modulo_comparativo');
    const totalModulosDisplay = document.getElementById('total_modulos_projeto');
    const btnGerarProposta = document.getElementById('btn_gerar_proposta');
    const msgValidacaoElement = document.getElementById('msg_validacao'); // FIX: Referência global para evitar perda no DOM
    const inputTipoLigacao = document.getElementById('uc_tipo_padrao');

    // Elementos da nova tabela
    const containerSugestaoPainel = document.getElementById('container_sugestao_painel'); // Agora um card
    const displayModuloSelecionado = document.getElementById('display_modulo_selecionado');
    const wrapperEtapaTecnica = document.getElementById('wrapper-etapa-tecnica');
    const wrapperEtapaFinanceira = document.getElementById('wrapper-etapa-financeira');

    // --- Elementos do Painel Fixo ---
    const fixoPotMinima = document.getElementById('fixo_p_minima');
    const fixoPotReal = document.getElementById('fixo_p_real');
    const fixoGeracao = document.getElementById('fixo_geracao');
    const fixoPr = document.getElementById('fixo_pr_final');
    const fixoTipoRede = document.getElementById('fixo_tipo_rede');

    // --- PREENCHIMENTO AUTOMÁTICO (Dados do Projeto) ---
    // Injeta os dados de consumo e tipo de ligação nos inputs ocultos
    if (inputConsumo) {
        inputConsumo.value = projeto.consumo || 0;
    }
    if (inputTipoLigacao) {
        inputTipoLigacao.value = projeto.tipoLigacao || 'monofasico';
    }

    // --- Variáveis de Estado ---
    // ESTRUTURA DE PROPOSTA DUPLA (PREPARADA PARA D1)
    let projetoGerenciador = {
        tipoEscopo: '', // 'STANDARD', 'PREMIUM', 'AMBAS'
        abaAtiva: 'standard', // 'standard' ou 'premium'
        modoDuplo: false,
        standard: {
            selecionado: false,
            dados: { inversores: [], modulo: null, financeiro: {}, precoCalculado: false, etapaIndex: 1, maxEtapaIndex: 1 }
        },
        premium: {
            selecionado: false,
            dados: { inversores: [], modulo: null, financeiro: {}, precoCalculado: false, etapaIndex: 1, maxEtapaIndex: 1 }
        }
    };

    let hspBruto = 0;
    let latitude = 0;
    let dimensionamentoCompleto = null;
    let modoOrientacao = 'simples'; // 'simples' ou 'composto'

    // Novo estado para o carrinho
    let carrinhoInversores = [];

    // Estado visual da seleção de inversores (UX)
    let estadoSelecaoInversor = { tipo: null, id: null }; // tipo: 'SUGESTAO' | 'MANUAL'
    let estadoSelecaoModulo = { watts: null, qtd: null }; // Estado visual dos módulos
    let statusTecnicoSistema = { valido: false, nivel: 'OK', mensagem: '' }; // Estado de integridade técnica

    // ======================================================================
    // 🔒 GERENCIADOR DE ETAPAS (SEGURANÇA EM CASCATA)
    // ======================================================================
    const gerenciadorEtapas = {
        // Mapeamento de índices para nomes lógicos das etapas
        ordem: ['premissas', 'modulos', 'inversores', 'financeiro', 'resumo'],
        labels: ['Premissas', 'Módulos', 'Inversores', 'Financeiro', 'Resumo'], // Labels para o menu

        etapas: {
            premissas: ['container_dimensionamento'],
            modulos: ['container_sugestao_painel'],
            inversores: ['card-dimensionamento-inversor'],
            financeiro: ['wrapper-etapa-financeira'],
            resumo: ['secao_resumo_executivo', 'container-acao-final']
        },

        // Armazena o estado dos dados ao entrar na edição para comparação posterior
        snapshotEstado: null,

        // Método de compatibilidade para chamadas antigas (evita TypeError)
        travar: function (etapa) {
            // Mapeia 'travar' para 'avancarPara' a próxima etapa lógica
            const indiceAtual = this.ordem.indexOf(etapa);
            if (indiceAtual > -1 && indiceAtual < this.ordem.length - 1) {
                this.avancarPara(this.ordem[indiceAtual + 1]);
            }
        },

        destravar: function (etapa) {
            this.recuarPara(etapa);
        },

        // Atualiza a interface baseada no índice da etapa atual da aba ativa (Lógica N-1)
        sincronizarVisual: function (rolarParaTopo = true) {
            const aba = projetoGerenciador.abaAtiva;
            if (!aba || !projetoGerenciador[aba]) return;

            const indiceAtual = projetoGerenciador[aba].dados.etapaIndex || 0;

            console.log("DEBUG: Sincronizando Visual. Etapa atual:", this.ordem[indiceAtual]);

            // FIX: Safeguard para garantir renderização dos módulos ao voltar
            if (this.ordem[indiceAtual] === 'modulos') {
                const container = document.getElementById('container_sugestao_painel');
                // Verifica se o container está vazio, sem cards ou com mensagem de aguardando
                if (container && (!container.querySelector('.card-modulo') || container.innerHTML.includes('Aguardando'))) {
                    console.log("Safeguard: Restaurando estrutura visual de módulos...");
                    if (dimensionamentoCompleto) {
                        processarEscolhaModulo(dimensionamentoCompleto);
                    }
                }
            }

            this.ordem.forEach((nomeEtapa, index) => {
                const ids = this.etapas[nomeEtapa];
                if (!ids) return;

                const isEtapaAtual = index === indiceAtual;
                let botaoVoltarAdicionado = false; // Flag para garantir apenas um botão voltar por etapa

                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;

                    // Limpeza de estilos antigos de bloqueio/overlay
                    const overlayAntigo = el.querySelector('.overlay-desbloqueio');
                    if (overlayAntigo) overlayAntigo.remove();

                    // Limpeza de botões de navegação antigos (para evitar duplicação)
                    const navAntiga = el.querySelector('.nav-etapa-container');
                    if (navAntiga) navAntiga.remove();

                    // LÓGICA PRINCIPAL: Mostrar apenas a etapa atual
                    if (isEtapaAtual) {
                        // Substituição de style.display por classes do engenharia.css
                        el.classList.remove('etapa-oculta');
                        el.classList.add('etapa-ativa');
                        el.style.display = ''; // Remove display:none inline se houver

                        // Reseta estilos visuais de bloqueio (caso existam no CSS)
                        el.classList.remove('card-bloqueado', 'etapa-bloqueada');

                        // Injeta botão de VOLTAR se não for a primeira etapa e ainda não foi adicionado nesta etapa
                        if (index > 0 && !botaoVoltarAdicionado) {
                            this.injetarBotaoVoltar(el, this.ordem[index - 1]);
                            botaoVoltarAdicionado = true;
                        }
                    } else {
                        // ETAPA FUTURA OU PASSADA: Oculta para focar na atual
                        el.classList.remove('etapa-ativa');
                        el.classList.add('etapa-oculta');
                    }
                });
            });

            // Rola para o topo para manter o foco na etapa atual
            if (rolarParaTopo) {
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
            }

            // Renderiza o menu de navegação atualizado
            this.renderizarMenuNavegacao();

            // --- REVALIDAÇÃO DE ESTADO DOS BOTÕES (FIX: Garante estado correto ao navegar) ---
            const nomeEtapaAtual = this.ordem[indiceAtual];
            if (nomeEtapaAtual === 'premissas') {
                if (typeof atualizarEstadoBotaoPremissas === 'function') atualizarEstadoBotaoPremissas();
            } 
            else if (nomeEtapaAtual === 'modulos') {
                const temSelecao = !!(estadoSelecaoModulo.watts && estadoSelecaoModulo.qtd);
                if (typeof renderizarBotaoNavegacao === 'function') {
                    renderizarBotaoNavegacao('container_sugestao_painel', 'window.avancarParaInversores()', temSelecao ? 'Configuração de Módulos Definida' : 'Selecione um Módulo', 'Avançar para Inversores', temSelecao);
                }
            } 
            else if (nomeEtapaAtual === 'inversores') {
                if (typeof atualizarComposicaoFinal === 'function') atualizarComposicaoFinal();
            } 
            else if (nomeEtapaAtual === 'financeiro') {
                const isPrecoOk = projetoGerenciador[aba].dados.precoCalculado;
                if (typeof renderizarBotaoNavegacao === 'function') {
                    renderizarBotaoNavegacao('wrapper-etapa-financeira', 'window.avancarParaResumo()', isPrecoOk ? 'Análise Financeira Concluída' : 'Defina o Valor do Kit', 'Ver Resumo e Salvar', isPrecoOk);
                }
            }
        },

        // Helper para criar o botão de voltar visualmente integrado
        injetarBotaoVoltar: function (elementoPai, nomeEtapaAnterior) {
            const containerNav = document.createElement('div');
            containerNav.className = 'nav-etapa-container';
            // Estilo movido para CSS (.nav-etapa-container)

            const btnVoltar = document.createElement('button');
            btnVoltar.innerHTML = `<i class="fas fa-arrow-left"></i> Voltar para ${nomeEtapaAnterior.charAt(0).toUpperCase() + nomeEtapaAnterior.slice(1)}`;
            btnVoltar.onclick = () => window.voltarEtapa();
            
            // Substituição de estilos inline por classe CSS
            btnVoltar.className = 'btn-voltar-etapa';

            containerNav.appendChild(btnVoltar);
            elementoPai.insertBefore(containerNav, elementoPai.firstChild);
        },

        // Avança para a próxima etapa (Forward)
        avancarPara: function (nomeEtapa) {
            const novoIndice = this.ordem.indexOf(nomeEtapa);
            const aba = projetoGerenciador.abaAtiva;
            if (novoIndice > -1 && projetoGerenciador[aba]) {
                // Garante que existe um índice numérico válido (fallback para 0)
                const indiceAtual = projetoGerenciador[aba].dados.etapaIndex || 0;

                // CORREÇÃO SCROLL: Só sincroniza visualmente (scroll top) se houver mudança real de etapa.
                // Isso evita que ações dentro da mesma etapa (como selecionar painel) rolem a tela.
                if (novoIndice > indiceAtual) {
                    // Atualiza o máximo alcançado se estiver avançando
                    if (novoIndice > (projetoGerenciador[aba].dados.maxEtapaIndex || 0)) {
                        projetoGerenciador[aba].dados.maxEtapaIndex = novoIndice;
                    }

                    projetoGerenciador[aba].dados.etapaIndex = novoIndice;
                    this.sincronizarVisual();

                    // Atualiza o header se estivermos no resumo
                    atualizarHeaderResumo(this.ordem[novoIndice] === 'resumo');
                }
            }
        },

        // Navegação direta via Menu (Salta para qualquer etapa permitida)
        irPara: function (indiceAlvo) {
            const aba = projetoGerenciador.abaAtiva;
            if (!projetoGerenciador[aba]) return;

            const maxPermitido = projetoGerenciador[aba].dados.maxEtapaIndex || 0;

            // Só permite ir se o índice alvo for menor ou igual ao máximo já alcançado
            if (indiceAlvo <= maxPermitido) {
                // FIX: Se estiver voltando para uma etapa anterior, captura o snapshot para detecção de mudanças
                const indiceAtual = projetoGerenciador[aba].dados.etapaIndex || 0;
                if (indiceAlvo < indiceAtual) {
                    const nomeEtapaAlvo = this.ordem[indiceAlvo];
                    this.snapshotEstado = this.capturarEstado(nomeEtapaAlvo);
                    console.log(`Navegação via Menu para ${nomeEtapaAlvo}. Snapshot criado.`);
                }

                projetoGerenciador[aba].dados.etapaIndex = indiceAlvo;
                this.sincronizarVisual();

                // Atualiza o header se estivermos entrando ou saindo do resumo
                atualizarHeaderResumo(this.ordem[indiceAlvo] === 'resumo');
            }
        },

        // Recua para uma etapa específica SEM resetar imediatamente (Snapshot para Dirty Check)
        recuarPara: function (nomeEtapa) {
            const novoIndice = this.ordem.indexOf(nomeEtapa);
            const aba = projetoGerenciador.abaAtiva;

            if (novoIndice > -1 && projetoGerenciador[aba]) {
                // 1. Captura o estado ATUAL da etapa para a qual estamos voltando
                // Isso serve para comparar depois se o usuário mudou algo ou não
                this.snapshotEstado = this.capturarEstado(nomeEtapa);
                console.log(`Voltando para ${nomeEtapa}. Snapshot criado para detecção de mudanças.`);

                // 2. Apenas recua o índice visualmente
                projetoGerenciador[aba].dados.etapaIndex = novoIndice;
                this.sincronizarVisual();

                // Atualiza o header (provavelmente saindo do resumo)
                atualizarHeaderResumo(this.ordem[novoIndice] === 'resumo');
            }
        },

        // Limpa dados das etapas futuras (chamado apenas se houver alteração)
        limparCascataFutura: function (etapaAtual) {
            const indiceAtual = this.ordem.indexOf(etapaAtual);
            // Limpa tudo DA PRÓXIMA etapa em diante
            const aba = projetoGerenciador.abaAtiva;

            // Reseta o progresso máximo para a etapa atual, pois o futuro foi invalidado
            if (projetoGerenciador[aba]) {
                projetoGerenciador[aba].dados.maxEtapaIndex = indiceAtual;
            }

            for (let i = this.ordem.length - 1; i > indiceAtual; i--) {
                const etapaNome = this.ordem[i];
                console.log(`Resetando etapa futura: ${etapaNome}`);
                if (etapaNome === 'modulos') {
                    console.error("DEBUG CRÍTICO: A etapa [" + etapaAtual + "] disparou um RESET na etapa [modulos]. Verifique se o snapshot de premissas está correto.");
                }
                this.limparDadosEtapa(etapaNome);
            }
        },

        // Captura uma "foto" dos dados críticos da etapa para comparação
        capturarEstado: function (etapa) {
            if (etapa === 'premissas') {
                return JSON.stringify({
                    consumo: document.getElementById('uc_consumo')?.value,
                    hsp: document.getElementById('hsp_bruto')?.innerText,
                    azimute: document.getElementById('azimute_geral')?.value,
                    inclinacao: document.getElementById('inclinacao_geral')?.value,
                    perdas: [
                        document.getElementById('p_efici_inv')?.value,
                        document.getElementById('p_temp_inv')?.value,
                        document.getElementById('p_temp_mod')?.value,
                        document.getElementById('p_cabos_total')?.value
                    ]
                });
            } else if (etapa === 'modulos') {
                return JSON.stringify(estadoSelecaoModulo);
            }
            return null;
        },

        // Verifica se o estado atual difere do snapshot salvo
        houveAlteracao: function (etapa) {
            const estadoAtual = this.capturarEstado(etapa);
            return estadoAtual !== this.snapshotEstado;
        },

        // Função auxiliar para limpar dados específicos de cada etapa
        limparDadosEtapa: function (etapa) {
            if (etapa === 'financeiro') {
                limparFinanceiro();
            } else if (etapa === 'inversores') {
                carrinhoInversores = [];
                estadoSelecaoInversor = { tipo: null, id: null };
                renderizarTabelaHuawei();
                atualizarComposicaoFinal();
            } else if (etapa === 'modulos') {
                limparSelecaoModulos();
                estadoSelecaoModulo = { watts: null, qtd: null };
                zerarInterfaceTecnica();
            }
        },

        // Renderiza o menu de navegação logo após o header fixo
        renderizarMenuNavegacao: function () {
            const aba = projetoGerenciador.abaAtiva;
            if (!aba || !projetoGerenciador[aba]) return;

            const dados = projetoGerenciador[aba].dados;
            const indiceAtual = dados.etapaIndex || 0;
            const maxAlcancado = dados.maxEtapaIndex || 0;

            // Busca ou cria o container do menu
            let menuContainer = document.getElementById('menu_navegacao_etapas');

            // Busca o wrapper sticky criado pelo cabeçalho de contexto
            const stickyWrapper = document.getElementById('sticky_wrapper_contexto');

            if (!menuContainer) {
                menuContainer = document.createElement('div');
                menuContainer.id = 'menu_navegacao_etapas';

                if (stickyWrapper) {
                    // Se o wrapper existe, o menu vai dentro dele (abaixo do contexto)
                    stickyWrapper.appendChild(menuContainer);
                } else {
                    // Fallback: insere no topo do wrapper principal
                    const main = document.querySelector('main') || document.body;
                    main.insertBefore(menuContainer, main.firstChild);
                }
            } else if (stickyWrapper && menuContainer.parentNode !== stickyWrapper) {
                // Se o menu já existe mas não está no wrapper (ex: recarregamento), move ele
                stickyWrapper.appendChild(menuContainer);
            }

            // Estilos do container
            menuContainer.className = 'menu-etapas-container';
            // Estilos movidos para CSS (.menu-etapas-container)

            let html = '';
            this.labels.forEach((label, index) => {
                const isAtivo = index === indiceAtual;
                const isAcessivel = index <= maxAlcancado;
                const isPassado = index < indiceAtual;

                // Definição de classes baseada no estado
                let classe = 'item-etapa ' + (isAtivo ? 'ativo' : (isAcessivel ? 'acessivel' : 'bloqueado'));

                const onclick = isAcessivel ? `onclick="window.navegarPeloMenu(${index})"` : '';
                const icone = isPassado ? '<i class="fas fa-check" style="font-size: 0.7rem; margin-right: 5px;"></i>' : `<span style="margin-right: 5px; opacity: 0.7;">${index + 1}.</span>`;

                html += `<div class="${classe}" ${onclick}>${icone}${label}</div>`;

                // Separador visual (opcional)
                if (index < this.labels.length - 1) {
                    html += `<div class="separador-etapa"><i class="fas fa-chevron-right"></i></div>`;
                }
            });

            menuContainer.innerHTML = html;
        }
    };

    // NOVA FUNÇÃO: Gerencia a exibição do botão no header durante o resumo
    function atualizarHeaderResumo(isResumo) {
        const btn = document.getElementById('btn_gerar_proposta');
        const cabecalhoContexto = document.getElementById('cabecalho_contexto_projeto');
        // Tenta encontrar o container de stats. Assumindo estrutura comum de dashboard.
        // Se não encontrar classe específica, usa o parent do fixoPotReal como referência.
        const containerStats = document.querySelector('.area-indicadores-fixos') || fixoPotReal?.parentElement?.parentElement;
        const headerContainer = document.querySelector('.painel-fixo') || containerStats?.parentElement;

        if (!btn || !containerStats || !headerContainer) return;

        if (isResumo) {
            containerStats.style.display = 'none'; // Oculta os números
            // Move o botão para o header
            headerContainer.appendChild(btn);
            btn.classList.add('btn-header-destaque'); // Classe para estilizar no header

            // Oculta o cabeçalho de contexto no resumo para limpar a visão
            if (cabecalhoContexto) cabecalhoContexto.style.display = 'none';
        } else {
            containerStats.style.display = ''; // Mostra os números
            // Devolve o botão para o final da página
            const containerOriginal = document.getElementById('container_botao_salvar_final');
            if (containerOriginal) containerOriginal.appendChild(btn);
            btn.classList.remove('btn-header-destaque');

            // Mostra o cabeçalho de contexto nas outras etapas
            if (cabecalhoContexto) cabecalhoContexto.style.display = 'flex';
        }
    }

    // NOVA FUNÇÃO: Exposta globalmente para o onclick do HTML gerado
    window.navegarPeloMenu = function (index) {
        if (typeof gerenciadorEtapas !== 'undefined') {
            gerenciadorEtapas.irPara(index);
        }
    };

    // NOVA FUNÇÃO: Voltar Etapa (Genérica)
    window.voltarEtapa = function () {
        const aba = projetoGerenciador.abaAtiva;
        if (!aba || !projetoGerenciador[aba]) return;

        const indiceAtual = projetoGerenciador[aba].dados.etapaIndex;
        if (indiceAtual > 0) {
            const etapaAnterior = gerenciadorEtapas.ordem[indiceAtual - 1];
            gerenciadorEtapas.recuarPara(etapaAnterior);
        }
    };

    // --- NOVA FUNÇÃO: CONFIRMAR PREMISSAS E AVANÇAR ---
    window.confirmarPremissasEAvançar = function () {
        console.log("Iniciando transição: Premissas -> Módulos");

        // 1. Antes de qualquer coisa, sincronizamos o snapshot para evitar resets falsos
        if (gerenciadorEtapas.houveAlteracao('premissas')) {
            console.warn("Mudança real detectada. Limpando apenas se necessário.");
            // Se mudou, precisamos recalcular, mas não podemos deixar o container vazio
            recalcularDimensionamento();
            processarEscolhaModulo(dimensionamentoCompleto);
        }

        // 2. FORÇA A EXIBIÇÃO DA GRID ANTES DE AVANÇAR
        const container = document.getElementById('container_sugestao_painel');
        if (container && (!container.querySelector('.grid-sugestoes') || container.innerHTML.includes('Aguardando'))) {
            console.log("Recuperando cards antes do avanço...");
            processarEscolhaModulo(dimensionamentoCompleto);
        }

        // 3. Garante que o CSS não está escondendo o container
        const wrapper = document.getElementById('wrapper-etapa-paineis');
        if (wrapper) {
            wrapper.classList.remove('etapa-oculta');
            wrapper.classList.add('etapa-ativa');
            wrapper.classList.remove('card-bloqueado', 'disabled');
        }

        gerenciadorEtapas.avancarPara('modulos');
    };

    // ======================================================================
    //  INICIALIZAÇÃO DE ESCOPO (GATEKEEPER)
    // ======================================================================

    function renderizarModalEscopo() {
        const modalHTML = `
            <div id="modal_inicial_escopo" class="modal-overlay-escopo">
                <div class="modal-content-escopo">
                    <div style="margin-bottom: 20px;">
                        <i class="fas fa-drafting-compass" style="font-size: 3rem; color: #FFD700;"></i>
                    </div>
                    <h3 style="font-size: 1.5rem; color: #0f172a; margin-bottom: 10px;">Definir Estratégia da Proposta</h3>
                    <p style="color: #64748b;">Selecione quais opções de investimento serão apresentadas ao cliente neste projeto:</p>
                    
                    <div class="opcoes-escopo">
                        <button onclick="window.configurarGerador('STANDARD')" class="btn-escopo">
                            <i class="fas fa-standard-definition"></i> Apenas Opção Standard
                        </button>
                        <button onclick="window.configurarGerador('PREMIUM')" class="btn-escopo">
                            <i class="fas fa-crown"></i> Apenas Opção Premium
                        </button>
                        <button onclick="window.configurarGerador('AMBAS')" class="btn-escopo btn-escopo-duplo">
                            <i class="fas fa-balance-scale"></i> Standard + Premium (Comparativa)
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    window.configurarGerador = function (modo) {
        // 1. Define no objeto global o que será processado (Schema D1)
        projetoGerenciador.tipoEscopo = modo;
        projetoGerenciador.modoDuplo = (modo === 'AMBAS');

        // 2. Manipulação Visual dos Botões do Header (Substitui as abas antigas)
        const btnStd = document.getElementById('btn_modo_std');
        const btnPrm = document.getElementById('btn_modo_prm');

        if (btnStd) btnStd.style.display = (modo === 'STANDARD' || modo === 'AMBAS') ? '' : 'none';
        if (btnPrm) btnPrm.style.display = (modo === 'PREMIUM' || modo === 'AMBAS') ? '' : 'none';

        // 3. Define qual aba deve ser a inicial
        let abaParaAbrir = (modo === 'PREMIUM') ? 'premium' : 'standard';

        // 4. Fecha o modal e inicia o gerador
        const modal = document.getElementById('modal_inicial_escopo');
        if (modal) modal.remove();

        // 5. Troca para a aba correta e limpa o topo
        // Precisamos garantir que o sistema saiba que mudou
        projetoGerenciador.abaAtiva = ''; // Força a troca
        window.trocarAbaProposta(abaParaAbrir);
    };

    // ======================================================================
    // � GERENCIAMENTO DE ABAS (STANDARD / PREMIUM)
    // ======================================================================

    window.trocarAbaProposta = function (novaAba) {
        if (projetoGerenciador.abaAtiva === novaAba) return;

        // 1. Salva o estado da aba atual
        salvarEstadoAbaAtual();

        // 2. Troca a referência
        projetoGerenciador.abaAtiva = novaAba;

        // --- ATUALIZAÇÃO VISUAL (MODO PREMIUM) ---
        if (novaAba === 'premium') {
            document.body.classList.add('modo-premium');
        } else {
            document.body.classList.remove('modo-premium');
        }

        // Sincroniza os botões do cabeçalho (novo método com data-aba)
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-aba') === novaAba);
        });

        // 3. O SEGREDO: Remove 'active' de todos os conteúdos e mostra só o alvo
        document.querySelectorAll('.aba-content').forEach(content => {
            if(content.getAttribute('data-aba') === novaAba) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
        console.log("Navegando para aba:", novaAba);
        // 4. Carrega o estado da nova aba
        carregarEstadoAba(novaAba);

        // 5. Atualiza a interface financeira (Preço muda conforme a aba)
        if (carrinhoInversores.length > 0) {
            window.calcularEngenhariaFinanceira();
        }

        // 6. Recalcula a engenharia para aplicar premissas globais (Azimute/Inclinação) à aba carregada
        if (estadoSelecaoModulo.watts) {
            recalcularDimensionamento();
        }

        // --- LÓGICA DE AUTOMAÇÃO UNIFICADA (STANDARD E PREMIUM) ---
        // Se a aba ainda não tem preço calculado (ou seja, está "virgem" ou incompleta),
        // executamos o fluxo de dimensionamento automático.
        const estadoNovaAba = projetoGerenciador[novaAba];
        if (estadoNovaAba && !estadoNovaAba.dados.precoCalculado) {
             console.log(`Iniciando automação para aba: ${novaAba}`);
             setTimeout(() => {
                 autoDimensionarCompleto();
             }, 200);
        }

        // FIX: Restaura a posição do botão no header se estivermos no resumo
        // O cálculo financeiro pode ter movido o botão para o container de resumo
        const estado = projetoGerenciador[novaAba];
        const indiceAtual = estado.dados.etapaIndex || 0;
        const isResumo = gerenciadorEtapas.ordem[indiceAtual] === 'resumo';
        atualizarHeaderResumo(isResumo);
    };

    function salvarEstadoAbaAtual() {
        const aba = projetoGerenciador.abaAtiva;

        // CORREÇÃO: Se a aba não estiver definida ou for inválida, não tenta salvar
        if (!aba || !projetoGerenciador[aba]) return;

        const estado = projetoGerenciador[aba];
        // FIX: Captura o índice atual antes de sobrescrever o objeto dados
        const indiceAtual = estado.dados.etapaIndex || 0;

        estado.selecionado = true;
        estado.dados = {
            inversores: [...carrinhoInversores],
            modulo: { ...estadoSelecaoModulo },
            estadoSelecaoInversor: { ...estadoSelecaoInversor }, // Salva o destaque do inversor
            valorKit: document.getElementById('valor_kit_fornecedor').value,
            fatorLucro: document.getElementById('prem_fator_lucro').value, // Salva o fator usado nesta aba
            precoCalculado: statusTecnicoSistema.valido && carrinhoInversores.length > 0,
            // FIX: Preserva o índice da etapa atual para não resetar o fluxo
            etapaIndex: indiceAtual,
            maxEtapaIndex: estado.dados.maxEtapaIndex || indiceAtual,
            // NOVO: Salva o resumo financeiro calculado para listagem rápida
            resumoFinanceiro: {
                valorTotal: parseFloat(document.getElementById('res_valor_total_proposta')?.innerText.replace(/[^\d,]/g, '').replace(',', '.')) || 0,
                potenciaTotal: parseFloat(document.getElementById('potencia_dc_total')?.innerText) || 0
            }
        };
    }

    function carregarEstadoAba(aba) {
        const estado = projetoGerenciador[aba];

        // Limpa variáveis temporárias
        carrinhoInversores = [];
        estadoSelecaoInversor = { tipo: null, id: null };
        estadoSelecaoModulo = { watts: null, qtd: null };

        // Limpa inputs ocultos por padrão (serão restaurados se houver dados)
        if (selectModulo) selectModulo.value = '';
        if (totalModulosDisplay) totalModulosDisplay.value = '';

        if (estado.selecionado) {
            // Restaura dados
            carrinhoInversores = [...estado.dados.inversores];
            estadoSelecaoModulo = { ...estado.dados.modulo };
            if (estado.dados.estadoSelecaoInversor) {
                estadoSelecaoInversor = { ...estado.dados.estadoSelecaoInversor };
            }

            document.getElementById('valor_kit_fornecedor').value = estado.dados.valorKit || '';

            // Restaura o fator de lucro salvo ou carrega o padrão da aba
            if (estado.dados.fatorLucro) {
                document.getElementById('prem_fator_lucro').value = estado.dados.fatorLucro;
            } else {
                // Se não tiver salvo, carrega o default global apropriado
                carregarFatorLucroPadrao(aba);
            }

            // Restaura visual dos módulos (Re-renderiza para aplicar a classe correta)
            if (dimensionamentoCompleto) {
                processarEscolhaModulo(dimensionamentoCompleto);
            }

            // Restaura inputs ocultos se houver seleção
            if (estadoSelecaoModulo.watts) {
                selectModulo.value = estadoSelecaoModulo.watts;
                totalModulosDisplay.value = estadoSelecaoModulo.qtd;

                // --- FIX: Atualiza Potência DC Total e Header ---
                const potDC = (estadoSelecaoModulo.watts * estadoSelecaoModulo.qtd);
                document.getElementById('potencia_dc_total').innerText = (potDC / 1000).toFixed(2);
                sincronizarEngenhariaUnica();
            }

            // Restaura visual dos inversores
            renderizarTabelaHuawei();
            atualizarComposicaoFinal();

            // Atualiza o resumo superior se estivermos na etapa financeira
            renderizarResumoSuperiorFinanceiro();
        } else {
            // Se a aba está vazia, reseta a interface técnica
            zerarInterfaceTecnica();
            // Garante que o PR e outros dados do header sejam atualizados mesmo sem módulos
            sincronizarEngenhariaUnica();

            // Limpa o valor do kit para não herdar da aba anterior
            const inputKit = document.getElementById('valor_kit_fornecedor');
            if (inputKit) inputKit.value = '';

            // Carrega o fator de lucro padrão para esta aba (novo ou limpo)
            carregarFatorLucroPadrao(aba);

            // --- FIX: Zera Potência DC Total ---
            document.getElementById('potencia_dc_total').innerText = "0.00";

            // Re-renderiza módulos para remover qualquer seleção visual anterior
            if (dimensionamentoCompleto) {
                processarEscolhaModulo(dimensionamentoCompleto);
            }

            renderizarTabelaHuawei();
            atualizarComposicaoFinal();

            // --- FIX: Limpa Financeiro ---
            limparFinanceiro();

            // Limpa resumo superior
            const resumoDiv = document.getElementById('resumo-topo-financeiro');
            if (resumoDiv) resumoDiv.remove();
        }

        // Aplica as travas visuais corretas para esta aba
        gerenciadorEtapas.sincronizarVisual(false);
        gerenciadorEtapas.renderizarMenuNavegacao(); // Garante que o menu apareça ao trocar de aba

        // FIX: Se carregou na etapa de premissas, tira snapshot inicial para evitar falso positivo de alteração
        if (projetoGerenciador[aba].dados.etapaIndex === 0) {
            gerenciadorEtapas.snapshotEstado = gerenciadorEtapas.capturarEstado('premissas');
        }
    }

    // Helper para carregar o fator correto das premissas globais
    function carregarFatorLucroPadrao(aba) {
        const premissas = db.buscarConfiguracao('premissas_globais');
        const inputFator = document.getElementById('prem_fator_lucro');
        if (!inputFator) return;

        const fator = aba === 'premium' ? (premissas?.financeiro?.fatorLucroPremium || 1.2) : (premissas?.financeiro?.fatorLucroStandard || 1.1);
        inputFator.value = fator;
    }

    // ======================================================================
    // 🛡️ MOTOR DE INTEGRIDADE DE DADOS (Gatilho de Invalidação)
    // ======================================================================

    /**
     * Gerencia o estado visual e funcional da página com base na validade dos cálculos.
     * @param {'VALIDAR' | 'INVALIDAR'} acao - A ação a ser tomada.
     */
    function gerenciarEstadoCalculo(acao) {
        // A lógica visual antiga foi substituída pela validação em tempo real
        // Mas mantemos o alerta de invalidação para feedback rápido
        if (acao === 'INVALIDAR') {
            if (projetoGerenciador.abaAtiva && projetoGerenciador[projetoGerenciador.abaAtiva]) {
                projetoGerenciador[projetoGerenciador.abaAtiva].dados.precoCalculado = false;
            }

            // FIX: Oculta o resumo executivo visualmente para evitar dados fantasmas
            const secaoResumo = document.getElementById('secao_resumo_executivo');
            if (secaoResumo) secaoResumo.style.display = 'none';

            const secaoComparativo = document.getElementById('secao_comparativa_final');
            if (secaoComparativo) secaoComparativo.classList.add('etapa-oculta');

            validarBotaoFinal(); // Revalida para bloquear o botão
        } else if (acao === 'VALIDAR') {
            validarBotaoFinal(); // Revalida para tentar liberar
        }
    }

    /**
     * Limpa a seção de seleção de módulos.
     */
    function limparSelecaoModulos() {
        containerSugestaoPainel.innerHTML = `<div class="alerta-reset">Aguardando novos dados de consumo...</div>`;
        if (wrapperEtapaTecnica) wrapperEtapaTecnica.classList.add('etapa-bloqueada');
        if (displayModuloSelecionado) displayModuloSelecionado.value = '';
        if (totalModulosDisplay) totalModulosDisplay.value = '';
    }

    /**
     * Limpa a seção financeira.
     */
    function limparFinanceiro() {
        // Não limpa o valor do kit aqui, pois ele é um input do usuário
        // document.getElementById('valor_kit_fornecedor').value = ''; 
        const campos = [
            'res_custo_materiais', 'res_custo_mo_base', 'res_logistica',
            'res_lucro_proposta', 'res_imposto_cascata', 'res_preco_venda_servico',
            'res_valor_total_proposta', 'res_linha_comissao_valor'
        ];
        campos.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = "R$ 0,00";
        });
        if (projetoGerenciador.abaAtiva && projetoGerenciador[projetoGerenciador.abaAtiva]) {
            projetoGerenciador[projetoGerenciador.abaAtiva].dados.precoCalculado = false;
        }
        
        // Oculta linha de comissão se existir
        const elComissao = document.getElementById('res_linha_comissao_valor');
        if (elComissao) {
            elComissao.closest('.linha-custo').style.display = 'none';
        }

        // FIX: Garante que o resumo da aba anterior não permaneça visível
        const secaoResumo = document.getElementById('secao_resumo_executivo');
        if (secaoResumo) secaoResumo.style.display = 'none';

        const secaoComparativo = document.getElementById('secao_comparativa_final');
        if (secaoComparativo) secaoComparativo.classList.add('etapa-oculta');

        validarBotaoFinal();
    }

    /**
     * Força o reset visual do Topo Fixo e dos inputs de seleção.
     * Usado quando a mudança de premissas invalida a escolha atual.
     */
    function zerarInterfaceTecnica() {
        // 1. Limpa inputs ocultos que guardam a seleção
        if (selectModulo) selectModulo.value = '';
        if (totalModulosDisplay) totalModulosDisplay.value = '';
        if (displayModuloSelecionado) displayModuloSelecionado.value = '';

        // 2. Zera o Topo Fixo imediatamente
        if (fixoPotReal) fixoPotReal.innerText = "0.00 kWp";
        if (fixoGeracao) fixoGeracao.innerText = "0 kWh";
    }

    // --- FUNÇÕES DE EVENTO (Declaradas antes do uso) ---
    function handlePremiseChange(event) {
        console.log("Alteração detectada em:", event.target.id);

        // Feedback visual imediato
        gerenciarEstadoCalculo('INVALIDAR');
        const btn = document.getElementById('btn_gerar_proposta');
        if (btn) btn.innerText = "Recalculando...";

        // Sincroniza o modo composto se a alteração for no modo simples
        if (event.target.id === 'azimute_geral' || event.target.id === 'inclinacao_geral') {
            sincronizarGeralParaComposto();
        }

        setTimeout(() => {
            // O recálculo agora decide se mantém ou limpa os dados
            recalcularDimensionamento();

            // Restaura texto do botão se ainda houver seleção válida
            if (estadoSelecaoModulo.watts && btn) btn.innerText = "Salvar Proposta";
        }, 500);

        // Se mudar premissa, destrava tudo para forçar novo fluxo
        // (Embora o botão de desbloqueio já faça isso, inputs diretos precisam invalidar)
    }

    // Função para atualizar os labels de resumo nos cards retráteis
    function atualizarResumosVisiveis() {
        console.log("Atualizando labels de resumo...");

        // 1. Resumo de Geometria
        const az = document.getElementById('azimute_geral')?.value || '0';
        const inc = document.getElementById('inclinacao_geral')?.value || '0';
        const resumoGeo = document.getElementById('resumo_geo');
        if (resumoGeo) resumoGeo.innerText = `(Az: ${az}° | Inc: ${inc}°)`;

        // 2. Resumo de Perdas (PR)
        const prElement = document.getElementById('fixo_pr_final');
        const resumoPerdas = document.getElementById('resumo_pr');
        if (resumoPerdas && prElement) {
            resumoPerdas.innerText = `(PR: ${prElement.innerText})`;
        }

        // Futuramente, pode-se adicionar o resumo da UC aqui também.
    }

    /**
    * Inicializa os componentes de interface e eventos da seção de Inversores
    */
    function initComponentesInversor() {
        const select = document.getElementById('sel_oversizing');
        if (!select) return;
        select.innerHTML = ''; // Limpa

        // LÊ O PADRÃO DAS PREMISSAS GLOBAIS (Conexão com Central BelEnergy)
        const premissas = db.buscarConfiguracao('premissas_globais');
        const padrao = premissas?.engenharia?.oversizingPadrao || 50; // Default 50% se não configurado

        for (let i = 10; i <= 80; i += 5) {
            const option = document.createElement('option');
            option.value = (1 + i / 100).toFixed(2);
            option.text = `${i}%`;
            if (i === padrao) option.selected = true;
            select.appendChild(option);
        }
        
        select.addEventListener('change', () => renderizarTabelaHuawei());
    }

    // --- REMOÇÃO DE ELEMENTOS REDUNDANTES (Limpeza de Interface) ---
    function limparInterfaceFinanceira() {
        const wrapper = document.getElementById('wrapper-etapa-financeira');
        if (wrapper) {
            // Remove títulos redundantes como "Formação de Preço"
            const titulos = wrapper.querySelectorAll('h2, h3, .titulo-secao');
            titulos.forEach(t => {
                if (t.innerText.includes('Formação de Preço') || t.innerText.includes('Engenharia de Custos')) {
                    t.style.display = 'none';
                }
            });
        }
    }

    // --- Funções de Inicialização ---
    function inicializarBaseDeDados() {
        // Restaura estilos críticos (CSS-in-JS) para garantir visualização dos cards
        injetarEstilosDinamicos();

        // INJEÇÃO DO BOTÃO CANCELAR (FIXO NO HEADER) - Visível constantemente
        const headerContainer = document.querySelector('.header-container');
        if (headerContainer && !document.getElementById('btn_cancelar_global')) {
            const btnCancel = document.createElement('button');
            btnCancel.id = 'btn_cancelar_global';
            btnCancel.innerHTML = '<i class="fas fa-times"></i> Sair';
            // Estilos inline para garantir visibilidade imediata no header escuro
            btnCancel.style.cssText = `
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #e2e8f0;
                padding: 6px 14px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: 20px;
                transition: all 0.2s;
                height: 36px;
            `;
            btnCancel.onmouseover = () => { btnCancel.style.background = 'rgba(255, 255, 255, 0.2)'; btnCancel.style.color = '#fff'; };
            btnCancel.onmouseout = () => { btnCancel.style.background = 'rgba(255, 255, 255, 0.1)'; btnCancel.style.color = '#e2e8f0'; };
            btnCancel.onclick = () => {
                if(confirm("Tem certeza que deseja sair? O progresso não salvo será perdido.")) {
                    const pid = sessionStorage.getItem('projeto_ativo_id');
                    window.location.href = pid ? `projeto-detalhes.html?id=${pid}` : 'dashboard-admin.html';
                }
            };

            // Insere logo após a logo-area para ficar à esquerda
            const logoArea = headerContainer.querySelector('.logo-area');
            if (logoArea) logoArea.insertAdjacentElement('afterend', btnCancel);
        }

        // Esconde o botão de gerar proposta inicialmente para evitar que apareça nas premissas
        if (btnGerarProposta) btnGerarProposta.style.display = 'none';

        // FIX: Esconde o container estático da ação final para não poluir as premissas
        const containerFinal = document.querySelector('.container-acao-final');
        if (containerFinal) containerFinal.style.display = 'none';

        // --- POPULA A NOVA BARRA DE CONTEXTO ---
        const elCtxCliente = document.getElementById('ctx_cliente');
        const elCtxLocal = document.getElementById('ctx_local');
        const elCtxConsumo = document.getElementById('ctx_consumo');
        const elCtxEstrutura = document.getElementById('ctx_estrutura');
        const elCtxOrigem = document.getElementById('ctx_origem');

        if (elCtxCliente) elCtxCliente.innerText = projetoCompleto.nome;
        if (elCtxLocal) elCtxLocal.innerText = `${projetoCompleto.projeto.cidade}/${projetoCompleto.projeto.uf}`;
        if (elCtxConsumo) elCtxConsumo.innerText = `${projetoCompleto.projeto.consumo || 0} kWh (${projetoCompleto.projeto.tipoLigacao === 'monofasico' ? 'Mono' : 'Tri'})`;
        if (elCtxEstrutura) elCtxEstrutura.innerText = projetoCompleto.projeto.tipoTelhado || 'Telhado';
        
        const origemMap = {
            'nenhum': 'Venda Direta', 'venda_direta': 'Venda Direta',
            'indicador': 'Indicação', 'representante': 'Representante'
        };
        if (elCtxOrigem) elCtxOrigem.innerText = origemMap[projetoCompleto.projeto.origemVenda] || 'Venda Direta';

        if (typeof window.verificarTipoEstrutura === 'function') {
            window.verificarTipoEstrutura(); // Atualiza visibilidade do fornecedor
        }

        const { cidade, uf } = projetoCompleto.projeto; // Usa o endereço do projeto
        const cidadeNormalizada = cidade.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dadosCidade = baseDadosAlagoas[cidadeNormalizada];

        // 1. Obter Fator de Geração (Prioriza o HSP salvo no projeto)
        if (projetoCompleto.projeto.hsp && projetoCompleto.projeto.hsp > 0) {
            hspBruto = projetoCompleto.projeto.hsp;
        } else {
            const fatorHistorico = dadosCidade ? dadosCidade.fator : 126; // Fallback
            hspBruto = obterHSPBruto(fatorHistorico);
        }
        if (inputHSPBruto) inputHSPBruto.innerText = hspBruto.toFixed(2);

        // 2. Obter Latitude
        if (dadosCidade && dadosCidade.lat) {
            latitude = dadosCidade.lat;
        } else if (coordenadasEstados[uf]) {
            latitude = coordenadasEstados[uf].lat;
        } else {
            latitude = -15.0; // Fallback Brasil
        }

        // Inicializa componentes dinâmicos da proposta
        initComponentesInversor();

        // Inicializa os opcionais premium
        renderizarOpcionaisPremium();

        // Limpa elementos redundantes da interface financeira
        limparInterfaceFinanceira();

        // Força um recálculo inicial para garantir que o estado esteja limpo/pronto
        recalcularDimensionamento();

        // GARANTIA: Força a atualização visual do header fixo mesmo se o recálculo não tiver módulos selecionados
        sincronizarEngenhariaUnica();

        // Renderiza o botão de avançar na etapa de Premissas (sem scroll inicial)
        atualizarEstadoBotaoPremissas();
    }

    // --- CARGA DE PREMISSAS GLOBAIS ---
    const premissasGlobais = db.buscarConfiguracao('premissas_globais');
    if (premissasGlobais) {
        // Atualiza inputs de engenharia (Azimute/Inclinação)
        if (document.getElementById('azimute_geral')) document.getElementById('azimute_geral').value = premissasGlobais.engenharia.azimute;
        if (document.getElementById('inclinacao_geral')) document.getElementById('inclinacao_geral').value = premissasGlobais.engenharia.inclinacao;

        // Atualiza inputs de perdas detalhadas (se existirem na configuração)
        if (premissasGlobais.engenharia) {
            if (document.getElementById('p_efici_inv')) document.getElementById('p_efici_inv').value = premissasGlobais.engenharia.eficienciaInversor ?? 98;
            if (document.getElementById('p_temp_inv')) document.getElementById('p_temp_inv').value = premissasGlobais.engenharia.perdaTempInversor ?? 1.5;
            if (document.getElementById('p_temp_mod')) document.getElementById('p_temp_mod').value = premissasGlobais.engenharia.perdaTempModulos ?? 10.13;
            if (document.getElementById('p_cabos_total')) document.getElementById('p_cabos_total').value = premissasGlobais.engenharia.cabos ?? 2.0;
            if (document.getElementById('p_extras')) document.getElementById('p_extras').value = premissasGlobais.engenharia.outros ?? 2.0;
            if (document.getElementById('p_indisp')) document.getElementById('p_indisp').value = premissasGlobais.engenharia.indisponibilidade ?? 0.5;
        }

        // Atualiza inputs financeiros
        // Define o inicial como Standard por padrão
        if (document.getElementById('prem_fator_lucro')) {
            document.getElementById('prem_fator_lucro').value = premissasGlobais.financeiro.fatorLucroStandard || 1.1;
        }
        if (document.getElementById('prem_lucro_minimo')) {
            document.getElementById('prem_lucro_minimo').value = premissasGlobais.financeiro.lucroMinimo || 0;
        }
        if (document.getElementById('prem_aliquota_imposto')) document.getElementById('prem_aliquota_imposto').value = premissasGlobais.financeiro.imposto;
    }

    // --- VERIFICAÇÃO DE EDIÇÃO DE PROPOSTA ---
    const propostaIdEdicao = sessionStorage.getItem('proposta_ativa_id');
    let modoEdicao = false;

    if (propostaIdEdicao) {
        const propostaSalva = db.listar('propostas').find(p => p.id === propostaIdEdicao);
        if (propostaSalva) {
            console.log("Modo Edição: Carregando proposta", propostaIdEdicao);
            modoEdicao = true;

            // 1. Restaura Escopo
            if (propostaSalva.escopo) {
                projetoGerenciador.tipoEscopo = propostaSalva.escopo;
                projetoGerenciador.modoDuplo = (propostaSalva.escopo === 'AMBAS');
                
                // Atualiza botões de escopo no header
                const btnStd = document.getElementById('btn_modo_std');
                const btnPrm = document.getElementById('btn_modo_prm');
                if (btnStd) btnStd.style.display = (propostaSalva.escopo === 'STANDARD' || propostaSalva.escopo === 'AMBAS') ? '' : 'none';
                if (btnPrm) btnPrm.style.display = (propostaSalva.escopo === 'PREMIUM' || propostaSalva.escopo === 'AMBAS') ? '' : 'none';
            }

            // 2. Restaura Dados das Versões
            if (propostaSalva.versoes.standard) {
                projetoGerenciador.standard.dados = propostaSalva.versoes.standard;
                projetoGerenciador.standard.selecionado = true;
            }
            if (propostaSalva.versoes.premium) {
                projetoGerenciador.premium.dados = propostaSalva.versoes.premium;
                projetoGerenciador.premium.selecionado = true;
            }

            // 3. Define Aba Inicial (Premium tem prioridade)
            if (projetoGerenciador.premium.selecionado) {
                projetoGerenciador.abaAtiva = 'premium';
                document.body.classList.add('modo-premium');
            } else {
                projetoGerenciador.abaAtiva = 'standard';
            }
            
            // Atualiza botões de aba visualmente
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-aba') === projetoGerenciador.abaAtiva);
            });
        }
    }

    // Oculta o campo de imposto da interface (Controlado via premissas globais)
    const elImpostoVisual = document.getElementById('prem_aliquota_imposto');
    if (elImpostoVisual) {
        const container = elImpostoVisual.closest('.grupo-form') || elImpostoVisual.parentElement;
        if (container) container.style.display = 'none';
    }

    /**
     * UNIFICAÇÃO JEAN MARCEL: Sincroniza todos os dados no Header
     * Elimina blocos redundantes de PR no corpo da página.
     * @param {number|null} prOverride - (Opcional) Força um valor de PR atualizado antes de salvar no global.
     */
    function sincronizarEngenhariaUnica(prOverride = null) {
        // 1. Higienização e Captura das "Primícias"
        const valConsumo = inputConsumo ? inputConsumo.value : '0';
        const consumo = parseFloat(higienizarParaCalculo(valConsumo)) || 0;
        const hsp = hspBruto || parseFloat(inputHSPBruto.innerText) || 0; // Usa variável global para precisão

        // 2. Cálculo do PR Real de Projeto (Unificado)
        // Se passarmos um override, usamos ele (tempo real), senão pegamos do último dimensionamento salvo
        const prFinal = prOverride !== null ? prOverride : (dimensionamentoCompleto?.prCalculado || 0);

        // 3. Potência Real (Módulos Selecionados)
        const wattsMod = parseFloat(selectModulo.value) || 0;
        const qtdTotal = parseInt(totalModulosDisplay.value) || 0;
        const potReal = (qtdTotal * wattsMod) / 1000;

        // 4. Potência Mínima Requerida
        const potMinima = hsp > 0 && prFinal > 0 ? consumo / (hsp * 30.4166 * prFinal) : 1;

        // 5. Atualização Visual no Header
        if (fixoPotMinima) fixoPotMinima.innerText = potMinima.toFixed(2) + " kWp";
        if (fixoPotReal) fixoPotReal.innerText = potReal.toFixed(2) + " kWp";
        if (fixoPr) fixoPr.innerText = (prFinal * 100).toFixed(2) + "%";
        if (fixoGeracao) fixoGeracao.innerText = Math.round(potReal * hsp * 30.4166 * prFinal) + " kWh";

        // 6. Validação dos 4% (Status Dot)
        if (fixoPotReal) {
            fixoPotReal.classList.remove('valor-ok', 'valor-atencao', 'valor-critico'); // Limpa classes anteriores
            const diff = potMinima > 0 ? (potReal / potMinima) - 1 : 0;

            if (potReal > 0) {
                if (diff < -0.04) {
                    fixoPotReal.classList.add("valor-critico");
                } else if (diff < 0) {
                    fixoPotReal.classList.add("valor-atencao");
                } else {
                    fixoPotReal.classList.add("valor-ok");
                }
            }
        }
    }

    // --- Motor de Cálculo Dinâmico ---
    function recalcularDimensionamento() {
        // Invalida o estado sempre que um recálculo de base é iniciado.
        gerenciarEstadoCalculo('INVALIDAR');

        const consumo = parseFloat(higienizarParaCalculo(inputConsumo.value)) || 0;
        let prPonderado = 0;

        const perdasExtras = {
            eficienciaInversor: parseFloat(higienizarParaCalculo(pEficiInv.value)),
            perdaTempInversor: parseFloat(higienizarParaCalculo(pTempInv.value)),
            perdaTempModulos: parseFloat(higienizarParaCalculo(pTempMod.value)),
            cabos: parseFloat(higienizarParaCalculo(pCabosTotal.value)),
            outros: parseFloat(higienizarParaCalculo(pExtras.value)),
            indisponibilidade: parseFloat(higienizarParaCalculo(pIndisp.value))
        };

        if (modoOrientacao === 'simples') {
            const azimute = parseFloat(higienizarParaCalculo(document.getElementById('azimute_geral').value)) || 0;
            const inclinacao = parseFloat(higienizarParaCalculo(document.getElementById('inclinacao_geral').value)) || 0;
            const resultadoPR = calcularRendimentoCientifico({ azimute, inclinacao, perdasExtras, latitude });
            prPonderado = resultadoPR.prFinal;
        } else { // Modo Composto
            const linhas = document.querySelectorAll('.linha-orientacao');
            linhas.forEach(linha => {
                const peso = (parseFloat(linha.querySelector('.input-perc').value) || 0) / 100;
                const azimute = parseFloat(linha.querySelector('.input-az').value) || 0;
                const inclinacao = parseFloat(linha.querySelector('.input-inc').value) || 0;

                if (peso > 0) {
                    const resultadoPR_n = calcularRendimentoCientifico({ azimute, inclinacao, perdasExtras, latitude });
                    prPonderado += (resultadoPR_n.prFinal * peso);
                }
            });
        }

        // 2. ATUALIZAÇÃO IMEDIATA DO TOPO (Correção do "Topo Fixo não mudou")
        // Passamos o PR calculado agora, sem esperar o resto do processo
        sincronizarEngenhariaUnica(prPonderado);

        // Atualiza o botão de avançar das premissas
        atualizarEstadoBotaoPremissas();

        // 3. Executa o Dimensionamento Completo (Motor de Seleção 540W-715W)
        if (consumo > 0 && hspBruto > 0) {
            // Usa o PR PONDERADO para dimensionar
            const paramsDimensionamento = { rendimentoFinal: prPonderado }; // O model.js agora só precisa do PR final.
            // Passa MODELOS_FOCO para garantir que o cálculo matemático bata com o estoque
            dimensionamentoCompleto = dimensionarSistema(consumo, hspBruto, paramsDimensionamento, MODELOS_FOCO);

            // 3. Atualiza a Tabela e Seleção Inteligente
            processarEscolhaModulo(dimensionamentoCompleto);
        }

        // 4. VALIDAÇÃO DE CONTINUIDADE DOS MÓDULOS
        // Verifica se a seleção atual ainda é válida com as novas perdas
        if (estadoSelecaoModulo.watts && estadoSelecaoModulo.qtd) {
            const potReal = (estadoSelecaoModulo.qtd * estadoSelecaoModulo.watts) / 1000;
            const geracaoNova = potReal * hspBruto * 30.4166 * prPonderado;

            // Se a nova geração caiu abaixo do consumo (com tolerância de 1%), invalida tudo.
            if (geracaoNova < consumo * 0.99) {
                console.warn("Premissa alterada tornou a seleção atual insuficiente. Resetando.");

                // Limpeza Profunda de Estado
                estadoSelecaoModulo = { watts: null, qtd: null };

                // >>> CORREÇÃO: Zera o Topo Fixo e Inputs imediatamente <<<
                zerarInterfaceTecnica();

                // Limpeza Visual
                document.getElementById('container_selecionados').style.display = 'none';
                document.getElementById('potencia_dc_total').innerText = "0.00";

                // Força re-renderização limpa
                renderizarTabelaHuawei();
                atualizarComposicaoFinal(); // Isso vai limpar os textos de expansão/geração futura

                // FIX: Bloqueia navegação para etapas futuras (Inversores, Financeiro)
                const aba = projetoGerenciador.abaAtiva;
                if (projetoGerenciador[aba]) {
                    // Define o máximo permitido como 1 (Módulos), forçando o usuário a resolver a pendência lá
                    projetoGerenciador[aba].dados.maxEtapaIndex = 1;
                }
                if (typeof gerenciadorEtapas !== 'undefined') gerenciadorEtapas.renderizarMenuNavegacao();

                // Avisa o usuário
                alert("A alteração nas premissas reduziu a geração abaixo do consumo. Por favor, selecione um novo conjunto de módulos.");
            } else {
                // Se ainda for válido, atualiza os números mantendo a seleção
                sincronizarEngenhariaUnica(prPonderado); // Garante atualização com PR novo

                // Atualiza a composição para refletir novos cálculos (ex: Geração Máxima com novo PR)
                atualizarComposicaoFinal();

                if (carrinhoInversores.length > 0) {
                    window.calcularEngenhariaFinanceira();
                }
            }
        } else {
            // Se não tinha seleção, apenas sincroniza o básico
            sincronizarEngenhariaUnica(prPonderado);
        }

        atualizarResumosVisiveis();
    }

    /**
     * Calcula a Potência Mínima e gera a tabela de comparação de módulos
     * Usa a lista de foco de mercado + sugestão técnica
     */
    function processarEscolhaModulo(resultadoDimensionamento) {
        console.warn("DEBUG: A função processarEscolhaModulo foi chamada. Gerando HTML...");

        if (!containerSugestaoPainel) {
            console.error("ERRO CRÍTICO: containerSugestaoPainel não encontrado no DOM!");
            return;
        }

        if (!resultadoDimensionamento || !resultadoDimensionamento.melhorSugestao) {
            containerSugestaoPainel.innerHTML = `<div class="alerta-reset">Aguardando dados de consumo e local...</div>`;
            return;
        }

        const pMinimaKwp = resultadoDimensionamento.kwpNecessario;

        // 1. OBTENÇÃO DOS DADOS: A lista de modelos já vem ordenada por precisão do model.js
        const candidatosSugeridos = resultadoDimensionamento.todosModelos;

        // Adiciona o campo 'excedente' para uso na UI, que é o mesmo que 'sobra' no model
        candidatosSugeridos.forEach(mod => {
            mod.excedente = mod.sobra;
        });

        // 4. SEPARAÇÃO: Top 4 Campeões e o Restante
        const top4Campeoes = candidatosSugeridos.slice(0, 4);
        const restante = candidatosSugeridos.slice(4);

        let htmlSugestoes = `
            <div class="secao-header">
                <i class="fas fa-check-circle" style="color: #ffcc00;"></i>
                <span>Sugestões de Módulos (Top 4)</span>
            </div>
            <div class="grid-sugestoes">
        `;

        top4Campeoes.forEach((mod, index) => {
            const isMelhor = index === 0;

            // Lógica Visual Unificada
            const isSelecionado = estadoSelecaoModulo.watts === mod.watts && estadoSelecaoModulo.qtd === mod.quantidade;
            let classesCard = 'card-modulo bloco-animado';
            if (isMelhor) classesCard += ' recomendado-ia';
            if (isSelecionado) classesCard += ' selecionado-usuario';

            htmlSugestoes += `
                <div class="${classesCard}" id="card_mod_${mod.watts}_${mod.quantidade}">
                    ${!isMelhor ? `<div class="selo-opcao" style="font-size:0.7rem; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">Opção ${index + 1}</div>` : ''}
                    <span class="label-potencia">${mod.watts}W</span>
                    <div class="dados-resumo">
                        <p>Quantidade: <strong>${mod.quantidade} un</strong></p>
                        <p>Potência Total: <strong>${mod.potenciaTotal.toFixed(2)} kWp</strong></p>
                        <small style="color: #64748b; font-size: 0.8rem;">Sobra: +${mod.excedente.toFixed(2)} kWp</small>
                    </div>
                    <button class="btn-selecionar-campeao" onclick="window.validarEConfirmarModulo(${mod.watts}, ${mod.quantidade}, ${pMinimaKwp})">
                        ${isMelhor ? 'Confirmar Sugestão' : 'Selecionar Este'}
                    </button>
                </div>
            `;
        });

        htmlSugestoes += `</div>`; // Fecha grid-sugestoes

        // Botão para ver o resto
        if (restante.length > 0) {
            htmlSugestoes += `
                <div class="area-expansao-modulos">
                    <button class="btn-ver-todos" onclick="window.toggleListaCompleta()">
                        <i class="fas fa-list"></i> Ver outras ${restante.length} opções de módulos
                    </button>
                    <div id="lista_completa_scroll" class="lista-oculta-scroll" style="display: none;">
                        <!-- A lista completa será renderizada aqui -->
                    </div>
                </div>
            `;
        }

        console.log(`DEBUG: Injetando HTML de sugestões no container. Tamanho: ${htmlSugestoes.length}`);
        containerSugestaoPainel.innerHTML = htmlSugestoes;

        // Prepara a lista completa, mas deixa oculta
        if (restante.length > 0) {
            prepararListaCompleta(restante, pMinimaKwp);
        }

        // RESTAURAÇÃO DO BOTÃO VOLTAR (Caso tenha sido apagado pelo innerHTML)
        // Verifica se estamos na etapa de módulos (índice 1) e se o botão sumiu
        if (typeof gerenciadorEtapas !== 'undefined') {
            const aba = projetoGerenciador.abaAtiva;
            if (projetoGerenciador[aba] && projetoGerenciador[aba].dados.etapaIndex === 1) {
                gerenciadorEtapas.injetarBotaoVoltar(containerSugestaoPainel, 'premissas');
            }
        }

        // Renderiza o botão de avançar (Desabilitado inicialmente, pois nenhum módulo foi confirmado ainda)
        // Se já houver seleção (recalculo), verifica se é válida
        const temSelecao = !!(estadoSelecaoModulo.watts && estadoSelecaoModulo.qtd);
        renderizarBotaoNavegacao('container_sugestao_painel', 'window.avancarParaInversores()', temSelecao ? 'Configuração de Módulos Definida' : 'Selecione um Módulo', 'Avançar para Inversores', temSelecao);
    }

    // NOVA FUNÇÃO: Valida a seleção antes de confirmar
    window.validarEConfirmarModulo = function (watts, qtd, pMinima) {
        // 1. Atualiza o estado visual (DOM) imediatamente
        document.querySelectorAll('.card-modulo').forEach(card => {
            card.classList.remove('selecionado-usuario');
        });

        const cardId = `card_mod_${watts}_${qtd}`;
        const cardSelecionado = document.getElementById(cardId);
        if (cardSelecionado) {
            cardSelecionado.classList.add('selecionado-usuario');
        }

        // 2. Salva no estado persistente
        estadoSelecaoModulo = { watts: watts, qtd: qtd };

        const potenciaSelecionada = (watts * qtd) / 1000;
        const percentualAtendimento = (potenciaSelecionada / pMinima) * 100;

        if (percentualAtendimento >= 100) {
            confirmarModulo(watts, qtd); // Atendimento pleno, confirma direto
        }
        else if (percentualAtendimento >= 96) {
            // ZONA DE TOLERÂNCIA (4%)
            const confirmar = confirm(`Atenção: Este sistema atende ${percentualAtendimento.toFixed(1)}% da necessidade (abaixo dos 100%). Deseja prosseguir com esta tolerância?`);
            if (confirmar) {
                confirmarModulo(watts, qtd);
            }
        }
        else {
            alert("Erro: O sistema selecionado está abaixo da tolerância permitida de 4%. Por favor, selecione uma configuração mais potente.");
        }
    }

    // Função interna que efetivamente seleciona o módulo
    function confirmarModulo(watts, qtd, auto = false) {
        // FIX: Atualiza o estado global para garantir consistência na automação e resumos
        estadoSelecaoModulo = { watts: watts, qtd: qtd };

        // 1. Define o inventário fixo do projeto
        selectModulo.value = watts; // Input hidden
        displayModuloSelecionado.value = `Módulo ${watts}W`;
        totalModulosDisplay.value = qtd;

        // 2. Destrava a etapa técnica e financeira, mas mantém o estado inválido até o cálculo financeiro ser refeito.
        if (wrapperEtapaTecnica) wrapperEtapaTecnica.classList.remove('etapa-bloqueada');
        if (wrapperEtapaFinanceira) wrapperEtapaFinanceira.classList.remove('etapa-bloqueada');

        // 🔒 SEGURANÇA: Trava as premissas anteriores
        // gerenciadorEtapas.travar('premissas'); // Removido para evitar scroll automático indesejado

        // ATUALIZADO: Atualiza o painel de inversores com a nova potência DC
        const potDCInstaladaWp = (watts * qtd);
        document.getElementById('potencia_dc_total').innerText = (potDCInstaladaWp / 1000).toFixed(2);

        // Sincroniza o painel fixo com a nova seleção
        sincronizarEngenhariaUnica(); // Aqui usa o PR salvo no dimensionamentoCompleto

        // FIX: Atualiza visualmente o botão de avançar para habilitado imediatamente
        renderizarBotaoNavegacao('container_sugestao_painel', 'window.avancarParaInversores()', 'Configuração de Módulos Definida', 'Avançar para Inversores', true);

        // VERIFICAÇÃO DE ALTERAÇÃO (DIRTY CHECK)
        if (typeof gerenciadorEtapas !== 'undefined') {
            if (gerenciadorEtapas.houveAlteracao('modulos')) {
                console.log("Módulos alterados. Resetando Inversores e Financeiro.");
                gerenciadorEtapas.limparCascataFutura('modulos');
            } else {
                console.log("Módulos mantidos. Preservando seleção de inversores.");
            }
        }

        // 3. GATILHO DE REAVALIAÇÃO EM CASCATA: Verifica se o carrinho atual ainda é válido
        atualizarComposicaoFinal();

        // Atualiza o resumo para a etapa financeira (mesmo que oculto ainda)
        renderizarResumoSuperiorFinanceiro();

        // Atualiza a tabela de sugestões (agora sem pré-seleção automática única)
        renderizarTabelaHuawei();

        // RESTAURANDO O AVANÇO AUTOMÁTICO
        // Se não for uma chamada automática, avança para a próxima etapa.
        if (typeof gerenciadorEtapas !== 'undefined' && !auto) {
            gerenciadorEtapas.avancarPara('inversores');
        }
    }

    // NOVA FUNÇÃO GENÉRICA: Renderiza botão de navegação padronizado (Atualiza estado se já existir)
    function renderizarBotaoNavegacao(containerId, acaoGlobal, textoFeedback, textoBotao, isValid = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let areaAcao = container.querySelector('.area-acao-navegacao');
        let isNew = false;

        if (!areaAcao) {
            isNew = true;
            areaAcao = document.createElement('div');
            areaAcao.className = 'area-acao-navegacao';
            container.appendChild(areaAcao);
        }

        // Alternância de classes de estado
        areaAcao.classList.toggle('estado-valido', isValid);
        areaAcao.classList.toggle('estado-invalido', !isValid);

        const iconClass = isValid ? 'fa-check-circle' : 'fa-lock';

        const disabledAttr = isValid ? '' : 'disabled';
        const btnClass = isValid ? 'btn-avancar ativo' : 'btn-avancar inativo';

        areaAcao.innerHTML = `
            <p class="feedback-validacao">
                <i class="fas ${iconClass}"></i> ${textoFeedback}
            </p>
            <button class="${btnClass}" onclick="${acaoGlobal}" ${disabledAttr}>
                ${textoBotao} <i class="fas fa-arrow-right"></i>
            </button>
        `;
    }

    // --- FUNÇÃO DE AUTOMAÇÃO (Cálculo + Seleção + Avanço) ---
    window.autoDimensionarCompleto = async function () {
        console.warn("🚀 INICIANDO FLUXO SEGURO PASSO A PASSO...");

        // PASSO 1: Cálculo Interno
        recalcularDimensionamento();

        if (!dimensionamentoCompleto || !dimensionamentoCompleto.melhorSugestao) {
            console.warn("Automação abortada: Dimensionamento incompleto.");
            return;
        }

        // PASSO 2: Garantir que a Seção está aberta antes de desenhar
        const secaoModulos = document.getElementById('wrapper-etapa-paineis');
        if (secaoModulos) {
            secaoModulos.classList.remove('etapa-oculta');
            secaoModulos.classList.add('etapa-ativa');
            secaoModulos.classList.remove('card-bloqueado', 'disabled', 'oculto');
            secaoModulos.style.opacity = '1';
            secaoModulos.style.pointerEvents = 'auto';
        }

        // PASSO 3: Renderizar e AGUARDAR a confirmação do DOM
        await new Promise((resolve) => {
            console.log("🛠️ Passo 3: Renderizando Cards...");
            const container = document.getElementById('container_sugestao_painel');
            if (container) container.innerHTML = ''; // Limpa o "Aguardando..."
            processarEscolhaModulo(dimensionamentoCompleto);

            // Usamos requestAnimationFrame para garantir que o navegador pintou o HTML
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    console.log("✅ Cards confirmados no DOM.");
                    resolve();
                });
            });
        });

        // PASSO 4: Destacar o selecionado E LIBERAR O BLOQUEIO
        const melhorMod = dimensionamentoCompleto.melhorSugestao;
        const cardId = `card_mod_${melhorMod.watts}_${melhorMod.quantidade}`;
        const cardAlvo = document.getElementById(cardId);

        if (cardAlvo) {
            document.querySelectorAll('.card-modulo').forEach(c => c.classList.remove('selecionado-usuario'));
            cardAlvo.classList.add('selecionado-usuario', 'recomendado-ia');
            console.log("🎨 Módulo selecionado destacado.");

            // 🚀 O SEGREDO: Atualiza a variável de estado que o sistema usa para destravar o botão
            estadoSelecaoModulo = { watts: melhorMod.watts, qtd: melhorMod.quantidade };
            
            // FIX: Valida visualmente o botão de avançar da etapa de módulos para ficar verde/habilitado
            renderizarBotaoNavegacao('container_sugestao_painel', 'window.avancarParaInversores()', 'Configuração de Módulos Definida', 'Avançar para Inversores', true);
        }

        // Atualiza inputs ocultos essenciais para o funcionamento do sistema
        const selectModulo = document.getElementById('select_modulo_comparativo');
        const displayModuloSelecionado = document.getElementById('display_modulo_selecionado');
        const totalModulosDisplay = document.getElementById('total_modulos_projeto');

        if (selectModulo) selectModulo.value = melhorMod.watts;
        if (displayModuloSelecionado) displayModuloSelecionado.value = `Módulo ${melhorMod.watts}W`;
        if (totalModulosDisplay) totalModulosDisplay.value = melhorMod.quantidade;

        // Atualiza Potência DC Total e Header
        const potDCInstaladaWp = (melhorMod.watts * melhorMod.quantidade);
        document.getElementById('potencia_dc_total').innerText = (potDCInstaladaWp / 1000).toFixed(2);
        sincronizarEngenhariaUnica();

        // PASSO 5: Dimensionar Inversores (Sem pressa)
        console.log("⚡ Passo 5: Dimensionando Inversores...");
        const sugestoes = gerarSugestoesCompostas();
        if (sugestoes.length > 0) {
            const wattsModulo = melhorMod.watts;
            const sugestoesOrdenadas = sugestoes.sort((a, b) => {
                const expA = Math.floor((a.capTotal - potDCInstaladaWp) / wattsModulo);
                const expB = Math.floor((b.capTotal - potDCInstaladaWp) / wattsModulo);
                return expA - expB;
            });
            const melhorInv = sugestoesOrdenadas[0];

            carrinhoInversores = [];
            melhorInv.itens.forEach(it => {
                carrinhoInversores.push({ modelo: it.mod, nominal: it.nom, tipo: it.tipo, qtd: it.qtd });
            });

            // Atualiza estado visual
            estadoSelecaoInversor = { tipo: 'SUGESTAO', id: 0 };
            renderizarTabelaHuawei();
            atualizarComposicaoFinal();

            // PASSO 6: Finalizar e LIMPAR TRAVAS VISUAIS
            console.log("💰 Passo 6: Finalizando no Financeiro.");

            if (typeof gerenciadorEtapas !== 'undefined') {
                // Forçamos o índice da etapa para 'financeiro' sem disparar o reset de cascata
                const aba = projetoGerenciador.abaAtiva;

                // Atualiza o máximo alcançado para habilitar a navegação no menu (Validação de Abas)
                if (3 > (projetoGerenciador[aba].dados.maxEtapaIndex || 0)) {
                    projetoGerenciador[aba].dados.maxEtapaIndex = 3;
                }

                projetoGerenciador[aba].dados.etapaIndex = 3; // Índice do financeiro
                
                // Sincroniza visualmente após garantir que o DOM está pronto
                setTimeout(() => {
                    gerenciadorEtapas.sincronizarVisual();
                }, 50);
            }
        } else {
            console.warn("Automação: Nenhum inversor compatível encontrado automaticamente.");
        }

        renderizarResumoSuperiorFinanceiro();
        if (typeof window.calcularEngenhariaFinanceira === 'function') {
            window.calcularEngenhariaFinanceira(); // Aplica seu Fator 1.1 e Impostos
        }

        // Foca no kit para finalizar
        const inputKit = document.getElementById('valor_kit_fornecedor');
        if (inputKit) {
            inputKit.focus();
            inputKit.select();
        }
    };

    // --- FUNÇÃO DE RESUMO SUPERIOR (Design Leve) ---
    function renderizarResumoSuperiorFinanceiro() {
        const wrapper = document.getElementById('wrapper-etapa-financeira');
        if (!wrapper) return;

        let resumoDiv = document.getElementById('resumo-topo-financeiro');
        if (!resumoDiv) {
            resumoDiv = document.createElement('div');
            resumoDiv.id = 'resumo-topo-financeiro';
            // Insere no topo do wrapper financeiro
            wrapper.insertBefore(resumoDiv, wrapper.firstChild);
        }

        // Coleta dados atuais
        const modulosTxt = estadoSelecaoModulo.qtd ? `${estadoSelecaoModulo.qtd}x ${estadoSelecaoModulo.watts}W` : '---';
        const potTotal = estadoSelecaoModulo.qtd ? ((estadoSelecaoModulo.qtd * estadoSelecaoModulo.watts) / 1000).toFixed(2) + ' kWp' : '0 kWp';

        const invsTxt = carrinhoInversores.length > 0
            ? carrinhoInversores.map(i => `${i.qtd}x ${i.modelo}`).join(', ')
            : 'Nenhum selecionado';

        // CÁLCULO DE EXPANSÃO (Quantidade e Geração Futura)
        const wattsModulo = estadoSelecaoModulo.watts || 580;
        const qtdModulosAtual = estadoSelecaoModulo.qtd || 0;
        const potDCInstaladaWp = (wattsModulo * qtdModulosAtual);
        
        const potNominalTotalAC = carrinhoInversores.reduce((acc, i) => acc + (i.nominal * i.qtd), 0);
        
        // Limite técnico baseado no Oversizing configurado (ex: 150%)
        const overAlvo = parseFloat(document.getElementById('sel_oversizing')?.value) || 1.35;
        const limiteTecnicoExpansao = potNominalTotalAC * overAlvo;
        const wattsExpansao = limiteTecnicoExpansao - potDCInstaladaWp;
        const numPlacasExp = Math.floor(Math.max(0, wattsExpansao) / wattsModulo);
        
        const geracaoAtual = parseFloat(document.getElementById('fixo_geracao')?.innerText) || 0;
        const geracaoPorModulo = qtdModulosAtual > 0 ? geracaoAtual / qtdModulosAtual : 0;
        const geracaoExpansao = numPlacasExp * geracaoPorModulo;
        
        const expansaoTxt = `+${numPlacasExp} mod (+${Math.round(geracaoExpansao)} kWh)`;

        resumoDiv.innerHTML = `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid var(--primaria); padding: 12px 20px; margin-bottom: 25px; border-radius: 6px; display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between; font-size: 0.9rem; color: #475569; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div>
                    <div style="display:flex; align-items:center; gap:5px;"><span style="display:block; font-size:0.7rem; text-transform:uppercase; color:#94a3b8; font-weight:700; letter-spacing:0.5px;">Módulos</span> <button class="btn-icon-sm" onclick="window.navegarPeloMenu(1)" title="Editar Módulos"><i class="fas fa-pencil-alt"></i></button></div>
                    <strong style="color:#0f172a; font-size:1rem;">${modulosTxt}</strong> <span style="color:#64748b;">(${potTotal})</span>
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <div style="display:flex; align-items:center; gap:5px;"><span style="display:block; font-size:0.7rem; text-transform:uppercase; color:#94a3b8; font-weight:700; letter-spacing:0.5px;">Inversores</span> <button class="btn-icon-sm" onclick="window.navegarPeloMenu(2)" title="Editar Inversores"><i class="fas fa-pencil-alt"></i></button></div>
                    <strong style="color:#0f172a; font-size:1rem;">${invsTxt}</strong>
                </div>
                 <div>
                    <span style="display:block; font-size:0.7rem; text-transform:uppercase; color:#94a3b8; font-weight:700; letter-spacing:0.5px;">Expansão Futura</span>
                    <strong style="color:#0f172a; font-size:1rem;">${expansaoTxt}</strong>
                </div>
            </div>
        `;
    }

    window.avancarParaInversores = function () {
        if (typeof gerenciadorEtapas !== 'undefined') {
            gerenciadorEtapas.avancarPara('inversores');
            // Garante que o botão de navegação da próxima etapa seja renderizado
            atualizarComposicaoFinal();
        }
    };

    window.avancarParaFinanceiro = function () {
        if (typeof gerenciadorEtapas !== 'undefined') {
            gerenciadorEtapas.avancarPara('financeiro');
        }
    };

    window.avancarParaResumo = function () {
        if (typeof gerenciadorEtapas !== 'undefined') {
            gerenciadorEtapas.avancarPara('resumo');
        }
    };

    // ======================================================================
    // 🔌 MOTOR DE DIMENSIONAMENTO DE INVERSOR E EXPANSÃO
    // ======================================================================

    // --- ALGORITMO DE SUGESTÃO DE COMPOSIÇÕES ---
    // TODO: Mover lógica de engenharia para 'model.js' conforme documentacao_tecnica.md (Seção 5.2)
    function gerarSugestoesCompostas() {
        const potDCInstaladaWp = parseFloat(document.getElementById('potencia_dc_total').innerText) * 1000;
        if (!potDCInstaladaWp || potDCInstaladaWp <= 0) return [];

        const overAlvo = parseFloat(document.getElementById('sel_oversizing').value);
        const tipoRedeUC = document.getElementById('uc_tipo_padrao').value;
        const limiteExpansaoWp = potDCInstaladaWp * 2.1; // Limite de engenharia (2.1x)

        let sugestoes = [];

        // 1. Inversores Únicos
        inversoresHuawei.forEach(inv => {
            if (tipoRedeUC === "monofasico" && inv.tipo !== "monofásico") return;

            const capEntrada = inv.nom * overAlvo;
            // Aceita se cobrir a potência E não for absurdamente grande (max 1.5x o limite de expansão)
            if (capEntrada >= potDCInstaladaWp && capEntrada <= limiteExpansaoWp * 1.5) {
                sugestoes.push({
                    itens: [{ ...inv, qtd: 1 }],
                    capTotal: capEntrada,
                    score: inv.nom // Menor potência nominal = melhor custo
                });
            }
        });

        // 2. Combinações de 2 Inversores (Para potências maiores ou monofásicos grandes)
        if (potDCInstaladaWp > 3000) {
            for (let i = 0; i < inversoresHuawei.length; i++) {
                for (let j = i; j < inversoresHuawei.length; j++) {
                    const inv1 = inversoresHuawei[i];
                    const inv2 = inversoresHuawei[j];

                    // Filtro de rede
                    if (tipoRedeUC === "monofasico" && (inv1.tipo !== "monofásico" || inv2.tipo !== "monofásico")) continue;

                    const capCombinada = (inv1.nom + inv2.nom) * overAlvo;

                    if (capCombinada >= potDCInstaladaWp && capCombinada <= limiteExpansaoWp) {
                        // Verifica se são iguais para agrupar a quantidade
                        const itens = (i === j)
                            ? [{ ...inv1, qtd: 2 }]
                            : [{ ...inv1, qtd: 1 }, { ...inv2, qtd: 1 }];

                        sugestoes.push({
                            itens: itens,
                            capTotal: capCombinada,
                            // Penalidade de 15% no score para desencorajar multi-inversor se um único resolver
                            score: (inv1.nom + inv2.nom) * 1.15
                        });
                    }
                }
            }
        }

        // Ordena pelo Score (Menor custo/complexidade primeiro) e pega top 5
        return sugestoes.sort((a, b) => a.score - b.score).slice(0, 5);
    }

    function renderizarTabelaHuawei() {
        const corpo = document.getElementById('corpo_tabela_huawei');
        const corpoSugestoes = document.getElementById('corpo_tabela_sugestoes_inteligentes');
        const areaSugestoes = document.getElementById('area_sugestoes_inteligentes');

        // Premissas para cálculo de Geração Potencial
        const elHsp = document.getElementById('hsp_bruto');
        const hsp = elHsp ? (parseFloat(elHsp.innerText) || 0) : 0;

        const elPr = document.getElementById('fixo_pr_final');
        const prTexto = elPr ? elPr.innerText.replace('%', '') : '80';
        const pr = parseFloat(prTexto) / 100 || 0.80;

        // --- DADOS PARA CÁLCULO LINEAR (PROJEÇÃO REAL) ---
        const elGeracao = document.getElementById('fixo_geracao');
        const geracaoAtual = elGeracao ? (parseFloat(elGeracao.innerText) || 0) : 0;

        const elQtdMod = document.getElementById('total_modulos_projeto');
        const qtdModulosAtual = elQtdMod ? (parseInt(elQtdMod.value) || 0) : 0;

        const elModComp = document.getElementById('select_modulo_comparativo');
        const wattsModulo = elModComp ? (parseFloat(elModComp.value) || 580) : 580;

        const geracaoPorModulo = (qtdModulosAtual > 0) ? (geracaoAtual / qtdModulosAtual) : 0;

        // 1. HERANÇA DE DADOS DO PROJETO (Sincronização total com o Painel Geral)
        const elPotDC = document.getElementById('potencia_dc_total');
        const potDCInstaladaWp = elPotDC ? (parseFloat(elPotDC.innerText) * 1000) : 0;

        // Controle de visibilidade das sugestões
        if (potDCInstaladaWp > 0) {
            areaSugestoes.style.display = 'block';

            // RENDERIZA SUGESTÕES INTELIGENTES
            const sugestoes = gerarSugestoesCompostas();

            // ORDENAÇÃO: Menor expansão para maior expansão (Custo-Benefício)
            const potDCInstaladaWp = parseFloat(document.getElementById('potencia_dc_total').innerText) * 1000;
            const sugestoesOrdenadas = sugestoes.sort((a, b) => {
                const expA = Math.floor((a.capTotal - potDCInstaladaWp) / wattsModulo);
                const expB = Math.floor((b.capTotal - potDCInstaladaWp) / wattsModulo);
                return expA - expB;
            });

            const htmlRows = sugestoesOrdenadas.map((sug, index) => {
                // Transforma a composição em Badges visuais (ETIQUETAS)
                const htmlComposicao = sug.itens.map(it => {
                    const dadosInv = inversoresHuawei.find(i => i.mod === it.mod);
                    const classeFase = dadosInv?.tipo === 'trifásico' ? 'badge-tri' : 'badge-mono';
                    const siglaFase = dadosInv?.tipo === 'trifásico' ? '3Φ' : '1Φ';

                    return `<div class="composicao-item" style="display:flex; align-items:center; gap:5px; margin-bottom:2px;">
                        <span class="fase-tag ${classeFase}" style="font-size:10px; padding:2px 4px;">${siglaFase}</span>
                        <span class="modelo-txt" style="font-size:13px;">${it.qtd}x ${it.mod}</span>
                    </div>`;
                }).join('');

                const numPlacasExp = Math.floor((sug.capTotal - potDCInstaladaWp) / wattsModulo);

                // Cálculo da Geração Potencial (Linear ou Teórico)
                let geracaoPotencial;
                if (geracaoPorModulo > 0) {
                    // Linear: (Módulos Atuais + Expansão) * Geração por Módulo
                    const totalModulosFuturo = qtdModulosAtual + numPlacasExp;
                    geracaoPotencial = totalModulosFuturo * geracaoPorModulo;
                } else {
                    geracaoPotencial = (sug.capTotal / 1000) * hsp * 30.4166 * pr;
                }

                const isIdeal = index === 0; // O primeiro da lista ordenada é o ideal

                // Lógica de Classes UX
                const isSelecionado = estadoSelecaoInversor.tipo === 'SUGESTAO' && estadoSelecaoInversor.id === index;
                let classesLinha = 'inversor-sugerido';
                if (isIdeal) classesLinha += ' ideal';
                if (isSelecionado) classesLinha += ' selecionado';

                return `
                    <tr class="${classesLinha}">
                        <td class="col-detalhe-inv" style="vertical-align: middle; padding: 12px;">
                            ${isIdeal ? '<span class="badge-recomendado"><i class="fas fa-star"></i> RECOMENDADO</span><br>' : ''}
                            ${htmlComposicao}
                        </td>
                        <td>${(sug.capTotal / 1000).toFixed(1)} kWp</td>
                        <td style="text-align: center;">
                            <span class="badge-expansao">+${numPlacasExp} un</span>
                        </td>
                        <td style="text-align: center; font-weight: 600; color: #15803d;">
                            ${Math.round(geracaoPotencial)} kWh
                        </td>
                        <td style="text-align: center;">
                            <button class="btn-primary-sm" onclick="window.aplicarComposicao('${encodeURIComponent(JSON.stringify(sug.itens))}', ${index})">
                                <i class="fas fa-check"></i> Selecionar
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Envolve em tabela limpa se não estiver
            corpoSugestoes.innerHTML = htmlRows;

            if (sugestoes.length === 0) {
                corpoSugestoes.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b;">Nenhuma combinação automática encontrada. Use o catálogo abaixo.</td></tr>`;
            }

        } else {
            areaSugestoes.style.display = 'none';
        }

        const overAlvo = parseFloat(document.getElementById('sel_oversizing').value);
        const tipoRedeUC = document.getElementById('uc_tipo_padrao').value;
        const termoFiltro = document.getElementById('filtro_huawei').value.toLowerCase();

        // 3. FILTRAGEM, PRÉ-CÁLCULO E ORDENAÇÃO
        const listaProcessada = inversoresHuawei
            .filter(inv => {
                const atendeTexto = termoFiltro ? (inv.mod.toLowerCase().includes(termoFiltro) || inv.nom.toString().includes(termoFiltro)) : true;
                if (tipoRedeUC === "monofasico" && inv.tipo !== "monofásico") return false;
                return atendeTexto;
            })
            .map(inv => {
                const capMaxUnit = inv.nom * overAlvo;
                // PRÉ-CÁLCULO: Quantidade necessária para cobrir a potência DC
                const qtdNecessaria = Math.ceil(potDCInstaladaWp / capMaxUnit) || 1;

                // Cálculo da Geração Potencial Total (Qtd * Unitário)
                let geracaoPotencialTotal;
                if (geracaoPorModulo > 0) {
                    const maxModulosCabem = Math.floor((capMaxUnit * qtdNecessaria) / wattsModulo);
                    geracaoPotencialTotal = maxModulosCabem * geracaoPorModulo;
                } else {
                    geracaoPotencialTotal = ((capMaxUnit * qtdNecessaria) / 1000) * hsp * 30.4166 * pr;
                }

                return {
                    ...inv,
                    qtdCalculada: qtdNecessaria,
                    geracaoTotal: geracaoPotencialTotal,
                    capMaxUnit: capMaxUnit
                };
            })
            // Regra 3: Limite superior visual (evita inversores gigantescos onde 1 já sobra muito)
            // Exibe se a capacidade total for razoável OU se for um inversor pequeno (para composição)
            .filter(inv => (inv.capMaxUnit * inv.qtdCalculada) <= (potDCInstaladaWp * 2.5) || inv.qtdCalculada > 1)
            .sort((a, b) => a.geracaoTotal - b.geracaoTotal); // ORDENAÇÃO: Geração Máxima Crescente

        // 4. RENDERIZAÇÃO LIMPA
        if (listaProcessada.length === 0) {
            corpo.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">
                Nenhum inversor Huawei compatível encontrado para ${(potDCInstaladaWp / 1000).toFixed(1)} kWp (${tipoRedeUC}).
            </td></tr>`;
            return;
        }

        const htmlManual = listaProcessada.map((inv, index) => {
            // Lógica de Classes UX (Manual)
            const isSelecionado = estadoSelecaoInversor.tipo === 'MANUAL' && estadoSelecaoInversor.id === inv.mod;
            const classeManual = isSelecionado ? 'item-inversor-manual selecionado' : 'item-inversor-manual';

            // Usa os valores pré-calculados
            const geracaoDisplay = Math.round(inv.geracaoTotal);

            return `
                <tr class="${classeManual}">
                    <td>
                        <strong>${inv.mod}</strong>
                    </td>
                    <td>
                        ${(inv.nom / 1000).toFixed(1)} kW<br>
                        <small class="tag-tipo">${inv.tipo}</small>
                    </td>
                    <td style="text-align: center;">${inv.mppt}</td>
                    <td>${(inv.capMaxUnit / 1000).toFixed(1)} kWp</td>
                    
                    <td style="text-align: center;">
                        <input type="number" id="qtd_${inv.mod.replace(/\s/g, '')}" value="${inv.qtdCalculada}" min="1" max="10" class="input-qtd-tabela" oninput="window.atualizarPotencialLinha('${inv.mod}', ${inv.nom})">
                    </td>

                    <td style="text-align: center; font-weight: 600; color: #64748b;">
                        <span id="potencial_${inv.mod.replace(/\s/g, '')}">${geracaoDisplay} kWh</span>
                    </td>
                    
                    <td style="text-align: center;">
                        <button class="btn-secundario-sm" 
                            onclick="window.adicionarAoCarrinho('${inv.mod}', ${inv.nom}, '${inv.tipo}')">
                            <i class="fas fa-plus"></i> Adicionar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        corpo.innerHTML = htmlManual;

    }

    // NOVA FUNÇÃO: Atualiza a coluna de Geração Máxima em tempo real ao digitar a quantidade
    window.atualizarPotencialLinha = function (modelo, nominal) {
        const idQtd = `qtd_${modelo.replace(/\s/g, '')}`;
        const idDestino = `potencial_${modelo.replace(/\s/g, '')}`;
        const elQtd = document.getElementById(idQtd);
        const elDestino = document.getElementById(idDestino);

        if (!elQtd || !elDestino) return;

        const qtd = parseInt(elQtd.value) || 0;
        const over = parseFloat(document.getElementById('sel_oversizing').value) || 1.0;
        
        const elHsp = document.getElementById('hsp_bruto');
        const hsp = elHsp ? (parseFloat(elHsp.innerText) || 0) : 0;

        const elPr = document.getElementById('fixo_pr_final');
        const pr = elPr ? (parseFloat(elPr.innerText.replace('%', '')) / 100 || 0.80) : 0.80;

        // Dados para cálculo linear
        const elGeracao = document.getElementById('fixo_geracao');
        const geracaoAtual = elGeracao ? (parseFloat(elGeracao.innerText) || 0) : 0;

        const elQtdMod = document.getElementById('total_modulos_projeto');
        const qtdModulosAtual = elQtdMod ? (parseInt(elQtdMod.value) || 0) : 0;

        const elModComp = document.getElementById('select_modulo_comparativo');
        const wattsModulo = elModComp ? (parseFloat(elModComp.value) || 580) : 580;

        const capMaxDC_Watts = nominal * qtd * over;

        let geracaoPotencial;
        if (qtdModulosAtual > 0 && geracaoAtual > 0) {
            const geracaoPorModulo = geracaoAtual / qtdModulosAtual;
            const maxModulosCabem = Math.floor(capMaxDC_Watts / wattsModulo);
            geracaoPotencial = maxModulosCabem * geracaoPorModulo;
        } else {
            geracaoPotencial = (capMaxDC_Watts / 1000) * hsp * 30.4166 * pr;
        }

        elDestino.innerText = Math.round(geracaoPotencial) + " kWh";
    }

    // ======================================================================
    // ⚙️ MOTOR DE OPCIONAIS PREMIUM (Instalação Industrial)
    // ======================================================================
    function renderizarOpcionaisPremium() {
        // Target the wrapper to replace the entire content with the new Clean Table design
        const containerWrapper = document.getElementById('container_opcionais_premium');
        if (!containerWrapper) return;

        // 1. Captura estado atual para preservar seleções durante re-renderização
        const estadoAnterior = {};
        // Check if we have rendered before by looking for checkboxes inside the wrapper
        const checkboxesExistentes = containerWrapper.querySelectorAll('.chk-opcional');
        const teveRenderizacao = checkboxesExistentes.length > 0;
        checkboxesExistentes.forEach(chk => {
            estadoAnterior[chk.dataset.id] = chk.checked;
        });

        // 2. Dados do Projeto e Configuração
        const config = db.buscarConfiguracao('premissas_globais') || {};
        const pMatPrem = config.materiaisPremium || {};
        
        const tipoRede = document.getElementById('uc_tipo_padrao')?.value || 'monofasico';
        const isTrifasico = tipoRede.toLowerCase().includes('trif');
        
        // Quantidade de Inversores (Mínimo 1 para exibição inicial)
        const qtdInversores = Math.max(1, carrinhoInversores.reduce((acc, i) => acc + i.qtd, 0));
        
        // Potência Total (para decisão de eletrocalha)
        const potTotalAC_kW = carrinhoInversores.reduce((acc, i) => acc + (i.nominal * i.qtd), 0) / 1000;
        const limitePotencia = pMatPrem.limite_potencia_mono || 12;

        // 3. Definição Dinâmica dos Itens (Lógica de Engenharia)
        const itens = [];

        // A. QDG (Filtrado por Rede)
        if (isTrifasico) {
            itens.push({ 
                id: "qdg_trif", 
                nome: "QDG Trifásico", 
                badge: "Trifásico",
                valor: pMatPrem.va_qdg_trif_premum || 300.00, 
                obrigatorio: false, 
                selecionadoPadrao: true 
            });
        } else {
            itens.push({ 
                id: "qdg_mono", 
                nome: "QDG Monofásico", 
                badge: "Monofásico",
                valor: pMatPrem.va_qdg_mono_premium || 150.00, 
                obrigatorio: false, 
                selecionadoPadrao: true 
            });
        }

        // B. Eletrocalha (Decisão Técnica 50mm vs 100mm baseada em potência/qtd)
        // Regra: > Limite(12kW) OU > 1 Inversor usa 100mm
        const usa100mm = potTotalAC_kW > limitePotencia || qtdInversores > 1;
        const custoEletrocalhaUnit = usa100mm ? (pMatPrem.va_eletrocalha_100 || 158.00) : (pMatPrem.va_eletrocalha_50 || 85.00);
        const nomeEletrocalha = "Eletrocalha Galvanizada";
        const dimEletrocalha = usa100mm ? "100mm" : "50mm";
        
        itens.push({
            id: "eletrocalha_dinamica",
            nome: nomeEletrocalha,
            badge: dimEletrocalha,
            qtd: qtdInversores,
            valor: custoEletrocalhaUnit * qtdInversores,
            obrigatorio: false,
            selecionadoPadrao: true
        });

        // C. Bloco de Distribuição (Qtd baseada na rede: 3 para Mono/Bi, 5 para Tri)
        const qtdBlocos = isTrifasico ? 5 : 3;
        const custoBlocoUnit = pMatPrem.va_bloco_distribuicao || 90.00;
        
        itens.push({
            id: "bloco_dist",
            nome: "Blocos de Distribuição DIN",
            badge: isTrifasico ? "5 Polos" : "3 Polos",
            qtd: qtdBlocos,
            valor: custoBlocoUnit * qtdBlocos,
            obrigatorio: false,
            selecionadoPadrao: true
        });

        // D. Tampa Acrílico (1 Por Inversor)
        const custoTampaUnit = pMatPrem.va_tampa_acrilico || 335.00;
        
        itens.push({
            id: "tampa_acrilico",
            nome: "Proteção Acrílica (QDG)",
            badge: "Padrão",
            qtd: qtdInversores,
            valor: custoTampaUnit * qtdInversores,
            obrigatorio: false,
            selecionadoPadrao: true
        });

        // RENDERIZAÇÃO DA TABELA CLEAN
        let html = `
            <div class="card-tecnico" style="margin-top: 10px; padding: 10px 15px;">
                <h4 style="color: #334155; font-size: 0.9rem; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;"><i class="fas fa-microchip" style="color: #ffcc00;"></i> Composição Técnica Premium</h4>
                <table class="tabela-transversal" style="font-size: 0.85rem;">
                    <thead>
                        <tr>
                            <th style="width: 30px; text-align: center; padding: 4px;">Inc.</th>
                            <th style="padding: 4px;">Item de Infraestrutura</th>
                            <th style="padding: 4px;">Dimensionamento</th>
                            <th style="text-align: center; padding: 4px;">Qtd</th>
                            <th style="text-align: right; padding: 4px;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        html += itens.map(item => {
            let isChecked = item.selecionadoPadrao;
            
            // Se já existia no DOM, preserva a escolha do usuário
            if (teveRenderizacao && estadoAnterior.hasOwnProperty(item.id)) {
                isChecked = estadoAnterior[item.id];
            }
            
            if (item.obrigatorio) isChecked = true;

            const checkedAttr = isChecked ? 'checked' : '';
            const isDisabled = item.obrigatorio ? 'disabled' : '';
            const qtdDisplay = item.qtd ? `${item.qtd} un` : '1 un';
            const valorDisplay = item.valor.toLocaleString('pt-br', {style: 'currency', currency: 'BRL'});

            return `
                <tr style="height: 32px;">
                    <td style="text-align: center; padding: 2px;">
                        <input type="checkbox" 
                               class="chk-opcional input-financeiro" 
                               style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--primaria, #16a34a);"
                               data-id="${item.id}" 
                               data-valor="${item.valor}"
                               ${checkedAttr}
                               ${isDisabled}
                               onchange="window.calcularEngenhariaFinanceira()">
                    </td>
                    <td style="color: #334155; font-weight: 500; padding: 2px 5px;">${item.nome}</td>
                    <td style="padding: 2px 5px;"><span class="badge" style="background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem;">${item.badge}</span></td>
                    <td style="text-align: center; color: #64748b; padding: 2px 5px;">${qtdDisplay}</td>
                    <td style="text-align: right; color: #0f172a; font-weight: 600; padding: 2px 5px;">${valorDisplay}</td>
                </tr>
            `;
        }).join('');

        html += `</tbody></table></div>`;
        
        containerWrapper.innerHTML = html;
    }

    // ======================================================================
    // 🛒 LÓGICA DO CARRINHO DE INVERSORES (MULTI-INVERSOR)
    // ======================================================================

    window.aplicarComposicao = function (itensJson, indexSugestao) {
        const itens = JSON.parse(decodeURIComponent(itensJson));
        carrinhoInversores = []; // Limpa o carrinho atual

        itens.forEach(it => {
            // Adiciona diretamente ao carrinho
            carrinhoInversores.push({ modelo: it.mod, nominal: it.nom, tipo: it.tipo, qtd: it.qtd });
        });

        // Atualiza estado visual
        estadoSelecaoInversor = { tipo: 'SUGESTAO', id: indexSugestao };
        renderizarTabelaHuawei(); // Re-renderiza para aplicar classes

        // REMOVIDO AVANÇO AUTOMÁTICO
        // gerenciadorEtapas.avancarPara('financeiro');

        atualizarComposicaoFinal();
    }

    window.adicionarAoCarrinho = function (modelo, nominal, tipo) {
        const qtdInput = document.getElementById(`qtd_${modelo.replace(/\s/g, '')}`);
        const qtd = parseInt(qtdInput ? qtdInput.value : 1) || 1;

        // Verifica se já existe, se sim aumenta a qtd, se não adiciona
        const index = carrinhoInversores.findIndex(i => i.modelo === modelo);
        if (index > -1) {
            carrinhoInversores[index].qtd += qtd;
        } else {
            carrinhoInversores.push({ modelo, nominal, tipo, qtd });
        }

        // Atualiza estado visual para Manual
        estadoSelecaoInversor = { tipo: 'MANUAL', id: modelo };
        renderizarTabelaHuawei(); // Re-renderiza para aplicar classes

        // REMOVIDO AVANÇO AUTOMÁTICO
        // gerenciadorEtapas.avancarPara('financeiro');

        atualizarComposicaoFinal();
    }

    window.removerDoCarrinho = function (index) {
        carrinhoInversores.splice(index, 1);
        atualizarComposicaoFinal();

        // Se esvaziar, limpa a seleção visual
        if (carrinhoInversores.length === 0) {
            estadoSelecaoInversor = { tipo: null, id: null };
            renderizarTabelaHuawei();
            // Se esvaziar, garante que estamos na etapa de Inversores e limpa o financeiro
            gerenciadorEtapas.recuarPara('inversores');
        }
    }

    function atualizarComposicaoFinal() {
        const container = document.getElementById('container_selecionados');
        const lista = document.getElementById('lista_inversores_escolhidos');
        const resumo = document.getElementById('resumo_tecnico_combinado');
        const overAlvo = parseFloat(document.getElementById('sel_oversizing').value);

        // Exibe ou oculta o container de itens selecionados
        if (carrinhoInversores.length === 0) {
            container.style.display = 'none';
            gerenciarEstadoCalculo('INVALIDAR');
        } else {
            container.style.display = 'block';
        }

        // 1. Dados do Projeto
        const elPotDC = document.getElementById('potencia_dc_total');
        const potDCInstaladaWp = elPotDC ? (parseFloat(elPotDC.innerText) * 1000) : 0;

        const elHsp = document.getElementById('hsp_bruto');
        const hsp = elHsp ? (parseFloat(elHsp.innerText) || 5.0) : 5.0;

        // Recalcula PR (Unificado)
        const elGeracao = document.getElementById('fixo_geracao');
        const geracaoX_Projeto = elGeracao ? (parseFloat(elGeracao.innerText) || 0) : 0;

        const prProjeto = geracaoX_Projeto > 0 && potDCInstaladaWp > 0 && hsp > 0
            ? (geracaoX_Projeto * 1000) / (potDCInstaladaWp * hsp * 30.4166)
            : 0.83;

        let capTotalEntradaDC = 0;
        let potNominalTotalAC = 0; // Soma das potências nominais dos inversores
        let htmlCarrinho = "";

        // 2. Renderiza Lista e Soma Capacidades
        carrinhoInversores.forEach((inv, idx) => {
            const capDC = inv.nominal * overAlvo * inv.qtd;
            capTotalEntradaDC += capDC;
            potNominalTotalAC += (inv.nominal * inv.qtd);
            htmlCarrinho += `
                <li class="tag-inversor-selecionado">
                    <strong>${inv.qtd}x</strong>&nbsp;${inv.modelo}
                    <span style="font-weight:normal; margin-left:5px; font-size:0.8em; color:#64748b;">
                        (${(capDC / 1000).toFixed(1)} kWp)
                    </span>
                    <i class="fas fa-times-circle" onclick="window.removerDoCarrinho(${idx})" title="Remover"></i>
                </li>`;
        });

        lista.innerHTML = htmlCarrinho;

        // 3. Cálculos Combinados
        // CÁLCULO DE OVERLOADING REAL (DC/AC)
        const ratioOverloading = potNominalTotalAC > 0 ? (potDCInstaladaWp / potNominalTotalAC) : 0;
        const percentualCarregamento = ratioOverloading * 100;

        // CÁLCULO DE EXPANSÃO LINEAR
        const wattsModulo = parseFloat(document.getElementById('select_modulo_comparativo').value) || 580;
        const qtdModulosAtual = parseInt(document.getElementById('total_modulos_projeto').value) || 0;

        // A expansão é baseada no limite seguro do inversor (ex: 1.35x) menos o que já está instalado
        // Se o inversor já está saturado (Overloading alto), a expansão é zero.
        const limiteTecnicoExpansao = potNominalTotalAC * overAlvo; // Usa o limite configurado (ex: 150%)
        const wattsExpansao = limiteTecnicoExpansao - potDCInstaladaWp;
        const numPlacasExp = Math.floor(Math.max(0, wattsExpansao) / wattsModulo);

        // Cálculo Linear: (Geração Atual / Qtd Atual) * (Qtd Atual + Expansão)
        const geracaoMaximaTotal = qtdModulosAtual > 0 ? (geracaoX_Projeto / qtdModulosAtual) * (qtdModulosAtual + numPlacasExp) : 0;

        // 4. Validações Técnicas (Clipping e Overloading)
        let avisos = [];
        statusTecnicoSistema = { valido: true, nivel: 'OK', mensagem: '' };

        // NÍVEL 1: CRÍTICO (> 150%)
        if (ratioOverloading > 1.50) {
            avisos.push(`<div class='alerta-critico'><i class="fas fa-radiation-alt"></i> <strong>CRÍTICO: Overloading de ${percentualCarregamento.toFixed(0)}%</strong>. O inversor está perigosamente subdimensionado. Risco de perda de garantia e danos. <strong>A proposta será bloqueada.</strong></div>`);
            statusTecnicoSistema = { valido: false, nivel: 'CRITICO', mensagem: 'Overloading Excessivo' };
        }
        // NÍVEL 2: ALERTA DE CLIPPING (> 130%)
        else if (ratioOverloading > 1.30) {
            avisos.push(`<div class='alerta-atencao'><i class="fas fa-exclamation-triangle"></i> <strong>Atenção: Overloading de ${percentualCarregamento.toFixed(0)}%</strong>. O sistema operará com Clipping (perda de energia) nos horários de pico. Verifique se isso é intencional.</div>`);
            statusTecnicoSistema = { valido: true, nivel: 'ATENCAO', mensagem: 'Risco de Clipping' };
        }
        // NÍVEL 3: SUBUTILIZADO (< 80%)
        else if (ratioOverloading < 0.80) {
            avisos.push(`<div class='alerta-info'><i class="fas fa-info-circle"></i> <strong>Inversor Superdimensionado (${percentualCarregamento.toFixed(0)}%):</strong> O inversor está trabalhando com folga excessiva. Considere aumentar os painéis ou reduzir o inversor para otimizar o custo.</div>`);
            statusTecnicoSistema = { valido: true, nivel: 'INFO', mensagem: 'Inversor Ocioso' };
        }
        // NÍVEL 4: IDEAL
        else {
            avisos.push(`<div class='alerta-sucesso'><i class="fas fa-check-circle"></i> <strong>Dimensionamento Ideal (${percentualCarregamento.toFixed(0)}%):</strong> Excelente relação custo-benefício e eficiência energética.</div>`);
        }

        // Validação de Potência Absoluta (Caso o usuário force manual muito errado)
        if (potNominalTotalAC * 2 < potDCInstaladaWp / 1000) {
            avisos.push(`<div class='alerta-erro'><i class="fas fa-ban"></i> <strong>Erro Fatal:</strong> Potência DC é mais que o dobro da AC. Configuração inválida.</div>`);
            statusTecnicoSistema.valido = false;
        }

        // Aviso de Multi-Inversor
        const qtdTotalInversores = carrinhoInversores.reduce((acc, i) => acc + i.qtd, 0);
        if (qtdTotalInversores > 1) {
            avisos.push(`<div class='alerta-info-suave'><i class="fas fa-layer-group"></i> <strong>Sistema Multi-Inversor:</strong> Custos ajustados para ${qtdTotalInversores} equipamentos.</div>`);
        } else {
            // Limpa avisos antigos se voltou para 1 inversor
        }

        // Aviso de Seleção Manual
        if (estadoSelecaoInversor.tipo === 'MANUAL') {
            avisos.push(`<div class='alerta-aviso' style="color: #b45309; background: #fffbeb; border: 1px dashed #f59e0b; padding: 8px; border-radius: 6px; margin-top: 5px;"><i class="fas fa-hand-paper"></i> <strong>Seleção Manual:</strong> Esta configuração foi definida manualmente pelo engenheiro.</div>`);
        }

        // 5. Renderiza Resumo Técnico
        resumo.innerHTML = `
            <div class="grid-resumo" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 0.9rem;">
                <div>Geração Atual:<br><strong>${geracaoX_Projeto.toFixed(0)} kWh</strong></div>
                <div>Expansão:<br><strong>+${numPlacasExp} un.</strong></div>
                <div style="color: #15803d;">Geração Máxima:<br><strong id="gen_max_txt">${geracaoMaximaTotal.toFixed(0)} kWh</strong></div>
            </div>
            ${avisos.length > 0 ? `<div class="avisos-tecnicos" style="margin-top: 10px;">${avisos.join('')}</div>` : ''}
        `;

        // ATUALIZAÇÃO DOS OPCIONAIS PREMIUM (Quantidades Dinâmicas baseadas nos inversores)
        renderizarOpcionaisPremium();

        // Chama a validação final
        validarBotaoFinal();

        // ATUALIZAÇÃO FINANCEIRA AUTOMÁTICA
        // Garante que mudanças nos inversores (complexidade) ou módulos (quantidade) reflitam no preço
        if (carrinhoInversores.length > 0) {
            window.calcularEngenhariaFinanceira();
        }

        // Renderiza o botão de avançar SEMPRE, mas desabilitado se vazio
        // Alvo alterado para 'card-dimensionamento-inversor' para ficar visível mesmo com carrinho vazio
        const temItens = carrinhoInversores.length > 0;

        // Atualiza o resumo superior (caso esteja visível ou vá ficar)
        renderizarResumoSuperiorFinanceiro();

        renderizarBotaoNavegacao('card-dimensionamento-inversor', 'window.avancarParaFinanceiro()', temItens ? 'Inversores Definidos' : 'Selecione os Inversores', 'Avançar para Financeiro', temItens);
    }

    window.filtrarTabelaHuawei = function () {
        renderizarTabelaHuawei();
    };

    window.toggleListaCompleta = function () {
        const lista = document.getElementById('lista_completa_scroll');
        if (lista.style.display === 'none') {
            lista.style.display = 'block';
        } else {
            lista.style.display = 'none';
        }
    }

    function prepararListaCompleta(listaRestante, pMinimaKwp) {
        const container = document.getElementById('lista_completa_scroll');
        if (!container) return;

        let tableHTML = '<table class="tabela-tecnica"><thead><tr><th>Modelo</th><th>Qtd</th><th>Pot. Total</th><th>Ação</th></tr></thead><tbody>';
        listaRestante.forEach(mod => {
            tableHTML += `
                <tr>
                    <td>${mod.watts}W</td>
                    <td>${mod.quantidade} un</td>
                    <td>${mod.potenciaTotal.toFixed(2)} kWp</td>
                    <td><button class="btn-selecionar" onclick="window.validarEConfirmarModulo(${mod.watts}, ${mod.quantidade}, ${pMinimaKwp})">Selecionar</button></td>
                </tr>
            `;
        });
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    }

    // ======================================================================
    // 📐 MOTOR DE ORIENTAÇÃO COMPOSTA
    // ======================================================================
    window.alternarModoOrientacao = function (modo) {
        modoOrientacao = modo;
        const subSimples = document.getElementById('subsecao_simples');
        const subComposto = document.getElementById('subsecao_composto');

        if (modo === 'simples') {
            subSimples.style.display = 'block';
            subComposto.style.display = 'none';
        } else {
            subSimples.style.display = 'none';
            subComposto.style.display = 'block';
            // Se a tabela composta estiver vazia, cria a primeira linha espelhando o modo simples
            if (document.getElementById('container_orientacoes_compostas').children.length === 0) {
                window.adicionarLinhaOrientacao(true);
            }
        }
        recalcularDimensionamento();
    };

    window.adicionarLinhaOrientacao = function (primeira = false) {
        const container = document.getElementById('container_orientacoes_compostas');
        const azimuteGeral = document.getElementById('azimute_geral').value;
        const inclinacaoGeral = document.getElementById('inclinacao_geral').value;

        const div = document.createElement('div');
        div.className = 'linha-orientacao';
        div.innerHTML = `
            <div class="grupo-form">
                <label>% da Potência</label>
                <input type="number" class="input-perc input-monitorado" value="${primeira ? 100 : 0}" oninput="window.validarSomaOrientacao(true)">
            </div>
            <div class="grupo-form">
                <label>Azimute (°)</label>
                <input type="number" class="input-az input-monitorado" value="${azimuteGeral}">
            </div>
            <div class="grupo-form">
                <label>Inclinação (°)</label>
                <input type="number" class="input-inc input-monitorado" value="${inclinacaoGeral}">
            </div>
            <div class="grupo-form">
                <label>&nbsp;</label>
                <button class="btn-remover-linha" onclick="window.removerLinhaOrientacao(this)"><i class="fas fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);

        // Se não for a primeira linha, zera o 100% da linha anterior para forçar o usuário a redistribuir
        if (!primeira && container.children.length > 1) {
            const primeiraLinhaPercInput = container.children[0].querySelector('.input-perc');
            if (primeiraLinhaPercInput.value === '100') {
                primeiraLinhaPercInput.value = '';
            }
        }

        // Re-atribui listeners para os novos inputs
        div.querySelectorAll('.input-monitorado').forEach(input => {
            input.addEventListener('change', handlePremiseChange);
        });

        window.validarSomaOrientacao();
    };

    window.removerLinhaOrientacao = function (btn) {
        const container = document.getElementById('container_orientacoes_compostas');
        if (container.children.length > 1) {
            btn.closest('.linha-orientacao').remove();
            window.validarSomaOrientacao();
            recalcularDimensionamento();
        } else {
            alert("É necessário manter pelo menos uma orientação.");
        }
    };

    window.validarSomaOrientacao = function (apenasVisual = false) {
        if (modoOrientacao === 'simples') return true;

        const inputs = document.querySelectorAll('#container_orientacoes_compostas .input-perc');
        let soma = 0;
        inputs.forEach(input => {
            soma += parseFloat(input.value) || 0;
        });

        const statusEl = document.getElementById('status_soma_perc');
        statusEl.innerText = `Total: ${soma}%`;

        // Usa tolerância para float (ex: 99.999...)
        if (Math.abs(soma - 100) < 0.1) {
            statusEl.style.color = '#16a34a'; // Verde
            if (!apenasVisual) recalcularDimensionamento();
            atualizarEstadoBotaoPremissas(); // Atualiza botão em tempo real
            return true;
        } else {
            statusEl.style.color = '#dc2626'; // Vermelho
            gerenciarEstadoCalculo('INVALIDAR');
            atualizarEstadoBotaoPremissas(); // Atualiza botão em tempo real (bloqueia)
            return false;
        }
    };

    // --- NOVA FUNÇÃO: VERIFICAR TIPO DE ESTRUTURA (SOLO/LAJE) ---
    window.verificarTipoEstrutura = function () {
        const selectEst = document.getElementById('select_tipo_estrutura');
        const wrapperOrigem = document.getElementById('wrapper_origem_estrutura');

        if (!selectEst) return;

        const tipo = selectEst.value.toLowerCase();

        // Lógica visual: Só mostra a origem se for Solo ou Laje
        if (tipo.includes('solo') || tipo.includes('laje')) {
            if (wrapperOrigem) wrapperOrigem.style.display = 'block';
        } else {
            if (wrapperOrigem) wrapperOrigem.style.display = 'none';
        }

        // Chama o recálculo para atualizar diárias e custos de estrutura
        if (typeof window.calcularEngenhariaFinanceira === 'function') {
            window.calcularEngenhariaFinanceira();
        }
    };

    // Função para expandir/recolher seções
    window.toggleSecao = function (idConteudo, idIcone) {
        const conteudo = document.getElementById(idConteudo);
        const icone = document.getElementById(idIcone);

        if (conteudo.style.display === "block") {
            conteudo.style.display = "none";
            icone.classList.remove('rotated');
        } else {
            conteudo.style.display = "block";
            icone.classList.add('rotated');
        }
    };

    function sincronizarGeralParaComposto() {
        const linhas = document.querySelectorAll('#container_orientacoes_compostas .linha-orientacao');
        if (linhas.length === 1) {
            linhas[0].querySelector('.input-az').value = document.getElementById('azimute_geral').value;
            linhas[0].querySelector('.input-inc').value = document.getElementById('inclinacao_geral').value;
        }
    };

    // --- NOVA FUNÇÃO: Validação em Tempo Real das Premissas ---
    function atualizarEstadoBotaoPremissas() {
        // 1. Validação de Consumo
        const consumo = parseFloat(document.getElementById('uc_consumo')?.value) || 0;
        const consumoValido = consumo > 0;

        // 2. Validação de Orientação (Geometria)
        let orientacaoValida = true;
        if (modoOrientacao === 'composto') {
            const inputs = document.querySelectorAll('#container_orientacoes_compostas .input-perc');
            let soma = 0;
            inputs.forEach(input => soma += parseFloat(input.value) || 0);
            orientacaoValida = (Math.abs(soma - 100) < 0.1);
        } else {
            // Modo Simples: Verifica se Azimute e Inclinação estão preenchidos e são números
            const az = document.getElementById('azimute_geral')?.value;
            const inc = document.getElementById('inclinacao_geral')?.value;
            orientacaoValida = (az !== '' && inc !== '' && !isNaN(parseFloat(az)) && !isNaN(parseFloat(inc)));
        }

        // 3. Validação de Perdas (Campos Críticos)
        const efici = document.getElementById('p_efici_inv')?.value;
        const perdasValidas = (efici !== '' && !isNaN(parseFloat(efici)));

        const premissasValidas = consumoValido && orientacaoValida && perdasValidas;

        let textoFeedback = 'Premissas Definidas';
        if (!consumoValido) textoFeedback = 'Informe o Consumo';
        else if (!orientacaoValida) textoFeedback = 'Verifique Orientação/Inclinação';
        else if (!perdasValidas) textoFeedback = 'Verifique os Parâmetros de Perdas';

        // POSICIONAMENTO EXTERNO (Abaixo do Card de Perdas ou Geometria)
        const cardPerdas = document.getElementById('card_perdas');
        const cardGeometria = document.getElementById('card_geometria');
        const anchorElement = cardPerdas || cardGeometria;

        if (anchorElement) {
            // 1. Limpa qualquer botão de navegação DENTRO do card (legado)
            const btnInterno = anchorElement.querySelector('.area-acao-navegacao');
            if (btnInterno) btnInterno.remove();

            // Remove botão solto legado se existir (Limpeza de HTML estático)
            const btnSolto = anchorElement.querySelector('button[onclick*="confirmarPremissasEAvançar"]');
            if (btnSolto) btnSolto.remove();

            // 2. Garante que existe o container externo
            let navContainer = document.getElementById('nav_premissas_externo');
            if (!navContainer) {
                navContainer = document.createElement('div');
                navContainer.id = 'nav_premissas_externo';
                navContainer.className = 'container-navegacao-externa';
                // Insere visualmente após o elemento âncora
                anchorElement.insertAdjacentElement('afterend', navContainer);
            }

            // 3. Renderiza o botão no container externo
            renderizarBotaoNavegacao('nav_premissas_externo', 'window.confirmarPremissasEAvançar()', textoFeedback, 'Avançar para Módulos', premissasValidas);
        }
    }

    // --- Event Listeners ---
    const inputsGatilho = document.querySelectorAll('.input-monitorado');
    inputsGatilho.forEach(input => {
        // Higieniza em tempo real
        input.addEventListener('input', (e) => {
            // Ignora elementos SELECT para evitar que o texto das opções seja apagado pela higienização numérica
            if (e.target.tagName === 'SELECT') return;

            const valorOriginal = e.target.value;
            const valorHigienizado = higienizarParaCalculo(valorOriginal);
            if (valorOriginal !== valorHigienizado) {
                e.target.value = valorHigienizado;
            }
        });
        // Dispara o recálculo na mudança
        input.removeEventListener('change', handlePremiseChange); // Evita duplicatas
        input.addEventListener('change', handlePremiseChange);
    });

    // Listener específico para validação em tempo real do Consumo
    if (inputConsumo) {
        inputConsumo.addEventListener('input', atualizarEstadoBotaoPremissas);
    }

    // Listeners específicos para campos de perdas (Garantia de Reatividade)
    const inputsPerdas = [pEficiInv, pTempInv, pTempMod, pCabosTotal, pExtras, pIndisp];
    inputsPerdas.forEach(input => {
        if (input) {
            input.removeEventListener('change', handlePremiseChange);
            input.addEventListener('change', handlePremiseChange);
        }
    });

    // Listeners específicos para campos financeiros (não resetam engenharia)
    const inputsFinanceiros = document.querySelectorAll('.input-financeiro');
    inputsFinanceiros.forEach(input => {
        // Ao tocar no financeiro, garante que estamos na etapa financeira (se já passamos pelos inversores)
        // input.addEventListener('focus', () => gerenciadorEtapas.avancarPara('financeiro'));

        // Usa 'input' para cálculo em tempo real ou 'change' para cálculo ao sair
        input.addEventListener('input', () => window.calcularEngenhariaFinanceira());
    });

    // Garante que fator de lucro, imposto e kit disparem o recálculo explicitamente
    const idsFinanceiros = ['prem_fator_lucro', 'prem_aliquota_imposto', 'valor_kit_fornecedor', 'prem_lucro_minimo'];
    idsFinanceiros.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // el.addEventListener('focus', () => gerenciadorEtapas.avancarPara('financeiro'));
            el.addEventListener('input', () => window.calcularEngenhariaFinanceira());
        }
    });

    // Listeners para Estrutura (Correção do Erro ReferenceError)
    const selectOrigemListener = document.getElementById('select_origem_estrutura');
    if (selectOrigemListener) {
        selectOrigemListener.addEventListener('change', () => window.calcularEngenhariaFinanceira());
    }

    // Listener para Origem da Venda (Garante recálculo de comissão)
    const selectOrigemVendaListener = document.getElementById('origem_venda');
    if (selectOrigemVendaListener) {
        selectOrigemVendaListener.addEventListener('change', () => window.calcularEngenhariaFinanceira());
    }

    // ======================================================================
    // 💲 MOTOR DE ENGENHARIA FINANCEIRA (CÁLCULO DE PREÇO)
    // ======================================================================

    // TODO: Mover lógica financeira para 'model.js' conforme documentacao_tecnica.md (Seção 5.2)
    window.calcularEngenhariaFinanceira = function () {
        // Define a função de formatação no início do escopo para evitar ReferenceError
        const formatarMoeda = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const premissas = db.buscarConfiguracao('premissas_globais');
        const aba = projetoGerenciador.abaAtiva;

        // Elementos DOM
        const elQtdModulos = document.getElementById('total_modulos_projeto');
        const elOrigemEstrutura = document.getElementById('select_origem_estrutura');
        const elFatorLucro = document.getElementById('prem_fator_lucro');
        const elValorKit = document.getElementById('valor_kit_fornecedor');
        const elImposto = document.getElementById('prem_aliquota_imposto');
        const elLucroMinimo = document.getElementById('prem_lucro_minimo');
        // Origem da venda vem do projeto, não mais de um input na tela
        const origemVenda = projetoCompleto.projeto.origemVenda || 'nenhum';

        const qtdModulos = parseInt(elQtdModulos?.value) || 0;
        // LÊ DIRETO DO PROJETO (Segurança de Dados)
        const tipoEstrutura = (projetoCompleto.projeto.tipoTelhado || 'Telhado').toLowerCase();
        const origemEstrutura = elOrigemEstrutura?.value || 'KIT';

        // Premissas
        const pFin = premissas?.financeiro || {};
        const pEst = premissas?.estruturas || {};
        const pLog = premissas?.logistica || {}; // NOVO: Leitura correta da logística
        const pMatPrem = premissas?.materiaisPremium || {};
        const tabelaMat = premissas?.tabelas?.materiais;
        const tabelaMO = premissas?.tabelas?.maoDeObra;

        // =================================================================
        // 1. CÁLCULO DE MATERIAIS (Lógica Acumulada: Base + Estrutura + Premium)
        // =================================================================
        // Base (Sempre existe)
        let custoMateriais = calcularCustoMateriaisBasicos(qtdModulos, tabelaMat);

        // Adicional de Estrutura (Solo/Laje) - Se fornecimento próprio
        // Afeta AMBAS as propostas (Standard e Premium)
        if (origemEstrutura === 'PROPRIO') {
            if (tipoEstrutura.includes('solo')) {
                custoMateriais += (qtdModulos * (pEst.va_estrutura_solo || 125));
            } else if (tipoEstrutura.includes('laje')) {
                custoMateriais += (qtdModulos * (pEst.va_estrutura_laje || 55));
            }
        }

        // Controle de visibilidade dos Opcionais (Mantido)
        const containerOpcionais = document.getElementById('container_opcionais_premium');

        if (containerOpcionais) {
            containerOpcionais.style.display = (aba === 'premium') ? 'block' : 'none';
        }

        // REMOÇÃO DEFINITIVA: Remove o resumo automático de materiais (Legado) se existir no DOM
        const containerResumo = document.getElementById('container_resumo_materiais');
        if (containerResumo) containerResumo.remove();

        // =================================================================
        // 1.1 CÁLCULO DE OPCIONAIS PREMIUM (Tempo Real)
        // =================================================================
        let custoOpcionais = 0;
        if (aba === 'premium') {
            document.querySelectorAll('.chk-opcional:checked').forEach(chk => {
                custoOpcionais += parseFloat(chk.dataset.valor || 0);
            });
        }

        // =================================================================
        // 2. CÁLCULO DE DIAS E LOGÍSTICA (Tempo Acumulado)
        // =================================================================
        // Cálculo de Dias (Apenas para Logística e Extras)
        const modulosPorDia = pFin.modulosPorDia || 12;
        let diasBase = qtdModulos > 0 ? Math.ceil(qtdModulos / modulosPorDia) : 0;
        let diasExtras = 0;

        // Adicional Estrutura (Tempo) - Afeta AMBAS as propostas
        if (tipoEstrutura.includes('solo')) {
            diasExtras += (qtdModulos * (pEst.diaria_extra_solo || 0.2));
        } else if (tipoEstrutura.includes('laje')) {
            diasExtras += (qtdModulos * (pEst.diaria_extra_laje || 0.1));
        }

        // Adicional Premium (Tempo)
        if (aba === 'premium') {
            const qtdInversores = carrinhoInversores.reduce((acc, i) => acc + i.qtd, 0);
            // Adiciona 1 dia fixo se for premium (configuração técnica) ou 1 por inversor se preferir
            // Mantendo a lógica anterior de +1.0 dia base
            diasExtras += 1.0;
        }

        const diasTotais = diasBase + diasExtras;

        // Mínimo e Arredondamento
        const diasMinimos = pFin.diasMinimosObra || 2;
        const diasParaLogistica = Math.max(diasTotais, diasMinimos);
        const diasFinais = Math.ceil(diasParaLogistica * 2) / 2;

        // --- CUSTO DE MÃO DE OBRA (Híbrido: Tabela Base + Extras por Tempo) ---
        const valorDiariaTecnica = pMatPrem.va_diaria_instalador || 390;

        // 1. M.O. Base: Busca da Tabela de Premissas (ex: R$ 150/módulo)
        // Isso corrige o erro de calcular apenas dias * diária para a base
        const custoMOBase = calcularMaoObraBase(qtdModulos, tabelaMO);

        // 2. M.O. Extra: Cobra apenas o tempo excedente (Solo/Laje/Premium)
        const custoMOExtra = diasExtras * valorDiariaTecnica;

        const custoMO = custoMOBase + custoMOExtra;

        // Logística (Baseada em KM e Dias)
        const cidadeNormalizada = (projetoCompleto?.projeto?.cidade || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const dadosCidade = baseDadosAlagoas[cidadeNormalizada];
        const distanciaIda = (dadosCidade && dadosCidade.dist !== undefined) ? dadosCidade.dist : 100;
        const kmSuprimentos = pFin.kmSuprimentos || 15;
        const kmDiario = (distanciaIda * 2) + (pFin.kmAlmoco || 5);
        const kmTotal = kmSuprimentos + (diasFinais * kmDiario);
        const custoLogistica = (kmTotal / (pLog.consumoVeiculo || 8.5)) * (pLog.precoCombustivel || 6.10);

        // =================================================================
        // 2.1 CÁLCULO DE COMISSÃO (Custo Variável de Venda)
         // 3. TOTALIZADOR FINAL (MARKUP POR ITEM)
        // =================================================================
        const fatorLucro = parseFloat(elFatorLucro?.value) || 1.1;
        const lucroMinimo = parseFloat(elLucroMinimo?.value) || pFin.lucroMinimo || 0; // Piso de lucro
        const aliquotaImposto = (parseFloat(elImposto?.value) || 0) / 100;
        const divisorImposto = (1 - aliquotaImposto) > 0 ? (1 - aliquotaImposto) : 1;
        const valorKit = parseFloat(elValorKit?.value) || 0;

        // B. LUCRO (Regra Jean Marcel: 1.1 * M.O. Integral)
        // Garante que o lucro seja exatamente o fator aplicado sobre a Mão de Obra
        const fatorAplicado = fatorLucro > 0 ? fatorLucro : 1.1;
        // CORREÇÃO: O lucro é calculado sobre a M.O. FINAL (Base + Extras) conforme solicitado
        let lucroNominal = custoMO * fatorAplicado;

        // APLICAÇÃO DO PISO DE LUCRO (Solicitação: Se calculado < piso, usa piso)
        if (lucroNominal < lucroMinimo) {
            lucroNominal = lucroMinimo;
        }

        // =================================================================
        // 2.1 CÁLCULO DE COMISSÃO (Custo Variável de Venda sobre TOTAL DA PROPOSTA)
        // =================================================================
        const taxasComissao = pFin.taxasComissao || { indicador: 2.0, representante: 5.0 };
        
        let taxaComissaoAplicada = 0;
        if (origemVenda === 'indicador') taxaComissaoAplicada = taxasComissao.indicador || 0;
        if (origemVenda === 'representante') taxaComissaoAplicada = taxasComissao.representante || 0;
        
        const taxaComissaoDecimal = taxaComissaoAplicada / 100;

        // CÁLCULO REVERSO: Preço Serviço deve cobrir Custos + (TotalProposta * TaxaComissao)
        // TotalProposta = PrecoServico + ValorKit
        // Fórmula derivada: PrecoServico = (CustosFixos + (ValorKit * TaxaComissao)) / (1 - Imposto - TaxaComissao)
        
        const custosFixosServico = custoMO + custoLogistica + custoMateriais + custoOpcionais + lucroNominal;
        
        // Denominador do Markup Global (Imposto + Comissão)
        const denominadorGlobal = (1 - aliquotaImposto - taxaComissaoDecimal);
        const divisorGlobal = denominadorGlobal > 0.01 ? denominadorGlobal : 0.01;

        // Preço de Venda do Serviço Necessário para cobrir tudo
        const precoVendaServico = (custosFixosServico + (valorKit * taxaComissaoDecimal)) / divisorGlobal;

        // Valor absoluto da comissão (Sobre o Total: Serviço + Kit)
        const valorComissao = (precoVendaServico + valorKit) * taxaComissaoDecimal;

        

        // A. MÃO DE OBRA (Custo Base + Extras)
        // Aplica o markup do imposto sobre o custo da M.O.
        const precoVendaMO = custoMO / divisorImposto;

        // B. LUCRO (Já calculado acima)
        const precoVendaLucro = lucroNominal / divisorImposto;

        // C. LOGÍSTICA (Repasse com Imposto)
        const precoVendaLogistica = custoLogistica / divisorImposto;

        // D. MATERIAIS (Instalação/Infra com Imposto)
        const precoVendaMateriais = (custoMateriais + custoOpcionais) / divisorImposto;

        // E. COMISSÃO (Repasse com Imposto)
        // Nota: Aqui calculamos o componente de comissão dentro do preço do serviço para exibição
        const precoVendaComissao = valorComissao / divisorImposto;

        // Cálculo Reverso do Imposto Real (Para exibição)
        // Base Total = Custos + Lucro Nominal
        const baseTotal = custoMO + lucroNominal + custoLogistica + custoMateriais + custoOpcionais + valorComissao;
        const valorImposto = precoVendaServico - baseTotal;

        // Lucro para exibição
        const lucro = lucroNominal;

        // VALOR TOTAL = SERVIÇO + MATERIAIS + KIT
        // Nota: custoMateriais já está embutido no precoVendaServico (taxado), então não somamos novamente.
        // O Valor Total é o Serviço (que contém MO, Logística, Materiais e Impostos) + Kit.
        const valorTotalCliente = precoVendaServico + valorKit;

        // VALIDAÇÃO: O Kit deve ter valor coerente para avançar
        const isKitValido = valorKit > 0;

        // 4. ATUALIZAÇÃO UI
        const custoMatTotal = custoMateriais + custoOpcionais;

        // --- RECONSTRUÇÃO DO PAINEL FINANCEIRO (Layout Clean) ---
        const containerCascata = document.querySelector('.painel-detalhamento-cascata');
        if (containerCascata) {
            const formatarLinha = (label, valor, idElemento, destaque = false, mostrarPerc = true, suffix = '') => {
                const moeda = formatarMoeda(valor);
                
                // Percentuais
                const percServico = precoVendaServico > 0 ? ((valor / precoVendaServico) * 100).toFixed(1) : '0.0';
                const percTotal = valorTotalCliente > 0 ? ((valor / valorTotalCliente) * 100).toFixed(1) : '0.0';
                
                const styleLabel = destaque ? 'font-weight: 700; color: #0f172a;' : 'color: #334155;';
                const styleValor = destaque ? 'font-weight: 700; color: #0f172a;' : 'font-weight: 600; color: #0f172a;';
                
                let htmlPerc = '';
                if (mostrarPerc) {
                    htmlPerc = `
                        <span style="font-size: 0.7rem; color: #64748b; background: #f1f5f9; padding: 1px 4px; border-radius: 4px; margin-left: 6px;" title="% sobre Serviço">${percServico}% Srv</span>
                        <span style="font-size: 0.7rem; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0px 4px; border-radius: 4px; margin-left: 4px;" title="% sobre Total">${percTotal}% Tot</span>
                    `;
                }

                return `
                    <div class="linha-custo" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <div style="display: flex; align-items: center;">
                            <span style="${styleLabel}">${label}</span>
                            ${suffix}
                            ${htmlPerc}
                        </div>
                        <span id="${idElemento}" style="${styleValor}">${moeda}</span>
                    </div>
                `;
            };

            let html = `<h4><i class="fas fa-list"></i> Itens de Custo do Serviço</h4>`;
            
            html += formatarLinha('Materiais de Inst:', custoMatTotal, 'res_custo_materiais');
            
            const suffixDias = `<span style="font-size: 0.85em; color: #94a3b8; font-weight: normal; margin-left: 5px;">(${diasFinais}d)</span>`;
            html += formatarLinha('M.O.:', custoMO, 'res_custo_mo_base', false, true, suffixDias);
            
            html += formatarLinha('Logística:', custoLogistica, 'res_logistica');
            
            if (valorComissao > 0) {
                const labelComissao = `Comissão (${origemVenda === 'indicador' ? 'Ind.' : 'Rep.'}):`;
                html += formatarLinha(labelComissao, valorComissao, 'res_linha_comissao_valor');
            }

            html += `<hr style="margin: 10px 0; border-color: #e2e8f0;">`;
            html += formatarLinha('Lucro:', lucro, 'res_lucro_proposta', true);
            html += formatarLinha('Imposto:', valorImposto, 'res_imposto_cascata', true);
            html += `<hr style="margin: 10px 0; border-color: #e2e8f0;">`;
            html += formatarLinha('Serviço:', precoVendaServico, 'res_preco_venda_servico', true, true);

            html += `
                <div class="total-geral-proposta" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 2px solid #e2e8f0;">
                    <span style="font-weight: 800; color: #0f172a; font-size: 1.1rem;">Total Proposta:</span>
                    <strong id="res_valor_total_proposta" style="font-weight: 800; color: #16a34a; font-size: 1.2rem;">${formatarMoeda(valorTotalCliente)}</strong>
                </div>
            `;

            containerCascata.innerHTML = html;
        }


        // Estado
        if (projetoGerenciador.abaAtiva && projetoGerenciador[projetoGerenciador.abaAtiva]) {
            projetoGerenciador[projetoGerenciador.abaAtiva].dados.precoCalculado = isKitValido;
        }

        // Atualiza o Resumo Executivo
        preencherResumoExecutivo({
            inversores: carrinhoInversores,
            qtdModulos: qtdModulos,
            potenciaModulo: parseInt(document.getElementById('select_modulo_comparativo').value) || 0,
            geracaoMensal: document.getElementById('fixo_geracao').innerText.replace(' kWh', ''),
            expansao: document.getElementById('gen_max_txt') ? parseInt(document.getElementById('gen_max_txt').innerText) : 0, // Simplificado
            geracaoMax: document.getElementById('gen_max_txt') ? document.getElementById('gen_max_txt').innerText : 'N/A',
            precoVenda: formatarMoeda(valorTotalCliente),
            impostos: formatarMoeda(valorImposto),
            lucro: formatarMoeda(lucro),
            diasObra: diasFinais,
            isMinimo: false,
            custoPremium: (aba === 'premium' ? (custoMateriais - calcularCustoMateriaisBasicos(qtdModulos, tabelaMat)) : 0)
        });

        validarBotaoFinal();

        // Renderiza o botão de avançar padronizado se o preço foi calculado
        const containerBtnId = 'wrapper-etapa-financeira';
        const containerBtn = document.getElementById(containerBtnId);

        const isPrecoOk = projetoGerenciador[projetoGerenciador.abaAtiva].dados.precoCalculado;
        renderizarBotaoNavegacao(containerBtnId, 'window.avancarParaResumo()', isPrecoOk ? 'Análise Financeira Concluída' : 'Defina o Valor do Kit', 'Ver Resumo e Salvar', isPrecoOk);
    };

    function preencherResumoExecutivo(dados) {
        const secao = document.getElementById('secao_resumo_executivo');
        if (!secao) return;

        // Só exibe se houver preço calculado
        if (projetoGerenciador[projetoGerenciador.abaAtiva].dados.precoCalculado) {
            // CORREÇÃO: Só exibe se estivermos na etapa de Resumo
            const aba = projetoGerenciador.abaAtiva;
            const indiceAtual = projetoGerenciador[aba].dados.etapaIndex || 0;
            const isResumo = gerenciadorEtapas.ordem[indiceAtual] === 'resumo';
            
            // A visibilidade agora é controlada pelo gerenciadorEtapas via classe .etapa-oculta

            // --- DADOS COMPLETOS PARA O RESUMO ---
            const clienteNome = projetoCompleto.nome || 'Cliente';
            const projNome = projetoCompleto.projeto.nome_projeto || 'Projeto';
            const local = `${projetoCompleto.projeto.cidade}/${projetoCompleto.projeto.uf}`;
            const consumo = projetoCompleto.projeto.consumo || 0;
            const tipoTelhado = projetoCompleto.projeto.tipoTelhado || 'Não informado';

            // Dados Técnicos
            const potSistema = ((dados.qtdModulos * dados.potenciaModulo) / 1000).toFixed(2);
            const modulosDesc = `${dados.qtdModulos}x ${dados.potenciaModulo}W`;

            // Cálculo da Potência AC Total (Inversores)
            const potInversoresAC = dados.inversores.reduce((acc, i) => acc + (i.nominal * i.qtd), 0) / 1000;

            // Formata lista de inversores com destaque para seleção manual
            const invDesc = dados.inversores.map(i => {
                const manualTag = estadoSelecaoInversor.tipo === 'MANUAL' ? '<span style="color:#f59e0b; font-size:0.8em;">(Manual)</span>' : '';
                return `<div><strong>${i.qtd}x</strong> ${i.modelo} ${manualTag}</div>`;
            }).join('');

            // HTML Rico e Padronizado (Wizard Style)
            const html = `
                <div class="resumo-geral-card" style="background: white; border: 1px solid #cbd5e1; border-radius: 12px; padding: 30px; margin-top: 30px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                    
                    <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 25px; text-align: center;">
                        <h3 style="color: #0f172a; font-size: 1.5rem; margin: 0;"><i class="fas fa-clipboard-list" style="color: var(--primaria);"></i> Resumo Geral da Proposta</h3>
                        <p style="color: #64748b; margin-top: 5px;">Confira os dados antes de salvar</p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px;">
                        
                        <!-- Coluna 1: Contexto -->
                        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
                            <h4 style="color: #334155; font-size: 1.1rem; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                                <i class="fas fa-user-tag"></i> Dados do Projeto
                            </h4>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 10px; font-size: 1rem; color: #475569;">
                                <div style="display: flex; justify-content: space-between;"><span>Cliente:</span> <strong style="color: #0f172a;">${clienteNome}</strong></div>
                                <div style="display: flex; justify-content: space-between;"><span>Projeto:</span> <strong style="color: #0f172a;">${projNome}</strong></div>
                                <div style="display: flex; justify-content: space-between;"><span>Local:</span> <strong style="color: #0f172a;">${local}</strong></div>
                                <div style="display: flex; justify-content: space-between;"><span>Consumo:</span> <strong style="color: #0f172a;">${consumo} kWh</strong></div>
                                <div style="display: flex; justify-content: space-between;"><span>Estrutura:</span> <strong style="color: #0f172a;">${tipoTelhado}</strong></div>
                            </div>
                        </div>

                        <!-- Coluna 2: Engenharia -->
                        <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
                            <h4 style="color: #334155; font-size: 1.1rem; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                                <i class="fas fa-microchip"></i> Solução Técnica
                            </h4>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 10px; font-size: 1rem; color: #475569;">
                                <div style="display: flex; justify-content: space-between;"><span>Potência DC:</span> <strong style="color: #0f172a;">${potSistema} kWp</strong></div>
                                <div style="display: flex; justify-content: space-between;"><span>Módulos:</span> <strong style="color: #0f172a;">${modulosDesc}</strong></div>
                                <div style="display: flex; justify-content: space-between;"><span>Potência Nominal Inversores:</span> <strong style="color: #0f172a;">${potInversoresAC.toFixed(2)} kW</strong></div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;"><span>Inversores:</span> <div style="text-align: right; color: #0f172a;">${invDesc}</div></div>
                                <div style="display: flex; justify-content: space-between;"><span>Geração Estimada:</span> <strong style="color: #16a34a;">${dados.geracaoMensal} kWh/mês</strong></div>
                                <div style="display: flex; justify-content: space-between;"><span>Expansão:</span> <strong style="color: #0f172a;">${dados.geracaoMax}</strong></div>
                            </div>
                        </div>
                    </div>

                    <!-- Bloco Financeiro -->
                    <div style="background: #f0fdf4; padding: 25px; border-radius: 10px; border: 1px solid #bbf7d0; text-align: center; margin-bottom: 30px;">
                        <h4 style="color: #166534; font-size: 1.2rem; margin-bottom: 20px;">Valor Final da Proposta</h4>
                        <div style="display: flex; justify-content: center; gap: 40px; align-items: flex-end;">
                            <div>
                                <span style="display: block; font-size: 0.9rem; color: #15803d; margin-bottom: 5px;">Preço ao Cliente</span>
                                <span style="font-size: 2.2rem; font-weight: 800; color: #16a34a; line-height: 1;">${dados.precoVenda}</span>
                            </div>
                            <div style="padding-left: 40px; border-left: 1px solid #bbf7d0;">
                                <span style="display: block; font-size: 0.9rem; color: #15803d; margin-bottom: 5px;">Lucro Projetado</span>
                                <span style="font-size: 1.5rem; font-weight: 700; color: #15803d; line-height: 1;">${dados.lucro}</span>
                            </div>
                        </div>
                        <div style="margin-top: 15px; font-size: 0.9rem; color: #166534;">
                            Tempo estimado de obra: <strong>${dados.diasObra} dias</strong>
                        </div>
                    </div>

                    <!-- Container para o Botão -->
                    <div id="container_botao_salvar_final" style="display: flex; justify-content: center;">
                        <!-- Botão será injetado aqui -->
                    </div>

                </div>
            `;

            secao.innerHTML = html;

            // Move o botão de salvar para dentro do resumo
            // Usa a variável do escopo (btnGerarProposta) pois o elemento pode ter sido removido do DOM ao limpar o innerHTML
            const btnSalvar = btnGerarProposta;
            const msgValidacao = msgValidacaoElement; // Usa referência global
            const containerBtn = document.getElementById('container_botao_salvar_final');

            if (btnSalvar && containerBtn) {
                containerBtn.innerHTML = ''; // Limpa container
                
                // Wrapper para alinhar botão e mensagem
                const wrapperAction = document.createElement('div');
                wrapperAction.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%;";
                containerBtn.appendChild(wrapperAction);

                wrapperAction.appendChild(btnSalvar);
                
                if (msgValidacao) {
                    wrapperAction.appendChild(msgValidacao);
                    msgValidacao.style.display = 'block';
                }

                // Estilização do botão para ficar imponente
                btnSalvar.style.width = 'auto';
                btnSalvar.style.minWidth = '250px';
                btnSalvar.style.padding = '16px 32px';
                btnSalvar.style.fontSize = '1.1rem';
                btnSalvar.style.display = 'inline-flex';
                btnSalvar.style.visibility = 'visible'; // Garante visibilidade
                btnSalvar.classList.remove('oculto'); // Remove classes de ocultação se houver
                btnSalvar.style.justifyContent = 'center';
                btnSalvar.style.alignItems = 'center';
                btnSalvar.style.gap = '10px';
            }

            // 5. Comparativo (Se ambas as abas estiverem preenchidas)
            atualizarComparativoFinal();

        }
    }

    function atualizarComparativoFinal() {
        const container = document.getElementById('secao_comparativa_final');
        // Verifica se ambas as abas têm dados calculados
        if (!projetoGerenciador.standard.dados.precoCalculado || !projetoGerenciador.premium.dados.precoCalculado) {
            if (container) container.style.display = 'none';
            return;
        }

        // Se não existir o container, cria (ou assume que existe no HTML)
        if (!container) return;

        // Recupera dados salvos (Standard) vs Dados Atuais (se estiver na Premium) ou vice-versa
        // O ideal é salvar o estado atual antes de comparar
        salvarEstadoAbaAtual();

        const std = projetoGerenciador.standard.dados;
        const prem = projetoGerenciador.premium.dados;

        // Extrai valores numéricos do sessionStorage ou do objeto salvo
        // Nota: Para simplificar, vamos assumir que os valores formatados estão salvos ou recalcular.
        // Aqui faremos uma comparação visual simples baseada no que foi salvo.

        // Implementação visual simplificada para o prompt
        container.innerHTML = `
            <div class="card-comparativo-limpo" style="background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%); border: 1px solid #16a34a; border-radius: 12px; padding: 15px; margin-top: 15px;">
                <div style="font-weight: 700; color: #16a34a; margin-bottom: 10px;"><i class="fas fa-balance-scale"></i> Comparativo Ativo</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <div>Standard: <strong>Configurada</strong></div>
                    <div>Premium: <strong>Configurada</strong></div>
                    <div style="color: #15803d; font-weight:bold;">Pronto para Salvar</div>
                </div>
            </div>
        `;
        
        // CORREÇÃO: Só exibe se estivermos na etapa de Resumo
        const aba = projetoGerenciador.abaAtiva;
        const indiceAtual = projetoGerenciador[aba].dados.etapaIndex || 0;
        const isResumo = gerenciadorEtapas.ordem[indiceAtual] === 'resumo';

        container.style.display = isResumo ? 'block' : 'none';
    }

    // ======================================================================
    // 🔒 VALIDAÇÃO FINAL (GATEKEEPER)
    // ======================================================================
    function validarBotaoFinal() {
        const btn = btnGerarProposta; // Usa referência global
        const msg = msgValidacaoElement; // Usa referência global

        if (!btn || !msg) return; // Safeguard contra erros de renderização

        // Verifica se há inversores no carrinho
        const temInversor = carrinhoInversores.length > 0;

        // VALIDAÇÃO DE ESCOPO (AMBAS, STANDARD, PREMIUM)
        const escopo = projetoGerenciador.tipoEscopo;
        const stdOk = projetoGerenciador.standard.dados.precoCalculado;
        const prmOk = projetoGerenciador.premium.dados.precoCalculado;

        let temPreco = false;
        if (escopo === 'AMBAS') {
            temPreco = stdOk && prmOk;
        } else if (escopo === 'PREMIUM') {
            temPreco = prmOk;
        } else {
            temPreco = stdOk;
        }

        const sistemaTecnicamenteValido = statusTecnicoSistema.valido;

        if (temInversor && temPreco && sistemaTecnicamenteValido) {
            btn.disabled = false;
            btn.className = "btn-proposta-ativo"; // CSS para botão habilitado
            msg.innerHTML = '<span style="color: #16a34a;"><i class="fas fa-check"></i> Tudo pronto para salvar!</span>';
        } else {
            btn.disabled = true;
            btn.className = "btn-proposta-desabilitado";

            let pendencias = [];
            if (!sistemaTecnicamenteValido) pendencias.push("Correção Técnica (Overloading)");
            if (!temInversor) pendencias.push("Inversor");

            if (escopo === 'AMBAS') {
                if (!stdOk) pendencias.push("Standard");
                if (!prmOk) pendencias.push("Premium");
            } else {
                if (!temPreco) pendencias.push("Custos");
            }

            msg.innerText = `* Pendente: ${pendencias.join(" e ")}`;
            if (!sistemaTecnicamenteValido) {
                msg.innerHTML += '<br><span style="color:#dc2626; font-weight:bold;">⚠️ O sistema possui erros críticos de dimensionamento.</span>';
            }
        }
    }

    // --- 5. GERAÇÃO E SALVAMENTO DA PROPOSTA ---
    if (btnGerarProposta) {
        btnGerarProposta.addEventListener('click', async () => {
            // 1. Consolida os dados da aba atual
            salvarEstadoAbaAtual();

            // 2. Determina qual versão será a "capa" da proposta na listagem (Prioridade: Premium > Standard)
            const dadosStd = projetoGerenciador.standard.dados.precoCalculado ? projetoGerenciador.standard.dados : null;
            const dadosPrm = projetoGerenciador.premium.dados.precoCalculado ? projetoGerenciador.premium.dados : null;

            const versaoPrincipal = dadosPrm || dadosStd;

            if (!versaoPrincipal) {
                alert("Erro: Nenhuma versão válida (com preço calculado) encontrada para salvar.");
                return;
            }

            const resumo = versaoPrincipal.resumoFinanceiro || { valorTotal: 0, potenciaTotal: 0 };

            // 3. Prepara o objeto para o banco de dados (Estrutura compatível com D1)
            const propostaParaGravar = {
                projetoId: projetoCompleto.projeto.id, // Relacionamento com Projeto
                clienteId: projetoCompleto.id,         // Relacionamento com Cliente
                
                // Campos de Resumo para Listagem Rápida (Desnormalização)
                valor: resumo.valorTotal,
                potenciaKwp: resumo.potenciaTotal,
                
                // Metadados da Proposta
                escopo: projetoGerenciador.tipoEscopo, // Salva a decisão inicial
                origemVenda: document.getElementById('origem_venda')?.value || projetoCompleto.projeto.origemVenda,
                
                // Estrutura de Versões (JSON B para futuro D1)
                configuracao: {
                    temStandard: projetoGerenciador.standard.dados.precoCalculado,
                    temPremium: projetoGerenciador.premium.dados.precoCalculado
                },
                versoes: {
                    standard: dadosStd,
                    premium: dadosPrm
                },
                premissasSnapshot: {
                    consumo: parseFloat(higienizarParaCalculo(inputConsumo.value)),
                    cidade: projetoCompleto.projeto.cidade,
                    uf: projetoCompleto.projeto.uf
                },
                status: 'Gerada'
            };

            // 4. Salva usando o serviço centralizado
            db.salvar('propostas', propostaParaGravar);

            alert("Proposta salva com sucesso!");
            window.location.href = `projeto-detalhes.html?id=${projetoCompleto.projeto.id}`;
        });
    }

    // --- Execução Inicial ---
    inicializarBaseDeDados();
    
    if (!modoEdicao) {
        // FLUXO NOVO: Inicia do zero
        projetoGerenciador.standard.dados.etapaIndex = 0;
        projetoGerenciador.abaAtiva = 'standard';
        gerenciadorEtapas.sincronizarVisual();
        window.alternarModoOrientacao('simples');
        window.autoDimensionarCompleto();
    } else {
        // FLUXO EDIÇÃO: Carrega estado salvo
        carregarEstadoAba(projetoGerenciador.abaAtiva);
        gerenciadorEtapas.sincronizarVisual();
        
        // Recalcula financeiro para atualizar totais na tela sem perder o valor do kit
        if (carrinhoInversores.length > 0) {
            window.calcularEngenhariaFinanceira();
        }
        renderizarResumoSuperiorFinanceiro();
    }
});

// ======================================================================
// 🎨 HELPER DE ESTILOS (Injeção de CSS Crítico - Fallback)
// ======================================================================
function injetarEstilosDinamicos() {
    const styleId = 'estilos-gerador-dinamicos';
    // Função esvaziada para usar apenas o CSS externo (engenharia.css)
    // Mantida vazia para evitar erros de referência se chamada em outros lugares
    if (document.getElementById(styleId)) return;
}