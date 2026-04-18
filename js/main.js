import { buscarPropostaService } from './api.js';
import { verificarAutorizacaoHardware, isPropostaValida } from './security.js';
import { mostrarLoading } from './utils.js';

const app = {
    idProposta: new URLSearchParams(window.location.search).get('id'),
    primeiroNome: new URLSearchParams(window.location.search).get('n'),
    propostaAtiva: 'standard', 
    etapaAtual: 0,
    dados: null,
    etapas: ['dados_gerais', 'equipamentos', 'instalacao', 'financeiro', 'total']
};

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
    abrirFoto: (url) => {
        const modal = document.getElementById('modal-foto');
        const img = document.getElementById('foto-display');
        if (modal && img) {
            img.src = url;
            modal.style.display = 'flex';
        }
    },
    fecharFoto: () => {
        const modal = document.getElementById('modal-foto');
        if (modal) modal.style.display = 'none';
    }
};

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
            
            // Tenta localizar a data de validade em diferentes nomes de campos comuns
            const validade = app.dados.dataValidade || app.dados.data_validade || app.dados.validade;

            console.log(`📦 Proposta: ${app.idProposta} | Validade: ${validade}`);

            // 3. Validação de Data de Expiração
            if (!isPropostaValida(validade)) {
                exibirStatusProposta('expirada');
                return;
            }
        } else {
            console.error("Proposta não encontrada ou erro na resposta:", resposta);
            mostrarLoading(false);
            return;
        }

        configurarControles();
        configurarAceite();
        mostrarLoading(false);
        
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
        const response = await fetch(`./views/status_proposta.html`);
        const html = await response.text();
        container.innerHTML = html;

        const titulo = document.getElementById('status-title');
        const msg = document.getElementById('status-message');
        const icone = document.getElementById('status-icon');

        if (motivo === 'bloqueado') {
            if (titulo) titulo.innerText = "Acesso Restrito";
            if (msg) msg.innerText = "Este dispositivo ainda não possui autorização de hardware para visualizar este projeto. Por favor, solicite a liberação ao gestor.";
            if (icone) icone.className = "fas fa-shield-halved";
        } else if (motivo === 'expirada') {
            if (titulo) titulo.innerText = "Proposta Expirada";
            if (msg) msg.innerText = "Este documento técnico teve seu prazo de validade encerrado. Os valores e condições precisam ser reavaliados pelo setor de engenharia.";
            if (icone) icone.className = "fas fa-hourglass-end";
        }
        
        // Oculta elementos que não devem aparecer em estados de erro
        if (modalAceite) modalAceite.style.display = 'none';
        document.querySelector('.footer-fixo').style.display = 'none';
        document.querySelector('.seletor-proposta').style.display = 'none';

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
            'economia_anual': 'economiaAno1',
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
                    if (chaveOriginal.includes('marca')) valor = item.marca || "Tier 1";
                    if (chaveOriginal.includes('modelo')) valor = `<span class="product-qty">${item.qtd}x</span> Módulos de ${item.watts}W`;
                    if (chaveOriginal.includes('tecnologia')) valor = "N-Type Monocristalino";
                    if (chaveOriginal.includes('garantia')) valor = item.garantia || "25 anos";
                }
            }
            // Tenta extrair dados do primeiro inversor
            if (chaveOriginal.includes('inversor') || chaveOriginal.includes('monitorizacao')) {
                const item = dadosConsolidados.inversores?.[0] || app.dados.inversores?.[0];
                if (item) {
                    if (chaveOriginal.includes('marca')) valor = item.modelo?.split('-')[0] || "Huawei";
                    if (chaveOriginal.includes('modelo')) valor = `<span class="product-qty">01x</span> Huawei - ${item.nominal}W`;
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
                campo.innerText = valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
                campo.innerText = valor.map(item => {
                    const nome = item.modelo || item.descricao || item.nome || '';
                    const qtd = item.quantidade || item.qtd || '';
                    return qtd ? `${qtd}x ${nome}` : nome;
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
        optStd.classList.toggle('ativa', app.propostaAtiva === 'standard');
        optPre.classList.toggle('ativa', app.propostaAtiva === 'premium');
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
        modal.style.transition = 'opacity 0.5s ease';
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            carregarView(); 
        }, 500);
    });
}

function configurarControles() {
    document.getElementById('btn-avancar').addEventListener('click', () => navegar(1));
    document.getElementById('btn-voltar').addEventListener('click', () => navegar(-1));
}

function alternarProposta(tipo) {
    app.propostaAtiva = tipo;
    document.body.className = `theme-${tipo}`;
    atualizarInterfaceSelecao();
    
    // Re-preenche a view atual com os novos dados do JSON (Premium vs Standard)
    preencherDadosView();
    atualizarDinamicos(app.dados.versoes[tipo].dados);
}

function navegar(direcao) {
    const novaEtapa = app.etapaAtual + direcao;
    if (novaEtapa >= 0 && novaEtapa < app.etapas.length) {
        app.etapaAtual = novaEtapa;
        carregarView();
        window.scrollTo(0, 0);
    }
}

async function carregarView() {
    const container = document.getElementById('view-container');
    const nomeView = app.etapas[app.etapaAtual];
    
    try {
        const response = await fetch(`./views/${nomeView}.html`);
        if (!response.ok) throw new Error(`Erro ao carregar HTML: ${nomeView}`);
        const html = await response.text();
        container.innerHTML = html;

        document.getElementById('etapa-atual').innerText = app.etapaAtual + 1;
        document.getElementById('btn-voltar').style.visibility = app.etapaAtual === 0 ? 'hidden' : 'visible';
        document.getElementById('btn-avancar').style.visibility = app.etapaAtual === (app.etapas.length - 1) ? 'hidden' : 'visible';

        preencherDadosView();
        atualizarInterfaceSelecao(); // Garante que os cards e o badge reflitam o estado atual
    } catch (e) {
        console.error("Erro ao carregar view:", e);
        container.innerHTML = `<p style="text-align:center; padding:20px;">Erro ao carregar etapa: ${nomeView}</p>`;
    }
}

// Inicia o sistema
init();