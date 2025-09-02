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

// Constantes para o cálculo do financiamento
// Spread calculado para que a taxa anual seja 17,11% com a SELIC de 15%
const SPREAD_ANUAL = 0.0221;
const IOF_FIXO = 0.0038; // 0,38%
const IOF_DIARIO = 0.000082; // 0,0082% ao dia

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

// **NOVA FUNÇÃO:** Calcula a Taxa Interna de Retorno (TIR) mensal
/**
 * Calcula a Taxa Interna de Retorno (TIR) mensal para um financiamento.
 * Usa um método de busca binária para encontrar a taxa que zera o VPL.
 * @param {number} valorFinanciado O valor total financiado (incluindo IOF).
 * @param {number} valorParcela O valor de cada parcela.
 * @param {number} numeroParcelas O número total de parcelas.
 * @returns {number} A taxa de juros mensal em formato decimal.
 */
function calcularTIRMensal(valorFinanciado, valorParcela, numeroParcelas) {
    let guess = 0.01; // Chute inicial para a taxa
    const tolerance = 0.0000000001; // Tolerância para o cálculo
    let low = 0;
    let high = 1;
    let i = 0;

    while (i < 1000) { // Limite de 1000 iterações para evitar loops infinitos
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

    return guess; // Retorna o melhor chute encontrado
}

// NOVO: Função para calcular o financiamento com a lógica da Tabela Price
/**
 * Calcula a simulação de financiamento com base na Selic e em um spread fixo.
 * @param {number} valorProjeto O valor total do projeto a ser financiado.
 * @param {number} selicAnual A taxa Selic anual em formato de número (ex: 10.5).
 * @returns {object} Um objeto com as parcelas calculadas, taxa nominal e a nova taxa efetiva.
 */

function calcularFinanciamento(valorProjeto, selicAnual) {
    const selicDecimal = selicAnual / 100;

    const jurosAnualNominal = selicDecimal + SPREAD_ANUAL;
    const jurosMensalNominal = (Math.pow((1 + jurosAnualNominal), (1 / 12))) - 1;

    const opcoesParcelas = [12, 24, 36, 48, 60, 72, 84];
    const simulacao = {}; // Objeto para armazenar os resultados

    // Objeto para armazenar as taxas efetivas de cada opção de parcela
    const taxasEfetivas = {};

    opcoesParcelas.forEach(n => {
        const iofFixoCalculado = IOF_FIXO * valorProjeto;
        const iofDiarioCalculado = IOF_DIARIO * n * 30 * valorProjeto;
        const valorComIOF = valorProjeto + iofFixoCalculado + iofDiarioCalculado;

        if (jurosMensalNominal <= 0) {
            const valorParcela = (valorComIOF / n);
            // **ALTERAÇÃO AQUI:** Removido as casas decimais das parcelas
            simulacao[`parcela-${n}`] = valorParcela.toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
            // Para taxa zero, a taxa efetiva é zero
            taxasEfetivas[`taxaAnualEfetiva-${n}`] = 0;
            return;
        }

        const parcela = (valorComIOF * jurosMensalNominal * Math.pow((1 + jurosMensalNominal), n)) / (Math.pow((1 + jurosMensalNominal), n) - 1);

        // **ALTERAÇÃO AQUI:** Removido as casas decimais das parcelas
        simulacao[`parcela-${n}`] = parcela.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        // NOVO: Calcula a taxa de juros efetiva anual (TIR)
        const taxaMensalEfetiva = calcularTIRMensal(valorComIOF, parcela, n);
        const taxaAnualEfetiva = Math.pow(1 + taxaMensalEfetiva, 12) - 1;
        taxasEfetivas[`taxaAnualEfetiva-${n}`] = taxaAnualEfetiva;
    });

    // NOVO: Retorna a simulação e as novas taxas
    return {
        parcelas: simulacao,
        taxaAnualNominal: jurosAnualNominal,
        taxaMensalNominal: jurosMensalNominal,
        taxasEfetivas: taxasEfetivas
    };
}

/**
 * Função para tratar e formatar os dados brutos da API para o formato que a página precisa.
 * Esta é a função principal de transformação.
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
    const pricingTable = dados.pricingTable || [];
    const nomeCliente = extrairValorVariavelPorChave(variables, 'cliente_nome') || 'Não informado';
    const dataProposta = formatarData(dados.generatedAt) || 'Não informado';
    const idProposta = dados.id || null;
    const linkProposta = dados.linkPdf || '#';
    const cidade = extrairValorVariavelPorChave(variables, 'cliente_cidade') || 'Não informado';
    const estado = extrairValorVariavelPorChave(variables, 'cliente_estado') || 'Não informado';

    console.log(`Modelo: Tratando dados para proposta ${tipoProposta}`);

    const consumoMensal = extrairValorVariavelPorChave(variables, 'consumo_mensal') || 'N/A';
    const geracaoMediaValor = extrairValorNumericoPorChave(variables, 'geracao_mensal') || 0;
    const tarifaEnergia = extrairValorNumericoPorChave(variables, 'tarifa_distribuidora_uc1') || 0;
    const tipoEstrutura = extrairValorVariavelPorChave(variables, 'vc_tipo_de_estrutura') || 'Não informado';
    const payback = extrairValorVariavelPorChave(variables, 'payback') || 'Não informado';

    // Calcula o valor ideal para a conta de luz
    const idealParaValor = geracaoMediaValor * tarifaEnergia;

    const valorTotal = extrairValorNumericoPorChave(variables, 'preco') || 0;
    const valorResumo = (dados.salesValue * 0.95).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const {
        parcelas: parcelasCalculadas,
        taxasEfetivas,
        taxaMensalNominal // **CORREÇÃO AQUI:** Adicionei essa linha para pegar a taxa nominal
    } = calcularFinanciamento(valorTotal, selicAtual);

    // --- NOVA LÓGICA DE CÁLCULO E FORMATAÇÃO DA TAXA MENSAL ---
    const taxasPorParcela = {};
    for (const key in taxasEfetivas) {
        if (taxasEfetivas.hasOwnProperty(key)) {
            const taxaAnualEfetiva = taxasEfetivas[key];
            const taxaMensalEfetiva = (Math.pow(1 + taxaAnualEfetiva, 1/12) - 1);
            taxasPorParcela[key] = `${(taxaMensalEfetiva * 100).toFixed(2).replace('.', ',')}% a.m.`;
        }
    }
    // --- FIM DA NOVA LÓGICA ---

    console.log("Parcelas Calculadas:", parcelasCalculadas);
    console.log("Taxas por Parcela:", taxasPorParcela);

    const retorno = {
        // NOVO: Adiciona o tipo de proposta ao objeto
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
            // **ALTERAÇÃO AQUI:** Removido as casas decimais do valor
            idealPara: idealParaValor.toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            })
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
            // NOVO: Adiciona o resumo de instalação ao objeto de retorno
            resumoInstalacao: tipoProposta === 'premium' ? resumoInstalacaoPremium : resumoInstalacaoAcessivel
        },
        valores: {
            // **ALTERAÇÃO AQUI:** Removido as casas decimais do valor total
            valorTotal: valorTotal.toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }),
            valorResumo: valorResumo,
            payback: payback,
            parcelas: parcelasCalculadas,
            taxasPorParcela: taxasPorParcela, // **NOVO:** Adiciona as taxas individuais aqui
            // **CORREÇÃO AQUI:** Adiciona a taxa nominal para o caso de o front-end precisar dela
            taxaJurosMensal: `${(taxaMensalNominal * 100).toFixed(2).replace('.', ',')}% a.m.`,
            observacao: 'Os valores de financiamento apresentados são uma simulação e utilizam as taxas de juros médias consideradas no momento da consulta. O resultado final pode variar conforme o perfil de crédito do cliente e as condições da instituição financeira.'
        },
        validade: `Proposta válida por até 3 dias corridos ou enquanto durarem os estoques.`
    };

    console.log("Modelo: Dados tratados para a página.", retorno);
    return retorno;
}

/**
 * Função principal para buscar e processar os dados das propostas.
 * @param {string} numeroProjeto O ID do projeto.
 * @param {string} primeiroNomeCliente O primeiro nome do cliente para validação de segurança.
 * @returns {Promise<object>} Objeto com os dados das propostas Premium e Acessível.
 */
export async function buscarETratarProposta(numeroProjeto, primeiroNomeCliente) {
    console.log(`Modelo: Iniciando busca e validação para o projeto: ${numeroProjeto} e cliente: ${primeiroNomeCliente}`);

    const authResponse = await authenticate(apiToken);
    if (!authResponse.sucesso) {
        return authResponse;
    }
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
        return {
            sucesso: false,
            mensagem: 'Nome do cliente não corresponde ao projeto.'
        };
    }

    const propostaPremium = tratarDadosParaProposta(dadosApiPremium, 'premium', selicAtual);
    if (!propostaPremium) {
        return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Premium.' };
    }
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

    if (!propostaAcessivel) {
        return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Acessível.' };
    }
    dadosProposta.acessivel = propostaAcessivel;

    return {
        sucesso: true,
        dados: dadosProposta
    };
}

/**
 * Função para atualizar o status de visualização da proposta na API.
 * @param {{propostaId: string, tipoVisualizacao: 'P'|'A'}} dados O ID da proposta e o tipo de visualização.
 * @returns {Promise<object>} Objeto de resposta da API.
 */
export async function atualizarStatusVisualizacao(dados) {
    try {
        console.log(`Modelo: Iniciando atualização do status de visualização para o projeto ${dados.propostaId}.`);
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
        const body = {
            description: novaDescricao
        };

        const respostaApi = await patch(endpoint, body, accessToken);

        if (respostaApi.sucesso) {
            console.log("Modelo: Status de visualização atualizado com sucesso!");
        } else {
            console.error("Modelo: Falha ao atualizar status de visualização.");
        }
    } catch (erro) {
        console.log("Modelo: Erro ao tentar atualizar o status de visualização.", erro);
        return {
            sucesso: false,
            mensagem: 'Ocorreu um erro ao tentar atualizar o status de visualização.'
        };
    }
}