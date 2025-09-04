import { buscarETratarProposta } from './model.js';

// Função para centralizar a atualização do estado do botão
// Função para centralizar a atualização do estado do botão
function atualizarEstadoBotao(estado, mensagem = '') {
    const btnConsultar = document.getElementById('btn-consultar');
    const numeroProjetoInput = document.getElementById('numero-projeto');
    const primeiroNomeInput = document.getElementById('primeiro-nome');
    const mensagemFeedback = document.getElementById('mensagem-feedback');

    if (!btnConsultar || !numeroProjetoInput || !primeiroNomeInput || !mensagemFeedback) {
        console.error("ERRO: Elementos HTML do formulário não encontrados.");
        return;
    }

    const btnTexto = btnConsultar.querySelector('.btn-texto');
    const iconeLoading = btnConsultar.querySelector('.icone-loading');
    const iconeSucesso = btnConsultar.querySelector('.icone-sucesso');
    const iconeErro = btnConsultar.querySelector('.icone-erro');

    // Reseta o estado do botão
    btnConsultar.disabled = false;
    numeroProjetoInput.disabled = false;
    primeiroNomeInput.disabled = false;
    btnConsultar.classList.remove('loading', 'success', 'error');

    // Remove a classe do botão de loading
    if (iconeLoading) {
        iconeLoading.classList.remove('icone-loading-centralizado');
    }

    mensagemFeedback.classList.remove('show', 'success-msg', 'error-msg');
    mensagemFeedback.innerText = '';

    // Aplica o novo estado
    switch (estado) {
        case 'carregando':
            btnConsultar.disabled = true;
            numeroProjetoInput.disabled = true;
            primeiroNomeInput.disabled = true;
            btnConsultar.classList.add('loading');
            break;
        case 'sucesso':
            btnConsultar.classList.add('success');
            if (mensagemFeedback) {
                mensagemFeedback.innerText = mensagem;
                mensagemFeedback.classList.add('show', 'success-msg');
            }
            break;
        case 'erro':
            btnConsultar.classList.add('error');
            if (mensagemFeedback) {
                mensagemFeedback.innerText = mensagem;
                mensagemFeedback.classList.add('show', 'error-msg');
            }
            break;
        case 'normal':
        default:
            break;
    }
}

// NOVO: Função que executa a consulta
async function executarConsulta(numeroProjeto, primeiroNome) {
    atualizarEstadoBotao('carregando');
    
    try {
        const resultado = await buscarETratarProposta(numeroProjeto, primeiroNome);

        if (resultado.sucesso) {
            atualizarEstadoBotao('sucesso', 'Proposta encontrada! Redirecionando...');
            setTimeout(() => {
                window.location.href = `proposta.html?id=${numeroProjeto}&nome=${primeiroNome}`;
            }, 1000);
        } else {
            atualizarEstadoBotao('erro', resultado.mensagem || 'Ocorreu um erro desconhecido.');
            setTimeout(() => {
                atualizarEstadoBotao('normal');
            }, 3000);
        }
    } catch (erro) {
        console.error('Erro na consulta:', erro);
        atualizarEstadoBotao('erro', 'Ocorreu um erro na consulta. Tente novamente.');
        setTimeout(() => {
            atualizarEstadoBotao('normal');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-consulta');
    const mainContent = document.querySelector('main');
    const urlParams = new URLSearchParams(window.location.search);
    const parametroErro = urlParams.get('erro');
    
    const numeroProjetoInput = document.getElementById('numero-projeto');
    const primeiroNomeInput = document.getElementById('primeiro-nome');

    if (!form || !numeroProjetoInput || !primeiroNomeInput) {
        console.error("ERRO: O formulário ou seus elementos não foram encontrados.");
        return;
    }

    if (mainContent) {
        setTimeout(() => {
            mainContent.classList.remove('main-oculto');
            mainContent.classList.add('main-visivel');
        }, 300);
    }
    
    // NOVO: Verifica os parâmetros e chama a função diretamente, sem simular um evento
    const idProjetoURL = urlParams.get('id');
    const nomeURL = urlParams.get('nome');
    
    if (idProjetoURL && nomeURL) {
        numeroProjetoInput.value = idProjetoURL;
        primeiroNomeInput.value = nomeURL;
        
        executarConsulta(idProjetoURL, nomeURL);
    }
    
    if (parametroErro) {
        let mensagem = '';
        switch (parametroErro) {
            case 'parametros-ausentes':
                mensagem = 'Os parâmetros da URL estão ausentes.';
                break;
            case 'proposta-expirada':
                mensagem = 'A proposta consultada está expirada.';
                break;
            case 'acesso-negado':
                mensagem = 'A proposta não pode ser acessada. Verifique os dados.';
                break;
            default:
                mensagem = 'Ocorreu um erro desconhecido.';
        }
        atualizarEstadoBotao('erro', mensagem);
        setTimeout(() => {
            atualizarEstadoBotao('normal');
        }, 3000);
    }

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        
        const numeroProjeto = numeroProjetoInput.value;
        const primeiroNome = primeiroNomeInput.value;
        
        // NOVO: Chama a função de consulta a partir do evento de submit
        executarConsulta(numeroProjeto, primeiroNome);
    });
});