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
    if (!imagemInstalacao) {
        console.error("ERRO: Elemento com ID 'imagem-instalacao' não encontrado.");
        return;
    }
    imagemInstalacao.src = proposta.instalacao?.imagem || '';
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

// Função para preencher a nova seção de detalhes da instalação
function preencherDetalhesInstalacao(proposta) {
    const secaoDetalhes = document.getElementById('detalhes-instalacao');
    if (!secaoDetalhes) {
        console.warn("AVISO: Elemento 'detalhes-instalacao' não encontrado. Não é possível preencher.");
        return;
    }

    // Limpa os detalhes anteriores para evitar duplicatas ao trocar de proposta
    secaoDetalhes.innerHTML = '';

    // Acessa o array de detalhes diretamente do objeto de proposta
    const detalhes = proposta.instalacao?.detalhesInstalacao;

    if (!detalhes || detalhes.length === 0) {
        console.warn("AVISO: Detalhes da instalação não encontrados na proposta.");
        // Opcional: exibe uma mensagem no HTML se não houver detalhes
        secaoDetalhes.innerHTML = '<p>Nenhum detalhe de instalação disponível.</p>';
        return;
    }

    // Itera sobre o array de detalhes e cria os elementos HTML
    detalhes.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-detalhe';
        div.innerHTML = `
            <i class="fas ${item.icone} icone-detalhe"></i>
            <p class="texto-detalhe">${item.texto}</p>
        `;
        secaoDetalhes.appendChild(div);
    });

    console.log("DEBUG: Detalhes de instalação preenchidos com sucesso.");
}

// Função para preencher a página com os dados da proposta
function preencherDadosProposta(dados) {
    console.log("DEBUG: Iniciando preenchimento dos dados da proposta. Conteúdo recebido:", dados);

    try {
        // CORREÇÃO: Declarando as variáveis do resumo e ícone no topo da função.
        const resumoInstalacaoEl = document.getElementById('resumo-instalacao');
        const iconeResumoEl = document.getElementById('icone-resumo');

        // 1. Dados do Cliente
        console.log("DEBUG: Preenchendo dados do cliente...");
        const nomeClienteEl = document.getElementById('nome-cliente');

        const nomeCompleto = dados.cliente || "Não informado";
        let nomeCurto = nomeCompleto;

        if (nomeCompleto !== "Não informado") {
            const palavrasDoNome = nomeCompleto.split(' ');
            if (palavrasDoNome.length > 2) {
                nomeCurto = `${palavrasDoNome[0]} ${palavrasDoNome[1]}`;
            }
        }

        if (nomeClienteEl) {
            nomeClienteEl.innerText = nomeCurto;
        }

        const localClienteEl = document.getElementById('local-cliente');
        if (localClienteEl) localClienteEl.innerText = dados.local || "Não informado";

        const dataPropostaEl = document.getElementById('data-proposta');
        if (dataPropostaEl) dataPropostaEl.innerText = dados.dataProposta || "Não informado";
        console.log("DEBUG: Dados do cliente preenchidos com sucesso.");

        // 2. Sistema Proposto (Separa valor e unidade)
        console.log("DEBUG: Preenchendo dados do sistema...");
        const geracaoMediaEl = document.getElementById('geracao-media');
        if (geracaoMediaEl) {
            const geracaoMedia = dados.sistema?.geracaoMedia;
            if (typeof geracaoMedia === 'string' && geracaoMedia.trim() !== '') {
                const geracaoMediaSplit = geracaoMedia.split(' ');
                geracaoMediaEl.innerText = geracaoMediaSplit[0];
                const unidadeGeracaoEl = document.getElementById('unidade-geracao');
                if (unidadeGeracaoEl) {
                    unidadeGeracaoEl.innerText = geracaoMediaSplit.slice(1).join(' ');
                }
            } else {
                geracaoMediaEl.innerText = 'N/A';
                const unidadeGeracaoEl = document.getElementById('unidade-geracao');
                if (unidadeGeracaoEl) {
                    unidadeGeracaoEl.innerText = 'kWh/mês';
                }
            }
        }

        const instalacaoPaineisEl = document.getElementById('instalacao-paineis');
        const iconeInstalacaoEl = document.getElementById('icone-instalacao'); // Encontra o ícone pelo novo ID

        if (instalacaoPaineisEl && iconeInstalacaoEl) {
            const tipoInstalacao = dados.sistema?.instalacaoPaineis || "Não informado";
            instalacaoPaineisEl.innerText = tipoInstalacao;
            if (tipoInstalacao.toLowerCase().includes('telhado')) {
                iconeInstalacaoEl.className = 'fas fa-house-chimney';
            } else if (tipoInstalacao.toLowerCase().includes('solo')) {
                iconeInstalacaoEl.className = 'fas fa-solar-panel';
            } else {
                iconeInstalacaoEl.className = 'fas fa-question-circle';
            }
        }

        const idealParaEl = document.getElementById('ideal-para');
        if (idealParaEl) {
            const idealPara = dados.sistema?.idealPara || 'R$ 0,00';
            idealParaEl.innerText = idealPara.replace('R$', '').trim();
        }
        console.log("DEBUG: Dados do sistema preenchidos com sucesso.");

        // 3. Equipamentos
        console.log("DEBUG: Preenchendo dados dos equipamentos...");
        const descricaoInversorEl = document.getElementById('descricao-inversor');
        if (descricaoInversorEl) descricaoInversorEl.innerText = dados.equipamentos?.descricaoInversor || "Não informado";
        const quantidadeInversorEl = document.getElementById('quantidade-inversor');
        if (quantidadeInversorEl) quantidadeInversorEl.innerText = `${dados.equipamentos?.quantidadeInversor || 0}`;
        const descricaoPainelEl = document.getElementById('descricao-painel');
        if (descricaoPainelEl) descricaoPainelEl.innerText = dados.equipamentos?.descricaoPainel || "Não informado";
        const quantidadePainelEl = document.getElementById('quantidade-painel');
        if (quantidadePainelEl) quantidadePainelEl.innerText = `${dados.equipamentos?.quantidadePainel || 0}`;
        console.log("DEBUG: Dados de equipamentos preenchidos com sucesso.");

        // 4. Valores Finais
        console.log("DEBUG: Preenchendo valores financeiros...");
        const valorTotalEl = document.getElementById('valor-total');
        if (valorTotalEl) valorTotalEl.innerText = dados.valores?.valorTotal || "Não informado";

        const descontoEl = document.getElementById('valor-desconto');
        if (descontoEl) descontoEl.innerText = dados.valores?.desconto || "Não informado";

        const valorAVistaEl = document.getElementById('valor-a-vista');
        if (valorAVistaEl) valorAVistaEl.innerText = dados.valores?.valorAVista || "Não informado";

        const economiaMensalEl = document.getElementById('economia-mensal');
        if (economiaMensalEl) economiaMensalEl.innerText = dados.valores?.economiaMensal || "Não informado";

        const paybackValorEl = document.getElementById('payback-valor');
        if (paybackValorEl) paybackValorEl.innerText = dados.valores?.payback || "Não informado";
        console.log("DEBUG: Valores financeiros preenchidos com sucesso.");

        // 5. Simulação de Financiamento
        console.log("DEBUG: Preenchendo simulações de financiamento...");
        const simulacao = dados.valores?.simulacao;

        // **ALTERADO:** Agora preenche a parcela e a taxa efetiva para cada opção
        const opcoesParcelas = [12, 24, 36, 48, 60, 72, 84];
        opcoesParcelas.forEach(n => {
            const parcelaEl = document.getElementById(`parcela-${n}`);
            if (parcelaEl) {
                parcelaEl.innerText = simulacao[`parcela-${n}`] || "N/A";
            }
            const taxaEl = document.getElementById(`taxa-${n}`);
            if (taxaEl) {
                // **ALTERAÇÃO AQUI:** Pega a taxa mensal e formata com 4 casas decimais para maior precisão
                const taxaFormatada = (simulacao[`taxaMensalEfetiva-${n}`] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                taxaEl.innerText = `${taxaFormatada}%`;
            }
        });
        console.log("DEBUG: Simulações de financiamento preenchidas com sucesso.");

        // 6. Imagens e Detalhes de Instalação
        console.log("DEBUG: Preenchendo imagens e detalhes de instalação...");
        atualizarImagemEquipamentos(dados);
        atualizarImagemInstalacao(dados);
        preencherDetalhesInstalacao(dados);
        // Preenche o resumo da instalação
        if (resumoInstalacaoEl) {
            resumoInstalacaoEl.innerText = dados.instalacao?.resumo || "";
        }
        if (iconeResumoEl) {
            // Define o ícone com base no tipo de proposta
            iconeResumoEl.className = dados.tipo === 'premium' ? 'icone-resumo fas fa-gem' : 'icone-resumo fas fa-star';
        }

        console.log("DEBUG: Preenchimento da página concluído com sucesso.");

        // Atualiza o status de visualização na API
        atualizarStatusVisualizacao({
            propostaId: dados.propostaId,
            tipoVisualizacao: dados.tipo === 'premium' ? 'Proposta Premium Visualizada' : 'Proposta Acessível Visualizada'
        });

    } catch (erro) {
        console.error("ERRO: Ocorreu um erro ao preencher os dados da proposta.", erro);
        // Exibe uma mensagem de erro na página se possível
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.innerHTML = '<p class="erro-mensagem">Não foi possível carregar a proposta. Por favor, tente novamente.</p>';
        }
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    mostrarLoadingOverlay();
    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjeto = urlParams.get('id');
    const primeiroNome = urlParams.get('nome');
    const tipoProposta = urlParams.get('tipo') || 'premium';

    if (!numeroProjeto || !primeiroNome) {
        console.error("ERRO: Parâmetros 'id' e 'nome' ausentes na URL.");
        document.body.innerHTML = '<div class="erro-container"><p class="erro-mensagem">Faltam informações para carregar a proposta. Por favor, retorne à página inicial e tente novamente.</p><a href="index.html" class="btn-voltar-proposta"><i class="fas fa-arrow-left"></i> Voltar</a></div>';
        esconderLoadingOverlay();
        return;
    }

    try {
        const resposta = await buscarETratarProposta(numeroProjeto, primeiroNome);

        if (resposta.sucesso) {
            const propostas = resposta.propostas;
            // Salva as propostas no localStorage para que o usuário possa alternar entre elas
            localStorage.setItem('propostaData', JSON.stringify(propostas));

            // Exibe a proposta correta com base no parâmetro `tipo` na URL
            const propostaSelecionada = propostas[tipoProposta];
            if (propostaSelecionada) {
                // Adiciona o tipo ao objeto para que possa ser usado na função preencherDadosProposta
                propostaSelecionada.tipo = tipoProposta;
                preencherDadosProposta(propostaSelecionada);
                atualizarImagemEquipamentos(propostaSelecionada);
                atualizarImagemInstalacao(propostaSelecionada);
                preencherDetalhesInstalacao(propostaSelecionada);
                atualizarEtiquetasDinamicas(tipoProposta);

                // Define o tema inicial da página
                document.body.classList.add(`theme-${tipoProposta}`);
                const btnSelecionado = document.getElementById(`btn-${tipoProposta}`);
                if (btnSelecionado) {
                    btnSelecionado.classList.add('selecionado');
                }
            } else {
                throw new Error("Tipo de proposta inválido.");
            }
        } else {
            console.error("ERRO: Falha ao carregar a proposta.", resposta.mensagem);
            document.body.innerHTML = `<div class="erro-container"><p class="erro-mensagem">${resposta.mensagem}</p><a href="index.html" class="btn-voltar-proposta"><i class="fas fa-arrow-left"></i> Voltar</a></div>`;
        }
    } catch (erro) {
        console.error("ERRO: Ocorreu um erro inesperado ao carregar a proposta.", erro);
        document.body.innerHTML = '<div class="erro-container"><p class="erro-mensagem">Ocorreu um erro inesperado. Por favor, tente novamente.</p><a href="index.html" class="btn-voltar-proposta"><i class="fas fa-arrow-left"></i> Voltar</a></div>';
    } finally {
        setTimeout(() => {
            esconderLoadingOverlay();
        }, 500);
    }
});


// Event Listeners para os botões de seleção (Premium/Acessível)
const btnPremium = document.getElementById('btn-premium');
const btnAcessivel = document.getElementById('btn-acessivel');

if (btnPremium && btnAcessivel) {
    btnPremium.addEventListener('click', () => {
        mostrarLoadingOverlay();

        const propostas = JSON.parse(localStorage.getItem('propostaData'));
        if (propostas && propostas.premium) {
            propostas.premium.tipo = 'premium';
            preencherDadosProposta(propostas.premium);
            atualizarImagemEquipamentos(propostas.premium);
            atualizarEtiquetasDinamicas('premium');
            atualizarImagemInstalacao(propostas.premium);
            preencherDetalhesInstalacao(propostas.premium);
            document.body.classList.add('theme-premium');
            document.body.classList.remove('theme-acessivel');
            btnPremium.classList.add('selecionado');
            btnAcessivel.classList.remove('selecionado');
        } else {
            console.error("ERRO: Dados da proposta Premium não encontrados no localStorage.");
        }

        setTimeout(() => {
            esconderLoadingOverlay();
        }, 400);
    });

    btnAcessivel.addEventListener('click', () => {
        mostrarLoadingOverlay();

        const propostas = JSON.parse(localStorage.getItem('propostaData'));
        if (propostas && propostas.acessivel) {
            propostas.acessivel.tipo = 'acessivel';
            preencherDadosProposta(propostas.acessivel);
            atualizarImagemEquipamentos(propostas.acessivel);
            atualizarEtiquetasDinamicas('acessivel');
            atualizarImagemInstalacao(propostas.acessivel);
            preencherDetalhesInstalacao(propostas.acessivel);
            document.body.classList.add('theme-acessivel');
            document.body.classList.remove('theme-premium');
            btnAcessivel.classList.add('selecionado');
            btnPremium.classList.remove('selecionado');
        } else {
            console.error("ERRO: Dados da proposta Acessível não encontrados no localStorage.");
        }

        setTimeout(() => {
            esconderLoadingOverlay();
        }, 400);
    });
}

const btnVoltar = document.querySelector('.btn-voltar-proposta');
if (btnVoltar) {
    btnVoltar.addEventListener('click', (evento) => {
        evento.preventDefault();
        mostrarLoadingOverlay();
        setTimeout(() => {
            window.location.href = btnVoltar.href;
        }, 400);
    });
}