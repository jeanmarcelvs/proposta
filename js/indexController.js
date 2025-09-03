import { buscarETratarProposta } from './model.js';

// Função para centralizar a atualização do estado do botão
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

    if (btnTexto) btnTexto.classList.remove('oculto');
    if (iconeLoading) {
        iconeLoading.classList.add('oculto');
        iconeLoading.classList.remove('icone-loading-centralizado'); // Remove a classe auxiliar
    }
    if (iconeSucesso) iconeSucesso.classList.add('oculto');
    if (iconeErro) iconeErro.classList.add('oculto');

    mensagemFeedback.classList.remove('show', 'success-msg', 'error-msg');
    mensagemFeedback.innerText = '';

    // Aplica o novo estado
    switch (estado) {
        case 'carregando':
            btnConsultar.disabled = true;
            numeroProjetoInput.disabled = true;
            primeiroNomeInput.disabled = true;
            btnConsultar.classList.add('loading');
            if (btnTexto) btnTexto.classList.add('oculto');
            if (iconeLoading) {
                iconeLoading.classList.remove('oculto');
                iconeLoading.classList.add('icone-loading-centralizado'); // Adiciona a classe auxiliar
            }
            break;
        case 'sucesso':
            btnConsultar.classList.add('success');
            if (iconeSucesso) iconeSucesso.classList.remove('oculto');
            if (mensagemFeedback) {
                mensagemFeedback.innerText = mensagem;
                mensagemFeedback.classList.add('show', 'success-msg');
            }
            break;
        case 'erro':
            btnConsultar.classList.add('error');
            if (iconeErro) iconeErro.classList.remove('oculto');
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

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-consulta');
    const mainContent = document.querySelector('main');
    const urlParams = new URLSearchParams(window.location.search);
    const parametroErro = urlParams.get('erro');

    if (!form) {
        console.error("ERRO: O formulário com o ID 'form-consulta' não foi encontrado.");
        return;
    }

    if (mainContent) {
        setTimeout(() => {
            mainContent.classList.remove('main-oculto');
            mainContent.classList.add('main-visivel');
        }, 300);
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
        // NOVO: Temporizador para limpar o estado de erro após 3 segundos
        setTimeout(() => {
            atualizarEstadoBotao('normal');
        }, 3000);
    }

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        atualizarEstadoBotao('carregando');

        const numeroProjeto = document.getElementById('numero-projeto').value;
        const primeiroNome = document.getElementById('primeiro-nome').value;

        try {
            const resultado = await buscarETratarProposta(numeroProjeto, primeiroNome);

            if (resultado.sucesso) {
                atualizarEstadoBotao('sucesso', 'Proposta encontrada! Redirecionando...');
                setTimeout(() => {
                    window.location.href = `proposta.html?id=${numeroProjeto}&nome=${primeiroNome}`;
                }, 1000);
            } else {
                atualizarEstadoBotao('erro', resultado.mensagem || 'Ocorreu um erro desconhecido.');
                // NOVO: Temporizador para limpar o estado de erro após 3 segundos
                setTimeout(() => {
                    atualizarEstadoBotao('normal');
                }, 3000);
            }
        } catch (erro) {
            console.error('Erro na consulta:', erro);
            atualizarEstadoBotao('erro', 'Ocorreu um erro na consulta. Tente novamente.');
            // NOVO: Temporizador para limpar o estado de erro após 3 segundos
            setTimeout(() => {
                atualizarEstadoBotao('normal');
            }, 3000);
        }
    });
    
});