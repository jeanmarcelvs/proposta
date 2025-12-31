import { buscarETratarProposta, verificarAcessoDispositivo } from './model.js';
import { mostrarLoadingOverlay, esconderLoadingOverlay, exibirMensagemBloqueio, organizarSecaoConfiabilidade } from './utils.js';

// --- CAROUSEL & MODAL LOGIC (Adapted for Service Page) ---

const imagePaths = {
    premium: [
        'imagens/inst_premium_1a.webp',
        'imagens/inst_premium_2a.webp',
        'imagens/inst_premium_3a.webp',
        'imagens/inst_premium_4a.webp',
        'imagens/inst_premium_5a.webp',
        'imagens/inst_premium_6a.webp',
        'imagens/inst_premium_7a.webp',
        'imagens/mod_1.webp'
    ]
};

let carouselInterval;
let currentImageIndex = 0;

function showImage(index) {
    return new Promise((resolve) => {
        const installationImage = document.getElementById('imagem-instalacao');
        const prevImageBtn = document.getElementById('prev-image-btn');
        const nextImageBtn = document.getElementById('next-image-btn');

        if (!installationImage) return resolve();

        const currentImageSet = imagePaths.premium; // Always premium for services
        if (!currentImageSet || currentImageSet.length === 0) return resolve();

        currentImageIndex = (index + currentImageSet.length) % currentImageSet.length;
        const imageUrl = currentImageSet[currentImageIndex];

        installationImage.style.opacity = '0.5';

        const handleLoad = () => {
            installationImage.style.opacity = '1';
            installationImage.removeEventListener('load', handleLoad);
            installationImage.removeEventListener('error', handleError);
            resolve();
        };

        const handleError = () => {
            console.error("ERRO: Falha ao carregar a imagem do carrossel:", imageUrl);
            installationImage.style.opacity = '1';
            installationImage.removeEventListener('load', handleLoad);
            installationImage.removeEventListener('error', handleError);
            resolve();
        };

        installationImage.addEventListener('load', handleLoad);
        installationImage.addEventListener('error', handleError);
        installationImage.src = imageUrl;

        if (installationImage.complete && installationImage.naturalWidth !== 0) {
            setTimeout(handleLoad, 10);
        }

        const showNav = currentImageSet.length > 1;
        prevImageBtn.classList.toggle('oculto', !showNav);
        nextImageBtn.classList.toggle('oculto', !showNav);
    });
}

function startCarouselAutoPlay() {
    stopCarouselAutoPlay();
    const currentImageSet = imagePaths.premium;
    if (currentImageSet && currentImageSet.length > 1) {
        carouselInterval = setInterval(() => {
            showImage(currentImageIndex + 1);
        }, 5000);
    }
}

function stopCarouselAutoPlay() {
    clearInterval(carouselInterval);
}

function showImageInModal(index) {
    const imagemModal = document.getElementById('imagem-modal');
    const prevModalBtn = document.getElementById('prev-modal-btn');
    const nextModalBtn = document.getElementById('next-modal-btn');
    const currentImageSet = imagePaths.premium;

    if (!imagemModal || !currentImageSet || currentImageSet.length === 0) return;

    currentImageIndex = (index + currentImageSet.length) % currentImageSet.length;
    imagemModal.src = currentImageSet[currentImageIndex];

    const showNav = currentImageSet.length > 1;
    prevModalBtn.classList.toggle('oculto', !showNav);
    nextModalBtn.classList.toggle('oculto', !showNav);
}

function preencherDetalhesInstalacao(proposta) {
    const secaoDetalhes = document.getElementById('detalhes-instalacao');
    if (!secaoDetalhes) return;

    secaoDetalhes.innerHTML = '';
    const detalhes = proposta.instalacao?.detalhesInstalacao;

    if (!detalhes || detalhes.length === 0) {
        secaoDetalhes.innerHTML = '<p>Nenhum detalhe de instalação disponível.</p>';
        return;
    }

    detalhes.forEach((detalhe, index) => {
        const div = document.createElement('div');
        div.className = 'card-item-detalhe animate-fade';
        div.style.animationDelay = `${index * 0.15}s`;
        div.innerHTML = `
            <div class="icone-container-detalhe">
                <i class="fas ${detalhe.icone} icone-detalhe"></i>
            </div>
            <div class="texto-container-detalhe">
                ${detalhe.titulo ? `<h4 class="titulo-card-detalhe">${detalhe.titulo}</h4>` : ''}
                <p class="texto-detalhe">${detalhe.texto}</p>
                ${detalhe.microtexto ? `<p class="microtexto-detalhe">${detalhe.microtexto}</p>` : ''}
            </div>
        `;
        secaoDetalhes.appendChild(div);
    });
}

function preencherDadosServico(dados) {
    // 1. Dados do Cliente
    const nomeClienteEl = document.getElementById('nome-cliente');
    const localClienteEl = document.getElementById('local-cliente');
    const dataPropostaEl = document.getElementById('data-proposta');

    if (nomeClienteEl) nomeClienteEl.innerText = dados.cliente || "Cliente";
    if (localClienteEl) localClienteEl.innerText = dados.local || "Não informado";
    if (dataPropostaEl) dataPropostaEl.innerText = dados.dataProposta || "Não informado";

    // 2. Descrição do Serviço
    const tipoServicoTituloEl = document.getElementById('tipo-servico-titulo');

    if (tipoServicoTituloEl) tipoServicoTituloEl.innerText = dados.dadosServico?.tipoServico || 'Serviço';

    // NOVO: Lógica para preencher a tabela de itens de serviço
    const temItens = dados.dadosServico?.temItens;
    const secaoDetalhada = document.getElementById('secao-itens-servico-detalhada');

    if (temItens && secaoDetalhada) {
        secaoDetalhada.classList.remove('oculto');

        const tbody = document.getElementById('tbody-itens-servico');
        tbody.innerHTML = ''; // Limpa antes de popular

        dados.dadosServico.itens.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'animate-fade';
            tr.style.animationDelay = `${index * 0.1}s`; // Cascata rápida na tabela

            // Coluna Descrição com Observação
            const tdDesc = document.createElement('td');
            tdDesc.className = 'col-descricao';
            tdDesc.innerHTML = `
                <span class="descricao-item">${item.descricao}</span>
                ${item.observacao ? `<span class="observacao-item">${item.observacao}</span>` : ''}
            `;

            // Células restantes
            tr.innerHTML += `<td class="col-numerica" data-label="Qtd.">${item.quantidade}</td>`;

            tr.insertBefore(tdDesc, tr.firstChild); // Adiciona a descrição no início
            tbody.appendChild(tr);
        });
    }

    // 3. Valores
    const obsServicoContainer = document.getElementById('secao-obs-servico');
    const obsServicoTextoEl = document.getElementById('texto-obs-servico');
    if (obsServicoContainer && obsServicoTextoEl) {
        if (dados.valores?.observacaoServico) {
            obsServicoTextoEl.innerText = dados.valores.observacaoServico;
            obsServicoContainer.classList.remove('oculto');
        }
    }

    const valorTotalEl = document.getElementById('valor-total');
    const observacaoEl = document.getElementById('texto-observacao');
    const validadeEl = document.getElementById('texto-validade');

    if (valorTotalEl) valorTotalEl.innerText = dados.valores?.valorTotal || "0,00"; // Agora usa o valor calculado
    if (observacaoEl) observacaoEl.innerText = dados.valores?.observacao || "Consulte condições.";
    if (validadeEl) validadeEl.innerText = dados.validade || "Não informada";

    // NOVO: Preenche as parcelas do cartão de crédito
    const containerParcelas = document.getElementById('container-parcelas-cartao');
    const tituloParcelas = document.querySelector('.titulo-parcelamento');
    if (dados.valores?.parcelas && containerParcelas && tituloParcelas) {
        let hasParcelas = false;
        const opcoes = ['debito', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
        opcoes.forEach(i => {
            const parcelaEl = document.getElementById(`parcela-${i}`);
            if (parcelaEl) {
                const valorParcela = dados.valores.parcelas[`parcela-${i}`];
                if (valorParcela) {
                    parcelaEl.innerText = valorParcela;
                    hasParcelas = true;
                } else {
                    // Oculta o card se não houver valor para a parcela
                    parcelaEl.closest('.card-valores').classList.add('oculto');
                }
            }
        });
        // Se houver parcelas, mostra o container
        if (hasParcelas) {
            containerParcelas.classList.remove('oculto');
            tituloParcelas.classList.remove('oculto');
        }
    }

    preencherDetalhesInstalacao(dados);
    organizarSecaoConfiabilidade();
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- Lógica do Bloco de Consciência de Valor (Animação + Interação) ---
    // 1. Lógica da Animação de Entrada por Scroll
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target); // Roda a animação apenas uma vez
                }
            });
        },
        {
            threshold: 0.35 // Dispara quando 35% do elemento está visível
        }
    );

    const elementsToAnimate = document.querySelectorAll(".animate-on-scroll");
    if (elementsToAnimate.length > 0) {
        elementsToAnimate.forEach(el => {
            observer.observe(el);
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

    mostrarLoadingOverlay();

    const urlParams = new URLSearchParams(window.location.search);
    const numeroProjeto = urlParams.get('id');
    const primeiroNome = urlParams.get('nome');

    if (numeroProjeto) {
        const acessoPermitido = await verificarAcessoDispositivo(numeroProjeto);
        if (!acessoPermitido) {
            exibirMensagemBloqueio();
            return;
        }
    }

    if (numeroProjeto && primeiroNome) {
        try {
            const resultado = await buscarETratarProposta(numeroProjeto, primeiroNome);

            if (!resultado.sucesso) {
                window.location.href = 'index.html?erro=acesso-negado';
                return;
            }

            // Para serviços, os dados geralmente vêm no slot 'premium' (como proposta única)
            // conforme a lógica definida no model.js
            const propostaData = resultado.dados.premium || resultado.dados.acessivel;

            if (propostaData) {
                preencherDadosServico(propostaData);
                await showImage(0);
                startCarouselAutoPlay();
            } else {
                throw new Error("Dados da proposta de serviço não encontrados.");
            }

        } catch (error) {
            console.error("Erro ao carregar proposta de serviço:", error);
            window.location.href = 'index.html?erro=acesso-negado';
        } finally {
            esconderLoadingOverlay();
        }
    } else {
        window.location.href = 'index.html?erro=parametros-ausentes';
    }

    // --- Event Listeners do Carrossel e Modal ---
    const installationImage = document.getElementById('imagem-instalacao');
    const prevImageBtn = document.getElementById('prev-image-btn');
    const nextImageBtn = document.getElementById('next-image-btn');
    const modalCarrossel = document.getElementById('modal-carrossel');
    const fecharModalBtn = document.getElementById('fechar-modal-btn');
    const prevModalBtn = document.getElementById('prev-modal-btn');
    const nextModalBtn = document.getElementById('next-modal-btn');

    if (nextImageBtn) nextImageBtn.addEventListener('click', () => {
        stopCarouselAutoPlay();
        showImage(currentImageIndex + 1).then(startCarouselAutoPlay);
    });

    if (prevImageBtn) prevImageBtn.addEventListener('click', () => {
        stopCarouselAutoPlay();
        showImage(currentImageIndex - 1).then(startCarouselAutoPlay);
    });

    if (installationImage) {
        installationImage.style.cursor = 'pointer';
        installationImage.addEventListener('click', () => {
            showImageInModal(currentImageIndex);
            stopCarouselAutoPlay();
            modalCarrossel.classList.remove('oculto');
            document.body.classList.add('modal-aberta');
        });
    }

    const esconderModal = () => {
        modalCarrossel.classList.add('oculto');
        document.body.classList.remove('modal-aberta');
        startCarouselAutoPlay();
    };

    if (fecharModalBtn) fecharModalBtn.addEventListener('click', esconderModal);
    if (modalCarrossel) modalCarrossel.addEventListener('click', (e) => e.target === modalCarrossel && esconderModal());
    document.addEventListener('keydown', (e) => e.key === 'Escape' && !modalCarrossel.classList.contains('oculto') && esconderModal());

    if (nextModalBtn) nextModalBtn.addEventListener('click', () => showImageInModal(currentImageIndex + 1));
    if (prevModalBtn) prevModalBtn.addEventListener('click', () => showImageInModal(currentImageIndex - 1));
});

// --- Script para forçar o recarregamento dos vídeos do Instagram (Movido do HTML) ---
window.addEventListener('load', function () {
    setTimeout(function () {
        if (window.instgrm) {
            window.instgrm.Embeds.process();
        }
    }, 1000);
});