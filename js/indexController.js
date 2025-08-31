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
    const iconeCarregando = btnConsultar.querySelector('.icone-carregando');
    const iconeSucesso = btnConsultar.querySelector('.icone-sucesso');
    const iconeErro = btnConsultar.querySelector('.icone-erro');

    btnConsultar.classList.remove('loading', 'success', 'error');
    if (btnTexto) btnTexto.style.opacity = '1';
    if (iconeCarregando) iconeCarregando.style.opacity = '0';
    if (iconeSucesso) iconeSucesso.style.opacity = '0';
    if (iconeErro) iconeErro.style.opacity = '0';
}

// Lógica principal
document.addEventListener('DOMContentLoaded', () => {
    const formConsulta = document.getElementById('form-consulta');
    const inputNumeroProjeto = document.getElementById('numero-projeto');
    const btnConsultar = document.getElementById('btn-consultar');

    // Inicialmente esconde a tela de splash para que o usuário veja o formulário
    esconderTelaSplash();

    // Função assíncrona para lidar com a submissão do formulário
    async function handleFormSubmit(event) {
        event.preventDefault(); // Impede o envio padrão do formulário

        // --- Estado de Carregamento do Botão ---
        btnConsultar.classList.add('loading');
        exibirMensagem('sucesso', 'Buscando dados da proposta...');
        let sucesso = false;

        try {
            const numeroProjeto = inputNumeroProjeto.value.trim();
            const resposta = await buscarETratarProposta(numeroProjeto);
            
            // CORRIGIDO: Agora verifica e salva a propriedade 'proposta' da resposta.
            if (resposta.sucesso && resposta.proposta) {
                sucesso = true;
                // --- Estado de Sucesso do Botão ---
                btnConsultar.classList.add('success');
                exibirMensagem('sucesso', 'Proposta encontrada. Redirecionando...');

                // CORRIGIDO: Salva a propriedade 'proposta' no localStorage
                localStorage.setItem('propostaData', JSON.stringify(resposta.proposta));
                
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
                setTimeout(resetarBotao, 2000);
            }
        }
    }

    // Adiciona o event listener para o formulário
    formConsulta.addEventListener('submit', handleFormSubmit);

    // --- NOVA LÓGICA: Verifica se há um ID na URL e inicia a consulta automática ---
    const urlParams = new URLSearchParams(window.location.search);
    const idDaUrl = urlParams.get('id');
    
    if (idDaUrl) {
        console.log(`ID encontrado na URL: ${idDaUrl}`);
        // Preenche o campo de input com o ID da URL
        inputNumeroProjeto.value = idDaUrl;
        // Simula o envio do formulário, o que irá iniciar o processo de busca
        handleFormSubmit({ preventDefault: () => {} });
    }
});