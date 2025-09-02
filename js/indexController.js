/**
 * indexController.js
 * Este arquivo é o Controlador da página index.html. Ele gerencia a
 * interação do usuário com o formulário e coordena a comunicação com o Modelo.
 */
import { buscarETratarProposta } from './model.js';

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

// Função para ocultar a tela de splash
function esconderTelaSplash() {
    const telaSplash = document.getElementById('tela-splash');
    if (telaSplash) {
        telaSplash.classList.add('oculto');
    }
}

// Função para exibir mensagem de feedback
function exibirMensagem(tipo, mensagem) {
    const mensagemFeedback = document.getElementById('mensagem-feedback');
    mensagemFeedback.textContent = mensagem;
    mensagemFeedback.className = 'mensagem-feedback show';
    if (tipo === 'sucesso') {
        mensagemFeedback.classList.add('success-msg');
    } else if (tipo === 'erro') {
        mensagemFeedback.classList.add('error-msg');
    }
    // Oculta a mensagem após alguns segundos
    setTimeout(() => {
        mensagemFeedback.classList.remove('show');
        setTimeout(() => {
            mensagemFeedback.className = 'mensagem-feedback';
        }, 500);
    }, 5000);
}

// Função para resetar o botão para o estado padrão
function resetarBotao() {
    const btnConsultar = document.getElementById('btn-consultar');
    const btnTexto = btnConsultar.querySelector('.btn-texto');
    btnConsultar.classList.remove('loading', 'success', 'error');
    btnConsultar.disabled = false;
    btnTexto.textContent = 'Consultar';
}


// Aguarda o documento HTML ser totalmente carregado
// Aguarda o documento HTML ser totalmente carregado
document.addEventListener('DOMContentLoaded', function () {
    const formConsulta = document.getElementById('form-consulta');
    const inputNumeroProjeto = document.getElementById('numero-projeto');
    const btnConsultar = document.getElementById('btn-consultar');
    const btnTexto = btnConsultar.querySelector('.btn-texto');

    // Funções de controle do overlay
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

    // Função que será executada ao submeter o formulário
    // Função que será executada ao submeter o formulário
    // Função que será executada ao submeter o formulário
    async function handleFormSubmit(evento, numeroProjetoUrl = null) {
        let sucesso = false;

        if (evento) {
            evento.preventDefault();
        }

        // Adicionado: Mostra o splash screen ao iniciar a consulta
        mostrarLoadingOverlay();

        const numeroProjeto = numeroProjetoUrl || document.getElementById('numero-projeto').value.trim();

        if (!numeroProjeto) {
            if (!numeroProjetoUrl) {
                exibirMensagem('erro', 'Por favor, digite o número do projeto.');
            }
            // Adicionado: Esconde o splash screen se a validação falhar
            esconderLoadingOverlay();
            return;
        }

        const btnConsultar = document.getElementById('btn-consultar');
        btnConsultar.disabled = true;
        btnConsultar.classList.add('loading');

        try {
            const resposta = await buscarETratarProposta(numeroProjeto);
            sucesso = resposta.sucesso;

            if (sucesso) {
                btnConsultar.classList.remove('loading');
                btnConsultar.classList.add('success');
                exibirMensagem('sucesso', `Proposta #${numeroProjeto} encontrada!`);

                setTimeout(() => {
                    window.location.href = `proposta.html?id=${numeroProjeto}`;
                }, 1500);
            } else {
                btnConsultar.classList.add('error');
                exibirMensagem('erro', `Erro: ${resposta.mensagem}`);
            }
        } catch (erro) {
            console.error('Ocorreu um erro na busca:', erro);
            btnConsultar.classList.add('error');
            exibirMensagem('erro', 'Ocorreu um erro inesperado ao consultar. Tente novamente.');
        } finally {
            // Garantido: Esconde o splash screen em caso de erro
            if (!sucesso) {
                esconderLoadingOverlay();
                setTimeout(resetarBotao, 2000);
            }
        }
    }

    formConsulta.addEventListener('submit', handleFormSubmit);

    // Esconde o overlay de carregamento após a página carregar
    esconderLoadingOverlay();
});