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
        // Apenas para garantir, mas o CSS já deve estar fazendo isso
        overlay.classList.remove('oculto');
    }
}

function esconderLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    const mainContent = document.querySelector('main');

    if (mainContent) {
        // Remove a classe que oculta e adiciona a que exibe
        mainContent.classList.remove('main-oculto');
        mainContent.classList.add('main-visivel');
    }

    // Oculta o overlay após o conteúdo principal aparecer
    if (overlay) {
        overlay.classList.add('oculto');
    }
}

// ... (Resto do seu código permanece o mesmo) ...

// Espera a página carregar
document.addEventListener('DOMContentLoaded', async () => {
    // Não precisa mais chamar mostrarLoadingOverlay() aqui
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

            // PONTO DE DEBUG 1: VERIFICA SE OS DADOS FORAM RECEBIDOS CORRETAMENTE
            console.log("DEBUG: Conteúdo de propostaData:", propostaData);

            document.body.classList.add('theme-premium');

            // PONTO DE DEBUG 2: ANTES DE CADA CHAMADA DE FUNÇÃO DE PREENCHIMENTO
            console.log("DEBUG: Chamando preencherDadosProposta...");
            preencherDadosProposta(propostaData.premium);

            console.log("DEBUG: Chamando atualizarImagemEquipamentos...");
            atualizarImagemEquipamentos(propostaData, 'premium');

            console.log("DEBUG: Chamando atualizarEtiquetasDinamicas...");
            atualizarEtiquetasDinamicas('premium');

            console.log("DEBUG: Chamando atualizarImagemInstalacao...");
            atualizarImagemInstalacao(propostaData, 'premium');

            console.log("DEBUG: Chamando preencherDetalhesInstalacao...");
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
            tipoVisualizacao: 'P'
        };
        await atualizarStatusVisualizacao(dadosVisualizacao);
    } catch (error) {
        console.error("ERRO: Falha ao atualizar o status de visualização.", error);
    }
});