import { getSelicTaxa } from './api.js';
import { validarValidadeProposta, verificarAcessoDispositivo, calcularFinanciamento, calcularParcelasCartao } from './model.js';
import { mostrarLoadingOverlay, esconderLoadingOverlay, exibirMensagemBloqueio, organizarSecaoConfiabilidade, criarBlocoLinhaTecnica } from './utils.js';

// FUNÇÃO CORRIGIDA: Gerencia a nova imagem da marca de equipamentos
function atualizarImagemEquipamentos(proposta) {
    return new Promise((resolve, reject) => {
        let imagemEquipamentos;
        
        imagemEquipamentos = document.getElementById('imagem-marca-equipamento');

        if (!imagemEquipamentos) {
            return resolve(); // Resolve a promise se o elemento não existe, para não travar a aplicação.
        }

        // 2. Define o caminho da imagem
        const imageUrl = proposta.equipamentos?.imagem || '';

        // Se a URL não mudou e não está vazia, resolve imediatamente.
        if (imagemEquipamentos.src && imagemEquipamentos.src.endsWith(imageUrl) && imageUrl !== '') {
            return resolve();
        }

        // 3. Define os Handlers (Load e Error)
        const handleLoad = () => {
            imagemEquipamentos.style.display = ''; // Garante que esteja visível se carregar
            imagemEquipamentos.removeEventListener('load', handleLoad);
            imagemEquipamentos.removeEventListener('error', handleError);
            resolve(); // Resolve a Promise com sucesso
        };

        const handleError = () => {
            console.error(`ERRO: Falha ao carregar a imagem de marca: ${imageUrl}`);
            imagemEquipamentos.style.display = 'none'; // Oculta a imagem quebrada
            imagemEquipamentos.removeEventListener('load', handleLoad);
            imagemEquipamentos.removeEventListener('error', handleError);
            resolve(); // Resolve mesmo com erro para não travar a aplicação
        };

        imagemEquipamentos.addEventListener('load', handleLoad);
        imagemEquipamentos.addEventListener('error', handleError);

        // 4. Inicia o Carregamento
        imagemEquipamentos.src = imageUrl;

        // 5. Verificação de Cache (Robusta)
        if (imagemEquipamentos.complete && imagemEquipamentos.naturalWidth !== 0) {
            setTimeout(handleLoad, 10);
        }
    });
}

function atualizarEtiquetasDinamicas(tipo) {
    const etiquetas = document.querySelectorAll('.etiqueta-proposta-dinamica:not(.etiqueta-a-vista)');
    const texto = tipo === 'premium' ? 'Premium' : 'Standard';
    etiquetas.forEach(etiqueta => {
        etiqueta.innerText = texto;
    });
}

function preencherDetalhesInstalacao(proposta) {
    const secaoDetalhes = document.getElementById('detalhes-instalacao');
    if (!secaoDetalhes) {
        return;
    }

    secaoDetalhes.innerHTML = '';
    const detalhes = proposta.instalacao?.detalhesInstalacao;

    if (!detalhes || detalhes.length === 0) {
        secaoDetalhes.innerHTML = '<p>Nenhum detalhe de instalação disponível.</p>';
        return;
    }


    // NOVO: Adiciona um título interno à seção de detalhes
    const tituloDetalhes = document.createElement('h3');
    tituloDetalhes.className = 'titulo-interno-detalhes';
    tituloDetalhes.innerText = 'O que está incluso:';
    secaoDetalhes.appendChild(tituloDetalhes);

    detalhes.forEach((detalhe, index) => {
        const textoFormatado = detalhe.texto
            .replace(/\*\*(.*?)\*\*/g, '<strong class="texto-destaque">$1</strong>') // Formata negrito
            .replace(/<br><br>/g, '</p><p class="texto-detalhe">');

        const div = document.createElement('div');
        // ATUALIZADO: Usa a nova classe de storytelling .bloco-animado
        div.className = 'card-item-detalhe bloco-animado';
        // A cascata de delay agora é tratada via CSS (nth-child) ou pode ser mantida inline se preferir controle fino
        div.style.transitionDelay = `${index * 0.1}s`; 

        // Estrutura de card com ícone, título (se houver) e texto. O ícone é dinâmico.
        div.innerHTML = `
            <div class="icone-container-detalhe">
                <i class="fas ${detalhe.icone} icone-detalhe"></i>
            </div>
            <div class="texto-container-detalhe">
                ${detalhe.titulo ? `<h4 class="titulo-card-detalhe">${detalhe.titulo}</h4>` : ''}
                <p class="texto-detalhe">${textoFormatado}</p>
                ${detalhe.microtexto ? `<p class="microtexto-detalhe">${detalhe.microtexto}</p>` : ''}
            </div>
        `;
        secaoDetalhes.appendChild(div);
    });
}

function preencherChecklistInstalacao(proposta) {
    const container = document.getElementById('checklist-instalacao-container');
    if (!container) return;

    const checklist = proposta.instalacao?.checklist;
    if (!checklist || checklist.length === 0) {
        container.innerHTML = '';
        return;
    }

    const tipoClasse = proposta.tipo === 'premium' ? 'checklist-premium' : 'checklist-standard';
    const listaHTML = checklist.map(item => `<li>${item}</li>`).join('');

    container.innerHTML = `<ul class="checklist ${tipoClasse}">${listaHTML}</ul>`;
}

// --- FUNÇÃO CENTRAL DE PREENCHIMENTO ATUALIZADA ---
function preencherDadosProposta(dados) {
    try {
        // 1. Dados do Cliente
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
        
        // 2. Sistema Proposto (Lógica Solar)
        const geracaoMediaEl = document.getElementById('geracao-media');
        const unidadeGeracaoEl = document.getElementById('unidade-geracao');
        const instalacaoPaineisEl = document.getElementById('instalacao-paineis');
        const iconeInstalacaoEl = document.getElementById('icone-instalacao');
        const idealParaEl = document.getElementById('ideal-para');
        const tituloSistemaEl = document.getElementById('titulo-sistema');
        
        // NOVO: Seleciona os elementos da nova seção de expansão
        const secaoExpansao = document.getElementById('secao-expansao');
        const expansaoCapacidadeValorEl = document.getElementById('expansao-capacidade-valor');
        const expansaoIdealValorEl = document.getElementById('expansao-ideal-valor');
        const expansaoModulosValorEl = document.getElementById('expansao-modulos-valor');

        if (tituloSistemaEl) tituloSistemaEl.innerText = 'Sistema Proposto';
        if (geracaoMediaEl) {
            const geracaoMedia = dados.sistema?.geracaoMedia;
            const geracaoMediaSplit = typeof geracaoMedia === 'string' ? geracaoMedia.split(' ') : ['N/A', ''];
            geracaoMediaEl.innerText = geracaoMediaSplit[0];
            if (unidadeGeracaoEl) unidadeGeracaoEl.innerText = geracaoMediaSplit.slice(1).join(' ');
        }
        if (instalacaoPaineisEl) instalacaoPaineisEl.innerText = dados.sistema?.instalacaoPaineis || 'Não informado';
        if (iconeInstalacaoEl) {
            const tipoInstalacao = dados.sistema?.instalacaoPaineis || "Não informado";
            if (tipoInstalacao.toLowerCase().includes('telhado')) {
                iconeInstalacaoEl.className = 'fas fa-house-chimney';
            } else if (tipoInstalacao.toLowerCase().includes('solo')) {
                iconeInstalacaoEl.className = 'fas fa-solar-panel';
            } else {
                iconeInstalacaoEl.className = 'fas fa-question-circle';
            }
        }
        if (idealParaEl) idealParaEl.innerText = dados.sistema?.idealPara || 'R$ 0,00';

        // --- Lógica para a NOVA seção de Expansão ---
        const getValorExpansao = (chave) => {
            if (!dados.variables || !Array.isArray(dados.variables)) {
                return undefined;
            }
            const item = dados.variables.find(v => v && v.key === chave);
            if (item) {
                const valor = item.formattedValue || item.value;
                return valor;
            }
            return undefined;
        };

        const valExpansao = getValorExpansao('vc_vc_exp_max_em_mod_no_sistema_temp');
        const modulosParaExpandirRaw = String(valExpansao || '0');
        const modulosParaExpandirNum = parseInt(modulosParaExpandirRaw.replace(/\D/g, ''), 10) || 0;

        if (secaoExpansao) {
            const temExpansao = modulosParaExpandirNum > 0;
            secaoExpansao.classList.toggle('oculto', !temExpansao);
            
            if (temExpansao) {
                if (expansaoCapacidadeValorEl) {
                    expansaoCapacidadeValorEl.innerText = getValorExpansao('vc_ger_max_com_exp') || 'N/A';
                }
                if (expansaoIdealValorEl) {
                    const idealParaRaw = getValorExpansao('vc_valor_aprox_cons_expans') || 'N/A';
                    expansaoIdealValorEl.innerText = String(idealParaRaw).replace(/Contas de até/i, '').trim();
                }
                if (expansaoModulosValorEl) {
                    expansaoModulosValorEl.innerText = valExpansao || 'N/A';
                }
            }
        }

        // 3. Equipamentos (Lógica Solar)
        const tituloEquipamentosEl = document.getElementById('titulo-equipamentos');
        const descricaoInversorEl = document.getElementById('descricao-inversor');
        const quantidadeInversorEl = document.getElementById('quantidade-inversor');
        const descricaoPainelEl = document.getElementById('descricao-painel');
        const quantidadePainelEl = document.getElementById('quantidade-painel');
        const painelBox = document.getElementById('painel-box');
        const inversorBox = document.getElementById('inversor-box');

        if (tituloEquipamentosEl) tituloEquipamentosEl.innerText = 'Equipamentos do Sistema';
        if (painelBox) painelBox.classList.remove('oculto');
        if (inversorBox) inversorBox.classList.remove('oculto');
        if (descricaoInversorEl) descricaoInversorEl.innerText = dados.equipamentos?.descricaoInversor || "Não informado";
        if (quantidadeInversorEl) quantidadeInversorEl.innerText = `${dados.equipamentos?.quantidadeInversor || 0}`;
        if (descricaoPainelEl) descricaoPainelEl.innerText = dados.equipamentos?.descricaoPainel || "Não informado";
        if (quantidadePainelEl) quantidadePainelEl.innerText = `${dados.equipamentos?.quantidadePainel || 0}`;

        // 4. Valores Finais e Financiamento (Lógica Solar)
        const valorTotalEl = document.getElementById('valor-total');
        const paybackContainer = document.getElementById('payback-container');
        const inputEntrada = document.getElementById('valor-entrada-input');

        if (valorTotalEl) valorTotalEl.innerText = dados.valores?.valorTotal || "Não informado";
        const paybackValorEl = document.getElementById('payback-valor');
        if (paybackValorEl) {
            paybackValorEl.innerText = dados.valores?.payback || 'Não informado';
        } else {
            console.error("ERRO: Elemento com ID 'payback-valor' não encontrado no DOM.");
        }
        if (paybackContainer) paybackContainer.classList.remove('oculto');
        
        // --- RECONSTRUÇÃO DA SEÇÃO FINANCEIRA (Card Único + Tabela) ---
        const containerValores = document.querySelector('.valores-container');
        const opcoesParcelas = [12, 24, 36, 48, 60, 72, 84];
        const opcoesCartao = ['debito', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

        if (containerValores) {
            // Preserva o card total (que está no final)
            const cardTotal = containerValores.querySelector('.card-total');
            
            // Remove elementos antigos de financiamento/cartão (tudo exceto card-total, detalhamento e validade)
            Array.from(containerValores.children).forEach(child => {
                const isCardTotal = child.classList.contains('card-total');
                const isDetalhamento = child.id === 'detalhamento-pagamento-container';
                const isValidade = child.querySelector && child.querySelector('#texto-validade');

                if (!isCardTotal && !isDetalhamento && !isValidade) {
                    child.remove();
                }
            });

            // HTML Financiamento (Card 60x + Tabela)
            const htmlFinanciamento = `
                <div class="titulo-secao-financiamento" style="width: 100%; text-align: center; margin-bottom: 10px;">
                    <h3 style="font-size: 1.2rem; color: var(--cor-texto-secundario); font-weight: 500;">Financiamento Bancário</h3>
                </div>
                
                <div class="card-destaque-unico bloco-animado">
                    <div class="info-parcela">60x de</div>
                    <div class="valor-parcela">R$ <span id="destaque-fin-60">...</span></div>
                </div>

                <table class="tabela-simulacao bloco-animado">
                    <thead><tr><th>Parcelas</th><th>Valor</th></tr></thead>
                    <tbody id="tbody-financiamento"></tbody>
                </table>

                <div class="secao-observacao-container" style="border: none; padding: 10px 0;">
                    <p class="texto-observacao" style="font-size: 0.85rem;"><span style="color: var(--cor-primaria); font-weight: bold;">*</span> <span id="texto-observacao">${dados.valores?.observacao || ''}</span></p>
                </div>
            `;

            // HTML Cartão (Card 12x + Tabela)
            const htmlCartao = `
                <div class="titulo-parcelamento" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 30px; margin-bottom: 10px;">
                    <i class="fas fa-credit-card" style="color: var(--cor-primaria); font-size: 1.5rem;"></i>
                    <span style="font-size: 1.2rem; font-weight: 500; color: var(--cor-texto-secundario);">Parcelamento no Cartão</span>
                </div>

                <div class="card-destaque-unico bloco-animado">
                    <div class="info-parcela">12x de</div>
                    <div class="valor-parcela">R$ <span id="destaque-cc-12">...</span></div>
                </div>

                <table class="tabela-simulacao bloco-animado">
                    <thead><tr><th>Parcelas</th><th>Valor</th></tr></thead>
                    <tbody id="tbody-cartao"></tbody>
                </table>

                <div class="secao-observacao-container" style="border: none; padding: 10px 0;">
                    <p class="texto-observacao" style="font-size: 0.85rem;"><span style="color: var(--cor-primaria); font-weight: bold;">*</span> Simulação sujeita a reajuste...</p>
                </div>
            `;

            // Insere o novo conteúdo antes do card-total
            const divWrapper = document.createElement('div');
            divWrapper.innerHTML = htmlFinanciamento + htmlCartao;
            while (divWrapper.firstChild) {
                containerValores.insertBefore(divWrapper.firstChild, cardTotal);
            }
        }

        // Preenche Tabela Financiamento
        const tbodyFin = document.getElementById('tbody-financiamento');
        const destaqueFin60 = document.getElementById('destaque-fin-60');
        if (tbodyFin && dados.valores?.parcelas) {
            tbodyFin.innerHTML = '';
            opcoesParcelas.forEach(n => {
                const valor = dados.valores.parcelas[`parcela-${n}`] || 'N/A';
                const row = `<tr><td>${n}x</td><td><strong>R$ <span id="val-fin-${n}">${valor}</span></strong></td></tr>`;
                tbodyFin.insertAdjacentHTML('beforeend', row);
                if (n === 60 && destaqueFin60) destaqueFin60.innerText = valor;
            });
        }

        // Preenche Tabela Cartão
        const tbodyCartao = document.getElementById('tbody-cartao');
        const destaqueCC12 = document.getElementById('destaque-cc-12');
        if (tbodyCartao && dados.valores?.parcelasCartao) {
            tbodyCartao.innerHTML = '';
            opcoesCartao.forEach(key => {
                const valor = dados.valores.parcelasCartao[`parcela-${key}`] || 'N/A';
                const label = key === 'debito' ? 'Débito' : `${key}x`;
                const row = `<tr><td>${label}</td><td><strong>R$ <span id="val-cc-${key}">${valor}</span></strong></td></tr>`;
                tbodyCartao.insertAdjacentHTML('beforeend', row);
                if (key === '12' && destaqueCC12) destaqueCC12.innerText = valor;
            });
        }

        // ============================================================
        // 🧠 LÓGICA DE SIMULAÇÃO DE ENTRADA (Financiamento + Cartão)
        // ============================================================
        if (inputEntrada && dados.valores?.valorTotalNum) {
            // 1. Clona o input para remover listeners antigos (evita duplicação ao trocar proposta)
            const novoInput = inputEntrada.cloneNode(true);
            inputEntrada.parentNode.replaceChild(novoInput, inputEntrada);
            
            // 2. Zera o valor e reseta o feedback visual
            novoInput.value = "";
            const feedbackEl = document.getElementById('feedback-entrada');
            if (feedbackEl) {
                feedbackEl.innerText = "";
                feedbackEl.className = "feedback-entrada";
            }

            const valorTotalProjeto = dados.valores.valorTotalNum;
            const selic = dados.valores.selicAtual || 11.25; // Fallback seguro

            // Formata o input como moeda enquanto digita
            novoInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, "");
                value = (parseInt(value) / 100).toFixed(2) + "";
                if (value === "NaN") value = "0.00";
                e.target.value = value.replace(".", ","); // Apenas visual simples
                
                // Debounce simples para recálculo
                clearTimeout(window.delayCalculo);
                window.delayCalculo = setTimeout(() => {
                    recalcularSimulacoes(parseFloat(value));
                }, 500);
            });

            function recalcularSimulacoes(valorEntrada) {
                // Regras de Negócio
                const metadeValor = valorTotalProjeto / 2;

                // Limpa estados anteriores
                feedbackEl.innerText = "";
                feedbackEl.className = "feedback-entrada";

                if (valorEntrada === 0) {
                    // Se entrada for 0, restaura valores originais (Financiamento 100%)
                    atualizarDOMParcelas(valorTotalProjeto);
                    return;
                }

                if (valorEntrada >= valorTotalProjeto) {
                    feedbackEl.innerText = "A entrada não pode ser igual ou maior que o valor total.";
                    feedbackEl.classList.add('feedback-erro');
                    return;
                }

                if (valorEntrada < metadeValor) {
                    feedbackEl.innerText = `Entrada mínima permitida: 50% (R$ ${metadeValor.toLocaleString('pt-BR', {minimumFractionDigits: 2})})`;
                    feedbackEl.classList.add('feedback-erro');
                    // Opcional: Não atualiza os valores se a regra for violada, ou atualiza mostrando erro.
                    // Decisão: Não atualizar para não mostrar simulação inválida.
                    return;
                }

                // Se passou nas validações, calcula o saldo a financiar/parcelar
                const saldoDevedor = valorTotalProjeto - valorEntrada;
                feedbackEl.innerText = `Simulando saldo restante de: R$ ${saldoDevedor.toLocaleString('pt-BR', {minimumFractionDigits: 2})})`;
                feedbackEl.classList.add('feedback-info');

                atualizarDOMParcelas(saldoDevedor);
            }

            function atualizarDOMParcelas(valorBase) {
                // 1. Recalcula Financiamento Bancário
                const { parcelas: novasParcelasFinan } = calcularFinanciamento(valorBase, selic);
                opcoesParcelas.forEach(n => {
                    // Atualiza células da tabela
                    const el = document.getElementById(`val-fin-${n}`);
                    if (el) el.innerText = novasParcelasFinan[`parcela-${n}`] || '---';
                    // Atualiza destaque 60x
                    if (n === 60 && destaqueFin60) destaqueFin60.innerText = novasParcelasFinan[`parcela-${n}`];
                });

                // 2. Recalcula Cartão de Crédito
                const { parcelas: novasParcelasCartao } = calcularParcelasCartao(valorBase, selic);
                opcoesCartao.forEach(i => {
                    // Atualiza células da tabela
                    const el = document.getElementById(`val-cc-${i}`);
                    if (el) el.innerText = novasParcelasCartao[`parcela-${i}`] || '---';
                    // Atualiza destaque 12x
                    if (i === '12' && destaqueCC12) destaqueCC12.innerText = novasParcelasCartao[`parcela-${i}`];
                });
            }
        }
        

        // NOVO: Preenchimento do Detalhamento de Pagamento (Equipamentos vs Serviços)
        const detalhamentoContainer = document.getElementById('detalhamento-pagamento-container');
        if (detalhamentoContainer) {
            const detalhe = dados.valores?.detalhamento;
            
            if (detalhe) {
                detalhamentoContainer.classList.remove('oculto');
                
                // Helper para formatar moeda sem R$
                const fmt = (val) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                // 1. Preenche o Resumo (Topo)
                document.getElementById('resumo-valor-equipamentos').innerText = fmt(detalhe.equipamentos);
                document.getElementById('resumo-valor-servicos').innerText = fmt(detalhe.servicosTotal);
                
                // 2. Preenche o Fluxo Cronológico
                document.getElementById('fluxo-valor-entrada').innerText = fmt(detalhe.servicoEntrada);
                document.getElementById('fluxo-valor-equipamentos').innerText = fmt(detalhe.equipamentos);
                document.getElementById('fluxo-valor-entrega').innerText = fmt(detalhe.servicoEntrega);
                document.getElementById('fluxo-valor-conclusao').innerText = fmt(detalhe.servicoConclusao);
            }
            // Removido o 'else' que ocultava a seção, já que você quer que ela apareça.
            // Se os dados não existirem, os campos ficarão vazios ou com o valor padrão do HTML.
        }

        // 5. Observações e Validade
        const observacaoEl = document.getElementById('texto-observacao');
        const validadeEl = document.getElementById('texto-validade');
        const resumoContainerEl = document.getElementById('resumo-instalacao-container');

        // NOVO: Adiciona o selo premium
        const seloPremiumEl = document.getElementById('selo-premium');
        if (seloPremiumEl) {
            seloPremiumEl.classList.toggle('oculto', dados.tipo !== 'premium');
        }

        // Atualiza o destaque do título da seção de instalação
        const tituloSecaoInstalacaoEl = document.getElementById('titulo-secao-instalacao') || document.querySelector('#secao-instalacao .titulo-secao');
        if (tituloSecaoInstalacaoEl) {
            // 1. Define apenas o título principal (mantendo a linha de destaque do CSS no H2)
            const tituloPremium = 'Padrão de Instalação <span id="tipo-instalacao-destaque">Premium</span>';
            const tituloStandard = 'Padrão de Instalação <span id="tipo-instalacao-destaque">Standard</span>';
            tituloSecaoInstalacaoEl.innerHTML = dados.tipo === 'premium' ? tituloPremium : tituloStandard;

            // 2. Insere a descrição como um elemento separado APÓS o H2
            let subtituloEl = tituloSecaoInstalacaoEl.nextElementSibling;
            
            // Cria o elemento se não existir ou se o próximo não for o nosso subtítulo
            if (!subtituloEl || !subtituloEl.classList.contains('subtitulo-instalacao')) {
                subtituloEl = document.createElement('p');
                subtituloEl.className = 'subtitulo-instalacao';
                tituloSecaoInstalacaoEl.after(subtituloEl);
            }

            // Define estilos dinâmicos (atualizados a cada troca de proposta)
            const corTexto = dados.tipo === 'premium' ? '#FFFFFF' : '#666666';
            if (dados.tipo === 'premium') {
                subtituloEl.style.cssText = `display: block; font-size: 1.1em; color: #B0B0B0; font-weight: normal; margin-top: 5px; margin-bottom: 25px; text-align: center; width: 100%;`;
                subtituloEl.innerHTML = `Projeto pensado — <span style="color: #FFFFFF;">Para consumidores mais exigentes.</span>`;
            } else {
                subtituloEl.style.display = 'none';
                subtituloEl.innerHTML = '';
            }
        }

        // NOVO: Injeção do Bloco de Storytelling Técnico (Linha Animada)
        // Insere antes da lista de detalhes para criar contexto de valor
        const containerDetalhes = document.getElementById('detalhes-instalacao');
        if (containerDetalhes) {
            const elementoAnterior = containerDetalhes.previousElementSibling;
            const blocoExiste = elementoAnterior && elementoAnterior.classList.contains('bloco-linha');

            if (dados.tipo === 'premium') {
                if (!blocoExiste) {
                    const textoTecnico = "Decisões técnicas influenciam o desempenho ao longo do tempo. <strong>Expertise na fase de concepção garante a integridade operacional por longo prazo.</strong>";
                    const blocoTecnico = criarBlocoLinhaTecnica(textoTecnico);
                    containerDetalhes.parentNode.insertBefore(blocoTecnico, containerDetalhes);
                }
            } else if (blocoExiste) {
                // Remove o bloco se estiver na proposta Standard
                elementoAnterior.remove();
            }
        }

        if (observacaoEl) observacaoEl.innerText = dados.valores?.observacao || "Não há observações sobre financiamento.";
        if (validadeEl) validadeEl.innerText = dados.validade || "Não informada";

        // --- Lógica de Visibilidade de Seções Exclusivas Premium ---
        const isPremium = dados.tipo === 'premium';
        
        const secoesMicroAutoridade = document.querySelectorAll('.micro-autoridade');
        secoesMicroAutoridade.forEach(secao => secao.classList.toggle('oculto', !isPremium));

        const secaoAutoridade = document.querySelector('.bloco-autoridade');
        if (secaoAutoridade) secaoAutoridade.classList.toggle('oculto', !isPremium);

        // NOVO: Controla a visibilidade da Frase de Ouro (Combo de Autoridade)
        const secaoFraseOuro = document.getElementById('secao-frase-ouro');
        if (secaoFraseOuro) secaoFraseOuro.classList.toggle('oculto', !isPremium);

        // CORREÇÃO: Oculta todo o container do resumo se não houver texto.
        // NOVO: Adiciona o bloco de alerta para a proposta Standard
        const alertaDecisaoEl = document.getElementById('alerta-decisao');
        if (alertaDecisaoEl) {
            alertaDecisaoEl.classList.toggle('oculto', dados.tipo !== 'acessivel');
        }


        if (resumoContainerEl) {
            // REMOVIDO: Oculta o resumo da instalação conforme solicitado
            resumoContainerEl.classList.add('oculto');
            resumoContainerEl.innerHTML = '';
        }

        // NOVO: Atualiza o texto do Modal de Aceite Consciente com a versão de Engenharia Consultiva
        const modalAceite = document.getElementById('proposalModal');
        if (modalAceite && dados.dadosAceite?.texto) {
            const onboardingText = modalAceite.querySelector('.onboarding-text');
            if (onboardingText) {
                onboardingText.innerHTML = dados.dadosAceite.texto;
            }
        }

        // NOVO: Organiza a seção de confiabilidade e garantias
        organizarSecaoConfiabilidade();

        // REORDENAÇÃO DE SEÇÃO: Move "Padrão de Instalação" para antes de "Sua Proposta Inclui"
        const secaoInstalacao = document.getElementById('secao-instalacao');
        const secoes = Array.from(document.querySelectorAll('.secao-principal'));
        // Encontra a seção pelo título, já que ela não tem ID
        const secaoEscopo = secoes.find(s => s.querySelector('h2.titulo-secao')?.textContent.includes('Sua Proposta Inclui'));

        if (secaoInstalacao && secaoEscopo) {
            secaoEscopo.parentNode.insertBefore(secaoInstalacao, secaoEscopo);
        }

    } catch (error) {
        console.error("ERRO DENTRO DE preencherDadosProposta:", error);
    }
}

// --- FUNÇÃO LOCAL DE SCROLL STORYTELLING (Mais sensível) ---
function iniciarAnimacaoScroll() {
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px', // Dispara um pouco antes do elemento estar totalmente visível
        threshold: 0.05 // Dispara assim que 5% do elemento estiver visível (evita espaços vazios)
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.bloco-animado').forEach(el => {
        observer.observe(el);
    });
}

// --- Função principal de inicialização ---
async function carregarProposta(idProposta) {
    document.addEventListener('contextmenu', function(evento) {
        evento.preventDefault();
    });
    document.addEventListener('keydown', function(evento) { // This listener might be added multiple times. It's better to have it in DOMContentLoaded. I'll move it.
        if ((evento.ctrlKey || evento.metaKey) && evento.key === 'p') {
            evento.preventDefault();
        }
        if (evento.key === 'F12') {
            evento.preventDefault();
        }
    });
    // --- Lógica do Modal de Aceite Consciente (Movido do HTML) ---
    const modalAceite = document.getElementById('proposalModal');
    const checkboxAceite = document.getElementById('acceptProposal');
    const btnConfirmarAceite = document.getElementById('confirmProposal');

    if (modalAceite && checkboxAceite && btnConfirmarAceite) {
        checkboxAceite.addEventListener('change', function () {
            btnConfirmarAceite.disabled = !this.checked;
        });

        btnConfirmarAceite.addEventListener('click', function () {
            modalAceite.classList.add('fade-out');
            setTimeout(() => {
                modalAceite.style.display = 'none';
                document.body.classList.remove('awaiting-acceptance');
                localStorage.setItem('aceiteConsciente', 'true');
            }, 500);
        });
    }

    // 2. Lógica da Interação de Clique (Toggle)
    const itemsDeConsciencia = document.querySelectorAll('.consciencia-item');
    if (itemsDeConsciencia.length > 0) {
        itemsDeConsciencia.forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('active');
            });
        });
    }

    const seletorTipoProposta = document.querySelector('.seletor-tipo-proposta');
    const btnPremium = document.getElementById('btn-premium');
    const btnAcessivel = document.getElementById('btn-acessivel');
    const btnVoltar = document.querySelector('.btn-voltar-proposta');

    // Função para exibir aviso amigável (Modal)
    function exibirAvisoAmigavel(titulo, mensagem, urlDestino) {
        const modal = document.getElementById('modal-aviso');
        const elTitulo = document.getElementById('titulo-aviso');
        const elMsg = document.getElementById('mensagem-aviso');
        const btn = document.getElementById('btn-aviso');
        const icone = document.getElementById('icone-aviso');

        if (modal && elTitulo && elMsg && btn) {
            elTitulo.innerText = titulo;
            elMsg.innerHTML = mensagem;
            
            if (titulo.toLowerCase().includes('expirada') || titulo.toLowerCase().includes('validade')) {
                icone.className = 'fas fa-clock';
                icone.style.color = '#f59e0b'; // Amber
            } else {
                icone.className = 'fas fa-exclamation-circle';
                icone.style.color = '#ef4444'; // Red
            }

            modal.classList.remove('oculto');
            esconderLoadingOverlay(); // Garante que o loading saia

            btn.onclick = function() {
                window.location.href = urlDestino;
            };
        } else {
            // Fallback caso o modal não exista no DOM
            alert(mensagem.replace(/<br>/g, '\n'));
            window.location.href = urlDestino;
        }
    }

    // =================================================================
    // 🌟 REESTRUTURAÇÃO: Variáveis do Carrossel e Modal (Corrigindo ReferenceError)
    // =================================================================
    const installationImage = document.getElementById('imagem-instalacao');
    const prevImageBtn = document.getElementById('prev-image-btn');
    const nextImageBtn = document.getElementById('next-image-btn');

    // Elementos do MODAL (Popup)
    const modalCarrossel = document.getElementById('modal-carrossel');
    const imagemModal = document.getElementById('imagem-modal');
    const fecharModalBtn = document.getElementById('fechar-modal-btn');
    const prevModalBtn = document.getElementById('prev-modal-btn');
    const nextModalBtn = document.getElementById('next-modal-btn');

    const imagePaths = {
        premium: [
            'imagens/inst_premium_1a.webp',
            'imagens/inst_premium_2a.webp',
            'imagens/inst_premium_3a.webp',
            'imagens/inst_premium_4a.webp',
            'imagens/inst_premium_5a.webp',
            'imagens/inst_premium_6a.webp',
            'imagens/inst_premium_7a.webp',
            'imagens/mod_1.webp',
            'imagens/mod_2.webp'
        ],
        acessivel: [
            'imagens/inst_acessível_1.webp',
            'imagens/mod_1.webp',
            'imagens/mod_2.webp'
        ]
    };

    let currentProposalType = 'premium';
    let carouselInterval; // Variável para armazenar o ID do intervalo do carrossel
    let currentImageIndex = 0;
    const preloadedImages = {};

    // =================================================================
    // 🌟 FUNÇÕES DO CARROSSEL E MODAL
    // =================================================================

    function showImage(index) {
        return new Promise((resolve) => { // AGORA RETORNA UMA PROMISE!
            const currentImageSet = imagePaths[currentProposalType];
            if (!currentImageSet || currentImageSet.length === 0) return resolve(); // Se não houver imagens, resolve imediatamente.

            currentImageIndex = (index + currentImageSet.length) % currentImageSet.length;
            const imageUrl = currentImageSet[currentImageIndex];

            // Transição suave ao trocar a imagem
            if (installationImage) installationImage.style.opacity = '0.5';

            // Remove quaisquer listeners anteriores para evitar múltiplas execuções
            if (installationImage._handleLoad) {
                installationImage.removeEventListener('load', installationImage._handleLoad);
                installationImage.removeEventListener('error', installationImage._handleError);
            }

            // Define os handlers (usando arrow functions para manter o 'this' implícito para o resolve)
            const handleLoad = () => {
                if (installationImage) installationImage.style.opacity = '1';
                installationImage.removeEventListener('load', handleLoad);
                installationImage.removeEventListener('error', handleError);
                resolve(); // 👈🏼 RESOLVE A PROMISE AQUI!
            };

            const handleError = () => {
                console.error("ERRO: Falha ao carregar a imagem:", imageUrl);                
                if (installationImage) installationImage.style.opacity = '1'; // Mostra mesmo se quebrar
                installationImage.removeEventListener('load', handleLoad);
                installationImage.removeEventListener('error', handleError);
                resolve(); // 👈🏼 RESOLVE A PROMISE MESMO COM ERRO para não travar o app.
            };

            // Armazena os handlers no elemento
            installationImage._handleLoad = handleLoad;
            installationImage._handleError = handleError;

            // 2. Anexa os Event Listeners ANTES de mudar o src
            installationImage.addEventListener('load', handleLoad);
            installationImage.addEventListener('error', handleError);

            // 3. Inicia o Carregamento
            installationImage.src = imageUrl;

            // 4. VERIFICAÇÃO DE CACHE ROBUSTA
            if (installationImage.complete && installationImage.naturalWidth !== 0) {
                setTimeout(handleLoad, 10);
            }

            // Atualiza a visibilidade dos botões de navegação.
            const showNav = currentImageSet.length > 1;
            prevImageBtn.classList.toggle('oculto', !showNav);
            nextImageBtn.classList.toggle('oculto', !showNav);
        });
    }

    function switchProposalType(type) {
        if (currentProposalType === type && installationImage.src) return Promise.resolve(); // Adiciona Promise
        currentProposalType = type;
        return showImage(0); // Retorna a Promise de showImage
    }

    function stopCarouselAutoPlay() {
        clearInterval(carouselInterval);
    }

    function startCarouselAutoPlay() {
        stopCarouselAutoPlay(); // Garante que apenas um intervalo esteja ativo
        const currentImageSet = imagePaths[currentProposalType];
        if (currentImageSet && currentImageSet.length > 1) {
            carouselInterval = setInterval(() => {
                showImage(currentImageIndex + 1);
            }, 5000);
        }
    }

    function mostrarModal() {
        if (modalCarrossel) {
            modalCarrossel.classList.remove('oculto');
            stopCarouselAutoPlay(); // Pausa o carrossel automático ao abrir o modal
            document.body.classList.add('modal-aberta'); // Bloqueia o scroll de fundo
        }
    }

    function esconderModal() {
        if (modalCarrossel) {
            startCarouselAutoPlay(); // Retoma o carrossel automático ao fechar o modal
            modalCarrossel.classList.add('oculto');
            document.body.classList.remove('modal-aberta');
        }
    }

    // Adaptação da função showImage para o Modal
    function showImageInModal(index) {
        const currentImageSet = imagePaths[currentProposalType];
        if (!currentImageSet || currentImageSet.length === 0) return;

        currentImageIndex = (index + currentImageSet.length) % currentImageSet.length;
        const imageUrl = currentImageSet[currentImageIndex];

        // Aqui usamos a imagem do modal
        if (imagemModal) imagemModal.src = imageUrl;

        // Atualiza a visibilidade dos botões de navegação do modal
        const showNav = currentImageSet.length > 1;
        if (prevModalBtn) prevModalBtn.classList.toggle('oculto', !showNav);
        if (nextModalBtn) nextModalBtn.classList.toggle('oculto', !showNav);
    }

    // Inicia o pré-carregamento em segundo plano
    Object.values(imagePaths).flat().forEach(url => {
        if (!preloadedImages[url]) {
            const img = new Image();
            img.src = url;
            preloadedImages[url] = img;
        }
    });
    // =================================================================
    // 🚦 INÍCIO DA LÓGICA DE CARREGAMENTO DA PÁGINA
    // =================================================================

    // CORREÇÃO: Mover a declaração de 'propostas' para fora do try para ser acessível no 'finally'
    let propostas;
    let redirecionando = false; // Flag para evitar flash de conteúdo em redirecionamentos

    if (idProposta) {
        try {
            propostas = await buscarPropostaPorId(idProposta);

            if (!propostas.sucesso) {
                let msgErro = 'Não foi possível localizar esta proposta. Verifique o link ou entre em contato.';
                if (propostas.mensagem && propostas.mensagem.includes('expirada')) {
                    msgErro = 'Esta proposta excedeu o prazo de validade.';
                }
                exibirAvisoAmigavel('Atenção', msgErro, 'index.html'); // Outros erros
                redirecionando = true;
                return;
            }

            const propostaData = propostas.dados;

            let propostaParaExibir;
            let initialThemeClass;
            let initialButtonToSelect;

            // 1. VALIDAÇÃO DE EXPIRAÇÃO (PRIORITÁRIA)
            // Verifica se a proposta está vencida ANTES de checar o dispositivo
            const pPremium = propostaData.premium;
            const pAcessivel = propostaData.acessivel;
            
            const isPremiumValida = pPremium && validarValidadeProposta(pPremium);
            const isAcessivelValida = pAcessivel && validarValidadeProposta(pAcessivel);

            // Se ambas forem inválidas (mas existirem), bloqueia tudo imediatamente.
            if (!isPremiumValida && !isAcessivelValida && (pPremium || pAcessivel)) {
                console.warn("Propostas encontradas mas expiradas (Bloqueio de Segurança).");
                
                // SEGURANÇA VISUAL: Oculta imediatamente qualquer modal ou conteúdo
                const modal = document.getElementById('proposalModal');
                if (modal) modal.style.display = 'none';
                document.body.classList.remove('awaiting-acceptance');
                
                exibirAvisoAmigavel(
                    'Proposta Expirada', 
                    'O prazo de validade desta proposta encerrou.<br>Você será redirecionado para a página do engenheiro responsável para solicitar uma atualização.', 
                    'index.html'
                );
                redirecionando = true;
                return;
            }

            // 2. VERIFICAÇÃO DE SEGURANÇA (FINGERPRINT) - APÓS VALIDAR DATA
            // Só verifica o dispositivo se a proposta estiver válida (data ok)
            const acessoPermitido = await verificarAcessoDispositivo(idProposta);
            if (!acessoPermitido) {
                exibirMensagemBloqueio();
                redirecionando = true; // Impede que o finally esconda o overlay ou execute lógica extra
                return;
            }

            // Se passou por todas as verificações, salva os dados e prossegue
            localStorage.setItem('propostaData', JSON.stringify(propostaData));

            // Se chegou aqui, pelo menos uma é válida ou não existem propostas (erro tratado abaixo)
            if (isPremiumValida) {
                propostaParaExibir = propostaData.premium;
                initialThemeClass = 'theme-premium';
                initialButtonToSelect = btnPremium;
            } else if (isAcessivelValida) {
                propostaParaExibir = propostaData.acessivel;
                initialThemeClass = 'theme-acessivel';
                initialButtonToSelect = btnAcessivel;
            } else {
                // Caso de erro genérico (nenhuma proposta retornada ou erro de lógica)
                console.error("Nenhuma proposta válida para exibir após buscar.");
                exibirAvisoAmigavel('Erro', 'Não foi possível exibir os dados da proposta.', 'index.html');
                redirecionando = true;
                return;
            }

            // CORREÇÃO: Define o tipo de proposta atual para o carrossel de imagens
            currentProposalType = propostaParaExibir.tipo;

            // Preencher dados
            preencherDadosProposta(propostaParaExibir);
            await atualizarImagemEquipamentos(propostaParaExibir);
            preencherDetalhesInstalacao(propostaParaExibir);
            atualizarEtiquetasDinamicas(propostaParaExibir.tipo);
            preencherChecklistInstalacao(propostaParaExibir);
            document.body.classList.add(initialThemeClass);

            // Gerenciar visibilidade e estado dos botões
            const premiumIsValid = !!propostaData.premium && validarValidadeProposta(propostaData.premium);
            const acessivelIsValid = !!propostaData.acessivel && validarValidadeProposta(propostaData.acessivel);

            if (seletorTipoProposta) {
                if (premiumIsValid && acessivelIsValid) {
                    seletorTipoProposta.classList.remove('oculto');
                    if (btnPremium) btnPremium.disabled = false;
                    if (btnAcessivel) btnAcessivel.disabled = false;
                } else {
                }
            }

            if (initialButtonToSelect) {
                initialButtonToSelect.classList.add('selecionado');
                if (initialButtonToSelect === btnPremium && btnAcessivel) btnAcessivel.classList.remove('selecionado');
                if (initialButtonToSelect === btnAcessivel && btnPremium) btnPremium.classList.remove('selecionado');
            }

            // 🌟 Inicia e ESPERA a imagem do carrossel carregar antes de prosseguir para o 'finally'
            await showImage(0);
            startCarouselAutoPlay(); // Inicia o avanço automático do carrossel

            // NOVO: Inicia o Scroll Storytelling após o conteúdo estar carregado
            setTimeout(iniciarAnimacaoScroll, 100);

        } catch (error) {
            console.error("ERRO: Falha ao carregar ou exibir a proposta.", error);
            exibirAvisoAmigavel('Erro', 'Ocorreu um erro inesperado ao processar sua solicitação.', 'index.html');
            redirecionando = true;
        } finally {
            if (!redirecionando) {
                esconderLoadingOverlay();
                // Garante que o carrossel automático seja iniciado mesmo se houver um erro
                // e a página não redirecionar, mas a proposta for exibida.
                // Isso é um fallback, o ideal é que startCarouselAutoPlay() seja chamado após o sucesso.
                if (propostas && propostas.sucesso) {
                    startCarouselAutoPlay();
                }
            }
        }
    } else {
        // Caso acesse sem ID na URL
        exibirAvisoAmigavel('Link Inválido', 'O link acessado não contém o identificador da proposta.', 'index.html');
    }

    // =================================================================
    // 🖱️ EVENT LISTENERS
    // =================================================================
    if (nextImageBtn) nextImageBtn.addEventListener('click', () => {
        stopCarouselAutoPlay();
        showImage(currentImageIndex + 1);
        startCarouselAutoPlay();
    });
    if (prevImageBtn) prevImageBtn.addEventListener('click', () => {
        stopCarouselAutoPlay();
        showImage(currentImageIndex + 1);
        startCarouselAutoPlay();
    });
    if (prevImageBtn) prevImageBtn.addEventListener('click', () => {
        stopCarouselAutoPlay();
        showImage(currentImageIndex - 1);
        startCarouselAutoPlay();
    });

    // Função auxiliar para alternar entre os modos (DRY - Don't Repeat Yourself)
    const alternarModoVisualizacao = async (novoTipo) => {
        const btnAlvo = novoTipo === 'premium' ? btnPremium : btnAcessivel;
        const btnOutro = novoTipo === 'premium' ? btnAcessivel : btnPremium;

        if (btnAlvo.classList.contains('selecionado')) return;

        mostrarLoadingOverlay();
        const propostas = JSON.parse(localStorage.getItem('propostaData'));

        if (propostas && propostas[novoTipo]) {
            try {
                stopCarouselAutoPlay();
                preencherDadosProposta(propostas[novoTipo]);
                atualizarEtiquetasDinamicas(novoTipo);
                await switchProposalType(novoTipo);
                preencherDetalhesInstalacao(propostas[novoTipo]);
                preencherChecklistInstalacao(propostas[novoTipo]);
                await atualizarImagemEquipamentos(propostas[novoTipo]);
                startCarouselAutoPlay();

                document.body.classList.toggle('theme-premium', novoTipo === 'premium');
                document.body.classList.toggle('theme-acessivel', novoTipo === 'acessivel');
                
                btnAlvo.classList.add('selecionado');
                if (btnOutro) btnOutro.classList.remove('selecionado');

                setTimeout(iniciarAnimacaoScroll, 100);
            } catch (error) {
                console.error(`ERRO ao trocar para proposta ${novoTipo}:`, error);
            } finally {
                esconderLoadingOverlay();
            }
        } else {
            console.error(`ERRO: Dados da proposta ${novoTipo} não encontrados no localStorage.`);
            esconderLoadingOverlay();
        }
    };

    if (btnPremium) {
        btnPremium.addEventListener('click', () => alternarModoVisualizacao('premium'));
    }

    if (btnAcessivel) {
        btnAcessivel.addEventListener('click', () => alternarModoVisualizacao('acessivel'));
    }

    if (btnVoltar) {
        btnVoltar.addEventListener('click', (evento) => {
            evento.preventDefault();
            mostrarLoadingOverlay();
            setTimeout(() => {
                window.location.href = btnVoltar.href;
            }, 500);
        });
    }

    // O restante dos event listeners já estão dentro da função carregarProposta
}

// =================================================================
// 🛠️ FUNÇÕES AUXILIARES DE BUSCA E TRATAMENTO (BYPASS MODEL)
// =================================================================

async function buscarPropostaPorId(id) { // id é o ID curto da proposta
    try {
        // 1. Busca a taxa Selic para cálculos financeiros
        const selicAtual = await getSelicTaxa() || 11.25;

        // 2. Busca a proposta pelo ID (curto ou completo)
        const response = await fetch('https://gdis-api-service.jeanmarcel-vs.workers.dev/security/find-proposta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ propostaId: id })
        });

        if (!response.ok) { // Erros 400, 404, 500
            const err = await response.json().catch(() => ({}));
            return { sucesso: false, mensagem: err.message || 'Proposta não encontrada.' };
        }

        const rawData = await response.json();
        const proposta = rawData.dadosProposta || rawData;

        // CORREÇÃO: Se 'dados' vier como string do D1 (SQLite), fazemos o parse manual
        if (proposta.dados && typeof proposta.dados === 'string') {
            try {
                proposta.dados = JSON.parse(proposta.dados);
                Object.assign(proposta, proposta.dados);
            } catch (e) {
                console.warn("Aviso: Falha ao converter string JSON em objeto (campo dados).", e);
            }
        }

        // 3. Busca dados complementares (Projeto e Cliente) se não estiverem no JSON
        let projeto = proposta.projeto || (proposta.dados && proposta.dados.projeto);
        let cliente = proposta.cliente || (proposta.dados && proposta.dados.cliente);

        if ((!projeto || !cliente) && proposta.projetoId && proposta.clienteId) {
            try {
                const [resProj, resCli] = await Promise.all([
                    fetch(`https://gdis-api-service.jeanmarcel-vs.workers.dev/erp/projetos/${proposta.projetoId}`),
                    fetch(`https://gdis-api-service.jeanmarcel-vs.workers.dev/erp/clientes/${proposta.clienteId}`)
                ]);
                if (resProj.ok) projeto = await resProj.json();
                if (resCli.ok) cliente = await resCli.json();
            } catch (e) {
                console.warn("Erro ao buscar dados complementares:", e);
            }
        }

        projeto = projeto || {};
        cliente = cliente || {};

        // 4. Monta o objeto completo para o tratador
        const dadosCompletos = { proposta, projeto, cliente };

        // 5. Passa para a função de tratamento que mapeia para o formato da View
        const dadosTratados = tratarDadosProposta(dadosCompletos, selicAtual);
        return { sucesso: true, dados: dadosTratados };

    } catch (error) {
        console.error("Erro ao buscar proposta:", error);
        return { sucesso: false, mensagem: 'Erro de conexão ao buscar os dados da proposta.' };
    }
}

function tratarDadosProposta(dadosCompletos, selicAtual = 11.25) {
    const { proposta, projeto, cliente } = dadosCompletos;
    const tratado = {};
    const formatar = (v) => v ? parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';

    // Helper para formatar payback em Anos e Meses
    const formatarPayback = (valor) => {
        if (!valor) return 'N/A';
        const anosFloat = parseFloat(valor);
        if (isNaN(anosFloat)) return 'N/A';

        const anos = Math.floor(anosFloat);
        const meses = Math.round((anosFloat - anos) * 12);

        if (meses === 0) return `${anos} anos`;
        if (meses === 12) return `${anos + 1} anos`;
        
        return `${anos} anos e ${meses} meses`;
    };

    const caminhosImagens = {
        premium: 'imagens/huawei.webp',
        acessivel: 'imagens/auxsolar.webp'
    };

    ['premium', 'standard'].forEach(key => {
        const versao = proposta.versoes?.[key];
        if (!versao) return;

        const tipo = key === 'standard' ? 'acessivel' : 'premium';
        
        const dadosTecnicos = versao.dados || {};
        const resumoFinanceiro = versao.resumoFinanceiro || {};

        const descInversor = dadosTecnicos.inversores?.map(i => {
            const potenciaKw = (i.nominal || 0) / 1000;
            return `${potenciaKw.toLocaleString('pt-BR')} kW`;
        }).join(' + ') || 'Inversor';
        const qtdInversor = dadosTecnicos.inversores?.reduce((acc, i) => acc + i.qtd, 0) || 1;

        const moduloPrincipal = dadosTecnicos.modulo || { watts: 0, qtd: 0 };
        const descPainel = `${moduloPrincipal.watts || 0}W`;
        const qtdPainel = moduloPrincipal.qtd || 0;

        const geracaoMedia = proposta.geracaoMensal || 0;
        const tarifa = projeto.tarifaGrupoB || proposta.premissasSnapshot?.viabilidade?.tarifaGrupoB || 0.95;
        
        let idealPara = geracaoMedia * tarifa;
        if (proposta.analiseFinanceira?.[key]?.detalhes?.faturaSemSolarAno1) {
            idealPara = proposta.analiseFinanceira[key].detalhes.faturaSemSolarAno1;
        }

        // Lógica de Detalhamento do Investimento (Equipamentos vs Serviços)
        const valorTotal = resumoFinanceiro.valorTotal || 0;
        const valorEquipamentos = resumoFinanceiro.valorKit || 0;
        let detalhamentoPagamento = null;

        if (valorEquipamentos > 0 && valorEquipamentos < valorTotal) {
            const valorServicosTotal = valorTotal - valorEquipamentos;
            
            // Regra: 24% do Total da Proposta, com mínimo de R$ 1.200,00
            let valorProjeto = valorTotal * 0.24;
            if (valorProjeto < 1200) valorProjeto = 1200;

            // O que sobra do serviço é dividido em 2 (Entrega + Conclusão)
            const valorRestanteInstalacao = valorServicosTotal - valorProjeto;
            const valorParcelaInstalacao = valorRestanteInstalacao / 2;

            detalhamentoPagamento = {
                equipamentos: valorEquipamentos,
                servicosTotal: valorServicosTotal,
                servicoEntrada: valorProjeto,       // 1ª Parcela: Projeto/Entrada
                servicoEntrega: valorParcelaInstalacao, // 2ª Parcela: Entrega (50% do restante)
                servicoConclusao: valorParcelaInstalacao // 3ª Parcela: Conclusão (50% do restante)
            };
        }

        // Lógica de exibição da validade com suporte a horas
        let textoValidade = `Proposta válida por até 3 dias corridos. Após esse prazo, condições técnicas, custos e disponibilidade podem ser reavaliados.`;
        if (proposta.dataValidade) {
            const dataVal = new Date(proposta.dataValidade);
            if (!isNaN(dataVal.getTime())) {
                // Se a string tem mais de 10 caracteres (ISO com hora), mostra o horário
                if (proposta.dataValidade.length > 10) {
                    textoValidade = `Válida até ${dataVal.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
                } else {
                    textoValidade = `Válida até ${dataVal.toLocaleDateString('pt-BR')}`;
                }
            }
        }

        tratado[tipo] = {
            tipo: tipo,
            cliente: cliente.nome || 'Cliente',
            local: projeto.cidade ? `${projeto.cidade}/${projeto.uf}` : 'Local',
            dataProposta: proposta.dataCriacao ? new Date(proposta.dataCriacao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
            validade: textoValidade,
            dataExpiracao: proposta.dataValidade,
            
            sistema: {
                geracaoMedia: `${Math.round(geracaoMedia)} kWh/mês`,
                instalacaoPaineis: projeto.tipoTelhado || 'Telhado',
                idealPara: `${formatar(idealPara)}`
            },
            equipamentos: {
                descricaoInversor: descInversor,
                quantidadeInversor: qtdInversor,
                descricaoPainel: descPainel,
                quantidadePainel: qtdPainel,
                imagem: caminhosImagens[tipo] || ''
            },
            valores: {
                valorTotal: formatar(versao.resumoFinanceiro?.valorTotal || 0),
                valorTotalNum: versao.resumoFinanceiro?.valorTotal || 0,
                payback: proposta.analiseFinanceira?.[key]?.paybackSimples ? formatarPayback(proposta.analiseFinanceira[key].paybackSimples) : 'N/A',
                parcelas: versao.financeiro?.parcelas || {},
                parcelasCartao: versao.financeiro?.parcelasCartao || {},
                selicAtual: selicAtual,
                observacao: 'Os valores de financiamento são estimativas baseadas em taxas médias de mercado, com carência de até 120 dias. As condições finais podem variar conforme análise de crédito da instituição financeira.',
                detalhamento: detalhamentoPagamento
            },
            instalacao: {
                detalhesInstalacao: tipo === 'premium' ? [
                    { icone: 'fa-user-shield', titulo: 'Pensado para durar', texto: 'Projeto técnico que reduz riscos ao longo do tempo.' },
                    { icone: 'fa-chart-line', titulo: 'Engenharia real', texto: 'Dimensionamento preciso evita perdas futuras.' },
                    { icone: 'fa-home', titulo: 'Perfil criterioso', texto: 'Para quem prioriza decisões bem fundamentadas.' }
                ] : [
                    { icone: 'fa-info-circle', titulo: 'Solução Básica', texto: 'Atende o básico com menor investimento inicial.', microtexto: 'Infraestrutura simplificada.' }
                ],
                checklist: tipo === 'premium' ? [
                    'Infraestrutura metálica de padrão industrial',
                    'Proteção elétrica coordenada em múltiplos níveis',
                    'Menor risco de manutenção futura'
                ] : [
                    'Infraestrutura simplificada de uso residencial',
                    'Proteções básicas',
                    'Maior dependência de manutenção futura'
                ]
            },
            variables: []
        };

        // Recalcula parcelas se não vierem preenchidas (usando funções do model)
        if ((!tratado[tipo].valores.parcelas || Object.keys(tratado[tipo].valores.parcelas).length === 0) && typeof calcularFinanciamento === 'function') {
             tratado[tipo].valores.parcelas = calcularFinanciamento(tratado[tipo].valores.valorTotalNum, selicAtual).parcelas;
        }
        if ((!tratado[tipo].valores.parcelasCartao || Object.keys(tratado[tipo].valores.parcelasCartao).length === 0) && typeof calcularParcelasCartao === 'function') {
             tratado[tipo].valores.parcelasCartao = calcularParcelasCartao(tratado[tipo].valores.valorTotalNum, selicAtual).parcelas;
        }
    });

    return tratado;
}

document.addEventListener('DOMContentLoaded', async () => {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') e.preventDefault();
        if (e.key === 'F12') e.preventDefault();
    });

    iniciarAnimacaoScroll();

    const urlParams = new URLSearchParams(window.location.search);
    const idProposta = urlParams.get('id');

    if (idProposta) {
        mostrarLoadingOverlay();
        const acessoPermitido = await verificarAcessoDispositivo(idProposta);
        if (!acessoPermitido) {
            exibirMensagemBloqueio();
            return; // Interrompe a execução
        }
        // Se o acesso for permitido, carrega a proposta
        await carregarProposta(idProposta);
    } else {
        exibirAvisoAmigavel('Link Inválido', 'O link acessado não contém o identificador da proposta.', 'index.html');
    }
});

window.addEventListener('load', function () {
    if (window.instgrm) window.instgrm.Embeds.process();
});