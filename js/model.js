// Importa as funções da API
import { get, patch, post, getSelicTaxa, validarDispositivoHardware, buscarDadosCompletos, buscarPropostaPorIdENome } from './api.js';

// Re-exporta post para uso nos controllers
export { post };

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
    }
};

// Detalhes de instalação fixos para a proposta Premium (dados corrigidos).
// ATUALIZADO: Foco em Risco Zero, Durabilidade e Padrão Industrial.
const detalhesInstalacaoPremium = [
    {
        icone: 'fa-user-shield',
        titulo: 'Pensado para durar',
        texto: 'Projeto técnico que reduz riscos ao longo do tempo.'
    },
    {
        icone: 'fa-chart-line',
        titulo: 'Engenharia real',
        texto: 'Dimensionamento preciso evita perdas futuras.'
    },
    {
        icone: 'fa-home',
        titulo: 'Perfil criterioso',
        texto: 'Para quem prioriza decisões bem fundamentadas.'
    }
];

// Detalhes de instalação fixos para a proposta Acessível (dados corrigidos)
// ATUALIZADO: Foco em Viabilidade, Economia Imediata e Acompanhamento.
const detalhesInstalacaoAcessivel = [
    {
        icone: 'fa-info-circle',
        titulo: 'Solução Básica',
        texto: 'Atende o básico com menor investimento inicial.',
        microtexto: 'Infraestrutura simplificada.'
    }];

// NOVO: Resumos para a seção de instalação
const resumoInstalacaoPremium =
    "Essa proposta prioriza estabilidade estrutural e comportamento confiável ao longo dos anos, mesmo sob variações naturais de uso, clima e carga elétrica.";

const resumoInstalacaoAcessivel =
    "Uma solução funcional para quem busca reduzir o investimento inicial, mantendo atendimento às exigências técnicas básicas.";

// NOVO: Dados para o Aceite Consciente (Gate de Leitura)
const dadosAceite = {
    titulo: "Entenda o modelo de trabalho",
    texto: `Esta não é uma simples oferta de kit solar. <br>
    É um serviço de <strong>engenharia consultiva e gestão</strong>. Como engenheiro responsável, eu gerencio a integração entre as suas necessidades e as melhores marcas do setor, assumindo a responsabilidade técnica por cada decisão para assegurar a performance da sua solução.`,
    textoCheckbox: "Li e estou ciente dessas diferenças",
    textoBotao: "Estou ciente e quero prosseguir"
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

// NOVO: Função para calcular parcelas de cartão de crédito (temporariamente com lógica de financiamento)
export function calcularParcelasCartao(valorProjeto, selicAnual) {
    // ATUALIZADO: Usando taxas fixas fornecidas.
    const taxasCartao = {
        'debito': 0.0229,
        '1': 0.0549,
        '2': 0.1089,
        '3': 0.1199,
        '4': 0.1259,
        '5': 0.1329,
        '6': 0.1399,
        '7': 0.1499,
        '8': 0.1559,
        '9': 0.1619,
        '10': 0.1689,
        '11': 0.1789,
        '12': 0.1829
    };

    const simulacao = {};

    Object.keys(taxasCartao).forEach(key => {
        const taxa = taxasCartao[key];
        const valorFinal = valorProjeto / (1 - taxa);
        const valorParcela = key === 'debito' ? valorFinal : valorFinal / parseInt(key);
        simulacao[`parcela-${key}`] = valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    });

    return { parcelas: simulacao };
}

// **NOVO: Função para validar se a proposta está expirada, usando o formato ISO 8601.**
/**
 * @param {object} proposta O objeto de dados da proposta (versão premium ou acessivel).
 * @returns {boolean} Retorna true se a proposta estiver ativa, false se estiver expirada.
 */
export function validarValidadeProposta(proposta) {
    // Se não houver data de expiração definida, assumimos válida para compatibilidade
    if (!proposta || !proposta.dataExpiracao || proposta.dataExpiracao === 'Não informado') {
        return true;
    }

    try {
        let dataExpiracao;
        let dataString = proposta.dataExpiracao;

        // Garante que é string para evitar erros de tipo
        if (typeof dataString !== 'string') {
            dataString = String(dataString);
        }

        // Tratamento robusto de data
        // 1. Formato D1 ERP (YYYY-MM-DD) -> Define para final do dia (23:59:59)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
            // Divide e cria manualmente para garantir fuso local (evita UTC do Date.parse)
            const partes = dataString.split('-');
            dataExpiracao = new Date(partes[0], partes[1] - 1, partes[2], 23, 59, 59);
        } 
        // 2. Formato Brasileiro (DD/MM/YYYY) -> Define para final do dia
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataString)) {
            const partes = dataString.split('/');
            dataExpiracao = new Date(partes[2], partes[1] - 1, partes[0], 23, 59, 59);
        }
        // 3. Formato ISO Completo ou outros aceitos pelo Date constructor
        else {
            dataExpiracao = new Date(dataString);
        }

        // Se a data for inválida, bloqueia o acesso (Fail Closed)
        if (isNaN(dataExpiracao.getTime())) {
            console.warn("Data de expiração inválida/não parseável:", dataString);
            return false; 
        }

        const agora = new Date();
        
        // Debug para rastrear validação em produção (Verifique o console do navegador)
        // console.log(`[Validade] Data Proposta: ${dataString} | Limite: ${dataExpiracao.toLocaleString()} | Agora: ${agora.toLocaleString()} | Válida: ${agora <= dataExpiracao}`);

        return agora <= dataExpiracao;
    } catch (error) {
        console.error("Erro ao validar validade da proposta:", error);
        return false; // Bloqueia o acesso em caso de erro crítico
    }
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
            propostaId: projectId, // Agora passamos o ID da Proposta (o parâmetro projectId da função recebe o ID da URL)
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
                // Se já temos a chave, é apenas um reload ou retorno do mesmo dispositivo.
                if (localStorage.getItem(storageKey)) {
                    console.log(`[Segurança] Dono retornando (Reload). Acesso autorizado.`);
                    return true;
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
export function calcularFinanciamento(valorProjeto, selicAnual) {
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
 * @param {object} dadosCompletos O objeto contendo { projeto, proposta, cliente }.
 * @param {string} tipoProposta O tipo da proposta (ex: 'premium' ou 'acessivel').
 * @param {number} selicAtual A taxa Selic atual em formato decimal.
 * @returns {object} Um objeto com os dados formatados para a página.
 */
function tratarDadosParaProposta(dadosCompletos, tipoProposta, selicAtual) {
    // Log para confirmar que a versão com os novos textos e Aceite Consciente foi carregada
    console.log(`[Model] Processando proposta ${tipoProposta} - Versão atualizada com Aceite Consciente.`);

    const { projeto, proposta, cliente } = dadosCompletos;
    
    // Mapeamento do JSON do ERP para o Model da View
    // O ERP salva em 'versoes.standard' e 'versoes.premium'
    const chaveVersao = tipoProposta === 'acessivel' ? 'standard' : 'premium';
    const dadosVersao = proposta.versoes[chaveVersao];
    const resumoFin = dadosVersao.resumoFinanceiro;
    const dadosTec = dadosVersao.dados;

    const tipoVisualizacao = 'SOLAR'; // Padrão ERP atual é Solar
    const tipoVisualizacaoUpper = tipoVisualizacao.trim().toUpperCase();
    const isServico = tipoVisualizacaoUpper === 'SERVICO';

    // Variáveis comuns a ambos os tipos de proposta
    const nomeCliente = cliente.nome || 'Não informado';
    const dataProposta = formatarData(proposta.dataCriacao) || 'Não informado';
    const idProposta = proposta.id || null;
    const linkProposta = '#'; // Não usado no modelo novo
    const cidade = projeto.cidade || 'Não informado';
    const estado = projeto.uf || 'Não informado';
    const valorTotal = resumoFin.valorTotal || 0;
    const dataExpiracao = proposta.dataValidade || 'Não informado';

    // Lógica para extração de dados específicos de cada tipo
    let sistema = {};
    let equipamentos = {};
    let valores = {};
    let instalacao = {};
    let dadosServico = {};
    
    // Dados de Engenharia
    const geracaoMediaValor = proposta.geracaoMensal || 0;
    
    // Payback vem da análise financeira se existir, senão calcula estimado
    let payback = '3.5 anos';
    if (proposta.analiseFinanceira) {
        const valPb = tipoProposta === 'premium' ? proposta.analiseFinanceira.premium.paybackSimples : proposta.analiseFinanceira.standard.paybackSimples;
        if (valPb) {
            const anosFloat = parseFloat(valPb);
            const anos = Math.floor(anosFloat);
            const meses = Math.round((anosFloat - anos) * 12);
            
            if (meses === 0) payback = `${anos} anos`;
            else if (meses === 12) payback = `${anos + 1} anos`;
            else payback = `${anos} anos e ${meses} meses`;
        }
    }
        
    const tarifaEnergia = projeto.tarifaGrupoB || 0.95;
    
    let idealParaValor = geracaoMediaValor * tarifaEnergia;
    const analiseFin = proposta.analiseFinanceira?.[chaveVersao];
    if (analiseFin?.detalhes?.faturaSemSolarAno1) {
        idealParaValor = analiseFin.detalhes.faturaSemSolarAno1;
    }

    // NOVO: Lógica de Detalhamento do Investimento (Equipamentos vs Serviços)
    // Extrai o valor dos equipamentos da variável 'preco_equipamentos'
    const valorEquipamentos = resumoFin.valorKit || 0;
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

    const { parcelas: parcelasCalculadas, taxasNominais } = calcularFinanciamento(valorTotal, selicAtual);
    // NOVO: Calcula também as parcelas do cartão de crédito para Solar
    const { parcelas: parcelasCartaoSolar } = calcularParcelasCartao(valorTotal, selicAtual);

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

    // Extração de Equipamentos do JSON do ERP
    const inversorPrincipal = dadosTec.inversores[0] || { modelo: 'N/A', qtd: 0 };
    const moduloPrincipal = dadosTec.modulo || { watts: 0, qtd: 0 };
    
    // Descrição Inversor
    const descInversor = dadosTec.inversores.map(i => i.modelo).join(' + ');

    if (isServico) {
        // Lógica simplificada para Serviços
        const itensServico = [];
        let novoValorTotalServicos = 0;

        for (let i = 1; i <= 3; i++) {
            const descricao = (variables.find(v => v.key === `cap_descricao_servico_${i}`) || {}).value;
            if (!descricao) continue; // Pula para o próximo item se a descrição não existir

            const observacao = (variables.find(v => v.key === `cap_obs_servico_${i}`) || {}).value;
            const quantidade = extrairValorNumericoPorChave(variables, `cap_qtd_servico_${i}`) || 1;
            const valorUnitario = extrairValorNumericoPorChave(variables, `cap_vlr_unit_servico_${i}`) || 0;
            const valorTotalItem = quantidade * valorUnitario;

            itensServico.push({
                descricao,
                observacao,
                quantidade,
                valorUnitario: valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                valorTotalItem: valorTotalItem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            });
            novoValorTotalServicos += valorTotalItem;
        }

        const temItensDeServico = itensServico.length > 0;
        // O valor final é a soma dos itens. Se não houver itens, o valor é 0.
        const valorFinalDaProposta = novoValorTotalServicos;

        const descricaoGeral = extrairValorVariavelPorChave(variables, 'cap_descricao_geral_servico');
        const { parcelas: parcelasCartao } = calcularParcelasCartao(valorFinalDaProposta, selicAtual);

        dadosServico = {
            // Se não houver itens, usa a descrição antiga como fallback.
            descricao: null, // A descrição geral agora é o título
            tipoServico: descricaoGeral || extrairValorVariavelPorChave(variables, 'proposta_titulo') || 'Serviço Especializado',
            itens: itensServico,
            temItens: temItensDeServico
        };
        valores = {
            valorTotal: valorFinalDaProposta.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            valorTotalNum: valorFinalDaProposta, // Valor numérico para cálculos
            observacao: extrairValorVariavelPorChave(variables, 'condicoes_pagamento') || 'Consulte condições de pagamento.',
            observacaoServico: extrairValorVariavelPorChave(variables, 'cap_obs_servico') || null,
            parcelas: parcelasCartao
        };
        // Adiciona os detalhes da instalação Premium para servir como vitrine da qualidade da empresa
        instalacao = {
            imagem: caminhosImagens.solar.instalacao['premium'], // Usa a imagem do carrossel premium
            detalhesInstalacao: detalhesInstalacaoPremium,
            resumoInstalacao: resumoInstalacaoPremium
        };
    } else {
        // Lógica existente para Solar (VE removido)
        sistema = {
            geracaoMedia: `${geracaoMediaValor.toFixed(0)} kWh/mês`,
            unidadeGeracao: 'kWh',
            instalacaoPaineis: projeto.tipoTelhado || 'Não informado',
            idealPara: idealParaValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
            expansaoModulos: proposta.geracaoExpansao ? `+${Math.round(proposta.geracaoExpansao / 60)}` : '0', // Estimativa visual se não tiver qtd exata
            geracaoExpansao: proposta.geracaoExpansao ? `+${proposta.geracaoExpansao} kWh` : '0 kWh'
        };
        equipamentos = {
            imagem: caminhosImagens.solar.equipamentos[tipoProposta],
            quantidadePainel: moduloPrincipal.qtd || 0,
            descricaoPainel: (moduloPrincipal.watts || '0') + ' W',
            quantidadeInversor: inversorPrincipal.qtd || 0,
            descricaoInversor: descInversor
        };
        instalacao = {
            imagem: caminhosImagens.solar.instalacao[tipoProposta],
            detalhesInstalacao: (tipoProposta === 'premium' ? detalhesInstalacaoPremium : detalhesInstalacaoAcessivel),
            resumoInstalacao: (tipoProposta === 'premium' ? resumoInstalacaoPremium : resumoInstalacaoAcessivel),
            checklist: tipoProposta === 'premium' ? checklistPremium : checklistStandard
        };
        valores = {
            valorTotal: valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
            detalhamento: detalhamentoPagamento, // Objeto com a divisão calculada
            valorTotalNum: valorTotal, // Valor numérico para cálculos
            payback: payback,
            parcelas: parcelasCalculadas,
            parcelasCartao: parcelasCartaoSolar, // Adicionado para uso no controller
            taxasPorParcela: taxasPorParcela,
            selicAtual: selicAtual, // Passa a Selic para recalculos no controller
            observacao: 'Os valores de financiamento são estimativas baseadas em taxas médias de mercado, com carência de até 120 dias. As condições finais podem variar conforme análise de crédito da instituição financeira.'
        };
    }

    const retorno = {
        tipo: tipoProposta,
        tipoVisualizacao: tipoVisualizacao.toLowerCase(),
        id: projeto.id,
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
        dadosServico, // Novo campo
        valores,
        validade: `Proposta válida por até 3 dias corridos. Após esse prazo, condições técnicas, custos e disponibilidade podem ser reavaliados.`,
        // Adiciona o array completo de variáveis para uso no controller (ex: seção de expansão)
        variables: [] // Mantido vazio pois agora usamos objeto estruturado
    };

    return retorno;
}

// **RESTANTE DO CÓDIGO** (permanece inalterado)
export async function buscarETratarProposta(propostaId, primeiroNomeCliente) {
    // PASSO 1: Buscar a proposta validando o nome (Nova Rota de Segurança)
    const resProposta = await buscarPropostaPorIdENome(propostaId, primeiroNomeCliente);

    if (!resProposta.sucesso) {
        console.error('Falha na busca da proposta:', resProposta.erro);
        return {
            sucesso: false,
            mensagem: resProposta.erro || 'Proposta não encontrada ou dados inválidos.'
        };
    }

    const proposta = resProposta.dadosProposta;

    // CORREÇÃO: Se 'dados' vier como string do D1 (SQLite), fazemos o parse manual
    if (proposta && proposta.dados && typeof proposta.dados === 'string') {
        try {
            proposta.dados = JSON.parse(proposta.dados);
        } catch (e) {
            console.warn("Aviso: Falha ao converter string JSON em objeto (campo dados) no Model.", e);
        }
    }

    // PASSO 2: Usar dados complementares (Projeto e Cliente) já injetados no JSON da proposta
    // O Worker agora retorna o "Super JSON" com tudo aninhado.
    // ROBUSTNESS: Verifica se está na raiz ou dentro de .dados (caso venha do DB raw)
    const projetoAninhado = proposta.projeto || (proposta.dados && proposta.dados.projeto) || {};
    const clienteAninhado = proposta.cliente || (proposta.dados && proposta.dados.cliente) || {};

    if (!projetoAninhado.id && !clienteAninhado.nome) {
        console.warn("Aviso: Objeto Proposta não contém cliente/projeto aninhados. Verifique se o ERP está salvando o JSON completo.");
    }

    const dadosCompletos = {
        projeto: projetoAninhado,
        proposta: proposta,
        cliente: clienteAninhado
    };

    const selicAtual = await getSelicTaxa();
    if (selicAtual === null) {
        return {
            sucesso: false,
            mensagem: 'Não foi possível obter a taxa Selic para o cálculo.'
        };
    }

    dadosProposta.premium = null;
    dadosProposta.acessivel = null;

    // PASSO 3: Verificar o tipo de visualização
    // No ERP novo, a proposta sempre contém as versões Standard e Premium se configurado
    const config = proposta.configuracao || {};

    if (config.temPremium) {
        const propostaPremiumTratada = tratarDadosParaProposta(dadosCompletos, 'premium', selicAtual);
        if (!propostaPremiumTratada) {
            return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Premium.' };
        }
        dadosProposta.premium = propostaPremiumTratada;
    }

    if (config.temStandard) {
        const propostaAcessivelTratada = tratarDadosParaProposta(dadosCompletos, 'acessivel', selicAtual);
        if (!propostaAcessivelTratada) {
            return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Acessível.' };
        }
        dadosProposta.acessivel = propostaAcessivelTratada;
    }

    if (!dadosProposta.premium && !dadosProposta.acessivel) {
        return { sucesso: false, mensagem: 'Não foi possível carregar nenhuma proposta válida.' };
    }

    return { sucesso: true, dados: dadosProposta };
}

// ======================================================================
// FUNÇÕES DE DADOS GEOGRÁFICOS (CEP / IBGE)
// ======================================================================

// Busca de CEP via API pública (ViaCEP)
export async function buscarEnderecoPorCEP(cep) {
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        return data.erro ? null : data;
    } catch (error) {
        console.error("Erro ao buscar CEP", error);
        return null;
    }
}

// Busca de Cidades via API do IBGE
export async function obterCidadesPorUF(uf) {
    try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar cidades", error);
        return [];
    }
}

// ======================================================================
// ENGENHARIA: MOTOR DE DIMENSIONAMENTO BELENERGY
// ======================================================================

const DIAS_MES_PRECISO = 30.4166666666666;

// Base de dados histórica BelEnergy para Alagoas (Fator de Geração Mensal - kWh/kWp.mês)
// A estrutura foi atualizada para incluir lat/lon, conforme solicitado.
export const baseDadosAlagoas = {
    "AGUA BRANCA": { fator: 126.7, lat: null, lon: null, dist: 300 }, "ANADIA": { fator: 121.21, lat: null, lon: null, dist: 90 },
    "ARAPIRACA": { fator: 122.46, lat: -9.751, lon: -36.660, dist: 130 }, "ATALAIA": { fator: 120.7, lat: null, lon: null, dist: 48 },
    "BARRA DE SANTO ANTONIO": { fator: 125.84, lat: null, lon: null, dist: 40 }, "BARRA DE SAO MIGUEL": { fator: 129.13, lat: null, lon: null, dist: 30 },
    "BATALHA": { fator: 122.95, lat: null, lon: null, dist: 190 }, "BELEM": { fator: 121.51, lat: null, lon: null, dist: 110 },
    "BELO MONTE": { fator: 124.45, lat: null, lon: null }, "BOCA DA MATA": { fator: 119.2, lat: null, lon: null },
    "BRANQUINHA": { fator: 119.75, lat: null, lon: null }, "CACIMBINHAS": { fator: 124.61, lat: null, lon: null },
    "CAJUEIRO": { fator: 118.32, lat: null, lon: null }, "CAMPESTRE": { fator: 119.2, lat: null, lon: null },
    "CAMPO ALEGRE": { fator: 121.3, lat: null, lon: null }, "CAMPO GRANDE": { fator: 122.74, lat: null, lon: null },
    "CANAPI": { fator: 128.09, lat: null, lon: null }, "CAPELA": { fator: 119.33, lat: null, lon: null },
    "CARNEIROS": { fator: 125.84, lat: null, lon: null }, "CHA PRETA": { fator: 119.82, lat: null, lon: null },
    "COITE DO NOIA": { fator: 123.64, lat: null, lon: null }, "COLONIA LEOPOLDINA": { fator: 115.98, lat: null, lon: null },
    "COQUEIRO SECO": { fator: 124.13, lat: null, lon: null, dist: 20 }, "CORURIPE": { fator: 126.49, lat: null, lon: null, dist: 90 },
    "CRAIBAS": { fator: 124.8, lat: null, lon: null }, "DELMIRO GOUVEIA": { fator: 128.34, lat: null, lon: null },
    "DOIS RIACHOS": { fator: 125.4, lat: null, lon: null }, "ESTRELA DE ALAGOAS": { fator: 126.14, lat: null, lon: null },
    "FEIRA GRANDE": { fator: 121.49, lat: null, lon: null }, "FELIZ DESERTO": { fator: 125.96, lat: null, lon: null },
    "FLEXEIRAS": { fator: 118.41, lat: null, lon: null }, "GIRAU DO PONCIANO": { fator: 122.51, lat: null, lon: null },
    "IBATEGUARA": { fator: 119.33, lat: null, lon: null }, "IGACI": { fator: 124.22, lat: null, lon: null },
    "IGREJA NOVA": { fator: 121.93, lat: null, lon: null }, "INHAPI": { fator: 127.95, lat: null, lon: null },
    "JACARE DOS HOMENS": { fator: 124.13, lat: null, lon: null }, "JACUIPE": { fator: 120.08, lat: null, lon: null },
    "JAPARATINGA": { fator: 127.79, lat: null, lon: null }, "JARAMATAIA": { fator: 122.02, lat: null, lon: null },
    "JEQUIA DA PRAIA": { fator: 126.33, lat: null, lon: null }, "JOAQUIM GOMES": { fator: 115.4, lat: null, lon: null },
    "JUNDIA": { fator: 119.2, lat: null, lon: null }, "JUNQUEIRO": { fator: 121.28, lat: null, lon: null },
    "LAGOA DA CANOA": { fator: 123.11, lat: null, lon: null }, "LIMOEIRO DE ANADIA": { fator: 122.51, lat: null, lon: null, dist: 110 },
    "MACEIO": { fator: 127.9, lat: -9.665, lon: -35.735, dist: 0 }, "MAJOR ISIDORO": { fator: 124.15, lat: null, lon: null },
    "MAR VERMELHO": { fator: 121.21, lat: null, lon: null }, "MARAGOGI": { fator: 123.94, lat: null, lon: null, dist: 125 },
    "MARAVILHA": { fator: 127.07, lat: null, lon: null }, "MARECHAL DEODORO": { fator: 126.24, lat: -9.701, lon: -35.849, dist: 28 },
    "MARIBONDO": { fator: 121.19, lat: null, lon: null }, "MATA GRANDE": { fator: 130.08, lat: null, lon: null },
    "MATRIZ DE CAMARAGIBE": { fator: 120.91, lat: null, lon: null }, "MESSIAS": { fator: 120.86, lat: null, lon: null },
    "MINADOR DO NEGRAO": { fator: 125.17, lat: null, lon: null }, "MONTEIROPOLIS": { fator: 124.13, lat: null, lon: null },
    "MURICI": { fator: 120.15, lat: null, lon: null }, "NOVO LINO": { fator: 117.69, lat: null, lon: null },
    "OLHO D'AGUA DAS FLORES": { fator: 125.4, lat: null, lon: null }, "OLHO D'AGUA DO CASADO": { fator: 127, lat: null, lon: null },
    "OLHO D'AGUA GRANDE": { fator: 123.23, lat: null, lon: null }, "OLIVENCA": { fator: 124.68, lat: null, lon: null },
    "OURO BRANCO": { fator: 127.07, lat: null, lon: null }, "PALESTINA": { fator: 123.69, lat: null, lon: null },
    "PALMEIRA DOS INDIOS": { fator: 124.68, lat: null, lon: null }, "PAO DE ACUCAR": { fator: 126.14, lat: null, lon: null },
    "PARICONHA": { fator: 127.93, lat: null, lon: null }, "PARIPUEIRA": { fator: 128.44, lat: null, lon: null },
    "PASSO DE CAMARAGIBE": { fator: 122.37, lat: null, lon: null }, "PAULO JACINTO": { fator: 121.21, lat: null, lon: null },
    "PENEDO": { fator: 123.62, lat: null, lon: null, dist: 160 }, "PIACABUCU": { fator: 126, lat: null, lon: null },
    "PILAR": { fator: 122.9, lat: null, lon: null, dist: 35 }, "PINDOBA": { fator: 119.1, lat: null, lon: null },
    "PIRANHAS": { fator: 126.65, lat: null, lon: null }, "POCO DAS TRINCHEIRAS": { fator: 126.33, lat: null, lon: null },
    "PORTO CALVO": { fator: 121.03, lat: null, lon: null, dist: 100 }, "PORTO DE PEDRAS": { fator: 125.47, lat: null, lon: null },
    "PORTO REAL DO COLEGIO": { fator: 125.84, lat: null, lon: null }, "QUEBRANGULO": { fator: 122.11, lat: null, lon: null },
    "RIO LARGO": { fator: 121.42, lat: null, lon: null }, "ROTEIRO": { fator: 125.01, lat: null, lon: null },
    "SANTA LUZIA DO NORTE": { fator: 124.13, lat: null, lon: null }, "SANTANA DO IPANEMA": { fator: 126.49, lat: null, lon: null },
    "SANTANA DO MUNDAU": { fator: 118.8, lat: null, lon: null }, "SAO BRAS": { fator: 123.23, lat: null, lon: null },
    "SAO JOSE DA LAJE": { fator: 117.64, lat: null, lon: null }, "SAO JOSE DA TAPERA": { fator: 125.17, lat: null, lon: null },
    "SAO LUIS DO QUITUNDE": { fator: 123.43, lat: null, lon: null }, "SAO MIGUEL DOS CAMPOS": { fator: 122.02, lat: null, lon: null },
    "SAO MIGUEL DOS MILAGRES": { fator: 129.57, lat: null, lon: null }, "SAO SEBASTIAO": { fator: 121.77, lat: null, lon: null },
    "SATUBA": { fator: 124.13, lat: null, lon: null }, "SENADOR RUI PALMEIRA": { fator: 125.59, lat: null, lon: null },
    "TANQUE D'ARCA": { fator: 122.39, lat: null, lon: null }, "TAQUARANA": { fator: 121.51, lat: null, lon: null },
    "TEOTONIO VILELA": { fator: 121.12, lat: null, lon: null, dist: 100 }, "TRAIPU": { fator: 126.51, lat: null, lon: null },
    "UNIAO DOS PALMARES": { fator: 119.75, lat: null, lon: null }, "VICOSA": { fator: 120.26, lat: null, lon: null }
};

// Gera lista de potências de painéis de 425W a 715W (passo de 5W)
export const listaPaineis = Array.from({ length: (715 - 540) / 5 + 1 }, (_, i) => 540 + i * 5);

export const MODELOS_FOCO = [540, 545, 550, 560, 565, 570, 575, 580, 585, 590, 595, 600, 605, 610, 615, 620, 625, 650, 660, 690, 695, 700, 710, 715];

export const CATALOGO_INVERSORES_HUAWEI = [
    { mod: "SUN2000-3KTL-L1", nom: 3000, mppt: 2, tipo: "monofásico" },
    { mod: "SUN2000-4KTL-L1", nom: 4000, mppt: 2, tipo: "monofásico" },
    { mod: "SUN2000-5KTL-L1", nom: 5000, mppt: 2, tipo: "monofásico" },
    { mod: "SUN2000-6KTL-L1", nom: 6000, mppt: 2, tipo: "monofásico" },
    { mod: "SUN2000-7.5K-LC0", nom: 7500, mppt: 3, tipo: "monofásico" },
    { mod: "SUN2000-8K-LC0", nom: 8000, mppt: 3, tipo: "monofásico" },
    { mod: "SUN2000-10K-LC0", nom: 10000, mppt: 3, tipo: "monofásico" },
    { mod: "SUN2000-12K-MB0", nom: 12000, mppt: 2, tipo: "trifásico" },
    { mod: "SUN2000-15KTL-M5", nom: 15000, mppt: 2, tipo: "trifásico" },
    { mod: "SUN2000-17KTL-M5", nom: 17000, mppt: 2, tipo: "trifásico" },
    { mod: "SUN2000-20KTL-M5", nom: 20000, mppt: 2, tipo: "trifásico" },
    { mod: "SUN2000-25KTL-M5", nom: 25000, mppt: 2, tipo: "trifásico" },
    { mod: "SUN2000-30KTL-M3", nom: 30000, mppt: 4, tipo: "trifásico" },
    { mod: "SUN2000-36KTL-M3", nom: 36000, mppt: 4, tipo: "trifásico" },
    { mod: "SUN2000-40KTL-M3", nom: 40000, mppt: 4, tipo: "trifásico" },
    { mod: "SUN2000-50KTL-M3", nom: 50000, mppt: 4, tipo: "trifásico" },
    { mod: "SUN2000-60KTL-M0", nom: 60000, mppt: 6, tipo: "trifásico" },
    { mod: "SUN2000-75KTL-M1", nom: 75000, mppt: 10, tipo: "trifásico" },
    { mod: "SUN2000-100KTL-M2", nom: 100000, mppt: 10, tipo: "trifásico" },
    { mod: "SUN2000-150K-MG0", nom: 150000, mppt: 6, tipo: "trifásico" },
    { mod: "SUN2000-185KTL-INH0", nom: 185000, mppt: 9, tipo: "trifásico" },
    { mod: "SUN2000-215KTL-H0", nom: 200000, mppt: 9, tipo: "trifásico" },
    { mod: "SUN2000-250KTL-H1", nom: 250000, mppt: 6, tipo: "trifásico" },
    { mod: "SUN2000-330KTL-H1", nom: 300000, mppt: 6, tipo: "trifásico" }
];

/**
 * Converte o fator de geração histórico (com perdas) para HSP Bruto (sem perdas).
 * @param {number} fatorMensalHistorico - Ex: 126.24 para Marechal Deodoro.
 * @returns {number} O HSP diário bruto (sem perdas).
 */
export function obterHSPBruto(fatorMensalHistorico) {
    const rendimentoPadrao = 0.7643; // 100% - 23.57% de perdas padrão
    return fatorMensalHistorico / (DIAS_MES_PRECISO * rendimentoPadrao);
}

/**
 * Calcula a Potência de Pico (kWp) necessária para atender um consumo.
 * @param {number} consumo - Consumo mensal em kWh.
 * @param {number} hspEfetivo - HSP diário já com as perdas aplicadas.
 * @returns {number} A potência de pico em kWp.
 */
export function calcularPpk(consumo, hspEfetivo) {
    if (hspEfetivo <= 0) return 0;
    // Ppk = Consumo / (HSP_Efetivo * Dias)
    return consumo / (hspEfetivo * DIAS_MES_PRECISO);
}

/**
 * Motor de Cálculo de Alta Precisão - Jean Marcel
 * @param {object} parametros - Objeto com { azimute, inclinacao, perdasExtras: { eficienciaInversor, perdaTempInversor, cabos, outros } }.
 * @returns {object} O Performance Ratio (PR) final e detalhes.
 */
export function calcularRendimentoCientifico(parametros) {
    // 1. PERDAS INTERNAS (Características Elétricas)
    const pEficienciaInv = (parametros.perdasExtras?.eficienciaInversor || 98.0) / 100;
    const pTempInv = (parametros.perdasExtras?.perdaTempInversor || 1.5) / 100;
    const pTempModulos = (parametros.perdasExtras?.perdaTempModulos || 10.13) / 100;
    const pCabos = (parametros.perdasExtras?.cabos || 2.0) / 100;
    const pOutros = (parametros.perdasExtras?.outros || 2.0) / 100; // Sombreamento/Sujidade
    const pIndisp = (parametros.perdasExtras?.indisponibilidade || 0.5) / 100;

    // Cálculo Multiplicativo (A perda de um recai sobre o que restou do outro)
    // CORREÇÃO: Todas as perdas são multiplicativas para refletir a cadeia de eficiência.
    let prBruto = pEficienciaInv * (1 - pTempInv) * (1 - pTempModulos) * (1 - pCabos) * (1 - pOutros) * (1 - pIndisp);

    // 2. PERDAS ANGULARES (SUBTRATIVO) - Conforme especificação de engenharia
    const taxaPerdaAzi = 0.05; // 0.05 pontos percentuais por grau
    const taxaPerdaInc = 0.08; // 0.08 pontos percentuais por grau
    const latitudeLocal = parametros.latitude || 9.7; // Latitude de Marechal Deodoro como fallback
    
    const desvioAzimute = Math.abs(parseFloat(parametros.azimute)) || 0;
    const desvioInclinacao = Math.abs((parseFloat(parametros.inclinacao) || 10) - latitudeLocal);

    // Calcula a perda total em pontos percentuais
    const perdaTotalAngular = (desvioAzimute * taxaPerdaAzi) + (desvioInclinacao * taxaPerdaInc);

    // Converte o PR dos insumos para percentual e subtrai as perdas angulares
    const prBrutoPercentual = prBruto * 100;
    let prGeograficoPercentual = prBrutoPercentual - perdaTotalAngular;

    // Converte de volta para decimal para o resto do sistema
    let prGeografico = prGeograficoPercentual / 100;

    // 3. TRAVA DE SEGURANÇA (O Ajuste de Engenharia)
    // APLICAÇÃO DA REGRA DE OURO: O PR Efetivo é o menor valor entre o PR calculado e o teto de 80%.
    const limitadorSeguranca = 0.80;
    const prFinal = Math.min(prGeografico, limitadorSeguranca);
    const valorAjuste = prFinal - prGeografico; // Será 0 ou um valor negativo (a perda do ajuste)

    return {
        prBruto: prBruto,
        prGeografico: prGeografico,
        valorAjuste: valorAjuste,
        prFinal: prFinal,
        // Mantém nomes antigos para compatibilidade com dimensionarSistema
        rendimentoFinal: prFinal,
        // Strings formatadas para UI
        brutoStr: (prBruto * 100).toFixed(2),
        geograficoStr: (prGeografico * 100).toFixed(2),
        ajusteStr: (valorAjuste * 100).toFixed(2),
        finalStr: (prFinal * 100).toFixed(2)
    };
}

/**
 * Dimensiona o sistema considerando apenas modelos viáveis comercialmente.
 * @param {Array} modelosPermitidos (Opcional) Lista de potências permitidas. Se null, usa lista geral.
 */
export function dimensionarSistema(consumoMensal, hspBruto, paramsTecnicos, modelosPermitidos = null) {
    // Usa a lista de foco se fornecida, senão usa a geral
    const listaWatts = modelosPermitidos || listaPaineis;

    const resultados = [];    
    // O rendimento final (PR) agora é pré-calculado no controller e passado via paramsTecnicos.
    const rendimentoFinal = paramsTecnicos.rendimentoFinal;
    const geracaoPorKwp = hspBruto * DIAS_MES_PRECISO * rendimentoFinal;
    
    // Evita divisão por zero
    const kwpNecessario = consumoMensal > 0 ? consumoMensal / geracaoPorKwp : 0;

    listaWatts.forEach(watts => {
        const wattsKw = watts / 1000;
        const qtdModulos = kwpNecessario > 0 ? Math.ceil(kwpNecessario / wattsKw) : 0;
        const potenciaRealSistema = qtdModulos * wattsKw;
        const sobra = potenciaRealSistema - kwpNecessario;
        const geracaoRealMensal = potenciaRealSistema * geracaoPorKwp;

        resultados.push({
            modelo: watts + "W",
            watts: watts,
            quantidade: qtdModulos,
            sobra: sobra,
            potenciaTotal: potenciaRealSistema,
            geracaoReal: geracaoRealMensal,
            atendimento: consumoMensal > 0 ? (geracaoRealMensal / consumoMensal) * 100 : 0
        });
    });

    // Lógica de Seleção Otimizada (Ranking de Engenharia):
    // 1. Ordena pela menor sobra (desvio positivo) para máxima precisão de dimensionamento.
    // 2. Como critério de desempate, prefere a menor quantidade de módulos (geralmente implica em módulos mais potentes, otimizando estrutura e M.O.).
    const sugestoesOrdenadas = [...resultados].sort((a, b) => {
        if (a.sobra !== b.sobra) {
            return a.sobra - b.sobra;
        }
        return a.quantidade - b.quantidade;
    });
    
    const melhorOpcaoTecnica = sugestoesOrdenadas.length > 0 ? sugestoesOrdenadas[0] : null;

    return {
        melhorSugestao: melhorOpcaoTecnica,
        // Retorna a lista já ordenada corretamente para o controller
        todosModelos: sugestoesOrdenadas,
        prCalculado: rendimentoFinal,
        kwpNecessario: kwpNecessario
    };
}

// ======================================================================
// ENGENHARIA: DADOS CLIMÁTICOS E GEOGRÁFICOS
// ======================================================================

// Busca coordenadas (Lat/Lon) da cidade para consultar a NASA
// Usa a API pública do OpenStreetMap (Nominatim)
export async function buscarCoordenadas(cidade, uf) {
    try {
        const query = `${cidade}, ${uf}, Brazil`;
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return { lat: data[0].lat, lon: data[0].lon };
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar coordenadas:", error);
        return null;
    }
}

// Busca dados de irradiação solar (HSP) da NASA POWER API
// Endpoint Climatology fornece médias históricas (ideal para dimensionamento)
export async function buscarHSPNasa(lat, lon) {
    try {
        const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
        const response = await fetch(url);
        const data = await response.json();
        
        // Retorna a média anual (ANN) do parâmetro ALLSKY_SFC_SW_DWN
        return data.properties.parameter.ALLSKY_SFC_SW_DWN.ANN;
    } catch (error) {
        console.error("Erro ao buscar dados da NASA:", error);
        return 5.0; // Fallback seguro (Média Brasil) caso a API falhe
    }
}

// ======================================================================
// ENGENHARIA: MOTOR DE CUSTOS PARAMETRIZADOS
// ======================================================================

/**
 * Calcula o custo base de materiais elétricos com base na quantidade de módulos.
 * Lógica de faixas de volume (SWITCH/CASE).
 * @param {number} quantidadeModulos - O número total de módulos no projeto.
 * @param {Array} tabelaPersonalizada - (Opcional) Array de objetos {limite, custo}.
 * @returns {number} O custo estimado dos materiais.
 */
export function calcularCustoMateriaisBasicos(quantidadeModulos, tabelaPersonalizada = null) {
    if (quantidadeModulos <= 0) return 0;

    // Se houver tabela personalizada, usa ela
    if (tabelaPersonalizada && Array.isArray(tabelaPersonalizada) && tabelaPersonalizada.length > 0) {
        // Encontra a faixa onde a quantidade se encaixa (assumindo ordenação por limite)
        const faixa = tabelaPersonalizada.find(f => quantidadeModulos <= f.limite);
        if (faixa) return faixa.custo;
        // Se for maior que o último limite, usa o último valor da tabela
        return tabelaPersonalizada[tabelaPersonalizada.length - 1].custo;
    }

    if (quantidadeModulos <= 20) return 1100;
    if (quantidadeModulos <= 25) return 1550;
    if (quantidadeModulos <= 30) return 2000;
    if (quantidadeModulos <= 40) return 2450;
    if (quantidadeModulos <= 50) return 2750;
    if (quantidadeModulos <= 70) return 3200;
    if (quantidadeModulos <= 90) return 3650;
    if (quantidadeModulos <= 110) return 4100;
    if (quantidadeModulos <= 130) return 4550;
    if (quantidadeModulos <= 150) return 5000;
    if (quantidadeModulos <= 170) return 5450;
    if (quantidadeModulos <= 190) return 5900;
    if (quantidadeModulos <= 210) return 6350;
    if (quantidadeModulos <= 230) return 6800;
    if (quantidadeModulos <= 250) return 7250;
    if (quantidadeModulos <= 270) return 7700;
    return quantidadeModulos * 33; // Custo variável para grandes usinas
}

/**
 * Calcula o custo base de mão de obra com base no custo unitário regressivo.
 * @param {number} qtdModulos - O número total de módulos no projeto.
 * @param {Array} tabelaPersonalizada - (Opcional) Array de objetos {limite, unitario}.
 * @returns {number} O custo base da mão de obra.
 */
export function calcularMaoObraBase(qtdModulos, tabelaPersonalizada = null) {
    if (qtdModulos <= 0) return 0;

    if (tabelaPersonalizada && Array.isArray(tabelaPersonalizada) && tabelaPersonalizada.length > 0) {
        const faixa = tabelaPersonalizada.find(f => qtdModulos <= f.limite);
        const valorUnitario = faixa ? faixa.unitario : tabelaPersonalizada[tabelaPersonalizada.length - 1].unitario;
        return qtdModulos * valorUnitario;
    }

    let valorPorModulo = 80; // Padrão para > 90

    const faixas = [
        { limite: 10, valor: 150 }, { limite: 11, valor: 140 }, { limite: 12, valor: 130 },
        { limite: 13, valor: 120 }, { limite: 14, valor: 115 }, { limite: 18, valor: 110 },
        { limite: 22, valor: 107 }, { limite: 26, valor: 104 }, { limite: 30, valor: 100 },
        { limite: 50, valor: 95 },  { limite: 70, valor: 90 },  { limite: 90, valor: 85 }
    ];

    const faixaEncontrada = faixas.find(f => qtdModulos <= f.limite);
    if (faixaEncontrada) {
        valorPorModulo = faixaEncontrada.valor;
    }

    return qtdModulos * valorPorModulo;
}

/**
 * Calcula a capacidade de expansão do inversor (Oversizing e Geração Futura).
 * @param {number} potenciaTotalCC - Potência total dos módulos selecionados (kWp).
 * @param {number} wattsModulo - Potência unitária do módulo (W).
 * @param {number} potenciaInvAC - Potência nominal do inversor (kW).
 * @param {number} qtdInv - Quantidade de inversores.
 * @param {number} oversizingLimite - Limite de oversizing (ex: 1.3 para 30%).
 * @param {number} hsp - HSP do local.
 * @param {number} pr - Performance Ratio (Rendimento final).
 */
export function calcularExpansaoInversor(potenciaTotalCC, wattsModulo, potenciaInvAC, qtdInv, oversizingLimite, hsp, pr) {
    const potenciaTotalAC = potenciaInvAC * qtdInv;
    
    if (potenciaTotalAC <= 0) return null;

    const oversizingAtual = (potenciaTotalCC / potenciaTotalAC); // Ratio (ex: 1.2)
    const potenciaMaxCC = potenciaTotalAC * oversizingLimite;
    
    // O quanto ainda cabe (em kWp)
    const potenciaDisponivel = Math.max(0, potenciaMaxCC - potenciaTotalCC);
    
    // Quantos módulos inteiros cabem nessa sobra
    const qtdModulosExtras = Math.floor((potenciaDisponivel * 1000) / wattsModulo);
    
    // Geração estimada desses módulos extras
    const geracaoExtra = (qtdModulosExtras * wattsModulo * hsp * 30.4166 * pr) / 1000;

    return {
        oversizingAtualPercentual: oversizingAtual * 100,
        potenciaMaxCC,
        potenciaDisponivel,
        qtdModulosExtras,
        geracaoExtra
    };
}

/**
 * Calcula o custo de logística e deslocamento.
 * @param {number} distanciaIda - Distância em KM da base até o cliente.
 * @param {number} qtdModulos - Quantidade de módulos.
 * @param {number} qtdInversores - Quantidade de inversores.
 * @param {object} premissas - Objeto com { precoCombustivel, consumoVeiculo, modulosPorDia, tempoExtraInversor, kmAlmoco, kmSuprimentos }.
 */
export function calcularCustoLogistica(distanciaIda, qtdModulos, qtdInversores, premissas) {
    // 1. Premissas Globais (com fallbacks)
    const precoCombustivel = premissas?.precoCombustivel || 6.10;
    const kmPorLitro = premissas?.consumoVeiculo || 8.5; // Carro popular carregado
    const modulosPorDia = premissas?.modulosPorDia || 12; // Produtividade padrão
    const tempoExtraInversor = premissas?.tempoExtraInversor || 0.5; // Dias a mais por inversor extra
    const kmSuprimentosMaceio = premissas?.kmSuprimentos || 15; // Média fixa para compra de materiais na cidade da empresa
    const kmAlmocoDiario = premissas?.kmAlmoco || 5;
    const diasMinimos = premissas?.diasMinimosObra || 2; // Piso de segurança parametrizado

    // 2. Estimativa de Dias de Obra (Diárias)
    // Fórmula: Teto(Módulos / Produtividade) + ((Qtd Inversores - 1) * Acréscimo Tempo)
    const diasBaseModulos = Math.ceil(qtdModulos / modulosPorDia);
    const diasExtrasInversores = qtdInversores > 1 ? (qtdInversores - 1) * tempoExtraInversor : 0;
    let diasDeObra = diasBaseModulos + diasExtrasInversores;

    // REGRA DE SEGURANÇA: Mínimo parametrizado para viabilidade de mobilização
    const diasCalculados = diasDeObra;
    diasDeObra = Math.max(diasMinimos, diasDeObra);
    const isMinimo = diasDeObra > diasCalculados;

    // 3. Cálculo de Quilometragem Total
    // Suprimentos (1x por obra) + [ (Ida + Volta + Almoço) * Dias ]
    const kmTotal = kmSuprimentosMaceio + (((distanciaIda * 2) + kmAlmocoDiario) * diasDeObra);

    // 4. Cálculo Financeiro
    const custoCombustivelTotal = (kmTotal / kmPorLitro) * precoCombustivel;

    return {
        kmTotal: kmTotal,
        diasObra: diasDeObra,
        isMinimo: isMinimo,
        custoFinanceiro: custoCombustivelTotal,
        detalhes: `Suprimentos (${kmSuprimentosMaceio}km) + Viagens (${diasDeObra}d x ${(distanciaIda * 2 + kmAlmocoDiario).toFixed(0)}km)`
    };
}