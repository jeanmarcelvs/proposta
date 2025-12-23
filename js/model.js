// Importa as funções da API
import { get, patch, post, getSelicTaxa, validarDispositivoHardware } from './api.js';

// ======================================================================
// CONSTANTES AJUSTADAS PARA SIMULAR OS VALORES DO BANCO BV
// ======================================================================

const IOF_FIXO = 0.0038;
const IOF_DIARIO = 0.000082;
const DIAS_CARENCIA = 120; // 120 dias de carência (apenas para cálculo do IOF Diário)

// AJUSTADO: Valores de spread recalibrados para simular a tabela do Banco BV.
const SPREAD_POR_VALOR = {
    faixa_1: 0.2515,
    faixa_2: 0.2515, // AJUSTADO
    faixa_3: 0.2515, // AJUSTADO
};

// AJUSTADO: Fator de risco recalibrado para simular a tabela do Banco BV.
const FATOR_RISCO_PRAZO = 0.00046; // AJUSTADO

// ======================================================================
// FIM DAS CONSTANTES
// ======================================================================

const detalhesInstalacaoPremiumVE = [
    { icone: 'fa-pen-ruler', texto: 'Projeto Elétrico da instalação conforme normas ABNT (NBR 5410/2004 e NBR 17019/2022)' },
    { icone: 'fa-check-circle', texto: 'Instalação com infraestrutura elétrica reforçada com padrão de sobrepor em aço zincado' },
    { icone: 'fa-bolt', texto: 'Sistema de proteção completo e coordenado contra surtos da rede de energia, desde o Quadro Geral até o ponto de recarga' }
];

const detalhesInstalacaoAcessivelVE = [
    { icone: 'fa-pen-ruler', texto: 'Projeto Elétrico da instalação conforme normas ABNT (NBR 5410/2004 e NBR 17019/2022)' },
    { icone: 'fa-triangle-exclamation', texto: 'Instalação elétrica básica com padrão de sobrepor em PVC' },
    { icone: 'fa-triangle-exclamation', texto: 'Dispositivo de proteção simples apenas no ponto de recarga' }
];

const resumoInstalacaoPremiumVE = 'Uma infraestrutura que garante máxima segurança e conformidade para o seu Wallbox, preparada para proteger seu investimento com materiais de alta qualidade.';
const resumoInstalacaoAcessivelVE = 'Uma solução básica mas em conformidade com os requisitos mínimos normativos.';


// Objeto que armazena os dados da proposta, incluindo as duas versões
let dadosProposta = {
    premium: null,
    acessivel: null
};

// Objeto que centraliza os caminhos das imagens
const caminhosImagens = {
    solar: {
        equipamentos: {
            premium: 'imagens/huawei.webp',
            acessivel: 'imagens/auxsolar.webp'
        },
        instalacao: {
            premium: 'imagens/instalacao-premium.webp',
            acessivel: 'imagens/instalacao-acessivel.webp'
        }
    },
    ve: {
        equipamentos: {
            premium: 'imagens/marca-ve-premium.webp',
            acessivel: 'imagens/marca-ve-acessivel.webp'
        },
        instalacao: {
            premium: 'imagens/instalacao-ve-premium.webp',
            acessivel: 'imagens/instalacao-ve-acessivel.webp'
        }
    }
};

// Detalhes de instalação fixos para a proposta Premium (dados corrigidos)
// ATUALIZADO: Foco em Risco Zero, Durabilidade e Padrão Industrial.
const detalhesInstalacaoPremium = [
    {
        icone: 'fa-user-shield',
        titulo: 'Decisão Pensada para o Longo Prazo',
        texto: 'Indicada para quem prefere fazer uma escolha consciente hoje e não revisitar essa decisão no futuro.'
    },
    {
        icone: 'fa-chart-line',
        titulo: 'Comportamento Estável ao Longo dos Anos',
        texto: 'Projeto voltado à constância de funcionamento e previsibilidade de resultado com o passar do tempo.'
    },
    {
        icone: 'fa-home',
        titulo: 'Perfil de Consumidor',
        texto: 'Consumidores exigentes, que valorizam organização, padrão elevado e tranquilidade.'
    }
];

// Detalhes de instalação fixos para a proposta Acessível (dados corrigidos)
// ATUALIZADO: Foco em Viabilidade, Economia Imediata e Acompanhamento.
const detalhesInstalacaoAcessivel = [
    {
        icone: 'fa-info-circle',
        titulo: 'Solução Simplificada',
        texto: 'Indicada para consumidores que priorizam um investimento inicial mais baixo.'
    }];

// NOVO: Resumos para a seção de instalação
const resumoInstalacaoPremium =
    "Esta proposta foi concebida para consumidores que valorizam previsibilidade, estabilidade e tranquilidade ao longo dos anos. O foco é reduzir riscos técnicos e evitar custos ocultos que só aparecem com o tempo.";

const resumoInstalacaoAcessivel =
    "Esta proposta prioriza a redução do investimento inicial, adotando soluções mais simples.";

// NOVO: Dados para o Aceite Consciente (Gate de Leitura)
const dadosAceite = {
    titulo: "Antes de visualizar a proposta",
    paragrafo1: "Tratando-se de projeto fotovoltaico, a diferença no valor costuma ser pequena. O que muda é o comportamento do sistema ao longo do tempo.",
    paragrafo2: "Algumas propostas priorizam apenas o custo inicial. Outras são pensadas para oferecer maior previsibilidade, estabilidade e tranquilidade ao longo dos anos.",
    textoCheckbox: "Li e estou ciente dessas diferenças",
    textoBotao: "Estou ciente"
};

/**
 * Função auxiliar para encontrar um objeto no array 'variables' pela chave
 * e retornar seu valor formatado.
 * @param {Array} variables O array de objetos de onde extrair os dados.
 * @param {string} key A chave do objeto a ser encontrado.
 * @returns {string|null} O valor formatado ou null se não encontrado.
 */
function extrairValorVariavelPorChave(variables, key) {
    const item = variables.find(obj => obj.key === key);
    return item ? item.formattedValue : null;
}

/**
 * Função auxiliar para encontrar um objeto no array 'variables' pela chave
 * e retornar seu valor numérico.
 * @param {Array} variables O array de objetos de onde extrair os dados.
 * @param {string} key A chave do objeto a ser encontrado.
 * @returns {number|null} O valor numérico ou null se não encontrado.
 */
function extrairValorNumericoPorChave(variables, key) {
    const item = variables.find(obj => obj.key === key);
    if (!item || item.value === null || item.value === undefined) {
        return null;
    }
    // Converte a string do valor para número, substituindo vírgulas por pontos.
    return parseFloat(String(item.value).replace(',', '.'));
}

/**
 * Função para tratar a string de payback (ex: "2 anos e 2 meses") e retornar os anos e meses.
 * @param {string} textoPayback A string de payback do JSON.
 * @returns {{anos: number, meses: number}} Objeto com anos e meses.
 */
function extrairValorPayback(textoPayback) {
    const regex = /(\d+)\s+anos?\s+e\s+(\d+)\s+meses?/;
    const match = textoPayback?.match(regex);
    if (match) {
        return {
            anos: parseInt(match[1]),
            meses: parseInt(match[2])
        };
    }
    return {
        anos: 0,
        meses: 0
    };
}

/**
 * Função para formatar um total de meses em "X anos e Y meses".
 * @param {number} totalMeses O total de meses a ser formatado.
 * @returns {string} A string formatada.
 */
function formatarPayback(totalMeses) {
    if (totalMeses < 0) totalMeses = 0;
    const anos = Math.floor(totalMeses / 12);
    // Alterado para Math.ceil() para arredondar os meses para cima.
    const meses = Math.ceil(totalMeses % 12);

    if (anos === 0 && meses === 0) {
        return "Não informado";
    }

    // Tratamento para o caso de o cálculo resultar em 12 meses
    const anosCalculados = meses === 12 ? anos + 1 : anos;
    const mesesCalculados = meses === 12 ? 0 : meses;

    const textoAnos = anosCalculados > 0 ? `${anosCalculados} ano${anosCalculados > 1 ? 's' : ''}` : '';
    const textoMeses = mesesCalculados > 0 ? `${mesesCalculados} mes${mesesCalculados > 1 ? 'es' : ''}` : '';

    if (textoAnos && textoMeses) {
        return `${textoAnos} e ${textoMeses}`;
    }

    return textoAnos || textoMeses;
}

/**
 * Função para formatar a data ISO 8601 (2025-08-20T23:33:46.000Z) para DD/MM/AAAA.
 * @param {string} dataISO A string de data no formato ISO 8601.
 * @returns {string} A data formatada.
 */
function formatarData(dataISO) {
    if (!dataISO) return 'N/A';
    const data = new Date(dataISO);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

// **NOVO: Função para validar se a proposta está expirada, usando o formato ISO 8601.**
/**
 * @param {object} proposta O objeto de dados da proposta (versão premium ou acessivel).
 * @returns {boolean} Retorna true se a proposta estiver ativa, false se estiver expirada.
 */
export function validarValidadeProposta(proposta) {
    if (!proposta || !proposta.dataExpiracao) {
        return false;
    }

    const dataAtual = new Date();
    const dataExpiracao = new Date(proposta.dataExpiracao);

    // Ajusta o fuso horário para a data de expiração, garantindo que a comparação seja precisa.
    // O `Date` do JavaScript já faz o ajuste automático, mas é bom ter certeza.
    // O `expirationDate` do JSON já vem em UTC, então a comparação é direta.

    const estaAtiva = dataAtual <= dataExpiracao;

    return estaAtiva;
}

// ======================================================================
// 🔒 LÓGICA DE SEGURANÇA (FINGERPRINT + LOCALSTORAGE)
// ======================================================================

/**
 * Coleta dados ESTÁVEIS do dispositivo para o Hash Tolerante.
 * Evita usar dados variáveis como IP, versão exata ou bateria.
 */
function getDadosEstaveisDispositivo() {
    const ua = navigator.userAgent;

    // 1. Sistema Operacional (Estável)
    let os = "Outro OS";
    if (ua.includes("Win")) os = "Windows";
    else if (ua.includes("Mac") && !ua.includes("Mobile")) os = "MacOS";
    else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    // 2. Navegador Principal (Estável - ignora versão menor)
    let navegador = "Outro Navegador";
    if (ua.includes("Chrome") && !ua.includes("Edg")) navegador = "Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) navegador = "Safari";
    else if (ua.includes("Firefox")) navegador = "Firefox";
    else if (ua.includes("Edg")) navegador = "Edge";

    // 3. Tipo de Dispositivo
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    const tipoDispositivo = isMobile ? "Mobile" : "Desktop";

    // 4. Identificador Único Persistente (Client-Side UUID)
    // Adiciona entropia para diferenciar dispositivos com mesmo hardware/software (ex: dois PCs Windows/Chrome).
    let deviceId = localStorage.getItem('cap_device_id');
    console.debug(`[Debug Segurança] Verificando UUID no localStorage...`);
    if (!deviceId) {
        console.debug(`[Debug Segurança] UUID não encontrado. Gerando um novo.`);
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            deviceId = crypto.randomUUID();
        } else {
            // Fallback simples para navegadores antigos
            deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }
        localStorage.setItem('cap_device_id', deviceId);
    } else {
        console.debug(`[Debug Segurança] UUID encontrado: ${deviceId}`);
    }

    return {
        os,
        navegador: `${navegador}::${deviceId}`, // Concatena ID para tornar o hash único no Worker
        navegadorLimpo: navegador, // Mantém o nome limpo para exibição
        tipoDispositivo
    };
}

/**
 * Verifica se o dispositivo atual tem permissão para acessar a proposta.
 * Implementa a lógica de "Primeiro Acesso" e "Chave Reserva Local".
 * @param {string} projectId O ID do projeto.
 * @param {string} clienteNome O nome do cliente para o log.
 * @returns {Promise<boolean>} True se o acesso for permitido, False se for bloqueado.
 */
export async function verificarAcessoDispositivo(projectId) {
    try {
        console.log("[Segurança] Iniciando verificação de acesso do dispositivo.");

        // 1. Coleta dados estáveis (sem FingerprintJS)
        const dadosEstaveis = getDadosEstaveisDispositivo();
        console.debug("[Debug Segurança] Dados estáveis coletados:", dadosEstaveis);

        // 2. Monta o payload para o Worker
        const payload = {
            projectId: projectId,
            dispositivoNome: `${dadosEstaveis.tipoDispositivo} via ${dadosEstaveis.navegadorLimpo}`,
            os: dadosEstaveis.os,
            navegador: dadosEstaveis.navegador, // Envia 'Chrome::UUID' para garantir hash único
            tipoDispositivo: dadosEstaveis.tipoDispositivo
        };
        console.debug("[Debug Segurança] Payload enviado para o Worker:", payload);

        // 3. Envia para o Worker (Backend) que fará toda a lógica de Hash, JSON e Bloqueio
        const resposta = await validarDispositivoHardware(payload);
        console.debug("[Debug Segurança] Resposta recebida do Worker:", resposta);

        const storageKey = `dono_registrado_${projectId}`;

        if (resposta.sucesso) {
            // Caso 1: O Worker diz que este é o DONO.
            if (resposta.status === 'dono') {
                // Verificamos no localStorage se já registramos um dono para este projeto antes.
                if (localStorage.getItem(storageKey)) {
                    // ANOMALIA DETECTADA: O Worker está criando um segundo "dono".
                    // Isso significa que o dispositivo atual é diferente do primeiro.
                    // BLOQUEAMOS por segurança, pois o Worker deveria ter retornado 'pendente'.
                    console.error("[Segurança] ANOMALIA: Worker tentou registrar um segundo 'dono'. Bloqueando acesso.");
                    return false;
                } else {
                    // É o primeiro "dono" legítimo. Permitimos o acesso e marcamos no localStorage.
                    console.log(`[Segurança] Acesso autorizado. Status: ${resposta.status}. Registrando dono localmente.`);
                    localStorage.setItem(storageKey, 'true');
                    return true;
                }
            }

            // Caso 2: O Worker reconheceu um dono existente.
            if (resposta.status === 'autorizado') {
                console.log(`[Segurança] Acesso autorizado. Status: ${resposta.status}`);
                return true;
            }

            // Caso 3: O Worker registrou como pendente.
            if (resposta.status === 'pendente') {
                console.warn(`[Segurança] Dispositivo registrado como PENDENTE. Acesso bloqueado aguardando aprovação.`);
                return false;
            }
        }

        // Caso sucesso: false (ex: bloqueado explicitamente, erro 403) ou status desconhecido
        console.warn(`[Segurança] Acesso BLOQUEADO. Motivo: ${resposta.mensagem || 'Desconhecido'}`);
        return false;

    } catch (error) {
        console.error("[Segurança] Erro crítico na verificação:", error);
        // SEGURANÇA: Alterado para Fail Closed. Se a verificação falhar (ex: erro de rede/CORS), bloqueia o acesso.
        return false;
    }
}


// **FUNÇÃO DE CÁLCULO DA TIR** (permanece inalterada)
function calcularTIRMensal(valorFinanciado, valorParcela, numeroParcelas) {
    let guess = 0.01;
    const tolerance = 0.0000000001;
    let low = 0;
    let high = 1;
    let i = 0;

    while (i < 1000) {
        let vpl = -valorFinanciado;
        for (let j = 1; j <= numeroParcelas; j++) {
            vpl += valorParcela / Math.pow(1 + guess, j);
        }

        if (Math.abs(vpl) < tolerance) {
            return guess;
        }

        if (vpl > 0) {
            low = guess;
        } else {
            high = guess;
        }

        guess = (low + high) / 2;
        i++;
    }

    return guess;
}

// ALTERADO: Função para calcular o financiamento com a lógica da Tabela Price
function calcularFinanciamento(valorProjeto, selicAnual) {
    const selicDecimal = selicAnual / 100;
    const opcoesParcelas = [12, 24, 36, 48, 60, 72, 84];
    const simulacao = {};
    const taxasNominais = {};
    const taxasEfetivas = {};

    let spreadBaseAnual;
    // A lógica das faixas de valor foi alterada para refletir os spreads corrigidos.
    if (valorProjeto > 50000) {
        spreadBaseAnual = SPREAD_POR_VALOR.faixa_1;
    } else if (valorProjeto > 20000) {
        spreadBaseAnual = SPREAD_POR_VALOR.faixa_2;
    } else {
        spreadBaseAnual = SPREAD_POR_VALOR.faixa_3;
    }

    // Adiciona o IOF ao valor financiado
    const iofFixoCalculado = IOF_FIXO * valorProjeto;
    const iofDiarioCalculado = IOF_DIARIO * DIAS_CARENCIA * valorProjeto;
    const valorFinanciado = valorProjeto + iofFixoCalculado + iofDiarioCalculado;

    opcoesParcelas.forEach(n => {
        // A nova lógica de spread agora inclui o fator de risco.
        const jurosAnualNominal = selicDecimal + spreadBaseAnual + (n * FATOR_RISCO_PRAZO);

        const jurosMensalNominal = (Math.pow((1 + jurosAnualNominal), (1 / 12))) - 1;

        if (jurosMensalNominal <= 0) {
            const valorParcela = (valorFinanciado / n);
            simulacao[`parcela-${n}`] = valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            taxasNominais[`taxaNominal-${n}`] = 0;
            taxasEfetivas[`taxaAnualEfetiva-${n}`] = 0;
            return;
        }

        // CORREÇÃO: Usando o valor financiado SEM os juros de carência.
        const parcela = (valorFinanciado * jurosMensalNominal * Math.pow((1 + jurosMensalNominal), n)) / (Math.pow((1 + jurosMensalNominal), n) - 1);

        simulacao[`parcela-${n}`] = parcela.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        taxasNominais[`taxaNominal-${n}`] = jurosMensalNominal;
        const taxaMensalEfetiva = calcularTIRMensal(valorFinanciado, parcela, n);
        taxasEfetivas[`taxaAnualEfetiva-${n}`] = Math.pow(1 + taxaMensalEfetiva, 12) - 1;
    });

    return {
        parcelas: simulacao,
        taxasNominais: taxasNominais,
        taxasEfetivas: taxasEfetivas
    };
}

/**
 * Função para tratar e formatar os dados brutos da API para o formato que a página precisa.
 * @param {object} dadosApi O objeto de dados brutos recebido da API.
 * @param {string} tipoProposta O tipo da proposta (ex: 'premium' ou 'acessivel').
 * @param {number} selicAtual A taxa Selic atual em formato decimal.
 * @returns {object} Um objeto com os dados formatados para a página.
 */
function tratarDadosParaProposta(dadosApi, tipoProposta, selicAtual) {
    // Log para confirmar que a versão com os novos textos e Aceite Consciente foi carregada
    console.log(`[Model] Processando proposta ${tipoProposta} - Versão atualizada com Aceite Consciente.`);

    if (!dadosApi || !dadosApi.dados) {
        console.error("Modelo: Dados da API não encontrados ou incompletos.");
        return null;
    }

    const dados = dadosApi.dados.data;
    const variables = dados.variables || [];

    const tipoVisualizacao = extrairValorVariavelPorChave(variables, 'cap_visualizacao') || 'SOLAR';
    const isVE = tipoVisualizacao.toUpperCase() === 'VE';

    // Variáveis comuns a ambos os tipos de proposta
    const nomeCliente = extrairValorVariavelPorChave(variables, 'cliente_nome') || 'Não informado';
    const dataProposta = formatarData(dados.generatedAt) || 'Não informado';
    const idProposta = dados.id || null;
    const linkProposta = dados.linkPdf || '#';
    const cidade = extrairValorVariavelPorChave(variables, 'cliente_cidade') || 'Não informado';
    const estado = extrairValorVariavelPorChave(variables, 'cliente_estado') || 'Não informado';
    const valorTotal = extrairValorNumericoPorChave(variables, 'preco') || 0;
    const dataExpiracao = dados.expirationDate || 'Não informado';

    // Lógica para extração de dados específicos de cada tipo
    let sistema = {};
    let equipamentos = {};
    let valores = {};
    let instalacao = {};

    // --- CORREÇÃO: A lógica para extração de dados de VE foi unificada com a de Solar ---
    const geracaoMediaValor = extrairValorNumericoPorChave(variables, 'geracao_mensal') || 0;
    const payback = extrairValorVariavelPorChave(variables, 'payback') || 'Não informado';
    const tarifaEnergia = extrairValorNumericoPorChave(variables, 'tarifa_distribuidora_uc1') || 0;
    const idealParaValor = geracaoMediaValor * tarifaEnergia;

    const { parcelas: parcelasCalculadas, taxasNominais } = calcularFinanciamento(valorTotal, selicAtual);
    const taxasPorParcela = {};
    for (const key in taxasNominais) {
        if (taxasNominais.hasOwnProperty(key)) {
            const taxaMensalNominal = taxasNominais[key];
            taxasPorParcela[key] = `${(taxaMensalNominal * 100).toFixed(2).replace('.', ',')}% a.m.`;
        }
    }

    // NOVO: Define os checklists para cada tipo de proposta
    const checklistPremium = [
        'Infraestrutura metálica de padrão industrial',
        'Proteção elétrica coordenada em múltiplos níveis',
        'Menor risco de manutenção futura'
    ];
    const checklistStandard = [
        'Infraestrutura simplificada de uso residencial',
        'Proteções básicas',
        'Maior dependência de manutenção futura'
    ];

    sistema = {
        geracaoMedia: isVE ? `${extrairValorVariavelPorChave(variables, 'geracao_mensal')} kWh/mês` : `${extrairValorVariavelPorChave(variables, 'geracao_mensal')} kWh/mês`,
        unidadeGeracao: 'kWh',
        instalacaoPaineis: extrairValorVariavelPorChave(variables, 'vc_tipo_de_estrutura') || 'Não informado',
        idealPara: idealParaValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    };
    equipamentos = {
        imagem: isVE ? caminhosImagens.ve.equipamentos[tipoProposta] : caminhosImagens.solar.equipamentos[tipoProposta],
        quantidadePainel: extrairValorVariavelPorChave(variables, 'modulo_quantidade') || 0,
        descricaoPainel: (extrairValorVariavelPorChave(variables, 'modulo_potencia') || 'Não informado') + ' W',
        quantidadeInversor: extrairValorVariavelPorChave(variables, 'inversores_utilizados') || 0,
        descricaoInversor: (extrairValorVariavelPorChave(variables, 'inversor_potencia_nominal_1') || 'Não informado') + ' W'
    };
    instalacao = {
        imagem: isVE ? caminhosImagens.ve.instalacao[tipoProposta] : caminhosImagens.solar.instalacao[tipoProposta],
        detalhesInstalacao: isVE ? (tipoProposta === 'premium' ? detalhesInstalacaoPremiumVE : detalhesInstalacaoAcessivelVE) : (tipoProposta === 'premium' ? detalhesInstalacaoPremium : detalhesInstalacaoAcessivel),
        resumoInstalacao: isVE ? (tipoProposta === 'premium' ? resumoInstalacaoPremiumVE : resumoInstalacaoAcessivelVE) : (tipoProposta === 'premium' ? resumoInstalacaoPremium : resumoInstalacaoAcessivel),
        checklist: tipoProposta === 'premium' ? checklistPremium : checklistStandard
    };
    valores = {
        valorTotal: valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        payback: payback,
        parcelas: isVE ? {} : parcelasCalculadas,
        taxasPorParcela: isVE ? {} : taxasPorParcela,
        observacao: isVE ? ' ' : 'Os valores de financiamento são estimativas baseadas em taxas médias de mercado, com carência de até 120 dias. As condições finais podem variar conforme análise de crédito da instituição financeira.'
    };

    const retorno = {
        tipo: tipoProposta,
        tipoVisualizacao: tipoVisualizacao.toLowerCase(),
        id: dados.project.id,
        propostaId: idProposta,
        cliente: nomeCliente,
        local: `${cidade} / ${estado}`,
        dataProposta: dataProposta,
        dataExpiracao: dataExpiracao,
        linkProposta: linkProposta,
        dadosAceite: dadosAceite,
        sistema,
        equipamentos,
        instalacao,
        valores,
        validade: `Proposta válida por até 3 dias corridos. Após esse prazo, condições técnicas, custos e disponibilidade podem ser reavaliados.`,
        // Adiciona o array completo de variáveis para uso no controller (ex: seção de expansão)
        variables: variables
    };

    return retorno;
}

// **RESTANTE DO CÓDIGO** (permanece inalterado)
export async function buscarETratarProposta(numeroProjeto, primeiroNomeCliente) {
    const endpointPremium = `/projects/${numeroProjeto}/proposals`;
    const dadosApiPrincipal = await get(endpointPremium); // Renomeado para 'Principal'

    if (!dadosApiPrincipal.sucesso) {
        console.error('Falha na busca da proposta premium.');
        return {
            sucesso: false,
            mensagem: 'Projeto não encontrado ou dados inválidos.'
        };
    }

    const propostaPrincipal = dadosApiPrincipal.dados.data;

    // Acessa o nome do cliente a partir das variáveis
    const nomeCompletoApi = extrairValorVariavelPorChave(propostaPrincipal.variables, 'cliente_nome');
    const primeiroNomeApi = nomeCompletoApi ? nomeCompletoApi.split(' ')[0] : null;

    if (!primeiroNomeApi || primeiroNomeApi.toLowerCase() !== primeiroNomeCliente.toLowerCase()) { // Correção: usar propostaPrincipal
        console.error("Tentativa de acesso não autorizado. Nome não corresponde.");
        return { sucesso: false, mensagem: 'Nome do cliente não corresponde ao projeto.' };
    }

    // --- NOVA LÓGICA DE VALIDAÇÃO ANTECIPADA DA PROPOSTA PREMIUM ---
    // Cria um objeto temporário para a verificação de validade
    const propostaParaValidarPremium = {
        dataExpiracao: propostaPrincipal.expirationDate, // Correção: usar propostaPrincipal
    };
    if (!validarValidadeProposta(propostaParaValidarPremium)) {
        return {
            sucesso: false,
            mensagem: 'Proposta expirada. Por favor, solicite uma nova.'
        };
    }
    // --- FIM DA NOVA LÓGICA ---

    const selicAtual = await getSelicTaxa();
    if (selicAtual === null) {
        return {
            sucesso: false,
            mensagem: 'Não foi possível obter a taxa Selic para o cálculo do financiamento.'
        };
    }

    // Resetar dadosProposta para garantir um estado limpo antes de popular
    dadosProposta.premium = null;
    dadosProposta.acessivel = null;

    // NOVO: Determina o tipo da proposta principal (Premium ou Basic/Acessível)
    let tipoPropostaPrincipal = extrairValorVariavelPorChave(propostaPrincipal.variables, 'cape_padrao_instalacao');
    const idProjetoAcessivel = extrairValorVariavelPorChave(propostaPrincipal.variables, 'vc_projeto_acessivel');

    if (!tipoPropostaPrincipal) {
        // Tentativa de inferência: Se tem projeto acessível vinculado, assume-se que é Premium
        if (idProjetoAcessivel && parseInt(idProjetoAcessivel) > 0) {
            tipoPropostaPrincipal = 'PREMIUM';
        }
    }

    // Cenário 1: A proposta principal é PREMIUM e tem uma proposta acessível vinculada.
    if (tipoPropostaPrincipal === 'PREMIUM' && idProjetoAcessivel && idProjetoAcessivel > 0) {
        const propostaPremiumTratada = tratarDadosParaProposta(dadosApiPrincipal, 'premium', selicAtual);
        if (!propostaPremiumTratada) {
            return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Premium.' };
        }
        dadosProposta.premium = propostaPremiumTratada;

        // Busca a proposta acessível vinculada
        const endpointAcessivel = `/projects/${idProjetoAcessivel}/proposals`;
        const dadosApiAcessivel = await get(endpointAcessivel);

        if (dadosApiAcessivel.sucesso) {
            const propostaParaValidarAcessivel = {
                dataExpiracao: dadosApiAcessivel.dados.data.expirationDate
            };

            if (validarValidadeProposta(propostaParaValidarAcessivel)) {
                const propostaAcessivel = tratarDadosParaProposta(dadosApiAcessivel, 'acessivel', selicAtual);
                if (propostaAcessivel) {
                    dadosProposta.acessivel = propostaAcessivel;
                } else {
                    console.warn("Falha ao processar dados da proposta Acessível vinculada.");
                }
            } else {
                console.warn("Proposta acessível vinculada expirada.");
            }
        } else {
            console.warn("Falha ao buscar a proposta acessível vinculada.");
        }

        // Cenário 2: A proposta principal é PREMIUM, mas é única (standalone).
    } else if (tipoPropostaPrincipal === 'PREMIUM') {
        const propostaPremiumTratada = tratarDadosParaProposta(dadosApiPrincipal, 'premium', selicAtual);
        if (!propostaPremiumTratada) {
            return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Premium.' };
        }
        dadosProposta.premium = propostaPremiumTratada;
        // dadosProposta.acessivel permanece null, o que está correto.

        // Cenário 3: A proposta principal é BASIC (Acessível) e é única.
    } else if (tipoPropostaPrincipal === 'BASIC' || tipoPropostaPrincipal === 'STANDARD') {
        const propostaAcessivelTratada = tratarDadosParaProposta(dadosApiPrincipal, 'acessivel', selicAtual);
        if (!propostaAcessivelTratada) {
            return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Acessível.' };
        }
        dadosProposta.acessivel = propostaAcessivelTratada;
        // dadosProposta.premium permanece null, o que está correto.

        // Cenário 4: Tipo de proposta desconhecido ou não definido.
    } else {
        return { sucesso: false, mensagem: `Padrão de instalação da proposta não reconhecido: ${tipoPropostaPrincipal} (esperado PREMIUM ou BASIC/STANDARD).` };
    }

    // Validação final: se nenhuma proposta foi carregada, retorna erro.
    if (!dadosProposta.premium && !dadosProposta.acessivel) {
        return { sucesso: false, mensagem: 'Não foi possível carregar nenhuma proposta válida.' };
    }

    return { sucesso: true, dados: dadosProposta };
}