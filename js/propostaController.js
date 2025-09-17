import { buscarETratarProposta, atualizarStatusVisualizacao, validarValidadeProposta } from './model.js';

// Funções para o novo loading-overlay
function mostrarLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('oculto');
    }
}

function esconderLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    const mainContent = document.querySelector('main');

    if (mainContent) {
        mainContent.classList.remove('main-oculto');
        mainContent.classList.add('main-visivel');
    }

    if (overlay) {
        overlay.classList.add('oculto');
    }
}

// FUNÇÃO CORRIGIDA: Gerencia a nova imagem da marca de equipamentos
// FUNÇÃO CORRIGIDA: Gerencia as imagens de equipamentos de forma inteligente
function atualizarImagemEquipamentos(proposta) {
    let imagemEquipamentos;

    // Acessa o elemento HTML baseado no tipo de visualização da proposta
    if (proposta.tipoVisualizacao === 've') {
        imagemEquipamentos = document.getElementById('imagem-marca-ve');
    } else {
        imagemEquipamentos = document.getElementById('imagem-marca-equipamento');
    }

    if (!imagemEquipamentos) {
        console.warn(`AVISO: Elemento de imagem para equipamentos não encontrado.`);
        return;
    }

    // Lógica para carregar a imagem da marca
    if (proposta.tipoVisualizacao === 've') {
        imagemEquipamentos.src = proposta.equipamentos?.imagem || '';
        console.log("DEBUG: Imagem de marca de VE preenchida com sucesso.");
    } else if (proposta.tipoVisualizacao === 'solar') {
        if (proposta.tipo === 'premium') {
            imagemEquipamentos.src = 'imagens/huawei.webp';
            console.log("DEBUG: Imagem de marca SOLAR (PREMIUM) preenchida com sucesso.");
        } else if (proposta.tipo === 'acessivel') {
            imagemEquipamentos.src = 'imagens/auxsolar.webp';
            console.log("DEBUG: Imagem de marca SOLAR (+ACESSÍVEL) preenchida com sucesso.");
        } else {
            console.warn("AVISO: Tipo de proposta solar desconhecido para carregar a imagem de marca.");
            imagemEquipamentos.src = '';
        }
    }
}

function atualizarImagemInstalacao(proposta) {
    const imagemInstalacao = document.getElementById('imagem-instalacao');
    if (!imagemInstalacao) {
        console.error("ERRO: Elemento com ID 'imagem-instalacao' não encontrado.");
        return;
    }
    imagemInstalacao.src = proposta.instalacao?.imagem || '';
}

function atualizarEtiquetasDinamicas(tipo) {
    const etiquetas = document.querySelectorAll('.etiqueta-proposta-dinamica:not(.etiqueta-a-vista)');
    const texto = tipo === 'premium' ? 'Premium' : '+Acessível';
    etiquetas.forEach(etiqueta => {
        etiqueta.innerText = texto;
    });
}

function preencherDetalhesInstalacao(proposta) {
    const secaoDetalhes = document.getElementById('detalhes-instalacao');
    if (!secaoDetalhes) {
        console.warn("AVISO: Elemento 'detalhes-instalacao' não encontrado. Não é possível preencher.");
        return;
    }

    secaoDetalhes.innerHTML = '';
    const detalhes = proposta.instalacao?.detalhesInstalacao;

    if (!detalhes || detalhes.length === 0) {
        console.warn("AVISO: Detalhes da instalação não encontrados na proposta.");
        secaoDetalhes.innerHTML = '<p>Nenhum detalhe de instalação disponível.</p>';
        return;
    }

    detalhes.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-detalhe';
        div.innerHTML = `
            <i class="fas ${item.icone} icone-detalhe"></i>
            <p class="texto-detalhe">${item.texto}</p>
        `;
        secaoDetalhes.appendChild(div);
    });

    console.log("DEBUG: Detalhes de instalação preenchidos com sucesso.");
}

// --- FUNÇÃO CENTRAL DE PREENCHIMENTO ATUALIZADA ---
function preencherDadosProposta(dados) {
    console.log("DEBUG: Iniciando preenchimento dos dados da proposta. Conteúdo recebido:", dados);

    try {
        const isVE = dados.tipoVisualizacao === 've';
        
        // 1. Dados do Cliente
        console.log("DEBUG: Preenchendo dados do cliente...");
        const nomeClienteEl = document.getElementById('nome-cliente');
        const nomeCompleto = dados.cliente || "Não informado";
        let nomeCurto = nomeCompleto;

        if (nomeCompleto !== "Não informado") {
            const palavrasDoNome = nomeCompleto.split(' ');
            if (palavrasDoNome.length > 2) {
                nomeCurto = `${palavrasDoNome[0]} ${palavrasDoNome[1]}`;
            }
        }
        if (nomeClienteEl) {
            nomeClienteEl.innerText = nomeCurto;
        }

        const localClienteEl = document.getElementById('local-cliente');
        if (localClienteEl) localClienteEl.innerText = dados.local || "Não informado";

        const dataPropostaEl = document.getElementById('data-proposta');
        if (dataPropostaEl) dataPropostaEl.innerText = dados.dataProposta || "Não informado";
        console.log("DEBUG: Dados do cliente preenchidos com sucesso.");
        
        // 2. Sistema Proposto (Lógica adaptada para VE e Solar)
        console.log("DEBUG: Preenchendo dados do sistema...");
        const geracaoMediaEl = document.getElementById('geracao-media');
        const unidadeGeracaoEl = document.getElementById('unidade-geracao');
        const instalacaoPaineisEl = document.getElementById('instalacao-paineis');
        const iconeInstalacaoEl = document.getElementById('icone-instalacao');
        const idealParaEl = document.getElementById('ideal-para');
        const tituloSistemaEl = document.getElementById('titulo-sistema');

        if (isVE) {
            if (tituloSistemaEl) tituloSistemaEl.innerText = 'Carregador Proposto';
            if (geracaoMediaEl) geracaoMediaEl.innerText = dados.sistema?.geracaoMedia || 'N/A';
            if (unidadeGeracaoEl) unidadeGeracaoEl.innerText = dados.sistema?.unidadeGeracao || '';
            if (instalacaoPaineisEl) instalacaoPaineisEl.innerText = dados.sistema?.instalacaoPaineis || 'Não informado';
            if (iconeInstalacaoEl) iconeInstalacaoEl.className = 'fas fa-charging-station';
            if (idealParaEl) idealParaEl.innerText = dados.sistema?.idealPara || 'Não informado';
            
        } else { // Lógica para o sistema Solar
            if (tituloSistemaEl) tituloSistemaEl.innerText = 'Sistema Proposto';
            if (geracaoMediaEl) {
                const geracaoMedia = dados.sistema?.geracaoMedia;
                const geracaoMediaSplit = typeof geracaoMedia === 'string' ? geracaoMedia.split(' ') : ['N/A', ''];
                geracaoMediaEl.innerText = geracaoMediaSplit[0];
                if (unidadeGeracaoEl) unidadeGeracaoEl.innerText = geracaoMediaSplit.slice(1).join(' ');
            }
            if (instalacaoPaineisEl) instalacaoPaineisEl.innerText = dados.sistema?.instalacaoPaineis || 'Não informado';
            if (iconeInstalacaoEl) {
                const tipoInstalacao = dados.sistema?.instalacaoPaineis || "Não informado";
                if (tipoInstalacao.toLowerCase().includes('telhado')) {
                    iconeInstalacaoEl.className = 'fas fa-house-chimney';
                } else if (tipoInstalacao.toLowerCase().includes('solo')) {
                    iconeInstalacaoEl.className = 'fas fa-solar-panel';
                } else {
                    iconeInstalacaoEl.className = 'fas fa-question-circle';
                }
            }
            if (idealParaEl) idealParaEl.innerText = dados.sistema?.idealPara || 'R$ 0,00';
        }
        console.log("DEBUG: Dados do sistema preenchidos com sucesso.");

        // 3. Equipamentos (Lógica adaptada para VE e Solar)
        console.log("DEBUG: Preenchendo dados dos equipamentos...");
        const tituloEquipamentosEl = document.getElementById('titulo-equipamentos');
        const descricaoInversorEl = document.getElementById('descricao-inversor');
        const quantidadeInversorEl = document.getElementById('quantidade-inversor');
        const descricaoPainelEl = document.getElementById('descricao-painel');
        const quantidadePainelEl = document.getElementById('quantidade-painel');
        const painelBox = document.getElementById('painel-box');
        const inversorBox = document.getElementById('inversor-box');

        if (isVE) {
            if (tituloEquipamentosEl) tituloEquipamentosEl.innerText = 'Equipamentos';
            if (painelBox) painelBox.classList.add('oculto');
            if (inversorBox) inversorBox.classList.remove('oculto');
            if (descricaoInversorEl) descricaoInversorEl.innerText = dados.equipamentos?.descricaoInversor || "Não informado";
            if (quantidadeInversorEl) quantidadeInversorEl.innerText = `${dados.equipamentos?.quantidadeInversor || 0}`;
        } else {
            if (tituloEquipamentosEl) tituloEquipamentosEl.innerText = 'Equipamentos do Sistema';
            if (painelBox) painelBox.classList.remove('oculto');
            if (inversorBox) inversorBox.classList.remove('oculto');
            if (descricaoInversorEl) descricaoInversorEl.innerText = dados.equipamentos?.descricaoInversor || "Não informado";
            if (quantidadeInversorEl) quantidadeInversorEl.innerText = `${dados.equipamentos?.quantidadeInversor || 0}`;
            if (descricaoPainelEl) descricaoPainelEl.innerText = dados.equipamentos?.descricaoPainel || "Não informado";
            if (quantidadePainelEl) quantidadePainelEl.innerText = `${dados.equipamentos?.quantidadePainel || 0}`;
        }
        console.log("DEBUG: Dados de equipamentos preenchidos com sucesso.");

        // 4. Valores Finais e Financiamento (Lógica adaptada para VE e Solar)
        console.log("DEBUG: Preenchendo valores financeiros...");
        const valorTotalEl = document.getElementById('valor-total');
        const paybackContainer = document.getElementById('payback-container');
        const financiamentoContainer = document.getElementById('financiamento-container');

        if (isVE) {
            if (valorTotalEl) valorTotalEl.innerText = dados.valores?.valorTotal || "Não informado";
            if (paybackContainer) paybackContainer.classList.add('oculto');
            if (financiamentoContainer) financiamentoContainer.classList.add('oculto');
        } else {
            if (valorTotalEl) valorTotalEl.innerText = dados.valores?.valorTotal || "Não informado";
            const paybackValorEl = document.getElementById('payback-valor');
            if (paybackValorEl) {
                paybackValorEl.innerText = dados.valores?.payback || 'Não informado';
            } else {
                console.error("ERRO: Elemento com ID 'payback-valor' não encontrado no DOM.");
            }
            if (paybackContainer) paybackContainer.classList.remove('oculto');
            if (financiamentoContainer) financiamentoContainer.classList.remove('oculto');
            
            const opcoesParcelas = [12, 24, 36, 48, 60, 72, 84];
            opcoesParcelas.forEach(n => {
                const parcelaKey = `parcela-${n}`;
                const elementoParcela = document.getElementById(parcelaKey);
                if (elementoParcela) {
                    elementoParcela.innerText = dados.valores?.parcelas[parcelaKey] || 'N/A';
                } else {
                    console.warn(`AVISO: Elemento de parcela '${parcelaKey}' não encontrado.`);
                }
                const elementoTaxa = document.getElementById(`taxa-${n}`);
                if (elementoTaxa) {
                    elementoTaxa.innerText = '';
                }
            });
        }
        console.log("DEBUG: Valores financeiros e financiamento preenchidos com sucesso.");

        // 5. Observações e Validade
        console.log("DEBUG: Preenchendo observações e validade...");
        const observacaoEl = document.getElementById('texto-observacao');
        const validadeEl = document.getElementById('texto-validade');
        const resumoInstalacaoEl = document.getElementById('resumo-instalacao');
        const iconeResumoEl = document.getElementById('icone-resumo');

        if (observacaoEl) {
            observacaoEl.innerText = dados.valores?.observacao || "Não há observações sobre financiamento.";
        }
        if (validadeEl) {
            validadeEl.innerText = dados.validade || "Não informada";
        }
        if (resumoInstalacaoEl && iconeResumoEl) {
            resumoInstalacaoEl.innerText = dados.instalacao?.resumoInstalacao || "";
            if (dados.tipo === 'premium') {
                iconeResumoEl.classList.add('fa-circle-check');
                iconeResumoEl.classList.remove('fa-triangle-exclamation');
            } else {
                iconeResumoEl.classList.add('fa-triangle-exclamation');
                iconeResumoEl.classList.remove('fa-circle-check');
            }
        }
        console.log("DEBUG: Observações, validade e resumo de instalação preenchidos com sucesso.");
    } catch (error) {
        console.error("ERRO DENTRO DE preencherDadosProposta:", error);
    }
}

// --- Função principal de inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    document.addEventListener('contextmenu', function(evento) {
        evento.preventDefault();
    });
    document.addEventListener('keydown', function(evento) {
        if ((evento.ctrlKey || evento.metaKey) && evento.key === 'p') {
            evento.preventDefault();
        }
        if (evento.key === 'F12') {
            evento.preventDefault();
        }
    });

    mostrarLoadingOverlay();

    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjeto = urlParams.get('id');
    const primeiroNome = urlParams.get('nome');

    const seletorTipoProposta = document.querySelector('.seletor-tipo-proposta');
    const btnPremium = document.getElementById('btn-premium');
    const btnAcessivel = document.getElementById('btn-acessivel');
    const btnVoltar = document.querySelector('.btn-voltar-proposta');

    if (numeroProjeto && primeiroNome) {
        try {
            const propostas = await buscarETratarProposta(numeroProjeto, primeiroNome);

            if (!propostas.sucesso) {
                // Determine o código de erro a ser passado na URL
                let codigoErro = 'acesso-negado'; // Valor padrão
                if (propostas.mensagem && propostas.mensagem.includes('expirada')) {
                    codigoErro = 'proposta-expirada';
                }
                
                // Redireciona para a página inicial com o código de erro correto
                window.location.href = `index.html?erro=${codigoErro}`;
                return;
            }

            const propostaData = propostas.dados;
            localStorage.setItem('propostaData', JSON.stringify(propostaData));

            const temPropostaAcessivelValida = propostaData.acessivel && validarValidadeProposta(propostaData.acessivel);

            // Lógica para esconder o seletor quando é uma proposta VE
            if (propostaData.premium.tipoVisualizacao === 've' && seletorTipoProposta) {
                seletorTipoProposta.classList.add('oculto');
                console.warn("Proposta de VE, seletor de proposta ocultado.");
            } else if (seletorTipoProposta) {
                if (temPropostaAcessivelValida) {
                    seletorTipoProposta.classList.remove('oculto');
                } else {
                    seletorTipoProposta.classList.add('oculto');
                    console.warn("Apenas uma proposta encontrada. Os botões de alternância foram ocultados.");
                }
            }
            
            // Lógica unificada para preenchimento dos dados
            const propostaInicial = propostaData.premium;
            preencherDadosProposta(propostaInicial);
            atualizarImagemEquipamentos(propostaInicial);
            atualizarImagemInstalacao(propostaInicial);
            preencherDetalhesInstalacao(propostaInicial);
            atualizarEtiquetasDinamicas('premium');
            document.body.classList.add('theme-premium');

            // A chamada para `atualizarStatusVisualizacao` agora está no lugar certo
            const dadosVisualizacao = {
                propostaId: numeroProjeto,
                tipoVisualizacao: 'P'
            };
            await atualizarStatusVisualizacao(dadosVisualizacao);

        } catch (error) {
            console.error("ERRO: Falha ao carregar ou exibir a proposta.", error);
            window.location.href = 'index.html?erro=acesso-negado';
        } finally {
            esconderLoadingOverlay();
        }
    } else {
        window.location.href = 'index.html?erro=parametros-ausentes';
    }

    if (btnPremium) {
        btnPremium.addEventListener('click', () => {
            if (btnPremium.classList.contains('selecionado')) {
                return;
            }
            mostrarLoadingOverlay();
            const propostas = JSON.parse(localStorage.getItem('propostaData'));
            if (propostas && propostas.premium) {
                preencherDadosProposta(propostas.premium);
                atualizarImagemEquipamentos(propostas.premium);
                atualizarEtiquetasDinamicas('premium');
                atualizarImagemInstalacao(propostas.premium);
                preencherDetalhesInstalacao(propostas.premium);
                document.body.classList.remove('theme-acessivel');
                document.body.classList.add('theme-premium');
                btnPremium.classList.add('selecionado');
                if (btnAcessivel) btnAcessivel.classList.remove('selecionado');
            } else {
                console.error("ERRO: Dados da proposta Premium não encontrados no localStorage.");
            }
            setTimeout(() => esconderLoadingOverlay(), 400);
        });
    }

    if (btnAcessivel) {
        btnAcessivel.addEventListener('click', () => {
            if (btnAcessivel.classList.contains('selecionado')) {
                return;
            }
            mostrarLoadingOverlay();
            const propostas = JSON.parse(localStorage.getItem('propostaData'));
            if (propostas && propostas.acessivel) {
                preencherDadosProposta(propostas.acessivel);
                atualizarImagemEquipamentos(propostas.acessivel);
                atualizarEtiquetasDinamicas('acessivel');
                atualizarImagemInstalacao(propostas.acessivel);
                preencherDetalhesInstalacao(propostas.acessivel);
                document.body.classList.add('theme-acessivel');
                document.body.classList.remove('theme-premium');
                btnAcessivel.classList.add('selecionado');
                if (btnPremium) btnPremium.classList.remove('selecionado');
            } else {
                console.error("ERRO: Dados da proposta Acessível não encontrados no localStorage.");
            }
            setTimeout(() => esconderLoadingOverlay(), 400);
        });
    }

    if (btnVoltar) {
        btnVoltar.addEventListener('click', (evento) => {
            evento.preventDefault();
            mostrarLoadingOverlay();
            setTimeout(() => {
                window.location.href = btnVoltar.href;
            }, 500);
        });
    }
});