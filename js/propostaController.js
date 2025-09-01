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
        // 1. Dados do Cliente
        console.log("DEBUG: Preenchendo dados do cliente...");
        const nomeClienteEl = document.getElementById('nome-cliente');

        // NOVO: Lógica para pegar apenas os dois primeiros nomes
        const nomeCompleto = dados.cliente || "Não informado";
        let nomeCurto = nomeCompleto;

        // Se o nome não for a string padrão "Não informado", processa
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
            // **NOVA LÓGICA AQUI**
            const tipoInstalacao = dados.sistema?.instalacaoPaineis || "Não informado";

            // Define o texto para o parágrafo
            instalacaoPaineisEl.innerText = tipoInstalacao;

            // Define a classe do ícone com base no tipo de instalação
            if (tipoInstalacao.toLowerCase().includes('telhado')) {
                // Altera apenas a classe do ícone para a casinha
                iconeInstalacaoEl.className = 'fas fa-house-chimney';
            } else if (tipoInstalacao.toLowerCase().includes('solo')) {
                // Altera apenas a classe do ícone para o painel solar
                iconeInstalacaoEl.className = 'fas fa-solar-panel';
            } else {
                // Caso a informação seja desconhecida
                iconeInstalacaoEl.className = 'fas fa-question-circle';
            }
        }

        const idealParaEl = document.getElementById('ideal-para');
        if (idealParaEl) {
            const idealPara = dados.sistema?.idealPara || 'R$ 0,00';
            // Garante que o valor venha sem o "R$" para o HTML
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

        const paybackEl = document.getElementById('payback');
        if (paybackEl) {
            if (dados.valores?.payback) {
                paybackEl.innerText = dados.valores.payback;
            } else {
                paybackEl.innerText = `${dados.valores?.paybackAnos || 0} anos e ${dados.valores?.paybackMeses || 0} meses`;
            }
        }
        console.log("DEBUG: Valores finais preenchidos com sucesso.");

        // 5. Parcelas
        console.log("DEBUG: Preenchendo parcelas...");
        for (const key in dados.valores?.parcelas || {}) {
            // CORRIGIDO: Usa querySelector para maior compatibilidade e robustez
            const elemento = document.querySelector(`#parcela-${key.replace('parcela-', '')}`);
            if (elemento) {
                elemento.innerText = dados.valores.parcelas[key] || 'N/A';
            } else {
                console.warn(`AVISO: Elemento de parcela '${key}' não encontrado.`);
            }
        }
        console.log("DEBUG: Parcelas preenchidas com sucesso.");

        // 6. Observações e Validade (Seções atualizadas)
        console.log("DEBUG: Preenchendo observações e validade...");
        const observacaoEl = document.getElementById('texto-observacao');
        const validadeEl = document.getElementById('texto-validade');

        if (observacaoEl) {
            observacaoEl.innerText = dados.valores?.observacao || "Não há observações sobre financiamento.";
        }

        if (validadeEl) {
            validadeEl.innerText = dados.validade || "Não informada";
        }
        console.log("DEBUG: Observações e validade preenchidas com sucesso.");
    } catch (error) {
        console.error("ERRO DENTRO DE preencherDadosProposta:", error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    //mostrarLoadingOverlay();
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
            // CORRIGIDO: Acessa a propriedade 'dados' do objeto de retorno
            const propostaData = resposta.dados;
            localStorage.setItem('propostaData', JSON.stringify(propostaData));

            console.log("DEBUG: Conteúdo de propostaData:", propostaData);

            document.body.classList.add('theme-premium');

            console.log("DEBUG: Chamando preencherDadosProposta...");
            preencherDadosProposta(propostaData.premium);

            console.log("DEBUG: Chamando atualizarImagemEquipamentos...");
            // CORRIGIDO: Agora a função recebe a proposta completa e usa a URL da imagem
            atualizarImagemEquipamentos(propostaData.premium);

            console.log("DEBUG: Chamando atualizarEtiquetasDinamicas...");
            atualizarEtiquetasDinamicas('premium');

            console.log("DEBUG: Chamando atualizarImagemInstalacao...");
            // CORRIGIDO: Agora a função recebe a proposta completa e usa a URL da imagem
            atualizarImagemInstalacao(propostaData.premium);

            console.log("DEBUG: Chamando preencherDetalhesInstalacao...");
            preencherDetalhesInstalacao(propostaData.premium);

            console.log("DEBUG: Preenchimento inicial concluído.");

            //esconderLoadingOverlay();

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
                //mostrarLoadingOverlay();
                preencherDadosProposta(propostas.premium);
                // CORRIGIDO: Funções de imagem atualizadas
                atualizarImagemEquipamentos(propostas.premium);
                atualizarEtiquetasDinamicas('premium');
                atualizarImagemInstalacao(propostas.premium);
                preencherDetalhesInstalacao(propostas.premium);
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
            console.log("DEBUG: Clicado no botão '+Acessível'. Carregando dados +Acessível...");
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