/**
 * indexController.js
 * Este arquivo é o Controlador da página index.html. Ele gerencia a
 * interação do usuário com o formulário e coordena a comunicação com o Modelo.
 */
import { buscarETratarProposta } from './model.js'; 

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
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(esconderTelaSplash, 500);

    const formConsulta = document.getElementById('form-consulta');
    const inputNumeroProjeto = document.getElementById('numero-projeto');
    const btnConsultar = document.getElementById('btn-consultar');
    const btnTexto = btnConsultar.querySelector('.btn-texto');

    formConsulta.addEventListener('submit', async function(evento) {
        evento.preventDefault();

        const numeroProjeto = inputNumeroProjeto.value.trim();

        // 1. Validação de campo vazio
        if (!numeroProjeto) {
            exibirMensagem('erro', 'Por favor, digite o número do projeto.');
            return;
        }

        // 2. Validação para garantir que é um número
        const regexNumeros = /^\d+$/; // Aceita apenas um ou mais dígitos de 0 a 9
        if (!regexNumeros.test(numeroProjeto)) {
            exibirMensagem('erro', 'O número do projeto deve conter apenas dígitos.');
            // Usamos a função para exibir a mensagem de erro
            setTimeout(resetarBotao, 2000); // Reseta o botão após ver a mensagem de erro
            return;
        }

        // --- Início do estado de carregamento do botão ---
        btnConsultar.classList.add('loading');
        btnConsultar.disabled = true;
        btnConsultar.classList.remove('success', 'error'); 
        btnTexto.textContent = ''; 

        let sucesso = false;
        try {
            const resposta = await buscarETratarProposta(numeroProjeto);

            if (resposta.sucesso) {
                // --- Estado de Sucesso do Botão ---
                sucesso = true;
                btnConsultar.classList.add('success');
                exibirMensagem('sucesso', 'Proposta encontrada! Redirecionando...');
                console.log('Proposta encontrada. Redirecionando para a página de proposta.');
                
                setTimeout(() => {
                    window.location.href = `proposta.html?id=${numeroProjeto}`;
                }, 1500); 

            } else {
                // --- Estado de Erro do Botão ---
                btnConsultar.classList.add('error');
                exibirMensagem('erro', `Erro: ${resposta.mensagem}`);
            }
        } catch (erro) {
            console.error('Ocorreu um erro na busca:', erro);
            // --- Estado de Erro do Botão ---
            btnConsultar.classList.add('error');
            exibirMensagem('erro', 'Ocorreu um erro inesperado ao consultar. Tente novamente.');
        } finally {
            // Se não houve sucesso, resetamos o botão para a próxima interação
            if (!sucesso) {
                setTimeout(resetarBotao, 2000); // Aguarda para que o usuário veja o estado de erro
            }
        }
    });

    // --- NOVA LÓGICA: Verifica se há um ID na URL e inicia a consulta automática ---
    const urlParams = new URLSearchParams(window.location.search);
    const idDaUrl = urlParams.get('id');
    
    if (idDaUrl) {
        console.log(`ID encontrado na URL: ${idDaUrl}`);
        // Preenche o campo de input com o ID da URL
        inputNumeroProjeto.value = idDaUrl;
        // Chama a função de submissão do formulário com o ID da URL
        handleFormSubmit(null, idDaUrl);
    }
});