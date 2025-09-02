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
            simulacao[`parcela-${n}`] = valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            // Para taxa zero, a taxa efetiva é zero
            taxasEfetivas[`taxaMensalEfetiva-${n}`] = 0;
            return;
        }
        const parcela = (valorComIOF * jurosMensalNominal * Math.pow((1 + jurosMensalNominal), n)) / (Math.pow((1 + jurosMensalNominal), n) - 1);
        // **ALTERAÇÃO AQUI:** Removido as casas decimais das parcelas
        simulacao[`parcela-${n}`] = parcela.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        // **NOVO:** Calcula a taxa de juros efetiva (TIR) para cada simulação de financiamento
        const taxaMensalEfetiva = calcularTIRMensal(valorComIOF, parcela, n);
        // **ALTERAÇÃO AQUI:** Armazena a taxa mensal efetiva, não a anual
        taxasEfetivas[`taxaMensalEfetiva-${n}`] = taxaMensalEfetiva * 100;
    });

    return {
        ...simulacao,
        ...taxasEfetivas,
        jurosNominal: jurosAnualNominal * 100 // Retorna a taxa nominal para fins de exibição
    };
}


/**
 * Função principal para buscar e processar os dados da proposta.
 * Inclui o cálculo da simulação de financiamento.
 * @param {string} numeroProjeto O número do projeto a ser buscado.
 * @param {string} primeiroNome O primeiro nome do cliente.
 * @returns {Promise<object>} Um objeto contendo os dados da proposta tratada.
 */
export async function buscarETratarProposta(numeroProjeto, primeiroNome) {
    const authResponse = await authenticate(apiToken);
    if (!authResponse.sucesso) {
        console.error("Modelo: Falha na autenticação.", authResponse.mensagem);
        return authResponse;
    }

    const accessToken = authResponse.accessToken;

    try {
        const params = new URLSearchParams({
            project_number: numeroProjeto,
            first_name: primeiroNome
        });

        const respostaApi = await get(`/proposals?${params.toString()}`, accessToken);

        if (!respostaApi.sucesso) {
            console.error("Modelo: Falha na busca da proposta.", respostaApi.mensagem);
            return respostaApi;
        }

        const dadosOriginais = respostaApi.data[0];

        if (!dadosOriginais) {
            return {
                sucesso: false,
                mensagem: "Proposta não encontrada."
            };
        }

        // Busca a taxa Selic para o cálculo
        const selicAnual = await getSelicTaxa();

        if (selicAnual === null) {
            console.error("Modelo: Falha ao obter a taxa Selic. Usando um valor padrão para cálculo.");
        }

        // Processa as duas propostas (Premium e Acessível)
        dadosProposta.premium = processarProposta(dadosOriginais, 'premium', selicAnual);
        dadosProposta.acessivel = processarProposta(dadosOriginais, 'acessivel', selicAnual);

        // Retorna o objeto completo para o controlador
        return {
            sucesso: true,
            propostas: dadosProposta,
            mensagem: "Proposta processada com sucesso."
        };

    } catch (erro) {
        console.error("Modelo: Erro no processamento da proposta.", erro);
        return {
            sucesso: false,
            mensagem: 'Ocorreu um erro no processamento dos dados.'
        };
    }
}

/**
 * Função para processar os dados de uma proposta específica (premium ou acessível).
 * @param {object} dadosOriginais Os dados originais da API.
 * @param {string} tipo O tipo de proposta ('premium' ou 'acessivel').
 * @param {number} selicAnual A taxa Selic anual.
 * @returns {object} O objeto de proposta processado.
 */
function processarProposta(dadosOriginais, tipo, selicAnual) {
    const propostaDoTipo = dadosOriginais.proposals.find(p => p.proposal_type === tipo);
    const variables = propostaDoTipo?.variables || [];

    // O valor do projeto é o preço do equipamento e da instalação, mas é armazenado no `valor_projeto`
    const valorTotalProjeto = extrairValorNumericoPorChave(variables, 'valor_projeto');

    const simulacaoFinanciamento = calcularFinanciamento(valorTotalProjeto, selicAnual || 13.75);

    const propostaTratada = {
        propostaId: dadosOriginais.id,
        cliente: extrairValorVariavelPorChave(variables, 'nome_completo'),
        local: extrairValorVariavelPorChave(variables, 'localidade_instalacao'),
        dataProposta: formatarData(dadosOriginais.created_at),
        sistema: {
            geracaoMedia: extrairValorVariavelPorChave(variables, 'geracao_mensal_media'),
            idealPara: extrairValorVariavelPorChave(variables, 'faixa_consumo'),
            instalacaoPaineis: extrairValorVariavelPorChave(variables, 'tipo_instalacao')
        },
        equipamentos: {
            descricaoInversor: extrairValorVariavelPorChave(variables, 'inversor'),
            quantidadeInversor: extrairValorNumericoPorChave(variables, 'quantidade_inversor'),
            descricaoPainel: extrairValorVariavelPorChave(variables, 'modulos'),
            quantidadePainel: extrairValorNumericoPorChave(variables, 'quantidade_modulos'),
            imagem: caminhosImagens.equipamentos[tipo]
        },
        instalacao: {
            imagem: caminhosImagens.instalacao[tipo],
            detalhesInstalacao: tipo === 'premium' ? detalhesInstalacaoPremium : detalhesInstalacaoAcessivel,
            resumo: tipo === 'premium' ? resumoInstalacaoPremium : resumoInstalacaoAcessivel,
        },
        valores: {
            valorTotal: extrairValorVariavelPorChave(variables, 'valor_projeto'),
            desconto: extrairValorVariavelPorChave(variables, 'valor_desconto_aplicado'),
            valorAVista: extrairValorVariavelPorChave(variables, 'valor_a_vista'),
            simulacao: simulacaoFinanciamento,
            economiaMensal: extrairValorVariavelPorChave(variables, 'economia_mensal_media'),
            payback: formatarPayback(extrairValorNumericoPorChave(variables, 'payback_meses'))
        }
    };

    return propostaTratada;
}

/**
 * Atualiza o status de visualização de uma proposta na API.
 * @param {object} dados Objeto com propostaId e tipoVisualizacao.
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
            mensagem: 'Ocorreu um erro ao tentar atualizar o status.'
        };
    }
}