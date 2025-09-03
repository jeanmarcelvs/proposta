/**
 * indexController.js
 * Este arquivo é o Controlador da página index.html. Ele gerencia a
 * interação do usuário com o formulário e coordena a comunicação com o Modelo.
 */
import { buscarETratarProposta, validarValidadeProposta } from './model.js';

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

//---------------------------------------------------------
// NOVO: Função para habilitar/desabilitar o formulário
//---------------------------------------------------------
/**
 * Altera o estado de todos os campos de entrada e do botão de consulta.
 * @param {boolean} disabled Indica se os elementos devem ser desabilitados (true) ou habilitados (false).
 */
function setFormState(disabled) {
    const inputs = document.querySelectorAll('#numero-projeto, #primeiro-nome');
    const button = document.getElementById('btn-consultar');
    
    inputs.forEach(input => {
        input.disabled = disabled;
    });
    
    button.disabled = disabled;
    
    // Altera o texto e o ícone do botão
    const btnTexto = button.querySelector('.btn-texto');
    const loadingIcon = button.querySelector('.icone-loading');

    if (disabled) {
        button.classList.add('loading');
        if (btnTexto) btnTexto.style.display = 'none';
        if (loadingIcon) loadingIcon.style.display = 'inline-block';
    } else {
        button.classList.remove('loading', 'success', 'error');
        if (btnTexto) btnTexto.style.display = 'inline-block';
        if (loadingIcon) loadingIcon.style.display = 'none';
        btnTexto.textContent = 'Consultar'; // Reseta o texto
    }
}

// Aguarda o documento HTML ser totalmente carregado
document.addEventListener('DOMContentLoaded', function () {
    const formConsulta = document.getElementById('form-consulta');
    const inputNumeroProjeto = document.getElementById('numero-projeto');
    const inputPrimeiroNome = document.getElementById('primeiro-nome');
    
    // **Ajustado:** Eventos de input para validação em tempo real
    inputPrimeiroNome.addEventListener('input', (event) => {
        event.target.value = event.target.value.trim().split(' ')[0];
    });

    inputNumeroProjeto.addEventListener('input', (event) => {
        event.target.value = event.target.value.replace(/[^0-9]/g, '').substring(0, 4);
    });
    
    // Função que será executada ao submeter o formulário
    async function handleFormSubmit(evento, numeroProjetoUrl = null, primeiroNomeUrl = null) {
        let sucesso = false;

        if (evento) {
            evento.preventDefault();
        }

        const numeroProjeto = numeroProjetoUrl || inputNumeroProjeto.value.trim();
        const primeiroNome = primeiroNomeUrl || inputPrimeiroNome.value.trim();

        // ----------------------------------------------------
        // NOVO: Validação de Campos Vazios e Formato
        // ----------------------------------------------------
        if (!numeroProjeto || !primeiroNome) {
            exibirMensagem('erro', 'Por favor, preencha o número do projeto e o primeiro nome.');
            return;
        }

        if (numeroProjeto.length !== 4) {
            exibirMensagem('erro', 'O número do projeto deve ter exatamente 4 dígitos.');
            return;
        }
        
        if (primeiroNome.includes(' ')) {
            exibirMensagem('erro', 'Por favor, digite apenas o primeiro nome, sem espaços.');
            return;
        }
        
        // **NOVA LÓGICA:** Desabilita o formulário e o botão
        setFormState(true);

        try {
            const resposta = await buscarETratarProposta(numeroProjeto, primeiroNome);
            sucesso = resposta.sucesso;

            if (sucesso) {
                // **NOVO:** Verificação da validade da proposta ANTES de redirecionar
                if (validarValidadeProposta(resposta.dados.premium)) {
                    // Proposta VÁLIDA: prossegue para a página da proposta
                    const btnConsultar = document.getElementById('btn-consultar');
                    btnConsultar.classList.remove('loading');
                    btnConsultar.classList.add('success');
                    exibirMensagem('sucesso', `Proposta #${numeroProjeto} encontrada! Redirecionando...`);
                    
                    setTimeout(() => {
                        window.location.href = `proposta.html?id=${numeroProjeto}&nome=${primeiroNome}`;
                    }, 1500);
                } else {
                    // Proposta EXPIRADA: exibe mensagem de erro na própria página
                    const btnConsultar = document.getElementById('btn-consultar');
                    btnConsultar.classList.remove('loading');
                    btnConsultar.classList.add('error');
                    exibirMensagem('erro', `Erro: A proposta #${numeroProjeto} está expirada e não pode ser acessada.`);
                    
                    // Permite que o usuário tente novamente após o erro
                    setTimeout(() => setFormState(false), 2000);
                    return; // Importante para não continuar o fluxo de sucesso
                }
            } else {
                const btnConsultar = document.getElementById('btn-consultar');
                btnConsultar.classList.remove('loading');
                btnConsultar.classList.add('error');
                exibirMensagem('erro', `Erro: ${resposta.mensagem}`);
            }
        } catch (erro) {
            console.error('Ocorreu um erro na busca:', erro);
            const btnConsultar = document.getElementById('btn-consultar');
            btnConsultar.classList.remove('loading');
            btnConsultar.classList.add('error');
            exibirMensagem('erro', 'Ocorreu um erro inesperado ao consultar. Tente novamente.');
        } finally {
            // Habilita o formulário e o botão somente em caso de erro
            if (!sucesso) {
                setTimeout(() => setFormState(false), 2000);
            }
        }
    }

    formConsulta.addEventListener('submit', handleFormSubmit);

    // Lógica para verificar o ID e o nome na URL
    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjetoDaUrl = urlParams.get('id');
    const primeiroNomeDaUrl = urlParams.get('nome');

    if (numeroProjetoDaUrl && primeiroNomeDaUrl) {
        inputNumeroProjeto.value = numeroProjetoDaUrl;
        inputPrimeiroNome.value = primeiroNomeDaUrl;
        handleFormSubmit(null, numeroProjetoDaUrl, primeiroNomeDaUrl);
    } else {
        esconderLoadingOverlay();
    }
});