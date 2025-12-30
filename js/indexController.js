import { buscarETratarProposta } from './model.js';

// Função para centralizar a atualização do estado do botão
// Função para centralizar a atualização do estado do botão
function atualizarEstadoBotao(estado, mensagem = '') {
    const btnConsultar = document.getElementById('btn-consultar');
    const numeroProjetoInput = document.getElementById('numero-projeto');
    const primeiroNomeInput = document.getElementById('primeiro-nome');
    const mensagemFeedback = document.getElementById('mensagem-feedback');

    if (!btnConsultar || !numeroProjetoInput || !primeiroNomeInput || !mensagemFeedback) {
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

// AQUI: Adicione esta função para manipular o redirecionamento
// AQUI: Adicione esta função para manipular o redirecionamento
async function executarConsulta(numeroProjeto, primeiroNome) {
    if (!numeroProjeto || !primeiroNome) {
        atualizarEstadoBotao('erro', 'Por favor, preencha todos os campos.');
        setTimeout(() => atualizarEstadoBotao('normal'), 3000);
        return;
    }

    try {
        atualizarEstadoBotao('carregando');
        const propostaData = await buscarETratarProposta(numeroProjeto, primeiroNome);

        if (propostaData.sucesso) {
            // CORREÇÃO: Determina o tipo de visualização a partir da proposta que existe (premium ou acessível)
            const propostaDisponivel = propostaData.dados.premium || propostaData.dados.acessivel;
            const tipoProposta = propostaDisponivel ? propostaDisponivel.tipoVisualizacao : null;

            if (tipoProposta === 've') { // tipoVisualizacao é 've' ou 'solar'
                // Redireciona para a página de propostas de VE
                window.location.href = `propostaVE.html?id=${numeroProjeto}&nome=${primeiroNome}`;
            } else if (tipoProposta === 'solar') {
                // Redireciona para a página de propostas Solar
                window.location.href = `proposta.html?id=${numeroProjeto}&nome=${primeiroNome}`;
            } else if (tipoProposta === 'servico') {
                // Redireciona para a página de propostas de Serviços
                window.location.href = `propostaServicos.html?id=${numeroProjeto}&nome=${primeiroNome}`;
            } else {
                // Caso o tipo seja desconhecido, mostra um erro
                atualizarEstadoBotao('erro', 'Tipo de proposta desconhecido.');
                setTimeout(() => atualizarEstadoBotao('normal'), 5000);
            }
        } else {
            // Se a busca falhar, exibe a mensagem de erro
            atualizarEstadoBotao('erro', propostaData.mensagem);
            setTimeout(() => atualizarEstadoBotao('normal'), 5000);
        }
    } catch (erro) {
        console.error('Erro na consulta:', erro);
        atualizarEstadoBotao('erro', 'Erro ao carregar a proposta.');
        setTimeout(() => atualizarEstadoBotao('normal'), 5000);
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

        // CORRETO: Chama a função de consulta a partir do evento de URL
        executarConsulta(idProjetoURL, nomeURL);
    }

    if (parametroErro) {
        let mensagem = '';
        switch (parametroErro) {
            case 'parametros-ausentes':
                mensagem = 'Os parâmetros da URL estão ausentes.';
                break;
            // CORREÇÃO: O caso 'proposta-expirada' agora exibe a mensagem completa e profissional
            case 'proposta-expirada':
                mensagem = 'Esta proposta encontra-se expirada. Por favor, solicite uma nova proposta.';
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
        }, 5000);
    }

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        const numeroProjeto = numeroProjetoInput.value;
        const primeiroNome = primeiroNomeInput.value;

        // CORRETO: Chama a função de consulta a partir do evento de submit
        executarConsulta(numeroProjeto, primeiroNome);
    });
});