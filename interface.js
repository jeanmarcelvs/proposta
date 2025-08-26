import { consultarProposta } from './api.js';
import { processarDadosProposta, verificarPropostaExpirada } from './logica.js';

// Variável para armazenar a proposta processada
let dadosPropostaProcessada = null;
let tipoPropostaAtual = 'premium';

// ######################################################################
// 1. SELETORES DO DOM (PONTOS DE REFERÊNCIA NO HTML)
// ######################################################################
const telaInicialContainer = document.getElementById('tela-inicial-container');
const propostaApresentacaoContainer = document.getElementById('proposta-apresentacao-container');
const cabecalhoProposta = document.getElementById('cabecalho-proposta');
const mensagemPropostaExpirada = document.getElementById('mensagem-proposta-expirada');

const botaoPremium = document.getElementById('botao-premium');
const botaoEconomica = document.getElementById('botao-economica');
const botaoVoltar = document.getElementById('botao-voltar');

// Containers para injetar o conteúdo
const secaoDadosCliente = document.getElementById('secao-dados-cliente');
const secaoDadosGerais = document.getElementById('secao-dados-gerais');
const secaoInstalacao = document.getElementById('secao-instalacao');
const secaoFinanciamento = document.getElementById('secao-financiamento');
const secaoValorTotal = document.getElementById('secao-valor-total');
const secaoValidade = document.getElementById('secao-validade');

// ######################################################################
// 2. LÓGICA DE GERENCIAMENTO DE TELA
// ######################################################################
/**
 * Alterna a visibilidade das seções da página.
 * @param {string} tipo - 'inicial', 'proposta' ou 'expirada'.
 */
function alternarVisualizacaoPagina(tipo) {
    telaInicialContainer.style.display = 'none';
    propostaApresentacaoContainer.style.display = 'none';
    mensagemPropostaExpirada.style.display = 'none';

    if (tipo === 'inicial') {
        telaInicialContainer.style.display = 'block';
    } else if (tipo === 'proposta') {
        propostaApresentacaoContainer.style.display = 'block';
    } else if (tipo === 'expirada') {
        mensagemPropostaExpirada.style.display = 'block';
    }
}

// ######################################################################
// 3. LÓGICA DE BUSCA DA PROPOSTA
// ######################################################################
/**
 * Cria e renderiza a tela inicial de busca.
 */
function criarTelaInicial() {
    const htmlTelaInicial = `
        <div class="busca-container">
            <h1>Buscar Proposta Comercial</h1>
            <input type="text" id="campo-projeto-id" placeholder="Digite o ID do projeto" class="busca-container__input">
            <button id="botao-buscar" class="busca-container__botao">Buscar</button>
        </div>
    `;
    telaInicialContainer.innerHTML = htmlTelaInicial;
    
    const campoProjetoId = document.getElementById('campo-projeto-id');
    const botaoBuscar = document.getElementById('botao-buscar');

    botaoBuscar.addEventListener('click', async () => {
        const projectId = campoProjetoId.value.trim();
        if (projectId) {
            try {
                const dadosBrutos = await consultarProposta(projectId);
                
                // === LÓGICA DE VALIDAÇÃO DA PROPOSTA ===
                const expirada = verificarPropostaExpirada(dadosBrutos.expirationDate);
                
                if (expirada) {
                    alternarVisualizacaoPagina('expirada');
                } else {
                    dadosPropostaProcessada = processarDadosProposta(dadosBrutos);
                    alternarVisualizacaoPagina('proposta');
                    renderizarProposta(dadosPropostaProcessada, tipoPropostaAtual);
                }
                
            } catch (erro) {
                alert('Erro ao buscar a proposta. Verifique o ID do projeto.');
                console.error('Erro na busca:', erro);
            }
        } else {
            alert('Por favor, digite o ID do projeto.');
        }
    });
}

// ######################################################################
// 4. FUNÇÕES DE RENDERIZAÇÃO DAS SEÇÕES
// ######################################################################
/**
 * Renderiza o conteúdo da proposta na página.
 * @param {object} dadosProposta - Os dados processados da proposta.
 * @param {string} tipo - 'premium' ou 'economica'.
 */
function renderizarProposta(dadosProposta, tipo) {
    // Define qual conjunto de dados usar para renderizar
    const dados = tipo === 'premium' ? dadosProposta : dadosProposta.propostaEconomica;
    
    // Formata as datas para exibir apenas a parte da data
    const dataCriacao = new Date(dadosProposta.dataCriacao).toLocaleDateString('pt-BR');
    const dataExpiracao = new Date(dadosProposta.dataExpiracao).toLocaleDateString('pt-BR');

    // Seção 1: Dados do Cliente
    secaoDadosCliente.innerHTML = `
        <h2 class="nome-cliente-destaque">${dadosProposta.nomeCliente}</h2>
        <p>Localidade: ${dadosProposta.localizacao}</p>
        <p>Data da Proposta: ${dataCriacao}</p>
    `;

    // Seção 2: Dados Gerais do Sistema
    secaoDadosGerais.innerHTML = `
        <h3 class="secao__titulo">Dados Gerais do Sistema</h3>
        <p>Geração Média Mensal: ${dadosProposta.geracaoMensal} kWh</p>
        <p>Potência do Sistema: ${dadosProposta.potenciaSistema} kWp</p>
        <p>Ideal para contas de até: <span class="destaque">R$ ${dados.valorContaIdeal}</span></p>
        <p>Tipo de Instalação: ${dadosProposta.tipoInstalacao}</p>
    `;

    // Seção 3: Dados da Instalação
    secaoInstalacao.innerHTML = `
        <h3 class="secao__titulo">Dados da Instalação</h3>
        <p>Esta seção será preenchida com os detalhes da instalação <span class="destaque">${tipo === 'premium' ? 'Premium' : 'Econômica'}</span>.</p>
    `;

    // Seção 4: Simulação de Financiamento
    const planos = dados.planosFinanciamento;
    const prazoEquilibrio = dados.parcelaEquilibrio;
    
    let htmlPlanos = '';
    planos.forEach(plano => {
        const isEquilibrio = plano.prazo == prazoEquilibrio;
        const classeDestaque = isEquilibrio ? 'card-financiamento--equilibrio' : '';

        htmlPlanos += `
            <div class="card-financiamento ${classeDestaque}">
                <h4 class="card-financiamento__titulo">${plano.prazo} meses</h4>
                <p class="card-financiamento__valor">R$ ${plano.parcela}</p>
                ${isEquilibrio ? '<span class="etiqueta-equilibrio">Parcela de Equilíbrio</span>' : ''}
            </div>
        `;
    });
    secaoFinanciamento.innerHTML = `
        <h3 class="secao__titulo">Simulação de Financiamento</h3>
        <div class="container-cards-financiamento">
            ${htmlPlanos}
        </div>
        <p class="secao__observacao">
            *Observação: As parcelas podem variar conforme análise de crédito,
            taxas de juros e situação financeira do mercado.
        </p>
    `;
    
    // Seção 5: Valor Total do Projeto
    secaoValorTotal.innerHTML = `
        <h3 class="secao__titulo">Valor Total do Projeto</h3>
        <p class="valor-total-destaque">R$ ${dados.precoTotalVenda}</p>
        <p class="secao__observacao">
            *Valor à vista. Consulte opção de pagamento no cartão de crédito.
        </p>
    `;

    // Seção 6: Validade da Proposta - Agora não exibe a data, mas a lógica já foi aplicada
    secaoValidade.innerHTML = `
        <h3 class="secao__titulo">Validade da Proposta</h3>
        <p class="secao__texto">Esta proposta é válida até o dia: <span class="destaque">${dataExpiracao}</span>.</p>
    `;
    
    // Atualiza o resumo do cabeçalho.
    renderizarCabecalhoDinamico(dadosProposta.planosFinanciamento, dadosProposta.propostaEconomica.planosFinanciamento);
}

// ######################################################################
// 5. LÓGICA DO CABEÇALHO DINÂMICO E SCROLL
// ######################################################################
function renderizarCabecalhoDinamico(planosPremium, planosEconomica) {
    const menorParcelaPremium = planosPremium[0]?.parcela || 'N/A';
    const menorParcelaEconomica = planosEconomica[0]?.parcela || 'N/A';
    
    cabecalhoProposta.innerHTML = `
        <img src="logo.png" alt="Logo da Empresa" class="cabecalho-proposta__logo">
        <nav class="botoes-tipo-proposta">
            <button id="botao-premium" class="botoes-tipo-proposta__botao botoes-tipo-proposta__botao--ativo">Premium</button>
            <button id="botao-economica" class="botoes-tipo-proposta__botao">Econômica</button>
        </nav>
        <div id="resumo-propostas" class="resumo-propostas">
            <span class="resumo-propostas__item resumo-propostas__item--premium">Proposta Premium: R$ ${menorParcelaPremium}</span>
            <span class="resumo-propostas__item resumo-propostas__item--economica">Proposta Econômica: R$ ${menorParcelaEconomica}</span>
        </div>
    `;

    const resumoPropostas = document.getElementById('resumo-propostas');
    const secaoValorTotal = document.getElementById('secao-valor-total');
    
    window.addEventListener('scroll', () => {
        const rect = secaoValorTotal.getBoundingClientRect();
        const alturaViewport = window.innerHeight;
        
        if (rect.top <= alturaViewport * 0.4) {
            resumoPropostas.classList.add('resumo-propostas--visivel');
        } else {
            resumoPropostas.classList.remove('resumo-propostas--visivel');
        }
    });

    const novoBotaoPremium = document.getElementById('botao-premium');
    const novoBotaoEconomica = document.getElementById('botao-economica');

    novoBotaoPremium.addEventListener('click', () => {
        tipoPropostaAtual = 'premium';
        renderizarProposta(dadosPropostaProcessada, tipoPropostaAtual);
        novoBotaoPremium.classList.add('botoes-tipo-proposta__botao--ativo');
        novoBotaoEconomica.classList.remove('botoes-tipo-proposta__botao--ativo');
    });

    novoBotaoEconomica.addEventListener('click', () => {
        tipoPropostaAtual = 'economica';
        renderizarProposta(dadosPropostaProcessada, tipoPropostaAtual);
        novoBotaoEconomica.classList.add('botoes-tipo-proposta__botao--ativo');
        novoBotaoPremium.classList.remove('botoes-tipo-proposta__botao--ativo');
    });
}

// ######################################################################
// 6. INICIALIZAÇÃO DA APLICAÇÃO
// ######################################################################
document.addEventListener('DOMContentLoaded', () => {
    window.scrollTo(0, 0);
    criarTelaInicial();
    botaoVoltar.addEventListener('click', () => {
        alternarVisualizacaoPagina('inicial');
        // Limpa os containers para evitar lixo de renderizações antigas
        secaoDadosCliente.innerHTML = '';
        secaoDadosGerais.innerHTML = '';
        secaoInstalacao.innerHTML = '';
        secaoFinanciamento.innerHTML = '';
        secaoValorTotal.innerHTML = '';
        secaoValidade.innerHTML = '';
    });
});