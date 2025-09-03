/**
 * propostaController.js
 * * Este arquivo é o Controlador da página proposta.html. Ele gerencia
 * a interface do usuário e coordena a exibição dos dados do Modelo.
 */
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

// CORRIGIDO: A função agora recebe a proposta completa e usa o caminho da imagem dela
function atualizarImagemEquipamentos(proposta) {
    const imagemMarca = document.getElementById('imagem-marca');
    if (!imagemMarca) {
        console.error("ERRO: Elemento com ID 'imagem-marca' não encontrado.");
        return;
    }
    imagemMarca.src = proposta.equipamentos?.imagem || '';
}

// CORRIGIDO: A função agora recebe a proposta completa e usa o caminho da imagem dela
function atualizarImagemInstalacao(proposta) {
    const imagemInstalacao = document.getElementById('imagem-instalacao');
    if (!imagemInstalacao) {
        console.error("ERRO: Elemento com ID 'imagem-instalacao' não encontrado.");
        return;
    }
    imagemInstalacao.src = proposta.instalacao?.imagem || '';
}

// Função para atualizar as etiquetas das seções dinâmicas,
// ignorando a etiqueta do card "À Vista".
function atualizarEtiquetasDinamicas(tipo) {
    const etiquetas = document.querySelectorAll('.etiqueta-proposta-dinamica:not(.etiqueta-a-vista)');
    const texto = tipo === 'premium' ? 'Premium' : '+Acessível';
    etiquetas.forEach(etiqueta => {
        etiqueta.innerText = texto;
    });
}

// Função para preencher a nova seção de detalhes da instalação
function preencherDetalhesInstalacao(proposta) {
    const secaoDetalhes = document.getElementById('detalhes-instalacao');
    if (!secaoDetalhes) {
        console.warn("AVISO: Elemento 'detalhes-instalacao' não encontrado. Não é possível preencher.");
        return;
    }

    // Limpa os detalhes anteriores para evitar duplicatas ao trocar de proposta
    secaoDetalhes.innerHTML = '';

    // Acessa o array de detalhes diretamente do objeto de proposta
    const detalhes = proposta.instalacao?.detalhesInstalacao;

    if (!detalhes || detalhes.length === 0) {
        console.warn("AVISO: Detalhes da instalação não encontrados na proposta.");
        // Opcional: exibe uma mensagem no HTML se não houver detalhes
        secaoDetalhes.innerHTML = '<p>Nenhum detalhe de instalação disponível.</p>';
        return;
    }

    // Itera sobre o array de detalhes e cria os elementos HTML
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

// Função para preencher a página com os dados da proposta
function preencherDadosProposta(dados) {
    console.log("DEBUG: Iniciando preenchimento dos dados da proposta. Conteúdo recebido:", dados);

    try {
        // CORREÇÃO: Declarando as variáveis do resumo e ícone no topo da função.
        const resumoInstalacaoEl = document.getElementById('resumo-instalacao');
        const iconeResumoEl = document.getElementById('icone-resumo');

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

        // 2. Sistema Proposto (Separa valor e unidade)
        console.log("DEBUG: Preenchendo dados do sistema...");
        const geracaoMediaEl = document.getElementById('geracao-media');
        if (geracaoMediaEl) {
            const geracaoMedia = dados.sistema?.geracaoMedia;
            if (typeof geracaoMedia === 'string' && geracaoMedia.trim() !== '') {
                const geracaoMediaSplit = geracaoMedia.split(' ');
                geracaoMediaEl.innerText = geracaoMediaSplit[0];
                const unidadeGeracaoEl = document.getElementById('unidade-geracao');
                if (unidadeGeracaoEl) {
                    unidadeGeracaoEl.innerText = geracaoMediaSplit.slice(1).join(' ');
                }
            } else {
                geracaoMediaEl.innerText = 'N/A';
                const unidadeGeracaoEl = document.getElementById('unidade-geracao');
                if (unidadeGeracaoEl) {
                    unidadeGeracaoEl.innerText = 'kWh/mês';
                }
            }
        }

        const instalacaoPaineisEl = document.getElementById('instalacao-paineis');
        const iconeInstalacaoEl = document.getElementById('icone-instalacao'); // Encontra o ícone pelo novo ID

        if (instalacaoPaineisEl && iconeInstalacaoEl) {
            const tipoInstalacao = dados.sistema?.instalacaoPaineis || "Não informado";
            instalacaoPaineisEl.innerText = tipoInstalacao;

            if (tipoInstalacao.toLowerCase().includes('telhado')) {
                iconeInstalacaoEl.className = 'fas fa-house-chimney';
            } else if (tipoInstalacao.toLowerCase().includes('solo')) {
                iconeInstalacaoEl.className = 'fas fa-solar-panel';
            } else {
                iconeInstalacaoEl.className = 'fas fa-question-circle';
            }
        }

        const idealParaEl = document.getElementById('ideal-para');
        if (idealParaEl) {
            const idealPara = dados.sistema?.idealPara || 'R$ 0,00';
            idealParaEl.innerText = idealPara.replace('R$', '').trim();
        }
        console.log("DEBUG: Dados do sistema preenchidos com sucesso.");

        // 3. Equipamentos
        console.log("DEBUG: Preenchendo dados dos equipamentos...");
        const descricaoInversorEl = document.getElementById('descricao-inversor');
        if (descricaoInversorEl) descricaoInversorEl.innerText = dados.equipamentos?.descricaoInversor || "Não informado";

        const quantidadeInversorEl = document.getElementById('quantidade-inversor');
        if (quantidadeInversorEl) quantidadeInversorEl.innerText = `${dados.equipamentos?.quantidadeInversor || 0}`;

        const descricaoPainelEl = document.getElementById('descricao-painel');
        if (descricaoPainelEl) descricaoPainelEl.innerText = dados.equipamentos?.descricaoPainel || "Não informado";

        const quantidadePainelEl = document.getElementById('quantidade-painel');
        if (quantidadePainelEl) quantidadePainelEl.innerText = `${dados.equipamentos?.quantidadePainel || 0}`;
        console.log("DEBUG: Dados de equipamentos preenchidos com sucesso.");

        // 4. Valores Finais
        console.log("DEBUG: Preenchendo valores financeiros...");
        const valorTotalEl = document.getElementById('valor-total');
        if (valorTotalEl) valorTotalEl.innerText = dados.valores?.valorTotal || "Não informado";

        // NOVO: Adiciona a informação de payback diretamente no span
        const paybackValorEl = document.getElementById('payback-valor');
        if (paybackValorEl) {
            paybackValorEl.innerText = dados.valores?.payback || 'Não informado';
        } else {
            console.error("ERRO: Elemento com ID 'payback-valor' não encontrado no DOM.");
        }

        console.log("DEBUG: Taxas de juros e SELIC preenchidas com sucesso.");

        // 5. Parcelas e Taxas
        console.log("DEBUG: Preenchendo parcelas e taxas...");
        const opcoesParcelas = [12, 24, 36, 48, 60, 72, 84];

        opcoesParcelas.forEach(n => {
            const parcelaKey = `parcela-${n}`;
            const elementoParcela = document.getElementById(parcelaKey);
            if (elementoParcela) {
                elementoParcela.innerText = dados.valores?.parcelas[parcelaKey] || 'N/A';
            } else {
                console.warn(`AVISO: Elemento de parcela '${parcelaKey}' não encontrado.`);
            }

            // Removido: O preenchimento da taxa de juros específica para a parcela
            const elementoTaxa = document.getElementById(`taxa-${n}`);
            if (elementoTaxa) {
                elementoTaxa.innerText = ''; // Limpa o conteúdo, se existir
            }
        });

        console.log("DEBUG: Parcelas preenchidas com sucesso.");

        // 6. Observações e Validade
        console.log("DEBUG: Preenchendo observações e validade...");
        const observacaoEl = document.getElementById('texto-observacao');
        const validadeEl = document.getElementById('texto-validade');

        if (observacaoEl) {
            observacaoEl.innerText = dados.valores?.observacao || "Não há observações sobre financiamento.";
        }

        if (validadeEl) {
            validadeEl.innerText = dados.validade || "Não informada";
        }

        if (resumoInstalacaoEl && iconeResumoEl) {
            resumoInstalacaoEl.innerText = dados.instalacao?.resumoInstalacao || "";
            if (dados.tipo === 'premium') {
                // CORREÇÃO: Ícone de 'check' para proposta Premium
                iconeResumoEl.classList.add('fa-circle-check');
                iconeResumoEl.classList.remove('fa-triangle-exclamation');
            } else {
                // Ícone de 'exclamação' para proposta Acessível
                iconeResumoEl.classList.add('fa-triangle-exclamation');
                iconeResumoEl.classList.remove('fa-circle-check');
            }
        }

        console.log("DEBUG: Observações, validade e resumo de instalação preenchidos com sucesso.");
    } catch (error) {
        console.error("ERRO DENTRO DE preencherDadosProposta:", error);
    }
}

// Adiciona o event listener para garantir que o conteúdo está pronto
document.addEventListener('DOMContentLoaded', async () => {
    // Mostra o overlay de carregamento imediatamente
    mostrarLoadingOverlay();

    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjeto = urlParams.get('id');
    const primeiroNome = urlParams.get('nome');

    if (!numeroProjeto || !primeiroNome) {
        window.location.href = 'index.html?error=parametrosInvalidos';
        return;
    }

    try {
        const resposta = await buscarETratarProposta(numeroProjeto, primeiroNome);

        if (!resposta.sucesso) {
            // Em caso de erro na API, redireciona com a mensagem da API
            window.location.href = `index.html?error=apiError&msg=${encodeURIComponent(resposta.mensagem)}`;
            return;
        }

        const propostaData = resposta.dados;
        
        // **INSERIDO: Validação de data de expiração**
        if (!validarValidadeProposta(propostaData.premium)) {
            // Proposta expirada, redireciona para a página inicial com um erro
            window.location.href = 'index.html?error=propostaExpirada';
            return;
        }

        // Armazena os dados no localStorage para alternância entre propostas
        localStorage.setItem('propostaData', JSON.stringify(propostaData));

        // Inicializa com a proposta premium
        preencherDadosProposta(propostaData.premium);
        atualizarImagemEquipamentos(propostaData.premium);
        atualizarEtiquetasDinamicas('premium');
        atualizarImagemInstalacao(propostaData.premium);
        preencherDetalhesInstalacao(propostaData.premium);
        document.body.classList.remove('theme-acessivel');
        document.body.classList.add('theme-premium');
        
        // Atualiza o status de visualização na API
        const dadosVisualizacao = {
            propostaId: numeroProjeto,
            tipoVisualizacao: 'P'
        };
        await atualizarStatusVisualizacao(dadosVisualizacao);

    } catch (error) {
        console.error("ERRO: Falha ao carregar ou exibir a proposta.", error);
        window.location.href = `index.html?error=acesso-negado`;
    } finally {
        esconderLoadingOverlay();
    }
    
    // O seu código original tinha um event listener dentro da função.
    // Movi-os para fora, para o escopo global do document.addEventListener
    // para melhor organização e para garantir que só sejam adicionados uma vez.

    const btnPremium = document.getElementById('btn-premium');
    const btnAcessivel = document.getElementById('btn-acessivel');

    if (btnPremium) {
        btnPremium.addEventListener('click', () => {
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
                btnAcessivel.classList.remove('selecionado');
            } else {
                console.error("ERRO: Dados da proposta Premium não encontrados no localStorage.");
            }

            setTimeout(() => {
                esconderLoadingOverlay();
            }, 400);
        });
    }

    if (btnAcessivel) {
        btnAcessivel.addEventListener('click', () => {
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
                btnPremium.classList.remove('selecionado');
            } else {
                console.error("ERRO: Dados da proposta Acessível não encontrados no localStorage.");
            }

            setTimeout(() => {
                esconderLoadingOverlay();
            }, 400);
        });
    }

    const btnVoltar = document.querySelector('.btn-voltar-proposta');
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