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

// CORRIGIDO: A função agora recebe a proposta completa e usa o caminho da imagem dela
function atualizarImagemEquipamentos(proposta) {
    const imagemMarca = document.getElementById('imagem-marca');
    if (!imagemMarca) {
        console.error("ERRO: Elemento com ID 'imagem-marca' não encontrado.");
        return;
    }
    imagemMarca.src = proposta.equipamentos?.imagem || '';
}

// CORRIGIDO: A função agora recebe a proposta completa e usa o caminho da imagem dela
function atualizarImagemInstalacao(proposta) {
    const imagemInstalacao = document.getElementById('imagem-instalacao');
    if (imagemInstalacao) {
        imagemInstalacao.src = proposta.instalacao?.imagem || '';
    } else {
        console.error("ERRO: Elemento com ID 'imagem-instalacao' não encontrado.");
    }
}

// NOVO: Função para preencher a seção de equipamentos dinamicamente
function preencherEquipamentos(proposta) {
    const listaEquipamentos = document.getElementById('lista-equipamentos');
    if (!listaEquipamentos) {
        console.error("ERRO: Elemento com ID 'lista-equipamentos' não encontrado.");
        return;
    }
    
    // Limpa a lista existente antes de adicionar os novos itens
    listaEquipamentos.innerHTML = '';

    proposta.equipamentos.lista.forEach(item => {
        const itemHtml = `
            <div class="item-equipamento">
                <div class="icone-equipamento">
                    <i class="fas fa-solar-panel"></i>
                </div>
                <div class="detalhes-item">
                    <div class="quantidade-e-unidade">
                        <span class="quantidade-equipamento">${item.quantidade}</span>
                        <span class="watts-unidade">W</span>
                    </div>
                    <div class="info-equipamento">
                        <h3 class="titulo-equipamento">${item.nome}</h3>
                        <p class="descricao-equipamento">${item.descricao}</p>
                    </div>
                </div>
            </div>
        `;
        listaEquipamentos.innerHTML += itemHtml;
    });
}

// NOVO: Função para preencher a seção de instalação dinamicamente
function preencherDetalhesInstalacao(proposta) {
    const listaInstalacao = document.getElementById('detalhes-instalacao');
    if (!listaInstalacao) {
        console.error("ERRO: Elemento com ID 'detalhes-instalacao' não encontrado.");
        return;
    }
    listaInstalacao.innerHTML = '';
    proposta.instalacao.detalhes.forEach(detalhe => {
        const detalheHtml = `
            <div class="info-detalhe-item">
                <i class="fas ${detalhe.icone} icone-item"></i>
                <p>${detalhe.texto}</p>
            </div>
        `;
        listaInstalacao.innerHTML += detalheHtml;
    });
}

// NOVO: Função para preencher o nome do cliente e a data
function preencherDadosCliente(proposta) {
    const nomeClienteEl = document.getElementById('nome-cliente');
    const dataPropostaEl = document.getElementById('data-proposta');
    const localPropostaEl = document.getElementById('local-proposta');

    if (nomeClienteEl) {
        nomeClienteEl.textContent = proposta.cliente.nome;
    }
    if (dataPropostaEl) {
        dataPropostaEl.textContent = new Date().toLocaleDateString('pt-BR');
    }
    if (localPropostaEl) {
        localPropostaEl.textContent = proposta.cliente.cidade;
    }
}

// Função principal para preencher todos os dados da proposta
function preencherDadosProposta(proposta) {
    preencherDadosCliente(proposta);
    preencherEquipamentos(proposta); // ESTA LINHA ESTAVA COMENTADA
    preencherDetalhesInstalacao(proposta);

    // ... (o restante da sua lógica para preencher outros campos)
}

// Lógica para alternar entre as propostas Premium e Acessível
function configurarBotoesDeAlternancia() {
    const btnPremium = document.getElementById('btn-premium');
    const btnAcessivel = document.getElementById('btn-acessivel');

    if (btnPremium) {
        btnPremium.addEventListener('click', () => {
            const propostas = JSON.parse(localStorage.getItem('propostaData'));
            if (propostas && propostas.premium) {
                //mostrarLoadingOverlay();
                preencherDadosProposta(propostas.premium);
                // CORRIGIDO: Funções de imagem atualizadas
                atualizarImagemEquipamentos(propostas.premium);
                atualizarEtiquetasDinamicas('premium');
                atualizarImagemInstalacao(propostas.premium);
                preencherDetalhesInstalacao(propostas.premium);
                // CORRIGIDO: Adiciona e remove as classes de tema corretamente
                document.body.classList.add('theme-premium');
                document.body.classList.remove('theme-acessivel');
                setTimeout(() => {
                    btnPremium.classList.add('selecionado');
                    btnAcessivel.classList.remove('selecionado');
                    //esconderLoadingOverlay();
                }, 100);
            } else {
                console.error("ERRO: Dados da proposta Premium não encontrados no localStorage.");
            }
        });
    }

    if (btnAcessivel) {
        btnAcessivel.addEventListener('click', () => {
            const propostas = JSON.parse(localStorage.getItem('propostaData'));
            if (propostas && propostas.acessivel) {
                //mostrarLoadingOverlay();
                preencherDadosProposta(propostas.acessivel);
                // CORRIGIDO: Funções de imagem atualizadas
                atualizarImagemEquipamentos(propostas.acessivel);
                atualizarEtiquetasDinamicas('acessivel');
                atualizarImagemInstalacao(propostas.acessivel);
                preencherDetalhesInstalacao(propostas.acessivel);
                // CORRIGIDO: Adiciona e remove as classes de tema corretamente
                document.body.classList.add('theme-acessivel');
                document.body.classList.remove('theme-premium');
                setTimeout(() => {
                    btnAcessivel.classList.add('selecionado');
                    btnPremium.classList.remove('selecionado');
                    //esconderLoadingOverlay();
                }, 100);
            } else {
                console.error("ERRO: Dados da proposta Acessível não encontrados no localStorage.");
            }
        });
    }
}

// Função para buscar e exibir os dados da proposta
async function carregarProposta() {
    // Esconde o conteúdo principal enquanto a busca é feita
    document.querySelector('main').classList.add('main-oculto');
    // Mostra o overlay de loading
    mostrarLoadingOverlay();

    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjeto = urlParams.get('id');

    if (!numeroProjeto) {
        console.error("ERRO: Número do projeto não encontrado na URL.");
        // Redireciona para a página inicial se não houver ID
        window.location.href = 'index.html';
        return;
    }

    try {
        const proposta = await buscarETratarProposta(numeroProjeto);
        if (proposta) {
            preencherDadosProposta(proposta);
            configurarBotoesDeAlternancia();
        } else {
            // Se a busca falhar, redireciona para a página inicial com a mensagem de erro
            window.location.href = `index.html?error=projeto_nao_encontrado`;
        }
    } catch (error) {
        console.error("Erro ao carregar a proposta:", error);
        window.location.href = `index.html?error=erro_inesperado`;
    } finally {
        esconderLoadingOverlay();
    }
}

document.addEventListener('DOMContentLoaded', carregarProposta);