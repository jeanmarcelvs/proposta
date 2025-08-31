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
    const mainContent = document.querySelector('main');

    if (mainContent) {
        mainContent.classList.remove('main-oculto');
        mainContent.classList.add('main-visivel');
    }

    if (overlay) {
        overlay.classList.add('oculto');
    }
}

// Função para atualizar as imagens dos equipamentos com base no tipo de proposta
function atualizarImagemEquipamentos(propostas, tipo) {
    const imagemMarca = document.getElementById('imagem-marca');
    if (!imagemMarca) {
        console.error("ERRO: Elemento com ID 'imagem-marca' não encontrado.");
        return;
    }
    imagemMarca.src = propostas[tipo].equipamentos.imagem;
    console.log(`Imagem de equipamentos atualizada para: ${imagemMarca.src}`);
}

// Funções para preencher o HTML com os dados da proposta
function preencherDadosProposta(proposta) {
    if (!proposta) {
        console.error("ERRO: Objeto de proposta é nulo.");
        return;
    }
    document.getElementById('consumo').textContent = proposta.consumoMensal;
    document.getElementById('geracao').textContent = proposta.geracaoMensal;
    document.getElementById('valor-sistema').textContent = proposta.valorSistema;
    document.getElementById('economia').textContent = proposta.economiaMensal;
    document.getElementById('payback').textContent = proposta.payback;
    document.getElementById('cliente').textContent = proposta.cliente;

    const valorResumoPremium = document.getElementById('valor-resumo-premium');
    if (valorResumoPremium) {
        valorResumoPremium.textContent = proposta.valorSistema;
    }
    console.log("Dados da proposta preenchidos no HTML.");
}

function preencherDetalhesInstalacao(proposta) {
    const imagemInstalacao = document.getElementById('imagem-instalacao');
    if (imagemInstalacao && proposta.instalacao && proposta.instalacao.imagemInstalacao) {
        imagemInstalacao.src = proposta.instalacao.imagemInstalacao;
        console.log("Imagem de instalação atualizada.");
    }
}

// NOVO: Função para atualizar etiquetas dinâmicas
function atualizarEtiquetasDinamicas(tipo) {
    const etiquetas = document.querySelectorAll('[data-etiqueta-proposta]');
    etiquetas.forEach(etiqueta => {
        if (etiqueta.dataset.etiquetaProposta === tipo) {
            etiqueta.style.display = 'block';
        } else {
            etiqueta.style.display = 'none';
        }
    });
}

// Função de inicialização
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Controlador: DOM totalmente carregado. Iniciando.");

    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjeto = urlParams.get('id');

    if (!numeroProjeto) {
        console.error("ERRO: ID do projeto não encontrado na URL.");
        document.querySelector('h1').textContent = "Erro ao Carregar Proposta";
        esconderLoadingOverlay();
        return;
    }

    mostrarLoadingOverlay();

    // Tenta buscar os dados da API
    console.log("Controlador: Buscando dados da API...");
    const resposta = await buscarETratarProposta(numeroProjeto);

    if (resposta.sucesso) {
        const propostas = resposta.proposta;
        console.log("Controlador: Dados da proposta carregados com sucesso da API.");

        // Salva os dados no localStorage para uso futuro
        localStorage.setItem('propostaData', JSON.stringify(propostas));
        
        // Exibe a proposta Premium por padrão
        preencherDadosProposta(propostas.premium);
        atualizarImagemEquipamentos(propostas, 'premium');
        atualizarEtiquetasDinamicas('premium');
        preencherDetalhesInstalacao(propostas.premium);
        document.body.classList.add('theme-premium');
        document.body.classList.remove('theme-acessivel');
        esconderLoadingOverlay();

        // Configura os botões de tipo de proposta
        const btnPremium = document.getElementById('btn-premium');
        const btnAcessivel = document.getElementById('btn-acessivel');

        if (btnPremium) {
            btnPremium.addEventListener('click', () => {
                console.log("DEBUG: Clicado no botão 'Premium'. Carregando dados Premium...");
                preencherDadosProposta(propostas.premium);
                atualizarImagemEquipamentos(propostas, 'premium');
                atualizarEtiquetasDinamicas('premium');
                preencherDetalhesInstalacao(propostas.premium);
                document.body.classList.add('theme-premium');
                document.body.classList.remove('theme-acessivel');
                btnPremium.classList.add('selecionado');
                btnAcessivel.classList.remove('selecionado');
            });
        }

        if (propostas.acessivel && btnAcessivel) {
            // Exibe o botão "+Acessível" apenas se houver dados
            btnAcessivel.style.display = 'inline-block';
            btnAcessivel.addEventListener('click', () => {
                console.log("DEBUG: Clicado no botão '+Acessível'. Carregando dados +Acessível...");
                preencherDadosProposta(propostas.acessivel);
                atualizarImagemEquipamentos(propostas, 'acessivel');
                atualizarEtiquetasDinamicas('acessivel');
                preencherDetalhesInstalacao(propostas.acessivel);
                document.body.classList.add('theme-acessivel');
                document.body.classList.remove('theme-premium');
                btnAcessivel.classList.add('selecionado');
                btnPremium.classList.remove('selecionado');
            });
        }

        // Tenta atualizar o status de visualização na API
        try {
            const dadosVisualizacao = {
                propostaId: numeroProjeto,
                tipoVisualizacao: 'P' // O 'P' maiúsculo é para Premium
            };
            await atualizarStatusVisualizacao(dadosVisualizacao);
        } catch (error) {
            console.error("ERRO: Falha ao atualizar o status de visualização.", error);
        }

    } else {
        // Trata o caso de erro ao buscar dados
        console.error("ERRO: Não foi possível carregar a proposta.", resposta.mensagem);
        document.querySelector('h1').textContent = `Erro ao Carregar: ${resposta.mensagem}`;
        esconderLoadingOverlay();
    }
});