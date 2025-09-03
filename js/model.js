/**
 * model.js
 * * Este arquivo é o Modelo do projeto. Ele contém a lógica de negócios-,
 * se comunica com a camada de API e prepara os dados para o Controlador.
 */
// Importa as funções da API, incluindo a nova 'authenticate' e 'patch'
import { get, post, authenticate, patch, getSelicTaxa } from './api.js';

// **ATENÇÃO: SUBSTITUA COM A SUA TOKEN DE API PESSOAL**
// Para fins de teste, ela está aqui. Em produção, use um método mais seguro.
//const apiToken = process.env.API_TOKEN;
const apiToken = "3649:y915jaWXevVcFJWaIdzNZJHlYfXL3MdbOwXX041T"

// ======================================================================
// CONSTANTES AJUSTADAS PARA SIMULAR A TAXA EFETIVA DE 2,55% a 3,41%
// ======================================================================

const IOF_FIXO = 0.0038;
const IOF_DIARIO = 0.000082;
const DIAS_CARENCIA = 120; // 120 dias de carência

// NOVO: Spread-base anual por nível de valor do projeto.
// Ajustados para que a simulação se inicie em 2,55% a.m. (considerando carência).
const SPREAD_POR_VALOR = {
    faixa_1: 0.08, // Reduzido para aproximar as parcelas
    faixa_2: 0.12, // Reduzido para aproximar as parcelas
    faixa_3: 0.16, // Reduzido para aproximar as parcelas
};

// NOVO: Fator de risco que aumenta o spread com o número de parcelas.
// Este valor é calculado para que o spread do pior cenário seja alcançado em 84 meses.
const FATOR_RISCO_PRAZO = (0.16 - 0.08) / 84; // Recalculado com os novos spreads

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
    equipamentos: {
        premium: 'imagens/huawei.png',
        acessivel: 'imagens/auxsolar.png'
    },
    instalacao: {
        premium: 'imagens/instalacao-premium.png',
        acessivel: 'imagens/instalacao-acessivel.png'
    }
};

// Detalhes de instalação fixos para a proposta Premium (dados corrigidos)
const detalhesInstalacaoPremium = [
    { icone: 'fa-shield-alt', texto: 'Sistema de Proteção Elétrica Coordenado e Completo' },
    { icone: 'fa-bolt-lightning', texto: 'Infraestrutura Elétrica e Mecânica mais Resistente' },
    { icone: 'fa-gears', texto: 'Instalação com Padrão Otimizado' }
];

// Detalhes de instalação fixos para a proposta Acessível (dados corrigidos)
const detalhesInstalacaoAcessivel = [
    { icone: 'fa-triangle-exclamation', texto: 'Apenas proteções internas do inversor' },
    { icone: 'fa-wrench', texto: 'Infraestrutura Elétrica e Mecânica mais acessível' },
    { icone: 'fa-plug', texto: 'Instalação mais acessível' }
];

// NOVO: Resumos para a seção de instalação
const resumoInstalacaoPremium = "Nossa instalação Premium se traduz em maior segurança ao seu sistema e ao seu patrimônio, maior durabilidade e eficiência de geração de energia. Tudo isso resulta em maior tranquilidade e economia real a longo prazo.";

const resumoInstalacaoAcessivel = "Esta instalação é a opção mais Acessível, ideal para quem busca uma solução de entrada. Porém, não oferece a mesma segurança e durabilidade, geralmente apresenta uma redução de eficiência em menos tempo e uma maior necessidade de manutenção.";

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

// NOVO: Função para calcular o financiamento com a lógica da Tabela Price
function calcularFinanciamento(valorProjeto, selicAnual) {
    const selicDecimal = selicAnual / 100;
    const opcoesParcelas = [12, 24, 36, 48, 60, 72, 84];
    const simulacao = {};
    const taxasNominais = {};
    const taxasEfetivas = {};

    let spreadBaseAnual;
    if (valorProjeto > 50000) {
        spreadBaseAnual = SPREAD_POR_VALOR.faixa_1;
    } else if (valorProjeto > 20000) {
        spreadBaseAnual = SPREAD_POR_VALOR.faixa_2;
    } else {
        spreadBaseAnual = SPREAD_POR_VALOR.faixa_3;
    }

    opcoesParcelas.forEach(n => {
        const spreadAnualAjustado = spreadBaseAnual + (n * FATOR_RISCO_PRAZO);
        const jurosAnualNominal = selicDecimal + spreadAnualAjustado;
        const jurosMensalNominal = (Math.pow((1 + jurosAnualNominal), (1 / 12))) - 1;

        // Adiciona o IOF e os juros da carência ao valor financiado
        const iofFixoCalculado = IOF_FIXO * valorProjeto;
        const iofDiarioCalculado = IOF_DIARIO * DIAS_CARENCIA * valorProjeto;
        
        // Valor principal para cálculo do juro da carência
        const valorPrincipalParaCarência = valorProjeto + iofFixoCalculado + iofDiarioCalculado;
        
        // Juros que acumulam durante a carência (4 meses)
        const valorComJurosCarência = valorPrincipalParaCarência * Math.pow(1 + jurosMensalNominal, DIAS_CARENCIA / 30);
        
        const valorFinanciadoComJuros = valorComJurosCarência;

        if (jurosMensalNominal <= 0) {
            const valorParcela = (valorFinanciadoComJuros / n);
            simulacao[`parcela-${n}`] = valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            taxasNominais[`taxaNominal-${n}`] = 0;
            taxasEfetivas[`taxaAnualEfetiva-${n}`] = 0;
            return;
        }

        const parcela = (valorFinanciadoComJuros * jurosMensalNominal * Math.pow((1 + jurosMensalNominal), n)) / (Math.pow((1 + jurosMensalNominal), n) - 1);

        simulacao[`parcela-${n}`] = parcela.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        taxasNominais[`taxaNominal-${n}`] = jurosMensalNominal;
        const taxaMensalEfetiva = calcularTIRMensal(valorFinanciadoComJuros, parcela, n);
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
    if (!dadosApi || !dadosApi.dados) {
        console.error("Modelo: Dados da API não encontrados ou incompletos.");
        return null;
    }

    const { dados } = dadosApi;
    const variables = dados.variables || [];
    const nomeCliente = extrairValorVariavelPorChave(variables, 'cliente_nome') || 'Não informado';
    const dataProposta = formatarData(dados.generatedAt) || 'Não informado';
    const idProposta = dados.id || null;
    const linkProposta = dados.linkPdf || '#';
    const cidade = extrairValorVariavelPorChave(variables, 'cliente_cidade') || 'Não informado';
    const estado = extrairValorVariavelPorChave(variables, 'cliente_estado') || 'Não informado';
    const consumoMensal = extrairValorVariavelPorChave(variables, 'consumo_mensal') || 'N/A';
    const geracaoMediaValor = extrairValorNumericoPorChave(variables, 'geracao_mensal') || 0;
    const tarifaEnergia = extrairValorNumericoPorChave(variables, 'tarifa_distribuidora_uc1') || 0;
    const tipoEstrutura = extrairValorVariavelPorChave(variables, 'vc_tipo_de_estrutura') || 'Não informado';
    const payback = extrairValorVariavelPorChave(variables, 'payback') || 'Não informado';
    const idealParaValor = geracaoMediaValor * tarifaEnergia;
    const valorTotal = extrairValorNumericoPorChave(variables, 'preco') || 0;
    const valorResumo = (dados.salesValue * 0.95).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const { parcelas: parcelasCalculadas, taxasNominais } = calcularFinanciamento(valorTotal, selicAtual);

    const taxasPorParcela = {};
    for (const key in taxasNominais) {
        if (taxasNominais.hasOwnProperty(key)) {
            const taxaMensalNominal = taxasNominais[key];
            // CORREÇÃO: Formatação correta da taxa nominal para exibição
            taxasPorParcela[key] = `${(taxaMensalNominal * 100).toFixed(2).replace('.', ',')}% a.m.`;
        }
    }

    const retorno = {
        tipo: tipoProposta,
        id: dados.project.id,
        propostaId: idProposta,
        cliente: nomeCliente,
        consumoMensal: `${consumoMensal} kWh`,
        geracaoMensal: `${extrairValorVariavelPorChave(variables, 'geracao_mensal')} kWh/mês`,
        local: `${cidade} / ${estado}`,
        dataProposta: dataProposta,
        linkProposta: linkProposta,
        sistema: {
            geracaoMedia: `${extrairValorVariavelPorChave(variables, 'geracao_mensal')} kWh/mês`,
            instalacaoPaineis: tipoEstrutura,
            idealPara: idealParaValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        },
        equipamentos: {
            imagem: caminhosImagens.equipamentos[tipoProposta],
            quantidadePainel: extrairValorVariavelPorChave(variables, 'modulo_quantidade') || 0,
            descricaoPainel: (extrairValorVariavelPorChave(variables, 'modulo_potencia') || 'Não informado') + ' W',
            quantidadeInversor: extrairValorVariavelPorChave(variables, 'inversores_utilizados') || 0,
            descricaoInversor: (extrairValorVariavelPorChave(variables, 'inversor_potencia_nominal_1') || 'Não informado') + ' W'
        },
        instalacao: {
            imagem: caminhosImagens.instalacao[tipoProposta],
            detalhesInstalacao: tipoProposta === 'premium' ? detalhesInstalacaoPremium : detalhesInstalacaoAcessivel,
            resumoInstalacao: tipoProposta === 'premium' ? resumoInstalacaoPremium : resumoInstalacaoAcessivel
        },
        valores: {
            valorTotal: valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
            valorResumo: valorResumo,
            payback: payback,
            parcelas: parcelasCalculadas,
            taxasPorParcela: taxasPorParcela,
            observacao: 'Os valores de financiamento apresentados são uma simulação e utilizam as taxas de juros (nominais) médias de mercado, com um período de carência de 120 dias. O resultado final pode variar conforme o perfil de crédito do cliente e as condições da instituição financeira.'
        },
        validade: `Proposta válida por até 3 dias corridos ou enquanto durarem os estoques.`
    };

    return retorno;
}

// **RESTANTE DO CÓDIGO** (permanece inalterado)
export async function buscarETratarProposta(numeroProjeto, primeiroNomeCliente) {
    const authResponse = await authenticate(apiToken);
    if (!authResponse.sucesso) { return authResponse; }
    const accessToken = authResponse.accessToken;

    const selicAtual = await getSelicTaxa();
    if (selicAtual === null) {
        return {
            sucesso: false,
            mensagem: 'Não foi possível obter a taxa Selic para o cálculo do financiamento.'
        };
    }

    const endpointPremium = `/projects/${numeroProjeto}/proposals`;
    const dadosApiPremium = await get(endpointPremium, accessToken);

    if (!dadosApiPremium.sucesso) {
        return {
            sucesso: false,
            mensagem: 'Projeto não encontrado ou dados inválidos.'
        };
    }

    const nomeCompletoApi = extrairValorVariavelPorChave(dadosApiPremium.dados.variables, 'cliente_nome');
    const primeiroNomeApi = nomeCompletoApi ? nomeCompletoApi.split(' ')[0] : null;

    if (!primeiroNomeApi || primeiroNomeApi.toLowerCase() !== primeiroNomeCliente.toLowerCase()) {
        console.error("Modelo: Tentativa de acesso não autorizado. Nome não corresponde.");
        return { sucesso: false, mensagem: 'Nome do cliente não corresponde ao projeto.' };
    }

    const propostaPremium = tratarDadosParaProposta(dadosApiPremium, 'premium', selicAtual);
    if (!propostaPremium) { return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Premium.' }; }
    dadosProposta.premium = propostaPremium;

    const idPropostaAcessivel = extrairValorVariavelPorChave(dadosApiPremium.dados.variables, 'vc_projeto_acessivel');
    let propostaAcessivel = null;

    if (idPropostaAcessivel) {
        const endpointAcessivel = `/projects/${idPropostaAcessivel}/proposals`;
        const dadosApiAcessivel = await get(endpointAcessivel, accessToken);
        if (dadosApiAcessivel.sucesso) {
            propostaAcessivel = tratarDadosParaProposta(dadosApiAcessivel, 'acessivel', selicAtual);
        } else {
            return { sucesso: false, mensagem: dadosApiAcessivel.mensagem || 'Falha ao buscar dados da proposta Acessível.' };
        }
    } else {
        return { sucesso: false, mensagem: 'ID da proposta acessível não encontrado.' };
    }

    if (!propostaAcessivel) { return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Acessível.' }; }
    dadosProposta.acessivel = propostaAcessivel;

    return { sucesso: true, dados: dadosProposta };
}

export async function atualizarStatusVisualizacao(dados) {
    try {
        const authResponse = await authenticate(apiToken);
        if (!authResponse.sucesso) {
            console.error("Modelo: Falha na autenticação para atualizar status.", authResponse.mensagem);
            return authResponse;
        }

        const accessToken = authResponse.accessToken;
        const agora = new Date();
        const dataHoraFormatada = `${agora.getDate().toString().padStart(2, '0')}-${(agora.getMonth() + 1).toString().padStart(2, '0')}-${agora.getFullYear()} ${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;
        const novaDescricao = `${dados.tipoVisualizacao}: ${dataHoraFormatada}`;
        const endpoint = `/projects/${dados.propostaId}`;
        const body = { description: novaDescricao };

        const respostaApi = await patch(endpoint, body, accessToken);
        if (respostaApi.sucesso) {
            console.log("Modelo: Status de visualização atualizado com sucesso!");
        } else {
            console.error("Modelo: Falha ao atualizar status de visualização.");
        }
    } catch (erro) {
        console.log("Modelo: Erro ao tentar atualizar o status de visualização.", erro);
        return { sucesso: false, mensagem: 'Ocorreu um erro ao tentar atualizar o status de visualização.' };
    }
}