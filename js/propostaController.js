/**
 * propostaController.js
 * * Este arquivo é o Controlador da página proposta.html. Ele gerencia
 * a interface do usuário e coordena a exibição dos dados do Modelo.
 */
import { buscarETratarProposta, atualizarStatusVisualizacao } from './model.js';

// Funções para o novo loading-overlay
function mostrarLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('oculto');
    }
}

function esconderLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    const secaoValores = document.getElementById('secao-investimento');

    if (secaoValores) {
        // Animação de entrada
        secaoValores.classList.add('entrar');
    }

    // Oculta o overlay após a animação
    setTimeout(() => {
        if (overlay) {
            overlay.classList.add('oculto');
        }
    }, 100);
}

// Função para atualizar as imagens dos equipamentos com base no tipo de proposta
function atualizarImagemEquipamentos(propostas, tipo) {
    const imagemMarca = document.getElementById('imagem-marca');
    if (!imagemMarca) {
        console.error("ERRO: Elemento com ID 'imagem-marca' não encontrado.");
        return;
    }
    if (tipo === 'premium') {
        imagemMarca.src = propostas.premium?.equipamentos?.imagemPremium || '';
    } else {
        imagemMarca.src = propostas.acessivel?.equipamentos?.imagemAcessivel || '';
    }
}

// NOVO: Função para atualizar a imagem do padrão de instalação
function atualizarImagemInstalacao(propostas, tipo) {
    const imagemInstalacao = document.getElementById('imagem-instalacao');
    if (!imagemInstalacao) {
        console.error("ERRO: Elemento com ID 'imagem-instalacao' não encontrado.");
        return;
    }
    if (tipo === 'premium') {
        imagemInstalacao.src = propostas.premium?.instalacao?.imagemInstalacaoPremium || '';
    } else {
        imagemInstalacao.src = propostas.acessivel?.instalacao?.imagemInstalacaoAcessivel || '';
    }
}

// CORRIGIDO: Função para atualizar as etiquetas das seções dinâmicas,
// ignorando a etiqueta do card "À Vista".
function atualizarEtiquetasDinamicas(tipo) {
    const etiquetas = document.querySelectorAll('.etiqueta-proposta-dinamica:not(.etiqueta-a-vista)');
    const texto = tipo === 'premium' ? 'Premium' : '+Acessível';
    etiquetas.forEach(etiqueta => {
        etiqueta.innerText = texto;
    });
}

// NOVO: Função para preencher a nova seção de detalhes da instalação
function preencherDetalhesInstalacao(proposta) {
    const cards = proposta.instalacao?.detalhesInstalacao;
    if (!cards) {
        console.warn("AVISO: Detalhes da instalação não encontrados.");
        return;
    }
    for (let i = 0; i < cards.length; i++) {
        const iconeElemento = document.getElementById(`icone-instalacao-${i + 1}`);
        const textoElemento = document.getElementById(`texto-instalacao-${i + 1}`);
        if (iconeElemento && textoElemento) {
            iconeElemento.className = `icone-card fas ${cards[i].icone}`;
            textoElemento.textContent = cards[i].texto;
        } else {
            console.error(`ERRO: Elemento de detalhe da instalação com ID 'icone-instalacao-${i + 1}' ou 'texto-instalacao-${i + 1}' não encontrado.`);
        }
    }
}

// Função para preencher a página com os dados da proposta
function preencherDadosProposta(dados) {
    console.log("DEBUG: Iniciando preenchimento dos dados da proposta. Conteúdo recebido:", dados);

    // 1. Dados do Cliente
    console.log("DEBUG: Preenchendo dados do cliente...");
    const nomeClienteEl = document.getElementById('nome-cliente');
    if (nomeClienteEl) nomeClienteEl.innerText = dados.cliente?.nome || "Não informado";

    const localClienteEl = document.getElementById('local-cliente');
    if (localClienteEl) localClienteEl.innerText = dados.cliente?.local || "Não informado";

    const dataPropostaEl = document.getElementById('data-proposta');
    if (dataPropostaEl) dataPropostaEl.innerText = dados.cliente?.dataProposta || "Não informado";
    console.log("DEBUG: Dados do cliente preenchidos com sucesso.");

    // 2. Sistema Proposto (Separa valor e unidade)
    console.log("DEBUG: Preenchendo dados do sistema...");
    const geracaoMediaEl = document.getElementById('geracao-media');
    if (geracaoMediaEl) {
        const geracaoMedia = dados.sistema?.geracaoMedia || 'N/A kWh/mês';
        const geracaoMediaSplit = geracaoMedia.split(' ');
        geracaoMediaEl.innerText = geracaoMediaSplit[0];
        const unidadeGeracaoEl = document.getElementById('unidade-geracao');
        if (unidadeGeracaoEl) {
            unidadeGeracaoEl.innerText = geracaoMediaSplit.slice(1).join(' ');
        }
    }

    const instalacaoPaineisEl = document.getElementById('instalacao-paineis');
    if (instalacaoPaineisEl) instalacaoPaineisEl.innerText = dados.sistema?.instalacaoPaineis || "Não informado";

    const idealParaEl = document.getElementById('ideal-para');
    if (idealParaEl) {
        const idealPara = dados.sistema?.idealPara || 'R$ 0';
        idealParaEl.innerText = idealPara.replace('R$', '').trim();
    }
    console.log("DEBUG: Dados do sistema preenchidos com sucesso.");

    // 3. Equipamentos
    console.log("DEBUG: Preenchendo dados dos equipamentos...");
    const descricaoInversorEl = document.getElementById('descricao-inversor');
    if (descricaoInversorEl) descricaoInversorEl.innerText = dados.equipamentos?.descricaoInversor || "Não informado";

    const quantidadeInversorEl = document.getElementById('quantidade-inversor');
    if (quantidadeInversorEl) quantidadeInversorEl.innerText = `( ${dados.equipamentos?.quantidadeInversor || 0} )`;

    const descricaoPainelEl = document.getElementById('descricao-painel');
    if (descricaoPainelEl) descricaoPainelEl.innerText = dados.equipamentos?.descricaoPainel || "Não informado";

    const quantidadePainelEl = document.getElementById('quantidade-painel');
    if (quantidadePainelEl) quantidadePainelEl.innerText = `( ${dados.equipamentos?.quantidadePainel || 0} )`;
    console.log("DEBUG: Dados de equipamentos preenchidos com sucesso.");

    // 4. Valores Finais
    console.log("DEBUG: Preenchendo valores financeiros...");
    const valorTotalEl = document.getElementById('valor-total');
    if (valorTotalEl) valorTotalEl.innerText = dados.valores?.valorTotal || "Não informado";

    // NOVO: Lógica para o payback da proposta +Acessível
    const paybackEl = document.getElementById('payback');
    if (paybackEl) {
        // Se a propriedade 'payback' existir, use-a (proposta acessível)
        if (dados.valores?.payback) {
            paybackEl.innerText = dados.valores.payback;
        } else {
            // Caso contrário, use as propriedades 'paybackAnos' e 'paybackMeses' (proposta premium)
            paybackEl.innerText = `${dados.valores?.paybackAnos || 0} anos e ${dados.valores?.paybackMeses || 0} meses`;
        }
    }
    console.log("DEBUG: Valores finais preenchidos com sucesso.");

    // 5. Parcelas
    console.log("DEBUG: Preenchendo parcelas...");
    for (const key in dados.valores?.parcelas || {}) {
        const elemento = document.getElementById(`parcela-${key.replace('x', '')}`);
        if (elemento) {
            elemento.innerText = dados.valores.parcelas[key] || 'N/A';
        } else {
            console.warn(`AVISO: Elemento de parcela '${key}' não encontrado.`);
        }
    }
    console.log("DEBUG: Parcelas preenchidas com sucesso.");

    // 6. Observações e Validade (Seções atualizadas)
    console.log("DEBUG: Preenchendo observações e validade...");
    const observacaoEl = document.getElementById('texto-observacao');
    const validadeEl = document.getElementById('texto-validade');

    if (observacaoEl) {
        observacaoEl.innerText = dados.observacaoFinanciamento || "Não há observações sobre financiamento.";
    }

    if (validadeEl) {
        validadeEl.innerText = dados.validade || "Não informada";
    }

    console.log("DEBUG: Observações e validade preenchidas com sucesso.");
}

// Espera a página carregar
document.addEventListener('DOMContentLoaded', async () => {
    mostrarLoadingOverlay();
    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjeto = urlParams.get('id');

    if (!numeroProjeto) {
        console.error('ERRO: Número do projeto não encontrado na URL.');
        alert('Número do projeto não encontrado na URL.');
        window.location.href = 'index.html';
        return;
    }

    try {
        console.log(`DEBUG: Iniciando busca da proposta para o projeto: ${numeroProjeto}`);
        const resposta = await buscarETratarProposta(numeroProjeto);

        if (resposta.sucesso) {
            console.log("DEBUG: Proposta buscada com sucesso. Preenchendo a página...");
            const propostaData = resposta.proposta;
            localStorage.setItem('propostaData', JSON.stringify(propostaData));

            document.body.classList.add('theme-premium');
            preencherDadosProposta(propostaData.premium);
            atualizarImagemEquipamentos(propostaData, 'premium');
            atualizarEtiquetasDinamicas('premium');
            atualizarImagemInstalacao(propostaData, 'premium');
            preencherDetalhesInstalacao(propostaData.premium);
            console.log("DEBUG: Preenchimento inicial concluído.");
            
            // SOMENTE ESCONDE O OVERLAY SE O SUCESSO FOR CONFIRMADO
            esconderLoadingOverlay();

        } else {
            console.error("ERRO: Falha na busca da proposta. Mensagem:", resposta.mensagem);
            alert(resposta.mensagem);
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("ERRO: Ocorreu um erro fatal ao carregar a proposta.", error);
        alert('Ocorreu um erro ao carregar a proposta.');
        window.location.href = 'index.html';
    } finally {
        // REMOVA A CHAMADA DAQUI
        // esconderLoadingOverlay(); 
    }

    // Lógica para alternar entre propostas
    const btnPremium = document.getElementById('btn-premium');
    const btnAcessivel = document.getElementById('btn-acessivel');

    if (btnPremium) {
        btnPremium.addEventListener('click', () => {
            console.log("DEBUG: Clicado no botão 'Premium'. Carregando dados Premium...");
            const propostas = JSON.parse(localStorage.getItem('propostaData'));
            if (propostas && propostas.premium) {
                mostrarLoadingOverlay();
                preencherDadosProposta(propostas.premium);
                atualizarImagemEquipamentos(propostas, 'premium');
                atualizarEtiquetasDinamicas('premium');
                atualizarImagemInstalacao(propostas, 'premium');
                preencherDetalhesInstalacao(propostas.premium);
                document.body.classList.add('theme-premium');
                document.body.classList.remove('theme-acessivel');
                setTimeout(() => {
                    btnPremium.classList.add('selecionado');
                    btnAcessivel.classList.remove('selecionado');
                    esconderLoadingOverlay();
                }, 100);
            } else {
                console.error("ERRO: Dados da proposta Premium não encontrados no localStorage.");
            }
        });
    }

    if (btnAcessivel) {
        btnAcessivel.addEventListener('click', () => {
            console.log("DEBUG: Clicado no botão '+Acessível'. Carregando dados +Acessível...");
            const propostas = JSON.parse(localStorage.getItem('propostaData'));
            if (propostas && propostas.acessivel) {
                mostrarLoadingOverlay();
                preencherDadosProposta(propostas.acessivel);
                atualizarImagemEquipamentos(propostas, 'acessivel');
                atualizarEtiquetasDinamicas('acessivel');
                atualizarImagemInstalacao(propostas, 'acessivel');
                preencherDetalhesInstalacao(propostas.acessivel);
                document.body.classList.add('theme-acessivel');
                document.body.classList.remove('theme-premium');
                setTimeout(() => {
                    btnAcessivel.classList.add('selecionado');
                    btnPremium.classList.remove('selecionado');
                    esconderLoadingOverlay();
                }, 100);
            } else {
                console.error("ERRO: Dados da proposta Acessível não encontrados no localStorage.");
            }
        });
    }

    try {
        const dadosVisualizacao = {
            propostaId: numeroProjeto,
            tipoVisualizacao: 'P' // O 'P' maiúsculo é para Premium
        };
        await atualizarStatusVisualizacao(dadosVisualizacao);
    } catch (error) {
        console.error("ERRO: Falha ao atualizar o status de visualização.", error);
    }
});