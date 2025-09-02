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
document.addEventListener('DOMContentLoaded', function () {
    const formConsulta = document.getElementById('form-consulta');
    const inputNumeroProjeto = document.getElementById('numero-projeto');
    const inputPrimeiroNome = document.getElementById('primeiro-nome'); // NOVO: Captura o novo campo
    const btnConsultar = document.getElementById('btn-consultar');

    //---------------------------------------------------------
    // NOVO: Adiciona listeners de validação em tempo real
    //---------------------------------------------------------
    inputPrimeiroNome.addEventListener('input', (event) => {
        // Remove espaços do valor do campo para garantir que seja apenas um nome
        event.target.value = event.target.value.trim().split(' ')[0];
    });

    // Ajuste aqui: Garante que apenas dígitos sejam aceitos e limita a 4 caracteres.
    inputNumeroProjeto.addEventListener('input', (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '').substring(0, 4);
    });


    // Funções de controle do overlay (manter aqui ou mover para o escopo global)
    // Para evitar duplicação, vamos assumir que as funções no escopo global são usadas.
    // As funções repetidas abaixo foram removidas para clareza.

    // Função que será executada ao submeter o formulário
    async function handleFormSubmit(evento, numeroProjetoUrl = null, primeiroNomeUrl = null) { // NOVO: Recebe o nome da URL
        let sucesso = false;

        if (evento) {
            evento.preventDefault();
        }

        const numeroProjeto = numeroProjetoUrl || inputNumeroProjeto.value.trim();
        const primeiroNome = primeiroNomeUrl || inputPrimeiroNome.value.trim(); // NOVO: Captura o nome

        // ----------------------------------------------------
        // NOVO: Validação de Campos Vazios e Formato
        // ----------------------------------------------------
        if (!numeroProjeto || !primeiroNome) {
            exibirMensagem('erro', 'Por favor, preencha o número do projeto e o primeiro nome.');
            esconderLoadingOverlay();
            return;
        }

        if (numeroProjeto.length !== 4) {
            exibirMensagem('erro', 'O número do projeto deve ter exatamente 4 dígitos.');
            esconderLoadingOverlay();
            return;
        }
        
        if (primeiroNome.includes(' ')) {
            exibirMensagem('erro', 'Por favor, digite apenas o primeiro nome, sem espaços.');
            esconderLoadingOverlay();
            return;
        }

        btnConsultar.disabled = true;
        btnConsultar.classList.add('loading');

        try {
            // NOVO: Passa o primeiro nome para a função do modelo
            const resposta = await buscarETratarProposta(numeroProjeto, primeiroNome);
            sucesso = resposta.sucesso;

            if (sucesso) {
                btnConsultar.classList.remove('loading');
                btnConsultar.classList.add('success');
                exibirMensagem('sucesso', `Proposta #${numeroProjeto} encontrada!`);
                
                // NOVO: Redireciona com o ID e o primeiro nome na URL
                setTimeout(() => {
                    window.location.href = `proposta.html?id=${numeroProjeto}&nome=${primeiroNome}`;
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
            if (!sucesso) {
                esconderLoadingOverlay();
                setTimeout(resetarBotao, 2000);
            }
        }
    }

    formConsulta.addEventListener('submit', handleFormSubmit);

    // NOVO: Lógica para verificar o ID e o nome na URL
    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjetoDaUrl = urlParams.get('id');
    const primeiroNomeDaUrl = urlParams.get('nome'); // NOVO: Pega o nome da URL

    if (numeroProjetoDaUrl && primeiroNomeDaUrl) { // NOVO: Valida ambos os parâmetros
        inputNumeroProjeto.value = numeroProjetoDaUrl;
        inputPrimeiroNome.value = primeiroNomeDaUrl; // NOVO: Preenche o novo campo
        handleFormSubmit(null, numeroProjetoDaUrl, primeiroNomeDaUrl);
    } else {
        esconderLoadingOverlay();
    }
});