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
    // CORRIGIDO: Usa a estrutura de dados plana que o model.js retorna
    if (tipo === 'premium') {
        imagemMarca.src = propostas.premium?.equipamentos?.imagem || '';
    } else {
        imagemMarca.src = propostas.acessivel?.equipamentos?.imagem || '';
    }
}

// Função para atualizar a imagem do padrão de instalação
function atualizarImagemInstalacao(propostas, tipo) {
    const imagemInstalacao = document.getElementById('imagem-instalacao');
    if (!imagemInstalacao) {
        console.error("ERRO: Elemento com ID 'imagem-instalacao' não encontrado.");
        return;
    }
    // CORRIGIDO: Usa a estrutura de dados plana que o model.js retorna
    if (tipo === 'premium') {
        imagemInstalacao.src = propostas.premium?.instalacao?.imagemInstalacao || '';
    } else {
        imagemInstalacao.src = propostas.acessivel?.instalacao?.imagemInstalacao || '';
    }
}

// Função para atualizar as etiquetas das seções dinâmicas,
// ignorando a etiqueta do card "À Vista".
function atualizarEtiquetasDinamicas(tipo) {
    const etiquetas = document.querySelectorAll('.etiqueta-proposta-dinamica:not(.etiqueta-a-vista)');
    const texto = tipo === 'premium' ? 'Premium' : '+Acessível';
    etiquetas.forEach(etiqueta => {
        etiqueta.innerText = texto;
    });
}

// CORRIGIDO: Lógica para preencher a nova seção de detalhes da instalação
function preencherDetalhesInstalacao(proposta) {
    // ATENÇÃO: A API não fornece esses dados, então a seção será ocultada
    // ou deixada em branco, dependendo da necessidade do layout.
    // Como não há dados, vamos simplesmente não preencher e deixar o aviso.
    console.warn("AVISO: Detalhes da instalação não encontrados. Não é possível preencher esta seção.");
}

// CORRIGIDO: Lógica para preencher a página com os dados da proposta
function preencherDadosProposta(dados) {
    console.log("DEBUG: Iniciando preenchimento dos dados da proposta. Conteúdo recebido:", dados);

    try {
        // 1. Dados do Cliente
        console.log("DEBUG: Preenchendo dados do cliente...");
        const nomeClienteEl = document.getElementById('nome-cliente');
        if (nomeClienteEl) nomeClienteEl.innerText = dados.cliente || "Não informado";

        // NOTA: Os campos 'local' e 'data' não são retornados pela API na estrutura atual
        // e, portanto, serão deixados como "Não informado" ou podem ser ocultados.
        const localClienteEl = document.getElementById('local-cliente');
        if (localClienteEl) localClienteEl.innerText = "Não informado";

        const dataPropostaEl = document.getElementById('data-proposta');
        if (dataPropostaEl) dataPropostaEl.innerText = "Não informado";
        console.log("DEBUG: Dados do cliente preenchidos com sucesso.");

        // 2. Sistema Proposto
        console.log("DEBUG: Preenchendo dados do sistema...");
        const geracaoMediaEl = document.getElementById('geracao-media');
        if (geracaoMediaEl) {
            geracaoMediaEl.innerText = dados.geracaoMensal?.split(' ')[0] || 'N/A';
            const unidadeGeracaoEl = document.getElementById('unidade-geracao');
            if (unidadeGeracaoEl) {
                unidadeGeracaoEl.innerText = dados.geracaoMensal?.split(' ').slice(1).join(' ') || 'kWh/mês';
            }
        }

        // NOTA: Os campos 'instalacaoPaineis' e 'idealPara' não são retornados pela API
        // e serão deixados como "Não informado" ou "0".
        const instalacaoPaineisEl = document.getElementById('instalacao-paineis');
        if (instalacaoPaineisEl) instalacaoPaineisEl.innerText = "Não informado";

        const idealParaEl = document.getElementById('ideal-para');
        if (idealParaEl) idealParaEl.innerText = "0";

        console.log("DEBUG: Dados do sistema preenchidos com sucesso.");

        // 3. Equipamentos
        console.log("DEBUG: Preenchendo dados dos equipamentos...");
        // NOTA: Estes campos não são retornados pela API
        const descricaoInversorEl = document.getElementById('descricao-inversor');
        if (descricaoInversorEl) descricaoInversorEl.innerText = "Não informado";

        const quantidadeInversorEl = document.getElementById('quantidade-inversor');
        if (quantidadeInversorEl) quantidadeInversorEl.innerText = `( 0 )`;

        const descricaoPainelEl = document.getElementById('descricao-painel');
        if (descricaoPainelEl) descricaoPainelEl.innerText = "Não informado";

        const quantidadePainelEl = document.getElementById('quantidade-painel');
        if (quantidadePainelEl) quantidadePainelEl.innerText = `( 0 )`;
        console.log("DEBUG: Dados de equipamentos preenchidos com sucesso.");

        // 4. Valores Finais
        console.log("DEBUG: Preenchendo valores financeiros...");
        const valorTotalEl = document.getElementById('valor-total');
        if (valorTotalEl) valorTotalEl.innerText = dados.valorSistema?.replace('R$ ', '') || "Não informado";

        const paybackEl = document.getElementById('payback');
        if (paybackEl) paybackEl.innerText = dados.payback || "0 anos e 0 meses";
        console.log("DEBUG: Valores finais preenchidos com sucesso.");

        // 5. Parcelas (Dados ausentes na API)
        console.log("DEBUG: Preenchendo parcelas...");
        // NOTA: Estes campos não são retornados pela API
        const parcelas = [12, 24, 36, 48, 60, 72, 84];
        parcelas.forEach(p => {
            const elemento = document.getElementById(`parcela-${p}`);
            if (elemento) elemento.innerText = 'N/A';
        });
        console.log("DEBUG: Parcelas preenchidas com sucesso.");

        // 6. Observações e Validade (Seções atualizadas)
        console.log("DEBUG: Preenchendo observações e validade...");
        // NOTA: Estes campos não são retornados pela API
        const observacaoEl = document.getElementById('texto-observacao');
        if (observacaoEl) observacaoEl.innerText = "Não há observações sobre financiamento.";
        const validadeEl = document.getElementById('texto-validade');
        if (validadeEl) validadeEl.innerText = "Não informada";
        console.log("DEBUG: Observações e validade preenchidas com sucesso.");

    } catch (error) {
        console.error("ERRO DENTRO DE preencherDadosProposta:", error);
    }
}

// O restante do código permanece o mesmo.
document.addEventListener('DOMContentLoaded', async () => {
    mostrarLoadingOverlay();
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

            console.log("DEBUG: Conteúdo de propostaData:", propostaData);

            document.body.classList.add('theme-premium');

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
    } finally {
        
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
            tipoVisualizacao: 'P' // O 'P' maiúsculo é para Premium
        };
        await atualizarStatusVisualizacao(dadosVisualizacao);
    } catch (error) {
        console.error("ERRO: Falha ao atualizar o status de visualização.", error);
    }
});