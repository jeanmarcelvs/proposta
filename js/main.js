import { buscarPropostaService } from './api.js';
import { verificarAutorizacaoHardware, isPropostaValida } from './security.js';
import { mostrarLoading } from './utils.js';

const app = {
    idProposta: new URLSearchParams(window.location.search).get('id'),
    primeiroNome: new URLSearchParams(window.location.search).get('n'),
    propostaAtiva: 'standard', 
    planoSelecionado: false, // Controla se o usuário já escolheu um padrão de projeto
    isNavigating: false, // Impede disparos múltiplos durante a transição
    etapaAtual: 0,
    dados: null,
    etapas: ['dados_gerais', 'equipamentos', 'instalacao', 'financeiro'],
    carrossel: {
        index: 0,
        fotos: [],
        intervalo: null,
        cache: {
            standard: null,
            premium: null
        }
    }
};

// Variáveis para controle de gestos (Swipe)
let touchStartX = 0;
let touchStartY = 0;

let loadingTimer = null;

// Expõe para o escopo global para o onclick do HTML
window.app = {
    mudarPlano: (tipo) => alternarProposta(tipo),
    playVideo: (url) => {
        const modal = document.getElementById('modal-video');
        const video = document.getElementById('video-player');
        if (modal && video) {
            video.src = url;
            modal.style.display = 'flex';
            video.play().catch(e => console.log("Auto-play bloqueado, aguardando interação."));
        }
    },
    fecharVideo: () => {
        const modal = document.getElementById('modal-video');
        const video = document.getElementById('video-player');
        if (modal && video) {
            modal.style.display = 'none';
            video.pause();
            video.src = "";
        }
    },
    abrirCarrossel: async (tipo) => {
        // Se as fotos já foram mapeadas nesta sessão, usa o cache para evitar novos 404 no console
        if (app.carrossel.cache[tipo]) {
            app.carrossel.fotos = app.carrossel.cache[tipo];
            app.carrossel.index = 0;
            const modal = document.getElementById('modal-foto');
            if (modal) {
                modal.style.display = 'flex';
                atualizarImagemCarrossel();
                iniciarAutoCarrossel();
            }
            return;
        }

        mostrarLoading(true);
        const fotosEncontradas = [];
        
        // Função auxiliar para verificar se o arquivo existe no servidor
        const verificarArquivo = async (url) => {
            try {
                const response = await fetch(url, { method: 'HEAD' });
                // Verifica se o arquivo existe e se não é uma página HTML (erro comum em servidores que redirecionam 404)
                return response.ok && !response.headers.get('content-type')?.includes('text/html');
            } catch { return false; }
        };

        // 1. Busca fotos específicas do tipo (standard ou premium) sequencialmente (1, 2, 3...)
        let i = 1;
        while (i < 10 && await verificarArquivo(`assets/inst_${tipo}_${i}.webp`)) {
            fotosEncontradas.push(`assets/inst_${tipo}_${i}.webp`);
            i++;
        }

        // 2. Busca fotos neutras sequencialmente (1, 2, 3...) para adicionar ao final
        let j = 1;
        while (j < 10 && await verificarArquivo(`assets/inst_neutro_${j}.webp`)) {
            fotosEncontradas.push(`assets/inst_neutro_${j}.webp`);
            j++;
        }

        // Salva no cache da sessão
        app.carrossel.cache[tipo] = fotosEncontradas;
        app.carrossel.fotos = fotosEncontradas;
        app.carrossel.index = 0;

        const modal = document.getElementById('modal-foto');
        if (modal && fotosEncontradas.length > 0) {
            mostrarLoading(false);
            modal.style.display = 'flex';
            atualizarImagemCarrossel();
            iniciarAutoCarrossel();
        } else {
            mostrarLoading(false);
            console.warn("Nenhuma imagem encontrada para o padrão selecionado.");
        }
    },
    fecharCarrossel: () => {
        const modal = document.getElementById('modal-foto');
        if (modal) {
            modal.style.display = 'none';
            clearInterval(app.carrossel.intervalo);
        }
    },
    mudarSlide: (direcao) => {
        clearInterval(app.carrossel.intervalo);
        app.carrossel.index = (app.carrossel.index + direcao + app.carrossel.fotos.length) % app.carrossel.fotos.length;
        atualizarImagemCarrossel();
        iniciarAutoCarrossel();
    },
    abrirInfoPremium: () => {
        const modal = document.getElementById('modal-info-premium');
        if (modal) modal.style.display = 'flex';
    },
    fecharInfoPremium: () => {
        const modal = document.getElementById('modal-info-premium');
        if (modal) modal.style.display = 'none';
    }
};

function atualizarImagemCarrossel() {
    const img = document.getElementById('foto-display');
    if (img && app.carrossel.fotos.length > 0) {
        img.style.opacity = '0';
        setTimeout(() => {
            img.src = app.carrossel.fotos[app.carrossel.index];
            img.onload = () => { img.style.opacity = '1'; };
        }, 250);
    }
}

function iniciarAutoCarrossel() {
    clearInterval(app.carrossel.intervalo);
    app.carrossel.intervalo = setInterval(() => {
        app.carrossel.index = (app.carrossel.index + 1) % app.carrossel.fotos.length;
        atualizarImagemCarrossel();
    }, 5000);
}

/**
 * Inicialização do Sistema
 */
async function init() {
    console.log("🚀 Iniciando aplicação para ID:", app.idProposta);
    if (!app.idProposta) return;

    mostrarLoading(true);

    try {
        // 1. Validação de Hardware/Fingerprint (Cloudflare Worker)
        const seguranca = await verificarAutorizacaoHardware(app.idProposta);
        
        if (!seguranca.autorizado) {
            exibirStatusProposta('bloqueado');
            return;
        }

        // 2. Busca de Dados da Proposta
        const resposta = await buscarPropostaService(app.idProposta, app.primeiroNome);
        
        if (resposta && resposta.sucesso) {
            // Garante a captura dos dados independentemente da estrutura de retorno da API
            app.dados = resposta.dadosProposta || resposta.dados || (resposta.id ? resposta : null); 
            const validade = app.dados.dataValidade || app.dados.data_validade || app.dados.validade;
            if (!isPropostaValida(validade)) {
                exibirStatusProposta('expirada');
                return;
            }
        } else {
            mostrarLoading(false);
            return;
        }

        // Aplica o tema padrão silenciosamente atrás do splash
        document.body.className = 'theme-standard';
        configurarControles();
        configurarAceite();

        // Só revela o modal de aceite após TODAS as validações
        const modalAceite = document.getElementById('modal-aceite');
        if (modalAceite) {
            // Tenta obter o primeiro nome dos dados da proposta se não estiver na URL
            let nomeParaExibir = app.primeiroNome;
            
            if (!nomeParaExibir && app.dados && app.dados.clienteNome) {
                nomeParaExibir = app.dados.clienteNome.split(' ')[0];
            } else if (!nomeParaExibir) {
                nomeParaExibir = "Visitante"; // Fallback de cortesia
            }

            const saudacao = document.getElementById('saudacao-cliente');
            if (saudacao) {
                saudacao.innerText = `Olá, ${nomeParaExibir}!`;
            }

            modalAceite.style.display = 'flex';
            requestAnimationFrame(() => {
                modalAceite.style.opacity = '1';
                // Libera o splash para mostrar o aceite pronto
                mostrarLoading(false);
            });
        }
        
    } catch (error) {
        console.error("💥 Erro fatal na inicialização:", error);
        mostrarLoading(false);
    }
}

/**
 * Carrega a View de Status (Expirado ou Bloqueado)
 */
async function exibirStatusProposta(motivo) {
    const container = document.getElementById('view-container');
    const modalAceite = document.getElementById('modal-aceite');
    try {
        // Ajustado para o nome real do arquivo no diretório: status_proposta.html
        const response = await fetch(`./views/status_proposta.html`);
        if (!response.ok) {
            throw new Error(`Não foi possível carregar a view de status: ${response.status}`);
        }
        const html = await response.text();
        container.innerHTML = html;

        const titulo = document.getElementById('status-title');
        const msg = document.getElementById('status-message');
        const icone = document.getElementById('status-icon');

        if (motivo === 'bloqueado') {
            if (titulo) titulo.innerText = "Acesso Exclusivo";
            if (msg) msg.innerText = "Este documento contém informações personalizadas e exclusivas. Por questões de segurança e privacidade, o acesso é restrito ao titular do projeto. Por favor, valide sua identidade com o consultor técnico.";
            if (icone) icone.className = "fas fa-user-shield";
        } else if (motivo === 'expirada') {
            if (titulo) titulo.innerText = "Vigência Encerrada";
            if (msg) msg.innerText = "Esta proposta técnica possui um prazo de validade para garantir as condições comerciais e a disponibilidade dos equipamentos. O período de vigência expirou e os valores precisam ser atualizados pela engenharia.";
            if (icone) icone.className = "fas fa-hourglass-end";
        }
        
        // Oculta elementos que não devem aparecer em estados de erro
        if (modalAceite) modalAceite.style.display = 'none';
        
        const footer = document.querySelector('.footer-fixo');
        if (footer) footer.style.display = 'none';

        const seletor = document.querySelector('.seletor-proposta');
        if (seletor) seletor.style.display = 'none';

        mostrarLoading(false);
    } catch (e) {
        console.error("Erro ao carregar view de status:", e);
        window.location.href = "https://wa.me/5582999469016";
    }
}

/**
 * Preenchimento de Dados com mapeamento inteligente
 */
function preencherDadosView() {
    if (!app.dados || !app.dados.versoes) {
        console.warn("⚠️ Dados ou Versões não encontrados no objeto app.dados.");
        return;
    }

    // Busca a versão ignorando Diferenças de Case (Ex: 'Standard' vs 'standard')
    const chaveVersao = Object.keys(app.dados.versoes).find(k => k.toLowerCase() === app.propostaAtiva.toLowerCase());
    const versaoAtiva = app.dados.versoes[chaveVersao];
    if (!versaoAtiva) { console.warn(`⚠️ Versão ${app.propostaAtiva} não encontrada.`); return; }

    const analise = app.dados.analiseFinanceira ? app.dados.analiseFinanceira[app.propostaAtiva] : {};
    const detalhesFinanceiros = analise.detalhes || {};

    // Consolida os dados em um único objeto para facilitar a busca por data-field
    const dadosConsolidados = {
        clienteNome: app.dados.clienteNome,
        id: app.dados.id,
        localidade: app.dados.localidade || `${app.dados.premissasSnapshot?.cidade || app.dados.cidade || '---'} / ${(app.dados.premissasSnapshot?.uf || app.dados.uf || '---').toUpperCase()}`,
        potenciaKwp: app.dados.potenciaKwp,
        geracaoMensal: app.dados.geracaoMensal,
        geracaoExpansao: app.dados.geracaoExpansao,
        qtdModulosExpansao: versaoAtiva.dados.premissasTecnicas?.qtdModulosExpansao,
        ...app.dados.premissasSnapshot, 
        dataValidade: app.dados.dataValidade,
        valorStandard: app.dados.versoes.standard?.resumoFinanceiro?.valorTotal,
        valorPremium: app.dados.versoes.premium?.resumoFinanceiro?.valorTotal,
        ...versaoAtiva.dados,
        ...versaoAtiva.resumoFinanceiro,
        economiaMediaAnual: analise.economiaMediaAnual,
        paybackSimples: analise.paybackSimples,
        economiaTotal: analise.economiaTotal,
        tir: analise.tir,
        economiaAno1: detalhesFinanceiros.economiaAno1,
        inflacaoEnergetica: app.dados.premissasSnapshot?.viabilidade?.inflacaoEnergetica,
        faturaSemSolarAno1: detalhesFinanceiros.faturaSemSolarAno1,
        tarifaConsiderada: detalhesFinanceiros.tarifaConsiderada
    };

    // Cálculo do Cronograma de Pagamento À Vista Personalizado
    const vServico = Number(dadosConsolidados.precoVendaServico) || 0;
    dadosConsolidados.valorPgtoEquatorial = vServico * 0.5;
    dadosConsolidados.valorPgtoKit = Number(dadosConsolidados.valorKit) || 0;
    dadosConsolidados.valorPgtoInicio = vServico * 0.25;
    dadosConsolidados.valorPgtoConclusao = vServico * 0.25;

    console.log(`🔎 Preenchendo ${app.propostaAtiva}.`, dadosConsolidados);

    const campos = document.querySelectorAll('[data-field]');
    
    campos.forEach(campo => {
        const chaveOriginal = campo.getAttribute('data-field');
        
        // Identifica campos que devem receber destaque visual (Badge)
        const camposDestaque = ['garantia', 'tecnologia', 'monitorizacao', 'monitoramento', 'protecao'];
        const deveTerBadge = camposDestaque.some(d => chaveOriginal.toLowerCase().includes(d));

        // MAPEAMENTO DE TRADUÇÃO (HTML snake_case -> JSON camelCase)
        const mapaTraduçao = {
            'cliente_nome': 'clienteNome',
            'geracao_mensal': 'geracaoMensal',
            'geracao_expansao': 'geracaoExpansao',
            'qtd_modulos_expansao': 'qtdModulosExpansao',
            'economia_ano_1': 'economiaAno1',
            'inflacao_energetica': 'inflacaoEnergetica',
            'economia_total': 'economiaTotal',
            'fatura_atendida': 'faturaSemSolarAno1',
            'payback': 'paybackSimples',
            'tipo_telhado': 'tipoTelhado', // Mapeamento existente
            'data_validade': 'dataValidade',
            'valor_total': 'valorTotal',
            'valor_standard': 'valorStandard',
            'valor_premium': 'valorPremium',
            'potencia_kwp': 'potenciaKwp',
            'potencia': 'potenciaKwp',
            'descricao_tecnica': 'descricao'
        };

        let chaveTratada = mapaTraduçao[chaveOriginal] || chaveOriginal;
        let valor = dadosConsolidados[chaveTratada];

        // Fallback: se não achar, tenta converter snake_case para camelCase dinamicamente
        if (valor === undefined && chaveOriginal.includes('_')) {
            const camelCaseDinamico = chaveOriginal.replace(/([-_][a-z])/g, group => 
                group.toUpperCase().replace('-', '').replace('_', '')
            );
            valor = dadosConsolidados[camelCaseDinamico];
        }

        // NOVA LÓGICA: Busca profunda em Equipamentos (Arrays)
        if (valor === undefined) {
            // Tenta extrair dados do primeiro módulo se a chave mencionar painéis/módulos
            if (chaveOriginal.includes('paineis') || chaveOriginal.includes('modulo')) {
                const item = dadosConsolidados.modulo || app.dados.modulo;
                if (item) {
                    const qtdNormalizada = parseInt(item.qtd || 0, 10); // Remove zeros à esquerda (06 -> 6)
                    if (chaveOriginal.includes('marca')) valor = item.marca || "Tier 1";
                    if (chaveOriginal.includes('modelo')) valor = `<span class="qty-badge">${qtdNormalizada}</span> Módulos de ${item.watts}W`;
                    if (chaveOriginal.includes('tecnologia')) valor = "N-Type Monocristalino";
                    if (chaveOriginal.includes('garantia')) valor = item.garantia || "25 anos";
                }
            }
            // Tenta extrair dados do primeiro inversor
            if (chaveOriginal.includes('inversor') || chaveOriginal.includes('monitorizacao')) {
                const item = dadosConsolidados.inversores?.[0] || app.dados.inversores?.[0];
                if (item) {
                    const qtdNormalizada = parseInt(item.qtd || 1, 10); // Remove zeros à esquerda
                    if (chaveOriginal.includes('marca')) valor = item.modelo?.split('-')[0] || "Huawei";
                    if (chaveOriginal.includes('modelo')) valor = `<span class="qty-badge">${qtdNormalizada}</span> Huawei - ${item.nominal}W`;
                    if (chaveOriginal.includes('garantia')) valor = "10 anos";
                    if (chaveOriginal.includes('monitorizacao')) valor = item.monitoramento || item.monitorizacao || "Wi-Fi Integrado";
                }
            }
        }

        // Fallback final: tenta a chave original se ainda for undefined (caso o JSON use snake_case)
        if (valor === undefined) {
            valor = dadosConsolidados[chaveOriginal] || app.dados[chaveOriginal];
        }

        // Fallbacks para campos obrigatórios não presentes no JSON (baseado em json-solar.txt)
        if (chaveOriginal === 'cliente_nome' && !valor) valor = "Cliente Especial";
        if (chaveOriginal === 'tipo_telhado' && !valor) valor = "Telhado Cerâmico";
        if (chaveOriginal === 'descricao_tecnica' && !valor) valor = "Sistema fotovoltaico de alta performance projetado para máxima eficiência térmica.";

        if (valor !== undefined && valor !== null) {
            const valorNumerico = Number(valor);
            const ehCampoFinanceiro = chaveTratada.toLowerCase().includes('valor') || 
                                     chaveTratada.toLowerCase().includes('fatura') ||
                                     chaveTratada.toLowerCase().includes('economia') ||
                                     chaveOriginal.toLowerCase().includes('total');

            // Se o valor for um objeto (como cliente), extrai o nome ou descrição
            if (typeof valor === 'object' && !Array.isArray(valor) && valor !== null) {
                valor = valor.nome || valor.razao_social || valor.descricao || valor;
            }

            // Formatação de Moeda
            if (!isNaN(valorNumerico) && ehCampoFinanceiro && typeof valor !== 'string') {
                const options = { style: 'currency', currency: 'BRL' };
                
                // Remove centavos para estimativas de faturas e economia (foco no benefício real)
                if (chaveTratada.toLowerCase().includes('fatura') || chaveTratada.toLowerCase().includes('economia')) {
                    options.minimumFractionDigits = 0;
                    options.maximumFractionDigits = 0;
                }
                
                campo.innerText = valorNumerico.toLocaleString('pt-BR', options);
            } else if (chaveTratada === 'potenciaKwp' || chaveOriginal === 'potencia_kwp') {
                campo.innerText = `${Number(valor).toFixed(2)} kWp`;
            } else if (chaveTratada === 'paybackSimples' || chaveOriginal === 'payback') {
                const num = parseFloat(valor);
                if (!isNaN(num)) {
                    const anos = Math.floor(num);
                    const meses = Math.round((num - anos) * 12);
                    let partes = [];
                    if (anos > 0) partes.push(anos === 1 ? "1 ano" : `${anos} anos`);
                    if (meses > 0) partes.push(meses === 1 ? "1 mês" : `${meses} meses`);
                    const textoPeriodo = partes.join(' e ');
                    campo.innerHTML = `Seu investimento se paga em até <strong>${textoPeriodo}</strong>`;
                }
            } else if (chaveTratada === 'geracaoExpansao' || chaveOriginal === 'geracao_expansao') {
                const container = campo.closest('.campo-info') || campo.closest('.info-expansao-texto');
                // Se não houver expansão extra (valor zerado ou igual à geração atual)
                const geracaoAtual = dadosConsolidados.geracaoMensal || 0;
                if (!valor || valor <= geracaoAtual) {
                    campo.innerHTML = `<i class="fas fa-circle-info" style="color: #eab308; font-size: 0.8rem; margin-right: 5px;"></i> Limite Técnico Alcançado`;
                    if (container) container.classList.add('limitada');
                } else {
                    campo.innerText = `${valor} kWh/mês`;
                    if (container) container.classList.remove('limitada');
                }
            } else if (chaveTratada === 'qtdModulosExpansao' || chaveOriginal === 'qtd_modulos_expansao') {
                const totalExp = dadosConsolidados.geracaoExpansao || 0;
                const geracaoAtual = dadosConsolidados.geracaoMensal || 0;
                // Só exibe o "+" se houver de fato um incremento e módulos a adicionar
                if (valor && valor > 0 && totalExp > geracaoAtual) {
                    campo.innerText = `+ ${valor} Módulos`;
                } else {
                    campo.innerText = "";
                }
            } else if (chaveTratada === 'geracaoMensal' || chaveOriginal === 'geracao_mensal') {
                campo.innerText = `${valor} kWh/mês`;
            } else if (chaveOriginal.includes('modelo')) {
                campo.innerHTML = valor;
            } 
            // Tratamento para Arrays (Módulos e Inversores)
            else if (Array.isArray(valor)) {
                campo.innerHTML = valor.map(item => {
                    const nome = item.modelo || item.descricao || item.nome || '';
                    const qtdRaw = item.quantidade || item.qtd || '';
                    const qtdNormalizada = qtdRaw ? parseInt(qtdRaw, 10) : null;
                    return qtdNormalizada ? `<span class="qty-badge">${qtdNormalizada}</span> ${nome}` : nome;
                }).filter(t => t !== '').join(' + ');
            } else if (chaveOriginal === 'cliente_nome' && !valor) {
                // Fallback para cliente caso não venha no JSON
                campo.innerText = "Cliente Especial";
            } else if (deveTerBadge && typeof valor === 'string') {
                // Aplica o Badge para Garantias e Tecnologias
                let icone = '';
                const chaveLower = chaveOriginal.toLowerCase();
                
                // Mapeamento intuitivo de ícones
                if (chaveLower.includes('garantia')) icone = '<i class="fas fa-shield-alt"></i>';
                else if (chaveLower.includes('tecnologia')) icone = '<i class="fas fa-microchip"></i>';
                else if (chaveLower.includes('monitor')) icone = '<i class="fas fa-wifi"></i>';
                else if (chaveLower.includes('protecao')) icone = '<i class="fas fa-user-shield"></i>';

                campo.innerHTML = `<span class="badge-tecnico">${icone} ${valor}</span>`;
            } else if (chaveOriginal === 'data_validade') {
                const data = new Date(valor);
                // Formata a data para DD/MM/AAAA
                campo.innerText = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
            else {
                campo.innerText = valor;
            }
        } else {
            console.log(`ℹ️ Campo '${chaveOriginal}' não localizado no JSON consolidado.`);
        }
    });

    atualizarDinamicos(dadosConsolidados);
}

/**
 * Atualiza ícones, imagens e elementos que não são apenas texto
 */
function atualizarDinamicos(info) {
    // 1. Atualizar Marca do Equipamento
    const imgMarca = document.getElementById('imagem-marca-equipamento');
    if (imgMarca) {
        // Tenta pegar a marca do primeiro inversor ou do primeiro módulo
        const marca = info.inversores?.[0]?.marca || info.modulos?.[0]?.marca || "";
        if (marca) {
            imgMarca.src = `./assets/marcas/${marca.toLowerCase()}.png`;
            imgMarca.style.display = 'inline-block';
        } else {
            imgMarca.style.display = 'none';
        }
    }

    // 2. Lógica de Ícone de Telhado
    const elIcone = document.getElementById('icone-telhado');
    
    // Usa o dado bruto para definir o ícone, evitando dependência do que foi escrito no DOM
    const txtTelhado = (info.tipoTelhado || info.tipo_telhado || "").toLowerCase();

    if (elIcone) {
        elIcone.className = 'fas';
        if (txtTelhado.includes('solo')) elIcone.classList.add('fa-solar-panel');
        else if (txtTelhado.includes('laje')) elIcone.classList.add('fa-layer-group');
        else if (txtTelhado.includes('metálico') || txtTelhado.includes('metalico')) elIcone.classList.add('fa-industry');
        else elIcone.classList.add('fa-house-chimney');
    }
}

/**
 * Gerencia o balão flutuante informativo
 */
function atualizarInterfaceSelecao() {
    // Estado dos cards (se estiver na view de instalação)
    const optStd = document.getElementById('opt-standard');
    const optPre = document.getElementById('opt-premium');
    if (optStd && optPre) {
        optStd.classList.toggle('ativa', app.planoSelecionado && app.propostaAtiva === 'standard');
        optPre.classList.toggle('ativa', app.planoSelecionado && app.propostaAtiva === 'premium');
    }
}

function configurarAceite() {
    const modal = document.getElementById('modal-aceite');
    const checkbox = document.getElementById('check-aceite');
    const btnAcessar = document.getElementById('btn-acessar');

    if(!checkbox || !btnAcessar) return;

    checkbox.addEventListener('change', () => {
        btnAcessar.disabled = !checkbox.checked;
        btnAcessar.classList.toggle('ativo', checkbox.checked);
    });

    btnAcessar.addEventListener('click', () => {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            configurarGestos(); // Ativa os gestos apenas após o aceite do termo
            carregarView();
        }, 400);
    });
}

function configurarControles() {
    document.getElementById('btn-avancar').addEventListener('click', () => navegar(1));
    document.getElementById('btn-voltar').addEventListener('click', () => navegar(-1));
}

/**
 * Configura detecção de gestos para smartphones
 */
function configurarGestos() {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;

        // Sensibilidade do arrasto e validação de direção (Horizontal > Vertical)
        const threshold = 70;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
            // Verifica se não há modais abertos que capturem o foco
            const algumModalAberto = ['modal-video', 'modal-foto', 'modal-info-premium', 'modal-aceite'].some(id => {
                const el = document.getElementById(id);
                return el && el.style.display === 'flex';
            });

            if (!algumModalAberto) {
                if (dx < 0) navegar(1);  // Swipe para Esquerda -> Avançar
                if (dx > 0) navegar(-1); // Swipe para Direita -> Voltar
            }
        }
    }, { passive: true });
}

function alternarProposta(tipo) {
    app.propostaAtiva = tipo;
    app.planoSelecionado = true; // Marca que o usuário realizou uma escolha
    document.body.className = `theme-${tipo}`;
    atualizarInterfaceSelecao();
    
    // Re-preenche a view atual com os novos dados do JSON (Premium vs Standard)
    preencherDadosView();
    atualizarDinamicos(app.dados.versoes[tipo].dados);

    // Se estiver na view de instalação, libera o botão avançar e ativa animação potente
    const btnAvancar = document.getElementById('btn-avancar');
    if (app.etapas[app.etapaAtual] === 'instalacao' && btnAvancar) {
        btnAvancar.disabled = false;
        btnAvancar.style.opacity = "1";
        btnAvancar.style.cursor = "pointer";
        btnAvancar.classList.add('animate-selling');
    }
}

function navegar(direcao) {
    if (app.isNavigating) return;

    // Segurança: Bloqueio de avanço na etapa de instalação sem plano selecionado
    if (direcao === 1 && app.etapas[app.etapaAtual] === 'instalacao' && !app.planoSelecionado) {
        return;
    }

    const novaEtapa = app.etapaAtual + direcao;
    if (novaEtapa >= 0 && novaEtapa < app.etapas.length) {
        app.isNavigating = true;
        app.etapaAtual = novaEtapa;
        carregarView(direcao);
    }
}

async function carregarView(direcao = 1) {
    const container = document.getElementById('view-container');
    const oldContent = container.querySelector('.view-content');
    const nomeView = app.etapas[app.etapaAtual];
    
    // 1. Inicia animação de saída horizontal no conteúdo atual
    if (oldContent) {
        oldContent.classList.remove('animate-in', 'slide-in-left', 'slide-in-right');
        oldContent.classList.add(direcao === 1 ? 'slide-out-left' : 'slide-out-right');
        
        // Pequena pausa para a animação de saída ser percebida antes de trocar o HTML
        await new Promise(r => setTimeout(r, 200));
    } else {
        container.style.opacity = '0';
    }

    // 2. Agenda o Splash apenas se a carga demorar mais de 0.7 segundos
    loadingTimer = setTimeout(() => {
        mostrarLoading(true);
    }, 700);

    try {
        const response = await fetch(`./views/${nomeView}.html`);
        if (!response.ok) throw new Error(`Erro ao carregar HTML: ${nomeView}`);
        const html = await response.text();

        // 3. Injeta o novo conteúdo e define a animação de entrada baseada na direção
        container.innerHTML = html;
        const newContent = container.querySelector('.view-content');
        if (newContent) {
            newContent.classList.remove('animate-in'); // Remove a classe estática para não conflitar
            newContent.classList.add(direcao === 1 ? 'slide-in-right' : 'slide-in-left');
        }

        preencherDadosView();
        atualizarInterfaceSelecao();

        document.getElementById('etapa-atual').innerText = app.etapaAtual + 1;
        
        const btnAvancar = document.getElementById('btn-avancar');
        document.getElementById('btn-voltar').style.visibility = app.etapaAtual === 0 ? 'hidden' : 'visible';
        btnAvancar.style.visibility = app.etapaAtual === (app.etapas.length - 1) ? 'hidden' : 'visible';

        gerenciarBotaoWhatsapp(nomeView);

        // Lógica de bloqueio do botão Avançar na View de Instalação
        if (nomeView === 'instalacao') {
            btnAvancar.disabled = !app.planoSelecionado;
            btnAvancar.style.opacity = app.planoSelecionado ? "1" : "0.5";
            btnAvancar.style.cursor = app.planoSelecionado ? "pointer" : "not-allowed";
            btnAvancar.classList.add('btn-analisar');
            btnAvancar.innerHTML = `Analisar Investimento <i class="fas fa-calculator"></i>`;
            
            if (app.planoSelecionado) btnAvancar.classList.add('animate-selling');
        } else {
            btnAvancar.disabled = false;
            btnAvancar.style.opacity = "1";
            btnAvancar.style.cursor = "pointer";
            btnAvancar.classList.remove('btn-analisar', 'animate-selling');
            btnAvancar.innerHTML = `<i class="fas fa-arrow-right"></i>`;
        }

        document.getElementById('btn-voltar').innerHTML = `<i class="fas fa-arrow-left"></i>`;

        // 3. Cancela o timer e revela a nova view
        clearTimeout(loadingTimer);
        
        setTimeout(() => {
            // 1. Move para o topo ANTES de tornar visível
            window.scrollTo(0, 0);
            
            // 2. Torna visível e executa animação de slide
            container.style.opacity = '1'; // Garante que o container fique visível após a carga
            
            // 3. Super Reflow Hack: Altera uma propriedade mínima para forçar o redesenho dos elementos fixos
            document.documentElement.style.paddingRight = '0.01px';
            setTimeout(() => { document.documentElement.style.paddingRight = '0px'; }, 50);

            mostrarLoading(false); // Esconde o splash se ele tiver chegado a aparecer
            app.isNavigating = false;
        }, 300); // Aguarda a conclusão visual da animação de entrada

    } catch (e) {
        console.error("Erro ao carregar view:", e);
        container.innerHTML = `<p style="text-align:center; padding:20px;">Erro ao carregar etapa: ${nomeView}</p>`;
        clearTimeout(loadingTimer);
        container.style.opacity = '1';
        mostrarLoading(false);
    }
}

/**
 * Gerencia a exibição do botão flutuante do WhatsApp
 * Garante que ele fique fora do contexto de transform das views
 */
function gerenciarBotaoWhatsapp(view) {
    let btn = document.getElementById('btn-whatsapp-global');
    
    if (view === 'financeiro') {
        if (!btn) {
            btn = document.createElement('a');
            btn.id = 'btn-whatsapp-global';
            btn.className = 'btn-whatsapp-float';
            btn.href = 'https://wa.me/5582999469016';
            btn.target = '_blank';
            btn.rel = 'noopener noreferrer';
            btn.innerHTML = '<i class="fab fa-whatsapp"></i><span>Aprovar<br>Projeto</span>';
            document.body.appendChild(btn);
        }
        btn.style.display = 'flex';
    } else {
        if (btn) btn.style.display = 'none';
    }
}

// Inicia o sistema
init();