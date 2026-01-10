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
    const inputTipoLigacao = document.getElementById('uc_tipo_padrao');
    
    // Elementos da nova tabela
    const containerSugestaoPainel = document.getElementById('container_sugestao_painel'); // Agora um card
    const displayModuloSelecionado = document.getElementById('display_modulo_selecionado');
    const wrapperEtapaTecnica = document.getElementById('wrapper-etapa-tecnica');
    const wrapperEtapaFinanceira = document.getElementById('wrapper-etapa-financeira');
    
    // Elementos do Header Atualizados
    const headerNomeCliente = document.getElementById('header_nome_cliente');
    const headerNomeProjeto = document.getElementById('header_nome_projeto');
    const headerLocalizacao = document.getElementById('header_localizacao');

    // --- Elementos do Painel Fixo ---
    const fixoPotMinima = document.getElementById('fixo_p_minima');
    const fixoPotReal = document.getElementById('fixo_p_real');
    const fixoGeracao = document.getElementById('fixo_geracao');
    const fixoPr = document.getElementById('fixo_pr_final');
    const fixoConsumo = document.getElementById('fixo_consumo');
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
            dados: { inversores: [], modulo: null, financeiro: {}, precoCalculado: false, etapaIndex: 0 }
        },
        premium: {
            selecionado: false,
            dados: { inversores: [], modulo: null, financeiro: {}, precoCalculado: false, etapaIndex: 0 }
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
        ordem: ['premissas', 'modulos', 'inversores', 'financeiro'],
        
        etapas: {
            premissas: ['card_geometria', 'card_perdas'],
            // ATUALIZADO: IDs completos para garantir controle total da visibilidade
            modulos: ['wrapper-etapa-paineis', 'container_sugestao_painel', 'wrapper-etapa-tecnica'],
            inversores: ['wrapper-etapa-inversores', 'card-dimensionamento-inversor'],
            financeiro: ['wrapper-etapa-financeira']
        },

        // Armazena o estado dos dados ao entrar na edição para comparação posterior
        snapshotEstado: null,

        // Método de compatibilidade para chamadas antigas (evita TypeError)
        travar: function(etapa) {
            // Mapeia 'travar' para 'avancarPara' a próxima etapa lógica
            const indiceAtual = this.ordem.indexOf(etapa);
            if (indiceAtual > -1 && indiceAtual < this.ordem.length - 1) {
                this.avancarPara(this.ordem[indiceAtual + 1]);
            }
        },

        destravar: function(etapa) {
            this.recuarPara(etapa);
        },

        // Atualiza a interface baseada no índice da etapa atual da aba ativa (Lógica N-1)
        sincronizarVisual: function() {
            const aba = projetoGerenciador.abaAtiva;
            if (!aba || !projetoGerenciador[aba]) return;

            const indiceAtual = projetoGerenciador[aba].dados.etapaIndex || 0;

            this.ordem.forEach((nomeEtapa, index) => {
                const ids = this.etapas[nomeEtapa];
                if (!ids) return;

                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;

                    // Remove overlays antigos para redesenhar corretamente
                    const overlayAntigo = el.querySelector('.overlay-desbloqueio');
                    if (overlayAntigo) overlayAntigo.remove();

                    // Lista de classes que devem ser removidas para desbloquear totalmente
                    const classesBloqueio = ['card-bloqueado', 'disabled', 'etapa-bloqueada'];

                    if (index < indiceAtual) {
                        // ETAPA PASSADA: TRANCADA
                        el.classList.add('card-bloqueado');
                        
                        // Lógica N-1: Botão "Editar" só aparece na etapa imediatamente anterior à atual
                        // E apenas no primeiro elemento da lista para não duplicar botões
                        if (index === indiceAtual - 1 && id === ids[0]) {
                            const overlay = document.createElement('div');
                            overlay.className = 'overlay-desbloqueio';
                            // Estilo inline para garantir visibilidade sobre o backdrop
                            overlay.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 20;";
                            overlay.innerHTML = `
                                <button class="btn-desbloquear" onclick="window.solicitarDesbloqueio('${nomeEtapa}')" style="background: white; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 6px; font-weight: 600; color: #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-lock-open" style="color: var(--primaria);"></i> Editar ${nomeEtapa.charAt(0).toUpperCase() + nomeEtapa.slice(1)}
                                </button>
                            `;
                            el.appendChild(overlay);
                        }
                    } else if (index === indiceAtual) {
                        // ETAPA ATUAL: ABERTA
                        el.classList.remove(...classesBloqueio);
                        el.style.opacity = "1";
                        el.style.pointerEvents = "auto";
                    } else {
                        // ETAPA FUTURA: TRANCADA E LIMPA (Reset em Cascata Visual)
                        // Mantém bloqueada para evitar interação antes da hora
                        el.classList.add('card-bloqueado');
                        // Opcional: Pode-se adicionar opacidade reduzida para indicar inatividade
                        el.style.opacity = "0.5";
                        el.style.pointerEvents = "none";
                    }
                });
            });
        },

        // Avança para a próxima etapa (Forward)
        avancarPara: function(nomeEtapa) {
            const novoIndice = this.ordem.indexOf(nomeEtapa);
            const aba = projetoGerenciador.abaAtiva;
            if (novoIndice > -1 && projetoGerenciador[aba]) {
                // Garante que existe um índice numérico válido (fallback para 0)
                const indiceAtual = projetoGerenciador[aba].dados.etapaIndex || 0;

                // Só avança se o novo índice for maior que o atual (evita recuos acidentais por esta função)
                if (novoIndice > indiceAtual) {
                    projetoGerenciador[aba].dados.etapaIndex = novoIndice;
                }
                // Se for igual ou menor, apenas sincroniza (útil para re-renderização)
                this.sincronizarVisual();
            }
        },

        // Recua para uma etapa específica SEM resetar imediatamente (Snapshot para Dirty Check)
        recuarPara: function(nomeEtapa) {
            const novoIndice = this.ordem.indexOf(nomeEtapa);
            const aba = projetoGerenciador.abaAtiva;
            
            if (novoIndice > -1 && projetoGerenciador[aba]) {
                // 1. Captura o estado ATUAL da etapa para a qual estamos voltando
                // Isso serve para comparar depois se o usuário mudou algo ou não
                this.snapshotEstado = this.capturarEstado(nomeEtapa);
                console.log(`Editando ${nomeEtapa}. Snapshot criado.`);

                // 2. Apenas recua o índice visualmente
                projetoGerenciador[aba].dados.etapaIndex = novoIndice;
                this.sincronizarVisual();
            }
        },

        // Limpa dados das etapas futuras (chamado apenas se houver alteração)
        limparCascataFutura: function(etapaAtual) {
            const indiceAtual = this.ordem.indexOf(etapaAtual);
            // Limpa tudo DA PRÓXIMA etapa em diante
            for (let i = this.ordem.length - 1; i > indiceAtual; i--) {
                const etapaNome = this.ordem[i];
                console.log(`Resetando etapa futura: ${etapaNome}`);
                this.limparDadosEtapa(etapaNome);
            }
        },

        // Captura uma "foto" dos dados críticos da etapa para comparação
        capturarEstado: function(etapa) {
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
        houveAlteracao: function(etapa) {
            const estadoAtual = this.capturarEstado(etapa);
            return estadoAtual !== this.snapshotEstado;
        },

        // Função auxiliar para limpar dados específicos de cada etapa
        limparDadosEtapa: function(etapa) {
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
        }
    };

    // Função Global para o botão de desbloqueio
    window.solicitarDesbloqueio = function(etapaAlvo) {
        // Mensagem mais amigável
        // const confirmacao = confirm(`Deseja editar a etapa "${etapaAlvo.toUpperCase()}"?`); // Removido confirm para fluidez, já que não deleta dados imediatamente
        
        if (true) {
            // A função recuarPara agora apenas destranca e tira o snapshot
            gerenciadorEtapas.recuarPara(etapaAlvo);
        }
    };

    // --- NOVA FUNÇÃO: CONFIRMAR PREMISSAS E AVANÇAR ---
    window.confirmarPremissasEAvançar = function() {
        console.log("Iniciando transição: Premissas -> Módulos");

        // 1. Verifica se houve mudança real nas premissas
        if (typeof gerenciadorEtapas !== 'undefined') {
            if (gerenciadorEtapas.houveAlteracao('premissas')) {
                console.log("Alterações detectadas nas premissas. Resetando etapas futuras.");
                gerenciadorEtapas.limparCascataFutura('premissas');
            } else {
                console.log("Nenhuma alteração nas premissas. Mantendo dados futuros.");
            }
        }

        // 2. Força um recálculo para garantir que os dados estão atualizados
        recalcularDimensionamento();

        // 3. Avança para a etapa de Módulos (Índice 1)
        // Isso vai trancar as premissas e liberar a seleção de módulos
        if (typeof gerenciadorEtapas !== 'undefined') {
            gerenciadorEtapas.avancarPara('modulos');
        }

        // 3. Scroll Suave para a próxima etapa
        // O desbloqueio visual agora é garantido pelo gerenciadorEtapas.sincronizarVisual()
        const scrollTarget = document.getElementById('wrapper-etapa-paineis') || document.getElementById('container_sugestao_painel');
        if (scrollTarget) {
            scrollTarget.scrollIntoView({ behavior: 'smooth' });
        }
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

    window.configurarGerador = function(modo) {
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
        zerarInterfaceTecnica();
    };

    // ======================================================================
    // � GERENCIAMENTO DE ABAS (STANDARD / PREMIUM)
    // ======================================================================

    window.trocarAbaProposta = function(novaAba) {
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

        // Sincroniza os botões do cabeçalho (se existirem)
        const btnStd = document.getElementById('btn_modo_std');
        const btnPrm = document.getElementById('btn_modo_prm');
        if (btnStd && btnPrm) {
            // Remove classe 'ativo' de ambos e adiciona no correto
            btnStd.classList.toggle('ativo', novaAba === 'standard');
            btnPrm.classList.toggle('ativo', novaAba === 'premium');
        }

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
            etapaIndex: indiceAtual
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
        } else {
            // Se a aba está vazia, reseta a interface técnica
            zerarInterfaceTecnica();
            
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
        }

        // Aplica as travas visuais corretas para esta aba
        gerenciadorEtapas.sincronizarVisual();
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
            if (secaoComparativo) secaoComparativo.style.display = 'none';

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
            'res_valor_total_proposta'
        ];
        campos.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = "R$ 0,00";
        });
        if (projetoGerenciador.abaAtiva && projetoGerenciador[projetoGerenciador.abaAtiva]) {
            projetoGerenciador[projetoGerenciador.abaAtiva].dados.precoCalculado = false;
        }
        
        // FIX: Garante que o resumo da aba anterior não permaneça visível
        const secaoResumo = document.getElementById('secao_resumo_executivo');
        if (secaoResumo) secaoResumo.style.display = 'none';
        
        const secaoComparativo = document.getElementById('secao_comparativa_final');
        if (secaoComparativo) secaoComparativo.style.display = 'none';

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
        if(btn) btn.innerText = "Recalculando...";

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
        const container = document.getElementById('oversizing_chips');
        if (!container) return;
        container.innerHTML = ''; // Limpa para evitar duplicados
        
        for (let i = 10; i <= 80; i += 5) {
            const chip = document.createElement('div');
            chip.className = `chip-os ${i === 50 ? 'active' : ''}`; 
            chip.innerText = `${i}%`;
            chip.onclick = () => {
                document.querySelectorAll('.chip-os').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                document.getElementById('val_oversizing_aplicado').value = (1 + i / 100).toFixed(2);
                renderizarTabelaHuawei();
            };
            container.appendChild(chip);
        }
        document.getElementById('val_oversizing_aplicado').value = "1.50";
    }

    // --- Funções de Inicialização ---
    function inicializarBaseDeDados() {
        // Preenchimento do Header com dados do Projeto
        if (headerNomeCliente) headerNomeCliente.innerText = projetoCompleto.nome;
        if (headerNomeProjeto) headerNomeProjeto.innerText = projetoCompleto.projeto.nome_projeto;
        if (headerLocalizacao) headerLocalizacao.innerText = `${projetoCompleto.projeto.cidade} - ${projetoCompleto.projeto.uf}`;
        
        // Preenchimento dos Vitals de Contexto
        // Inicializa o tipo de estrutura com o valor do projeto
        if (document.getElementById('display_tipo_estrutura')) {
            document.getElementById('display_tipo_estrutura').innerText = projetoCompleto.projeto.tipoTelhado || 'Não informado';
        }
        if (typeof window.verificarTipoEstrutura === 'function') {
            window.verificarTipoEstrutura(); // Atualiza visibilidade do fornecedor
        }
        if (fixoConsumo) fixoConsumo.innerText = `${projetoCompleto.projeto.consumo} kWh`;
        if (fixoTipoRede) {
            const tipo = projetoCompleto.projeto.tipoLigacao;
            fixoTipoRede.innerText = tipo === 'monofasico' ? 'Mono' : (tipo === 'bifasico' ? 'Bif' : 'Tri');
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

        // Força um recálculo inicial para garantir que o estado esteja limpo/pronto
        recalcularDimensionamento();
    }

    // --- CARGA DE PREMISSAS GLOBAIS ---
    const premissasGlobais = db.buscarConfiguracao('premissas_globais');
    if (premissasGlobais) {
        // Atualiza inputs de engenharia (Azimute/Inclinação)
        if(document.getElementById('azimute_geral')) document.getElementById('azimute_geral').value = premissasGlobais.engenharia.azimute;
        if(document.getElementById('inclinacao_geral')) document.getElementById('inclinacao_geral').value = premissasGlobais.engenharia.inclinacao;
        
        // Atualiza inputs de perdas detalhadas (se existirem na configuração)
        if (premissasGlobais.engenharia) {
            if(document.getElementById('p_efici_inv')) document.getElementById('p_efici_inv').value = premissasGlobais.engenharia.eficienciaInversor ?? 98;
            if(document.getElementById('p_temp_inv')) document.getElementById('p_temp_inv').value = premissasGlobais.engenharia.perdaTempInversor ?? 1.5;
            if(document.getElementById('p_temp_mod')) document.getElementById('p_temp_mod').value = premissasGlobais.engenharia.perdaTempModulos ?? 10.13;
            if(document.getElementById('p_cabos_total')) document.getElementById('p_cabos_total').value = premissasGlobais.engenharia.cabos ?? 2.0;
            if(document.getElementById('p_extras')) document.getElementById('p_extras').value = premissasGlobais.engenharia.outros ?? 2.0;
            if(document.getElementById('p_indisp')) document.getElementById('p_indisp').value = premissasGlobais.engenharia.indisponibilidade ?? 0.5;
        }

        // Atualiza inputs financeiros
        // Define o inicial como Standard por padrão
        if (document.getElementById('prem_fator_lucro')) {
            document.getElementById('prem_fator_lucro').value = premissasGlobais.financeiro.fatorLucroStandard || 1.1;
        }
        if (document.getElementById('prem_aliquota_imposto')) document.getElementById('prem_aliquota_imposto').value = premissasGlobais.financeiro.imposto;
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
        const consumo = parseFloat(higienizarParaCalculo(uc_consumo.value)) || 0;
        const hsp = hspBruto || parseFloat(inputHSPBruto.innerText) || 0; // Usa variável global para precisão
        
        // 2. Cálculo do PR Real de Projeto (Unificado)
        // Se passarmos um override, usamos ele (tempo real), senão pegamos do último dimensionamento salvo
        const prFinal = prOverride !== null ? prOverride : (dimensionamentoCompleto?.prCalculado || 0);

        // 3. Potência Real (Módulos Selecionados)
        const wattsMod = parseFloat(selectModulo.value) || 0;
        const qtdTotal = parseInt(totalModulosDisplay.value) || 0;        
        const potReal = (qtdTotal * wattsMod) / 1000;

        // 4. Potência Mínima Requerida
        const potMinima = hsp > 0 && prFinal > 0 ? consumo / (hsp * 30.4166 * prFinal) : 0;

        // 5. Atualização Visual no Header
        fixoPotMinima.innerText = potMinima.toFixed(2) + " kWp";
        fixoPotReal.innerText = potReal.toFixed(2) + " kWp";
        fixoPr.innerText = (prFinal * 100).toFixed(2) + "%";
        fixoGeracao.innerText = Math.round(potReal * hsp * 30.4166 * prFinal) + " kWh";

        // 6. Validação dos 4% (Status Dot)
        fixoPotReal.classList.remove('valor-ok', 'valor-atencao', 'valor-critico'); // Reseta classes de validação
        const diff = potMinima > 0 ? (potReal / potMinima) - 1 : 0;
        if (potReal > 0 && diff < -0.04) {
            fixoPotReal.classList.add("valor-critico");
        } else if (potReal > 0 && diff < 0) {
            fixoPotReal.classList.add("valor-atencao");
        } else {
            fixoPotReal.classList.add("valor-ok");
        }
    }

    // --- Motor de Cálculo Dinâmico ---
    function recalcularDimensionamento() {
        // Invalida o estado sempre que um recálculo de base é iniciado.
        gerenciarEstadoCalculo('INVALIDAR');

        const consumo = parseFloat(higienizarParaCalculo(uc_consumo.value)) || 0;
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
            <div class="alerta-engenharia-topo" style="background: #f1f5f9; border: none; padding: 10px; text-align: center; color: #475569; margin-bottom: 1rem;">
                 Potência Mínima Requerida (100%): <strong>${pMinimaKwp.toFixed(2)} kWp</strong>
            </div>
            <div class="grid-sugestoes">
        `;

        top4Campeoes.forEach((mod, index) => {
            const isMelhor = index === 0;
            
            // Lógica Visual Unificada
            const isSelecionado = estadoSelecaoModulo.watts === mod.watts && estadoSelecaoModulo.qtd === mod.quantidade;
            let classesCard = 'card-modulo';
            if (isMelhor) classesCard += ' recomendado-ia';
            if (isSelecionado) classesCard += ' selecionado-usuario';

            htmlSugestoes += `
                <div class="${classesCard}" id="card_mod_${mod.watts}_${mod.quantidade}">
                    ${!isMelhor ? `<div class="selo-opcao">OPÇÃO ${index + 1}</div>` : ''}
                    <span class="label-potencia">MODELO ${mod.watts}W</span>
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

        containerSugestaoPainel.innerHTML = htmlSugestoes;
        
        // Prepara a lista completa, mas deixa oculta
        if (restante.length > 0) {
            prepararListaCompleta(restante, pMinimaKwp);
        }
    }

    // NOVA FUNÇÃO: Valida a seleção antes de confirmar
    window.validarEConfirmarModulo = function(watts, qtd, pMinima) {
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
    function confirmarModulo(watts, qtd) {
        // 1. Define o inventário fixo do projeto
        selectModulo.value = watts; // Input hidden
        displayModuloSelecionado.value = `Módulo ${watts}W`;
        totalModulosDisplay.value = qtd;
        
        // 2. Destrava a etapa técnica e financeira, mas mantém o estado inválido até o cálculo financeiro ser refeito.
        if (wrapperEtapaTecnica) wrapperEtapaTecnica.classList.remove('etapa-bloqueada');
        if (wrapperEtapaFinanceira) wrapperEtapaFinanceira.classList.remove('etapa-bloqueada');

        // 🔒 SEGURANÇA: Trava as premissas anteriores
        gerenciadorEtapas.travar('premissas');

        // ATUALIZADO: Atualiza o painel de inversores com a nova potência DC
        const potDCInstaladaWp = (watts * qtd);
        document.getElementById('potencia_dc_total').innerText = (potDCInstaladaWp / 1000).toFixed(2);

        // Sincroniza o painel fixo com a nova seleção
        sincronizarEngenhariaUnica(); // Aqui usa o PR salvo no dimensionamentoCompleto

        // VERIFICAÇÃO DE ALTERAÇÃO (DIRTY CHECK)
        if (typeof gerenciadorEtapas !== 'undefined') {
            if (gerenciadorEtapas.houveAlteracao('modulos')) {
                console.log("Módulos alterados. Resetando Inversores e Financeiro.");
                gerenciadorEtapas.limparCascataFutura('modulos');
            } else {
                console.log("Módulos mantidos. Preservando seleção de inversores.");
            }
        }

        // AVANÇO DE ETAPA: Módulos definidos -> Vai para Inversores (Índice 2)
        if (typeof gerenciadorEtapas !== 'undefined') {
            gerenciadorEtapas.avancarPara('inversores');
        }

        // 3. GATILHO DE REAVALIAÇÃO EM CASCATA: Verifica se o carrinho atual ainda é válido
        atualizarComposicaoFinal();

        // Atualiza a tabela de sugestões (agora sem pré-seleção automática única)
        renderizarTabelaHuawei();

        // Rola a tela para a próxima etapa: Dimensionamento de Inversores
        const scrollTarget = document.getElementById('wrapper-etapa-inversores') || document.getElementById('card-dimensionamento-inversor');
        if (scrollTarget) {
            scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ======================================================================
    // 🔌 MOTOR DE DIMENSIONAMENTO DE INVERSOR E EXPANSÃO
    // ======================================================================

    // --- ALGORITMO DE SUGESTÃO DE COMPOSIÇÕES ---
    function gerarSugestoesCompostas() {
        const potDCInstaladaWp = parseFloat(document.getElementById('potencia_dc_total').innerText) * 1000;
        if (!potDCInstaladaWp || potDCInstaladaWp <= 0) return [];

        const overAlvo = parseFloat(document.getElementById('val_oversizing_aplicado').value);
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
        const hsp = parseFloat(document.getElementById('hsp_bruto').innerText) || 0;
        const prTexto = document.getElementById('fixo_pr_final').innerText.replace('%','');
        const pr = parseFloat(prTexto) / 100 || 0.80;

        // --- DADOS PARA CÁLCULO LINEAR (PROJEÇÃO REAL) ---
        const geracaoAtual = parseFloat(document.getElementById('fixo_geracao').innerText) || 0;
        const qtdModulosAtual = parseInt(document.getElementById('total_modulos_projeto').value) || 0;
        const wattsModulo = parseFloat(document.getElementById('select_modulo_comparativo').value) || 580;
        const geracaoPorModulo = (qtdModulosAtual > 0) ? (geracaoAtual / qtdModulosAtual) : 0;

        // 1. HERANÇA DE DADOS DO PROJETO (Sincronização total com o Painel Geral)
        const potDCInstaladaWp = parseFloat(document.getElementById('potencia_dc_total').innerText) * 1000;

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

            corpoSugestoes.innerHTML = sugestoesOrdenadas.map((sug, index) => {
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
                    <tr class="${classesLinha}" style="border-bottom: 1px solid #f1f5f9; transition: all 0.3s ease;">
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

            if (sugestoes.length === 0) {
                corpoSugestoes.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b;">Nenhuma combinação automática encontrada. Use o catálogo abaixo.</td></tr>`;
            }

        } else {
            areaSugestoes.style.display = 'none';
        }

        const overAlvo = parseFloat(document.getElementById('val_oversizing_aplicado').value);
        const tipoRedeUC = document.getElementById('uc_tipo_padrao').value;
        const termoFiltro = document.getElementById('filtro_huawei').value.toLowerCase();

        // 3. FILTRAGEM DO CATÁLOGO COMPLETO (Mantido para personalização)
        const listaFiltrada = inversoresHuawei
            .filter(inv => {
                const capMaxEntradaWp = inv.nom * overAlvo;
                
                // Regra 1: Filtro de Fase (Rigoroso para Monofásico, Flexível para Trifásico)
                if (tipoRedeUC === "monofasico" && inv.tipo !== "monofásico") return false;
                
                // Regra 2: Limite superior visual (evita poluição com inversores gigantescos desnecessários)
                // Mas permite inversores pequenos para composição
                const limiteSuperior = capMaxEntradaWp <= (potDCInstaladaWp * 2.2);

                // Regra 3: Filtro de texto do input
                const atendeTexto = termoFiltro ? (inv.mod.toLowerCase().includes(termoFiltro) || inv.nom.toString().includes(termoFiltro)) : true;

                return limiteSuperior && atendeTexto;
            })
            .sort((a, b) => a.nom - b.nom);

        // 4. RENDERIZAÇÃO LIMPA
        if (listaFiltrada.length === 0) {
            corpo.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:#64748b;">
                Nenhum inversor Huawei compatível encontrado para ${ (potDCInstaladaWp/1000).toFixed(1) } kWp (${tipoRedeUC}).
            </td></tr>`;
            return;
        }

        corpo.innerHTML = listaFiltrada.map((inv, index) => {
            const capMaxEntradaWp = inv.nom * overAlvo;
            
            // Lógica de Classes UX (Manual)
            const isSelecionado = estadoSelecaoInversor.tipo === 'MANUAL' && estadoSelecaoInversor.id === inv.mod;
            const classeManual = isSelecionado ? 'item-inversor-manual selecionado' : 'item-inversor-manual';
            
            // Cálculo inicial para 1 unidade (Linear ou Teórico)
            let geracaoPotencialUnit;
            if (geracaoPorModulo > 0) {
                const maxModulosCabem = Math.floor(capMaxEntradaWp / wattsModulo);
                geracaoPotencialUnit = maxModulosCabem * geracaoPorModulo;
            } else {
                geracaoPotencialUnit = (capMaxEntradaWp / 1000) * hsp * 30.4166 * pr;
            }
            
            return `
                <tr class="${classeManual}" style="transition: all 0.3s ease;">
                    <td>
                        <strong>${inv.mod}</strong>
                    </td>
                    <td>
                        ${(inv.nom/1000).toFixed(1)} kW<br>
                        <small class="tag-tipo">${inv.tipo}</small>
                    </td>
                    <td style="text-align: center;">${inv.mppt}</td>
                    <td>${(capMaxEntradaWp/1000).toFixed(1)} kWp</td>
                    
                    <td style="text-align: center;">
                        <input type="number" id="qtd_${inv.mod.replace(/\s/g, '')}" value="1" min="1" max="10" class="input-qtd-tabela" oninput="window.atualizarPotencialLinha('${inv.mod}', ${inv.nom})">
                    </td>

                    <td style="text-align: center; font-weight: 600; color: #64748b;">
                        <span id="potencial_${inv.mod.replace(/\s/g, '')}">${Math.round(geracaoPotencialUnit)} kWh</span>
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
    }

    // NOVA FUNÇÃO: Atualiza a coluna de Geração Máxima em tempo real ao digitar a quantidade
    window.atualizarPotencialLinha = function(modelo, nominal) {
        const idQtd = `qtd_${modelo.replace(/\s/g, '')}`;
        const idDestino = `potencial_${modelo.replace(/\s/g, '')}`;
        const elQtd = document.getElementById(idQtd);
        const elDestino = document.getElementById(idDestino);
        
        if (!elQtd || !elDestino) return;
        
        const qtd = parseInt(elQtd.value) || 0;
        const over = parseFloat(document.getElementById('val_oversizing_aplicado').value) || 1.0;
        const hsp = parseFloat(document.getElementById('hsp_bruto').innerText) || 0;
        const pr = parseFloat(document.getElementById('fixo_pr_final').innerText.replace('%','')) / 100 || 0.80;

        // Dados para cálculo linear
        const geracaoAtual = parseFloat(document.getElementById('fixo_geracao').innerText) || 0;
        const qtdModulosAtual = parseInt(document.getElementById('total_modulos_projeto').value) || 0;
        const wattsModulo = parseFloat(document.getElementById('select_modulo_comparativo').value) || 580;
        
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
    // 🛒 LÓGICA DO CARRINHO DE INVERSORES (MULTI-INVERSOR)
    // ======================================================================

    window.aplicarComposicao = function(itensJson, indexSugestao) {
        const itens = JSON.parse(decodeURIComponent(itensJson));
        carrinhoInversores = []; // Limpa o carrinho atual
        
        itens.forEach(it => {
            // Adiciona diretamente ao carrinho
            carrinhoInversores.push({ modelo: it.mod, nominal: it.nom, tipo: it.tipo, qtd: it.qtd });
        });
        
        // Atualiza estado visual
        estadoSelecaoInversor = { tipo: 'SUGESTAO', id: indexSugestao };
        renderizarTabelaHuawei(); // Re-renderiza para aplicar classes

        // AVANÇO DE ETAPA: Inversores definidos -> Vai para Financeiro (Índice 3)
        gerenciadorEtapas.avancarPara('financeiro');

        atualizarComposicaoFinal();
        // Rola para o resumo
        document.getElementById('container_selecionados').scrollIntoView({ behavior: 'smooth' });
    }

    window.adicionarAoCarrinho = function(modelo, nominal, tipo) {
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

        // AVANÇO DE ETAPA: Inversores definidos -> Vai para Financeiro (Índice 3)
        gerenciadorEtapas.avancarPara('financeiro');

        atualizarComposicaoFinal();
    }

    window.removerDoCarrinho = function(index) {
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
        const overAlvo = parseFloat(document.getElementById('val_oversizing_aplicado').value);
        
        if (carrinhoInversores.length === 0) {
            container.style.display = 'none';
            // Reseta proposta atual
            gerenciarEstadoCalculo('INVALIDAR');
            return;
        }

        container.style.display = 'block';
        
        // 1. Dados do Projeto
        const potDCInstaladaWp = parseFloat(document.getElementById('potencia_dc_total').innerText) * 1000;
        const hsp = parseFloat(document.getElementById('hsp_bruto').innerText) || 5.0;
        
        // Recalcula PR (Unificado)
        const geracaoX_Projeto = parseFloat(document.getElementById('fixo_geracao').innerText) || 0;
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
                        (${(capDC/1000).toFixed(1)} kWp)
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
        const limiteTecnicoExpansao = potNominalTotalAC * 1.35; // Limite técnico seguro (135%)
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

        // Chama a validação final
        validarBotaoFinal();

        // ATUALIZAÇÃO FINANCEIRA AUTOMÁTICA
        // Garante que mudanças nos inversores (complexidade) ou módulos (quantidade) reflitam no preço
        if (carrinhoInversores.length > 0) {
            window.calcularEngenhariaFinanceira();
        }
    }

    window.filtrarTabelaHuawei = function() {
        renderizarTabelaHuawei();
    };

    window.toggleListaCompleta = function() {
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
        
        let tableHTML = '<table class="tabela-comparativa-modulos"><thead><tr><th>Modelo</th><th>Qtd</th><th>Pot. Total</th><th>Ação</th></tr></thead><tbody>';
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
    window.alternarModoOrientacao = function(modo) {
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

    window.adicionarLinhaOrientacao = function(primeira = false) {
        const container = document.getElementById('container_orientacoes_compostas');
        const azimuteGeral = document.getElementById('azimute_geral').value;
        const inclinacaoGeral = document.getElementById('inclinacao_geral').value;

        const div = document.createElement('div');
        div.className = 'linha-orientacao';
        div.innerHTML = `
            <div class="grupo-form">
                <label>% da Potência</label>
                <input type="number" class="input-perc input-monitorado" value="${primeira ? 100 : 0}" oninput="window.validarSomaOrientacao()">
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

    window.removerLinhaOrientacao = function(btn) {
        const container = document.getElementById('container_orientacoes_compostas');
        if (container.children.length > 1) {
            btn.closest('.linha-orientacao').remove();
            window.validarSomaOrientacao();
            recalcularDimensionamento();
        } else {
            alert("É necessário manter pelo menos uma orientação.");
        }
    };

    window.validarSomaOrientacao = function() {
        if (modoOrientacao === 'simples') return true;

        const inputs = document.querySelectorAll('#container_orientacoes_compostas .input-perc');
        let soma = 0;
        inputs.forEach(input => {
            soma += parseFloat(input.value) || 0;
        });

        const statusEl = document.getElementById('status_soma_perc');
        statusEl.innerText = `Total: ${soma}%`;

        if (soma === 100) {
            statusEl.style.color = '#16a34a'; // Verde
            recalcularDimensionamento();
            return true;
        } else {
            statusEl.style.color = '#dc2626'; // Vermelho
            gerenciarEstadoCalculo('INVALIDAR');
            return false;
        }
    };

    // --- NOVA FUNÇÃO: VERIFICAR TIPO DE ESTRUTURA (SOLO/LAJE) ---
    window.verificarTipoEstrutura = function() {
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
    window.toggleSecao = function(idConteudo, idIcone) {
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
    const idsFinanceiros = ['prem_fator_lucro', 'prem_aliquota_imposto', 'valor_kit_fornecedor'];
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

    // ======================================================================
    // 💲 MOTOR DE ENGENHARIA FINANCEIRA (CÁLCULO DE PREÇO)
    // ======================================================================
    
    window.calcularEngenhariaFinanceira = function() {
        // Define a função de formatação no início do escopo para evitar ReferenceError
        const formatarMoeda = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // --- FUNÇÃO AUXILIAR: RENDERIZAÇÃO DO RESUMO DE MATERIAIS PREMIUM ---
        function renderizarResumoMateriaisPremium(dadosEletrocalha, dadosQDG, custoTampas, totalMateriais, potAC, rede) {
            let container = document.getElementById('container_resumo_materiais');
            if (!container) {
                container = document.createElement('div');
                container.id = 'container_resumo_materiais';
                const wrapper = document.getElementById('wrapper-etapa-financeira');
                if (wrapper) wrapper.appendChild(container);
            }

            if (projetoGerenciador.abaAtiva !== 'premium') {
                container.style.display = 'none';
                return;
            }
            container.style.display = 'block';

            const nInv = carrinhoInversores.reduce((acc, i) => acc + i.qtd, 0);

            // Calcula o custo base para mostrar apenas o adicional premium no resumo
            const qtdModulos = parseInt(document.getElementById('total_modulos_projeto')?.value) || 0;
            const premissas = db.buscarConfiguracao('premissas_globais');
            const custoBase = calcularCustoMateriaisBasicos(qtdModulos, premissas?.tabelas?.materiais);
            // const custoInfraPremium = totalMateriais - custoBase; // Unused variable

            container.innerHTML = `
                <div class="check-list-premium" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-top: 20px;">
                    <h4 style="color: #0f172a; margin-bottom: 10px; font-size: 1rem; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">
                        <i class="fas fa-list-check" style="color: var(--primaria);"></i> Detalhamento da Infraestrutura (Automático)
                    </h4>
                    <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 10px;">
                        Nota técnica: Dimensionado para <strong>${potAC.toFixed(2)} kW</strong> de potência AC em rede <strong>${rede}</strong>.
                    </div>
                    <ul style="list-style: none; padding: 0; font-size: 0.9rem; color: #334155;">
                        <li style="margin-bottom: 6px; display: flex; justify-content: space-between;">
                            <span><i class="fas fa-box"></i> <strong>Quadro:</strong> 1x ${dadosQDG.tipo}</span>
                            <span>${formatarMoeda(dadosQDG.custoQDG)}</span>
                        </li>
                        <li style="margin-bottom: 6px; display: flex; justify-content: space-between;">
                            <span><i class="fas fa-th"></i> <strong>Barramento:</strong> ${dadosQDG.qtdBlocos}x Blocos de Distribuição</span>
                            <span>${formatarMoeda(dadosQDG.custoBlocos)}</span>
                        </li>
                        <li style="margin-bottom: 6px; display: flex; justify-content: space-between;">
                            <span><i class="fas fa-road"></i> <strong>Passagem:</strong> ${nInv}x Eletrocalha <strong>${dadosEletrocalha.tipo}</strong> (3m)</span>
                            <span>${formatarMoeda(nInv * dadosEletrocalha.custoUnit)}</span>
                        </li>
                        <li style="margin-bottom: 6px; display: flex; justify-content: space-between;">
                            <span><i class="fas fa-shield-alt"></i> <strong>Proteção:</strong> ${nInv}x Tampas de Acrílico</span>
                            <span>${formatarMoeda(custoTampas)}</span>
                        </li>
                    </ul>
                </div>
            `;
        }

        const premissas = db.buscarConfiguracao('premissas_globais');
        const aba = projetoGerenciador.abaAtiva;
        
        // Elementos DOM
        const elQtdModulos = document.getElementById('total_modulos_projeto');
        const elOrigemEstrutura = document.getElementById('select_origem_estrutura');
        const elFatorLucro = document.getElementById('prem_fator_lucro');
        const elValorKit = document.getElementById('valor_kit_fornecedor');
        const elImposto = document.getElementById('prem_aliquota_imposto');

        const qtdModulos = parseInt(elQtdModulos?.value) || 0;
        // LÊ DIRETO DO PROJETO (Segurança de Dados)
        const tipoEstrutura = (projetoCompleto.projeto.tipoTelhado || 'Telhado').toLowerCase(); 
        const origemEstrutura = elOrigemEstrutura?.value || 'KIT';
        
        // Premissas
        const pFin = premissas?.financeiro || {};
        const pEst = premissas?.estruturas || {};
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

        // Adicional Premium (Se for a aba Premium, SOMA ao invés de substituir)
        if (aba === 'premium') {
            const qtdInversores = carrinhoInversores.reduce((acc, i) => acc + i.qtd, 0);
            const tipoRede = document.getElementById('uc_tipo_padrao')?.value || 'monofasico';
            const isTrifasico = tipoRede.toLowerCase().includes('trif');
            
            const custoQDG = isTrifasico ? (pMatPrem.va_qdg_trif_premum || 300) : (pMatPrem.va_qdg_mono_premium || 150);
            const qtdBlocos = isTrifasico ? 5 : 3;
            const custoBlocos = qtdBlocos * (pMatPrem.va_bloco_distribuicao || 90);
            
            const potTotalInversoresAC_kW = carrinhoInversores.length > 0 ? carrinhoInversores.reduce((acc, i) => acc + (i.nominal * i.qtd), 0) / 1000 : 0;
            let custoUnitEletrocalha = (pMatPrem.va_eletrocalha_50 || 85);
            if (potTotalInversoresAC_kW > 12 || qtdInversores > 1) {
                custoUnitEletrocalha = (pMatPrem.va_eletrocalha_100 || 158);
            }
            const custoEletrocalhas = qtdInversores * custoUnitEletrocalha;
            const custoTampas = qtdInversores * (pMatPrem.va_tampa_acrilico || 335);

            custoMateriais += (custoQDG + custoBlocos + custoEletrocalhas + custoTampas);
            
            // Renderiza Checklist Premium
            renderizarResumoMateriaisPremium(
                { tipo: (custoUnitEletrocalha === (pMatPrem.va_eletrocalha_100 || 158)) ? "100mm" : "50mm", custoUnit: custoUnitEletrocalha },
                { tipo: isTrifasico ? "Trifásico Amplo" : "Monofásico Amplo", custoQDG: custoQDG, qtdBlocos: qtdBlocos, custoBlocos: custoBlocos },
                custoTampas, custoMateriais, potTotalInversoresAC_kW, tipoRede
            );
        } else {
            // Oculta checklist se não for premium
            const containerResumo = document.getElementById('container_resumo_materiais');
            if (containerResumo) containerResumo.style.display = 'none';
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
        const custoLogistica = (kmTotal / (pFin.consumoVeiculo || 8.5)) * (pFin.precoCombustivel || 6.10);

        // =================================================================
        // 3. TOTALIZADOR FINAL (MARKUP POR ITEM)
        // =================================================================
        const fatorLucro = parseFloat(elFatorLucro?.value) || 1.1;
        const lucroMinimo = pFin.lucroMinimo || 0; // Piso de lucro
        const aliquotaImposto = (parseFloat(elImposto?.value) || 0) / 100;
        const divisorImposto = (1 - aliquotaImposto) > 0 ? (1 - aliquotaImposto) : 1;
        
        // A. MÃO DE OBRA (Custo Base + Extras)
        // Aplica o markup do imposto sobre o custo da M.O.
        const precoVendaMO = custoMO / divisorImposto;
        
        // B. LUCRO (Calculado sobre a M.O. sem imposto)
        // Regra: Lucro = Custo M.O. * Fator (ex: 1500 * 1.1 = 1650 de lucro nominal)
        let lucroNominal = custoMO * fatorLucro;

        // APLICAÇÃO DO PISO (TRAVA DE SEGURANÇA)
        if (lucroNominal < lucroMinimo) {
            lucroNominal = lucroMinimo;
        }

        const precoVendaLucro = lucroNominal / divisorImposto;

        // C. LOGÍSTICA (Repasse com Imposto)
        const precoVendaLogistica = custoLogistica / divisorImposto;
        
        // D. MATERIAIS (Instalação/Infra com Imposto)
        const precoVendaMateriais = custoMateriais / divisorImposto;

        // PREÇO FINAL DO SERVIÇO (Soma dos itens com Gross-up)
        const precoVendaServico = precoVendaMO + precoVendaLucro + precoVendaLogistica + precoVendaMateriais;
        
        // Cálculo Reverso do Imposto Real (Para exibição)
        // Base Total = Custos + Lucro Nominal
        const baseTotal = custoMO + lucroNominal + custoLogistica + custoMateriais;
        const valorImposto = precoVendaServico - baseTotal;
        
        // Lucro para exibição
        const lucro = lucroNominal;

        // VALOR TOTAL = SERVIÇO + MATERIAIS + KIT
        // Nota: custoMateriais já está embutido no precoVendaServico (taxado), então não somamos novamente.
        // O Valor Total é o Serviço (que contém MO, Logística, Materiais e Impostos) + Kit.
        const valorKit = parseFloat(elValorKit?.value) || 0;
        const valorTotalCliente = precoVendaServico + valorKit;

        // 4. ATUALIZAÇÃO UI
        if(document.getElementById('res_custo_materiais')) document.getElementById('res_custo_materiais').innerText = formatarMoeda(custoMateriais);
        if(document.getElementById('res_custo_mo_base')) document.getElementById('res_custo_mo_base').innerText = `${formatarMoeda(custoMO)} (${diasFinais}d)`;
        if(document.getElementById('res_logistica')) document.getElementById('res_logistica').innerText = formatarMoeda(custoLogistica);
        if(document.getElementById('res_lucro_proposta')) document.getElementById('res_lucro_proposta').innerText = formatarMoeda(lucro);
        if(document.getElementById('res_imposto_cascata')) document.getElementById('res_imposto_cascata').innerText = formatarMoeda(valorImposto);
        if(document.getElementById('res_preco_venda_servico')) document.getElementById('res_preco_venda_servico').innerText = formatarMoeda(precoVendaServico);
        if(document.getElementById('res_valor_total_proposta')) document.getElementById('res_valor_total_proposta').innerText = formatarMoeda(valorTotalCliente);

        // Estado
        if (projetoGerenciador.abaAtiva && projetoGerenciador[projetoGerenciador.abaAtiva]) {
            projetoGerenciador[projetoGerenciador.abaAtiva].dados.precoCalculado = true;
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
    };

    function preencherResumoExecutivo(dados) {
        const secao = document.getElementById('secao_resumo_executivo');
        if (!secao) return;

        // Só exibe se houver preço calculado
        if (projetoGerenciador[projetoGerenciador.abaAtiva].dados.precoCalculado) {
            secao.style.display = 'block';

            // 1. Equipamentos
            let descInversores = dados.inversores.map(i => `${i.qtd}x ${i.modelo}`).join(' + ');
            
            // Adiciona flag de seleção manual no resumo final
            if (estadoSelecaoInversor.tipo === 'MANUAL') {
                descInversores += ' <span style="color: #f59e0b; font-size: 0.8em;" title="Seleção Manual do Engenheiro">⚠️ (Manual)</span>';
            }
            
            // Verifica se o módulo escolhido é o recomendado (assumindo que o primeiro da lista gerada era o recomendado)
            // Nota: Para precisão total, precisaríamos persistir qual era o recomendado. 
            // Aqui usamos uma lógica visual: se tem seleção manual diferente da recomendação padrão.
            if (estadoSelecaoModulo.watts && dimensionamentoCompleto?.melhorSugestao) {
                 // Lógica simplificada para o resumo
            }

            document.getElementById('res_final_equipamentos').innerHTML = descInversores || "Nenhum inversor";
            document.getElementById('res_final_detalhes_mod').innerText = `${dados.qtdModulos}x Painéis de ${dados.potenciaModulo}W`;

            // 2. Geração e Expansão
            document.getElementById('res_final_geracao').innerText = `Geração: ${dados.geracaoMensal}`;
            // Usa o cálculo linear de expansão se disponível, ou o valor passado
            const textoExpansao = `Geração Máxima: ${dados.geracaoMax}`;
            document.getElementById('res_final_expansao').innerText = textoExpansao;

            // 3. Financeiro
            document.getElementById('res_final_preco').innerText = dados.precoVenda;
            document.getElementById('res_final_imposto_lucro').innerText = `Impostos: ${dados.impostos} | Lucro: ${dados.lucro}`;
            
            // 4. Status de Seleção Técnica (Novo)
            const statusDiv = document.getElementById('status_selecao_tecnica');
            if (!statusDiv) {
                // Cria se não existir (inserir antes do financeiro ou onde preferir)
                const div = document.createElement('div');
                div.id = 'status_selecao_tecnica';
                div.className = 'item-resumo';
                document.getElementById('res_final_equipamentos').parentNode.appendChild(div);
            }
            
            const isModuloRecomendado = dimensionamentoCompleto?.melhorSugestao && 
                                      (estadoSelecaoModulo.watts === dimensionamentoCompleto.melhorSugestao.watts && 
                                       estadoSelecaoModulo.qtd === dimensionamentoCompleto.melhorSugestao.quantidade);
            
            const modTexto = isModuloRecomendado ? "<span style='color:#16a34a'>Recomendado</span>" : "<span style='color:#3b82f6'>Personalizado</span>";
            const invTexto = estadoSelecaoInversor.tipo === 'MANUAL' ? "<span style='color:#f59e0b'>Manual ⚠️</span>" : "<span style='color:#16a34a'>Sugerido</span>";
            
            document.getElementById('status_selecao_tecnica').innerHTML = `
                <div style="margin-top:10px; font-size:0.85rem; border-top:1px solid #eee; padding-top:5px;">
                    Configuração: <strong>Módulos ${modTexto}</strong> | <strong>Inversores ${invTexto}</strong>
                </div>
            `;

            // 4. Execução (Segurança)
            const elDias = document.getElementById('res_final_dias_txt');
            const elAlerta = document.getElementById('res_final_alerta_minimo');
            if (elDias) elDias.innerText = `${dados.diasObra} Dias de Obra`;
            if (elAlerta) elAlerta.style.display = dados.isMinimo ? 'block' : 'none';

            // 5. Comparativo (Se ambas as abas estiverem preenchidas)
            atualizarComparativoFinal();

        } else {
            secao.style.display = 'none';
        }
    }

    function atualizarComparativoFinal() {
        const container = document.getElementById('secao_comparativa_final');
        // Verifica se ambas as abas têm dados calculados
        if (!projetoGerenciador.standard.dados.precoCalculado || !projetoGerenciador.premium.dados.precoCalculado) {
            if(container) container.style.display = 'none';
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
        container.style.display = 'block';
    }

    // ======================================================================
    // 🔒 VALIDAÇÃO FINAL (GATEKEEPER)
    // ======================================================================
    function validarBotaoFinal() {
        const btn = document.getElementById('btn_gerar_proposta');
        const msg = document.getElementById('msg_validacao');
        
        // Verifica se há inversores no carrinho
        const temInversor = carrinhoInversores.length > 0;
        const temPreco = (projetoGerenciador.abaAtiva && projetoGerenciador[projetoGerenciador.abaAtiva]) 
            ? projetoGerenciador[projetoGerenciador.abaAtiva].dados.precoCalculado 
            : false;
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
            if (!temPreco) pendencias.push("Custos");
            
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

            // 2. Prepara o objeto para o banco de dados (D1 Structure)
            const propostaParaGravar = {
                id_proposta: `PROP-${Date.now()}`,
                escopo: projetoGerenciador.tipoEscopo, // Salva a decisão inicial
                id_projeto: projetoCompleto.projeto.id,
                data_criacao: new Date().toISOString(),
                configuracao: {
                    temStandard: projetoGerenciador.standard.dados.precoCalculado,
                    temPremium: projetoGerenciador.premium.dados.precoCalculado
                },
                premissas_comuns: {
                    consumo: parseFloat(higienizarParaCalculo(inputConsumo.value)),
                    cidade: projetoCompleto.projeto.cidade,
                    uf: projetoCompleto.projeto.uf
                },
                versoes: {
                    standard: projetoGerenciador.standard.dados.precoCalculado ? projetoGerenciador.standard.dados : null,
                    premium: projetoGerenciador.premium.dados.precoCalculado ? projetoGerenciador.premium.dados : null
                },
                status: 'Gerada'
            };

            // 3. Salva no LocalStorage (Simulando D1)
            const propostasExistentes = JSON.parse(localStorage.getItem('db_propostas_d1')) || [];
            propostasExistentes.push(propostaParaGravar);
            localStorage.setItem('db_propostas_d1', JSON.stringify(propostasExistentes));

            alert("Proposta salva com sucesso! Você será redirecionado para a visualização.");
            // window.location.href = 'lista-propostas.html'; // Exemplo de redirecionamento
        });
    }

    // --- Execução Inicial ---
    inicializarBaseDeDados();
    validarBotaoFinal(); // Garante estado inicial correto
    
    // Inicializa o visual das etapas (Premissas aberta, resto fechado)
    gerenciadorEtapas.sincronizarVisual();
    
    window.alternarModoOrientacao('simples'); // Garante o estado inicial correto
    
    // Injeta o Modal de Decisão
    renderizarModalEscopo();
});