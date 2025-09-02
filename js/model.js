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

// NOVO: Constantes para o cálculo do financiamento
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
    { icone: 'fa-shield-alt', texto: 'Sistema de Proteção Elétrica Coordenado e Completo (Proteções CC e CA)' },
    { icone: 'fa-bolt', texto: 'Infraestrutura Elétrica e Mecânica mais Segura e Durável' },
    { icone: 'fa-screwdriver-wrench', texto: 'Instalação projetada para garantir uma menor necessidade de manutenção ao longo da vida útil' }
];

// Detalhes de instalação fixos para a proposta Acessível (dados corrigidos)
const detalhesInstalacaoAcessivel = [
    { icone: 'fa-shield-alt', texto: 'Apenas proteções internas do inversor e as existentes na propriedade do cliente' },
    { icone: 'fa-bolt', texto: 'Infraestrutura elétrica e mecânica básica de mercado' },
    { icone: 'fa-plug', texto: 'Tipo de instalação básica de mercado, maior necessidade de manutenção ao longo da vida útil' }
];

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

// NOVO: Função para calcular o financiamento com a lógica da Tabela Price
/**
 * Calcula a simulação de financiamento com base na Selic e em um spread fixo.
 * @param {number} valorProjeto O valor total do projeto a ser financiado.
 * @param {number} selicAnual A taxa Selic anual em formato de número (ex: 10.5).
 * @returns {object} Um objeto com as parcelas calculadas.
 */

function calcularFinanciamento(valorProjeto, selicAnual) {
    const selicDecimal = selicAnual / 100;

    const jurosAnualTotal = selicDecimal + SPREAD_ANUAL;
    const jurosMensal = (Math.pow((1 + jurosAnualTotal), (1 / 12))) - 1;

    const opcoesParcelas = [12, 24, 36, 48, 60, 72, 84];
    const simulacao = {}; // Objeto para armazenar os resultados

    opcoesParcelas.forEach(n => {
        const iofFixoCalculado = IOF_FIXO * valorProjeto;
        const iofDiarioCalculado = IOF_DIARIO * n * 30 * valorProjeto;
        const valorComIOF = valorProjeto + iofFixoCalculado + iofDiarioCalculado;

        if (jurosMensal <= 0) {
            simulacao[`parcela-${n}`] = (valorComIOF / n).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            return;
        }

        // CORREÇÃO APLICADA AQUI
        const parcela = (valorComIOF * jurosMensal * Math.pow((1 + jurosMensal), n)) / (Math.pow((1 + jurosMensal), n) - 1);

        simulacao[`parcela-${n}`] = parcela.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    });

    // **NOVA LINHA:** Retorna a simulação e as duas taxas
    return { parcelas: simulacao, taxaAnual: jurosAnualTotal, taxaMensal: jurosMensal };
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
    // NOVO: Chamada para a nova função de cálculo das parcelas e captura dos valores de retorno
    const {
        parcelas: parcelasCalculadas,
        taxaAnual: taxaAnualCalculada,
        taxaMensal: taxaMensalCalculada
    } = calcularFinanciamento(valorTotal, selicAtual);

    // Apenas para mostrar no console
    console.log("Parcelas Calculadas:", parcelasCalculadas);

    const retorno = {
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
            idealPara: idealParaValor.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
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
        },
        valores: {
            valorTotal: valorTotal.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }),
            valorResumo: valorResumo,
            payback: payback,
            // ATUALIZADO: Usando as parcelas calculadas em vez das da API externa
            parcelas: parcelasCalculadas,
            // **NOVAS PROPRIEDADES:** As taxas de juros formatadas
            taxaJurosAnual: (taxaAnualCalculada * 100).toFixed(2).replace('.', ',') + '%',
            taxaJurosMensal: (taxaMensalCalculada * 100).toFixed(2).replace('.', ',') + '%',
            // NOVO: Adicionando a taxa SELIC
            selicTaxa: selicAtual.toLocaleString('pt-BR') + '%',
            // NOVO TEXTO DE OBSERVAÇÃO
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

    // NOVO: Busca a taxa Selic antes de buscar as propostas
    const selicAtual = await getSelicTaxa();
    if (selicAtual === null) {
        // Se a Selic não puder ser obtida, retorne um erro ou use um valor padrão
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

    // NOVO: Extrai o primeiro nome do cliente dos dados da API
    const nomeCompletoApi = extrairValorVariavelPorChave(dadosApiPremium.dados.variables, 'cliente_nome');
    const primeiroNomeApi = nomeCompletoApi ? nomeCompletoApi.split(' ')[0] : null;

    // NOVO: Realiza a validação de segurança
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

        // Formata a data e hora para a mensagem da API
        const agora = new Date();
        const dataHoraFormatada = `${agora.getDate().toString().padStart(2, '0')}-${(agora.getMonth() + 1).toString().padStart(2, '0')}-${agora.getFullYear()} ${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;

        // Monta a mensagem para o campo 'description'
        const novaDescricao = `${dados.tipoVisualizacao}: ${dataHoraFormatada}`;

        // O endpoint correto é o do projeto, e o método é PATCH
        // CORRIGIDO: Agora usa dados.propostaId
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
        console.error("Modelo: Erro ao tentar atualizar o status de visualização.", erro);
        return {
            sucesso: false,
            mensagem: 'Ocorreu um erro ao tentar atualizar o status de visualização.'
        };
    }
}