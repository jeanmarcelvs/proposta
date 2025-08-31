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

// CORRIGIDO: A função agora recebe apenas o objeto da proposta (premium ou acessivel)
function atualizarImagemEquipamentos(proposta) {
    const imagemMarca = document.getElementById('imagem-marca');
    if (!imagemMarca) {
        console.error("ERRO: Elemento com ID 'imagem-marca' não encontrado.");
        return;
    }
    // CORRIGIDO: Acessa o caminho da imagem diretamente do objeto da proposta
    const caminho = proposta.equipamentos.imagemPremium || proposta.equipamentos.imagemAcessivel;

    if (caminho) {
        imagemMarca.src = caminho;
    } else {
        console.error("ERRO: Caminho da imagem de equipamentos não encontrado.");
    }
}

// Função para preencher os dados dinâmicos da proposta
function preencherDadosProposta(dados) {
    // Mapeamento dos IDs de elementos para as chaves de dados
    const mapaDados = {
        'nome-cliente': 'cliente',
        'consumo': 'consumoMensal',
        'geracao': 'geracaoMensal',
        'valor-investimento-premium': 'valorSistema',
        'economia': 'economiaMensal',
        'payback': 'payback'
    };

    // Preenche os campos de texto com os dados do objeto
    for (const id in mapaDados) {
        const elemento = document.getElementById(id);
        if (elemento && dados[mapaDados[id]]) {
            elemento.textContent = dados[mapaDados[id]];
        }
    }
}

// CORRIGIDO: A função agora recebe apenas o objeto da proposta (premium ou acessivel)
function atualizarImagemInstalacao(proposta) {
    const imagemInstalacao = document.getElementById('imagem-instalacao');
    if (!imagemInstalacao) {
        console.error("ERRO: Elemento com ID 'imagem-instalacao' não encontrado.");
        return;
    }
    // CORRIGIDO: Acessa o caminho da imagem diretamente do objeto da proposta
    const caminho = proposta.instalacao.imagemInstalacaoPremium || proposta.instalacao.imagemInstalacaoAcessivel;
    
    if (caminho) {
        imagemInstalacao.src = caminho;
    } else {
        console.error("ERRO: Caminho da imagem de instalação não encontrado.");
    }
}

function preencherDetalhesInstalacao(dados) {
    // Implemente a lógica para preencher os detalhes de instalação
    // com base na sua estrutura de dados (dados.acessivel ou dados.premium)
}

function atualizarEtiquetasDinamicas(tipo) {
    const etiquetaEconomia = document.getElementById('etiqueta-economia');
    const etiquetaPayback = document.getElementById('etiqueta-payback');

    if (etiquetaEconomia) {
        etiquetaEconomia.textContent = tipo === 'premium' ? "Economia mensal estimada:" : "Economia mensal estimada:";
    }

    if (etiquetaPayback) {
        etiquetaPayback.textContent = tipo === 'premium' ? "Seu investimento se paga em:" : "Seu investimento se paga em:";
    }
}

// Lógica de inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjeto = urlParams.get('id');

    if (!numeroProjeto) {
        console.error('ERRO: ID do projeto não encontrado na URL.');
        // Redirecionar ou mostrar mensagem de erro
        return;
    }

    const dadosArmazenados = localStorage.getItem('propostaData');
    if (!dadosArmazenados) {
        console.log("Controlador: Dados não encontrados no localStorage. Buscando na API...");
        const resposta = await buscarETratarProposta(numeroProjeto);

        // CORRIGIDO: Verifica se a resposta e a proposta existem
        if (resposta.sucesso && resposta.proposta && resposta.proposta.premium) {
            // CORRIGIDO: Salva o objeto completo de resposta.proposta no localStorage
            localStorage.setItem('propostaData', JSON.stringify(resposta.proposta));
            inicializarBotoes(resposta.proposta);
            preencherDadosProposta(resposta.proposta.premium);
            atualizarImagemEquipamentos(resposta.proposta.premium);
            atualizarImagemInstalacao(resposta.proposta.premium);
            atualizarEtiquetasDinamicas('premium');
            esconderLoadingOverlay();
        } else {
            // Trata o erro, talvez redirecionando para a página inicial
            console.error("Controlador: Falha ao carregar dados da API.");
            alert(resposta.mensagem || 'Falha ao carregar a proposta.');
            window.location.href = 'index.html';
        }
    } else {
        console.log("Controlador: Dados encontrados no localStorage. Carregando...");
        // CORRIGIDO: O parse agora retorna o objeto { premium: ..., acessivel: ... }
        const propostas = JSON.parse(dadosArmazenados);
        inicializarBotoes(propostas);
        preencherDadosProposta(propostas.premium);
        atualizarImagemEquipamentos(propostas.premium);
        atualizarImagemInstalacao(propostas.premium);
        atualizarEtiquetasDinamicas('premium');
        esconderLoadingOverlay();
    }
});

// A nova função para inicializar os botões e controlar a visibilidade
function inicializarBotoes(propostas) {
    const btnPremium = document.getElementById('btn-premium');
    const btnAcessivel = document.getElementById('btn-acessivel');
    const seletorBotoes = document.querySelector('.seletor-tipo-proposta');

    // Se não houver dados para a proposta acessível, esconde o seletor de botões
    if (!propostas.acessivel) {
        if (seletorBotoes) {
            seletorBotoes.style.display = 'none';
        }
        return; // Sai da função, não precisa adicionar os event listeners
    } else {
        // Garante que o seletor está visível se a proposta acessível existir
        if (seletorBotoes) {
            seletorBotoes.style.display = 'flex'; // ou 'block'
        }
    }

    // Lógica para o botão Premium
    if (btnPremium) {
        btnPremium.addEventListener('click', () => {
            console.log("DEBUG: Clicado no botão 'Premium'. Carregando dados Premium...");
            mostrarLoadingOverlay();
            preencherDadosProposta(propostas.premium);
            atualizarImagemEquipamentos(propostas.premium);
            atualizarEtiquetasDinamicas('premium');
            atualizarImagemInstalacao(propostas.premium);
            preencherDetalhesInstalacao(propostas.premium);
            document.body.classList.remove('theme-acessivel');
            document.body.classList.add('theme-premium');
            setTimeout(() => {
                btnPremium.classList.add('selecionado');
                btnAcessivel.classList.remove('selecionado');
                esconderLoadingOverlay();
            }, 100);
            const dadosVisualizacao = {
                propostaId: propostas.premium.id,
                tipoVisualizacao: 'P' // Premium
            };
            atualizarStatusVisualizacao(dadosVisualizacao);
        });
    }

    // Lógica para o botão +Acessível
    if (btnAcessivel) {
        btnAcessivel.addEventListener('click', () => {
            console.log("DEBUG: Clicado no botão '+Acessível'. Carregando dados +Acessível...");
            mostrarLoadingOverlay();
            preencherDadosProposta(propostas.acessivel);
            atualizarImagemEquipamentos(propostas.acessivel);
            atualizarEtiquetasDinamicas('acessivel');
            atualizarImagemInstalacao(propostas.acessivel);
            preencherDetalhesInstalacao(propostas.acessivel);
            document.body.classList.add('theme-acessivel');
            document.body.classList.remove('theme-premium');
            setTimeout(() => {
                btnAcessivel.classList.add('selecionado');
                btnPremium.classList.remove('selecionado');
                esconderLoadingOverlay();
            }, 100);
            const dadosVisualizacao = {
                propostaId: propostas.acessivel.id,
                tipoVisualizacao: 'A' // Acessível
            };
            atualizarStatusVisualizacao(dadosVisualizacao);
        });
    }
}