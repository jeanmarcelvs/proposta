import { buscarETratarProposta, atualizarStatusVisualizacao, validarValidadeProposta } from './model.js';

// Funções para o novo loading-overlay
function mostrarLoadingOverlay() {
    // CORREÇÃO: Usa querySelector para pegar o elemento pela CLASSE.
    const overlay = document.querySelector('.loading-overlay');
    const mainContent = document.querySelector('main');

    if (mainContent) {
        mainContent.classList.add('main-oculto');
        mainContent.classList.remove('main-visivel');
    }

    if (overlay) {
        overlay.classList.remove('oculto');
    }
}

function esconderLoadingOverlay() {
    // CORREÇÃO: Usa querySelector para pegar o elemento pela CLASSE.
    const overlay = document.querySelector('.loading-overlay');
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
    return new Promise((resolve, reject) => {
        let imagemEquipamentos;
        const isVE = proposta.tipoVisualizacao === 've';

        // 1. Acessa o elemento HTML
        if (isVE) {
            // Para propostas VE, o elemento pode não existir, então não tratamos como erro.
            imagemEquipamentos = document.getElementById('imagem-marca-ve');
        } else {
            imagemEquipamentos = document.getElementById('imagem-marca-equipamento');
        }

        if (!imagemEquipamentos) {
            return resolve(); // Resolve a promise se o elemento não existe, para não travar a aplicação.
        }

        // 2. Define o caminho da imagem
        let imageUrl = '';
        if (isVE) {
            imageUrl = proposta.equipamentos?.imagem || '';
        } else if (proposta.tipoVisualizacao === 'solar') {
            if (proposta.tipo === 'premium') {
                imageUrl = 'imagens/huawei.webp';
            } else if (proposta.tipo === 'acessivel') {
                imageUrl = 'imagens/auxsolar.webp';
            }
        }

        // Se a URL não mudou e não está vazia, resolve imediatamente.
        if (imagemEquipamentos.src && imagemEquipamentos.src.endsWith(imageUrl) && imageUrl !== '') {
            return resolve();
        }

        // 3. Define os Handlers (Load e Error)
        const handleLoad = () => {
            imagemEquipamentos.removeEventListener('load', handleLoad);
            imagemEquipamentos.removeEventListener('error', handleError);
            resolve(); // Resolve a Promise com sucesso
        };

        const handleError = () => {
            console.error(`ERRO: Falha ao carregar a imagem de marca: ${imageUrl}`);
            imagemEquipamentos.removeEventListener('load', handleLoad);
            imagemEquipamentos.removeEventListener('error', handleError);
            reject(new Error('Falha no carregamento da imagem de marca.')); // Rejeita a Promise com erro
        };

        imagemEquipamentos.addEventListener('load', handleLoad);
        imagemEquipamentos.addEventListener('error', handleError);

        // 4. Inicia o Carregamento
        imagemEquipamentos.src = imageUrl;

        // 5. Verificação de Cache (Robusta)
        if (imagemEquipamentos.complete && imagemEquipamentos.naturalWidth !== 0) {
            setTimeout(handleLoad, 10);
        }
    });
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
        return;
    }

    secaoDetalhes.innerHTML = '';
    const detalhes = proposta.instalacao?.detalhesInstalacao;

    if (!detalhes || detalhes.length === 0) {
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
}

// --- FUNÇÃO CENTRAL DE PREENCHIMENTO ATUALIZADA ---
function preencherDadosProposta(dados) {
    try {
        const isVE = dados.tipoVisualizacao === 've';
        
        // 1. Dados do Cliente
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
        
        // 2. Sistema Proposto (Lógica adaptada para VE e Solar)
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

        // 3. Equipamentos (Lógica adaptada para VE e Solar)
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

        // 4. Valores Finais e Financiamento (Lógica adaptada para VE e Solar)
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
                }
                const elementoTaxa = document.getElementById(`taxa-${n}`);
                if (elementoTaxa) {
                    elementoTaxa.innerText = '';
                }
            });
        }

        // 5. Observações e Validade
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

    // =================================================================
    // 🌟 REESTRUTURAÇÃO: Variáveis do Carrossel e Modal (Corrigindo ReferenceError)
    // =================================================================
    const installationImage = document.getElementById('imagem-instalacao');
    const prevImageBtn = document.getElementById('prev-image-btn');
    const nextImageBtn = document.getElementById('next-image-btn');

    // Elementos do MODAL (Popup)
    const modalCarrossel = document.getElementById('modal-carrossel');
    const imagemModal = document.getElementById('imagem-modal');
    const fecharModalBtn = document.getElementById('fechar-modal-btn');
    const prevModalBtn = document.getElementById('prev-modal-btn');
    const nextModalBtn = document.getElementById('next-modal-btn');

    const imagePaths = {
        premium: [
            'imagens/instalacao-premium.webp',
            'imagens/inst_premium_1.webp',
            'imagens/inst_premium_2.webp',
            'imagens/inst_premium_3.webp'
        ],
        acessivel: [
            'imagens/instalacao-acessivel.webp',
            'imagens/inst_acessível_1.webp',
            'imagens/inst_acessível_2.webp',
            'imagens/inst_acessível_3.webp'
        ]
    };

    let currentProposalType = 'premium';
    let currentImageIndex = 0;
    const preloadedImages = {};

    // =================================================================
    // 🌟 FUNÇÕES DO CARROSSEL E MODAL
    // =================================================================

    function showImage(index) {
        return new Promise((resolve) => { // AGORA RETORNA UMA PROMISE!
            const currentImageSet = imagePaths[currentProposalType];
            if (!currentImageSet || currentImageSet.length === 0) return resolve(); // Se não houver imagens, resolve imediatamente.

            currentImageIndex = (index + currentImageSet.length) % currentImageSet.length;
            const imageUrl = currentImageSet[currentImageIndex];

            // Transição suave ao trocar a imagem
            if (installationImage) installationImage.style.opacity = '0.5';

            // Remove quaisquer listeners anteriores para evitar múltiplas execuções
            if (installationImage._handleLoad) {
                installationImage.removeEventListener('load', installationImage._handleLoad);
                installationImage.removeEventListener('error', installationImage._handleError);
            }

            // Define os handlers (usando arrow functions para manter o 'this' implícito para o resolve)
            const handleLoad = () => {
                if (installationImage) installationImage.style.opacity = '1';
                installationImage.removeEventListener('load', handleLoad);
                installationImage.removeEventListener('error', handleError);
                resolve(); // 👈🏼 RESOLVE A PROMISE AQUI!
            };

            const handleError = () => {
                console.error("ERRO: Falha ao carregar a imagem:", imageUrl);                
                if (installationImage) installationImage.style.opacity = '1'; // Mostra mesmo se quebrar
                installationImage.removeEventListener('load', handleLoad);
                installationImage.removeEventListener('error', handleError);
                resolve(); // 👈🏼 RESOLVE A PROMISE MESMO COM ERRO para não travar o app.
            };

            // Armazena os handlers no elemento
            installationImage._handleLoad = handleLoad;
            installationImage._handleError = handleError;

            // 2. Anexa os Event Listeners ANTES de mudar o src
            installationImage.addEventListener('load', handleLoad);
            installationImage.addEventListener('error', handleError);

            // 3. Inicia o Carregamento
            installationImage.src = imageUrl;

            // 4. VERIFICAÇÃO DE CACHE ROBUSTA
            if (installationImage.complete && installationImage.naturalWidth !== 0) {
                setTimeout(handleLoad, 10);
            }

            // Atualiza a visibilidade dos botões de navegação.
            const showNav = currentImageSet.length > 1;
            prevImageBtn.classList.toggle('oculto', !showNav);
            nextImageBtn.classList.toggle('oculto', !showNav);
        });
    }

    function switchProposalType(type) {
        if (currentProposalType === type && installationImage.src) return Promise.resolve(); // Adiciona Promise
        currentProposalType = type;
        return showImage(0); // Retorna a Promise de showImage
    }

    function mostrarModal() {
        if (modalCarrossel) {
            modalCarrossel.classList.remove('oculto');
            document.body.classList.add('modal-aberta'); // Bloqueia o scroll de fundo
        }
    }

    function esconderModal() {
        if (modalCarrossel) {
            modalCarrossel.classList.add('oculto');
            document.body.classList.remove('modal-aberta');
        }
    }

    // Adaptação da função showImage para o Modal
    function showImageInModal(index) {
        const currentImageSet = imagePaths[currentProposalType];
        if (!currentImageSet || currentImageSet.length === 0) return;

        currentImageIndex = (index + currentImageSet.length) % currentImageSet.length;
        const imageUrl = currentImageSet[currentImageIndex];

        // Aqui usamos a imagem do modal
        if (imagemModal) imagemModal.src = imageUrl;

        // Atualiza a visibilidade dos botões de navegação do modal
        const showNav = currentImageSet.length > 1;
        if (prevModalBtn) prevModalBtn.classList.toggle('oculto', !showNav);
        if (nextModalBtn) nextModalBtn.classList.toggle('oculto', !showNav);
    }

    // Inicia o pré-carregamento em segundo plano
    Object.values(imagePaths).flat().forEach(url => {
        if (!preloadedImages[url]) {
            const img = new Image();
            img.src = url;
            preloadedImages[url] = img;
        }
    });
    // =================================================================
    // 🚦 INÍCIO DA LÓGICA DE CARREGAMENTO DA PÁGINA
    // =================================================================

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
            } else if (seletorTipoProposta) {
                if (temPropostaAcessivelValida) {
                    seletorTipoProposta.classList.remove('oculto');
                } else {
                    seletorTipoProposta.classList.add('oculto');
                }
            }
            
            // Lógica unificada para preenchimento dos dados
            const propostaInicial = propostaData.premium;
            preencherDadosProposta(propostaInicial);
            await atualizarImagemEquipamentos(propostaInicial);
            preencherDetalhesInstalacao(propostaInicial);
            atualizarEtiquetasDinamicas('premium');
            document.body.classList.add('theme-premium');

            // A chamada para `atualizarStatusVisualizacao` agora está no lugar certo
            const dadosVisualizacao = {
                propostaId: numeroProjeto,
                tipoVisualizacao: 'P'
            };
            await atualizarStatusVisualizacao(dadosVisualizacao);

            // 🌟 CORREÇÃO: Inicia e ESPERA a imagem do carrossel carregar antes de prosseguir para o 'finally'
            await showImage(0); 

        } catch (error) {
            console.error("ERRO: Falha ao carregar ou exibir a proposta.", error);
            window.location.href = 'index.html?erro=acesso-negado';
        } finally {
            esconderLoadingOverlay();
        }
    } else {
        window.location.href = 'index.html?erro=parametros-ausentes';
    }

    // =================================================================
    // 🖱️ EVENT LISTENERS
    // =================================================================
    if (nextImageBtn) nextImageBtn.addEventListener('click', () => showImage(currentImageIndex + 1));
    if (prevImageBtn) prevImageBtn.addEventListener('click', () => showImage(currentImageIndex - 1));


    if (btnPremium) {
        btnPremium.addEventListener('click', async () => {
            if (btnPremium.classList.contains('selecionado')) {
                return;
            }
            mostrarLoadingOverlay();
            const propostas = JSON.parse(localStorage.getItem('propostaData'));
            if (propostas && propostas.premium) {
                try {
                    preencherDadosProposta(propostas.premium);
                    atualizarEtiquetasDinamicas('premium');
                    await switchProposalType('premium');
                    preencherDetalhesInstalacao(propostas.premium);
                    await atualizarImagemEquipamentos(propostas.premium); // Espera a imagem carregar
                    document.body.classList.remove('theme-acessivel');
                    document.body.classList.add('theme-premium');
                    btnPremium.classList.add('selecionado');
                    if (btnAcessivel) btnAcessivel.classList.remove('selecionado');
                } catch (error) {
                    console.error("ERRO ao trocar para proposta Premium:", error);
                } finally {
                    esconderLoadingOverlay(); // Esconde o overlay após tudo, incluindo a imagem
                }
            } else {
                console.error("ERRO: Dados da proposta Premium não encontrados no localStorage.");
                esconderLoadingOverlay();
            }
        });
    }

    if (btnAcessivel) {
        btnAcessivel.addEventListener('click', async () => {
            if (btnAcessivel.classList.contains('selecionado')) {
                return;
            }
            mostrarLoadingOverlay();
            const propostas = JSON.parse(localStorage.getItem('propostaData'));
            if (propostas && propostas.acessivel) {
                try {
                    preencherDadosProposta(propostas.acessivel);
                    atualizarEtiquetasDinamicas('acessivel');
                    await switchProposalType('acessivel');
                    preencherDetalhesInstalacao(propostas.acessivel);
                    await atualizarImagemEquipamentos(propostas.acessivel); // Espera a imagem carregar
                    document.body.classList.add('theme-acessivel');
                    document.body.classList.remove('theme-premium');
                    btnAcessivel.classList.add('selecionado');
                    if (btnPremium) btnPremium.classList.remove('selecionado');
                } catch (error) {
                    console.error("ERRO ao trocar para proposta Acessível:", error);
                } finally {
                    esconderLoadingOverlay(); // Esconde o overlay após tudo, incluindo a imagem
                }
            } else {
                console.error("ERRO: Dados da proposta Acessível não encontrados no localStorage.");
                esconderLoadingOverlay();
            }
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

    // --- Event Listeners do Carrossel e Modal ---

    // 1. Abertura do Modal ao clicar na imagem
    if (installationImage) {
        installationImage.style.cursor = 'pointer'; // Dá uma dica visual
        installationImage.addEventListener('click', () => {
            // Abre o modal na imagem que estava sendo visualizada na página principal
            showImageInModal(currentImageIndex);
            mostrarModal();
        });
    }

    // 2. Navegação no Modal
    if (nextModalBtn) {
        nextModalBtn.addEventListener('click', () => {
            showImageInModal(currentImageIndex + 1);
        });
    }

    if (prevModalBtn) {
        prevModalBtn.addEventListener('click', () => {
            showImageInModal(currentImageIndex - 1);
        });
    }

    // 3. Fechar Modal
    if (fecharModalBtn) {
        fecharModalBtn.addEventListener('click', esconderModal);
    }

    // Fechar Modal ao clicar fora
    if (modalCarrossel) {
        modalCarrossel.addEventListener('click', (e) => {
            if (e.target === modalCarrossel) {
                esconderModal();
            }
        });
    }

    // Fechar Modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalCarrossel && !modalCarrossel.classList.contains('oculto')) {
            esconderModal();
        }
    });
});