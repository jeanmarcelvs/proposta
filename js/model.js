/**
 * model.js
 * * Este arquivo é o Modelo do projeto. Ele contém a lógica de negócios,
 * se comunica com a camada de API e prepara os dados para o Controlador.
 */
// Importa as funções da API, incluindo a nova 'authenticate' e 'patch'
import { get, post, authenticate, patch } from './api.js';

// **ATENÇÃO: SUBSTITUA COM A SUA TOKEN DE API PESSOAL**
// Para fins de teste, ela está aqui. Em produção, use um método mais seguro.
//const apiToken = process.env.API_TOKEN;
const apiToken = "3649:y915jaWXevVcFJWaIdzNZJHlYfXL3MdbOwXX041T"

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
 * NOVO: Função para formatar um total de meses em "X anos e Y meses".
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

/**
 * Calcula os valores da proposta acessível com base nos valores da Premium.
 * @param {object} propostaPremium Os dados da proposta Premium.
 * @returns {object} Os dados da proposta acessível.
 */
function calcularPropostaAcessivel(propostaPremium) {
    console.log("DEBUG: Calculando proposta Acessível com base na Premium...");

    // Lógica para calcular o fator de redução dinâmico
    const potenciaStr = propostaPremium.sistema?.potenciaSistema || '0 kWp';
    const potenciaNumerica = parseFloat(potenciaStr.replace(' kWp', '').replace(',', '.'));
    const minPotencia = 2;
    const maxPotencia = 100;
    const minReducao = 0.078; // 7.8%
    const maxReducao = 0.098; // 9.8%

    // Garante que a potência esteja dentro da faixa esperada
    const potenciaClamped = Math.max(minPotencia, Math.min(maxPotencia, potenciaNumerica));

    // Calcula o percentual de redução usando uma interpolação linear inversa
    const percentualReducao = maxReducao - ((potenciaClamped - minPotencia) / (maxPotencia - minPotencia)) * (maxReducao - minReducao);

    // Calcula o fator de redução
    const fatorReducao = 1 - percentualReducao;

    const novaProposta = JSON.parse(JSON.stringify(propostaPremium));

    // Converte o valor total formatado para um número para o cálculo
    const valorTotalNumerico = parseFloat(novaProposta.valores.valorTotal.replace('.', '').replace(',', '.'));
    console.log(`DEBUG: Valor Total Premium: ${valorTotalNumerico}`);
    console.log(`DEBUG: Fator de Redução: ${fatorReducao}`);

    // Calcula o novo valor total com a redução
    const novoValorTotal = valorTotalNumerico * fatorReducao;

    // Atualiza os valores da nova proposta
    novaProposta.valores.valorTotal = novoValorTotal.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    // Recalcula o valor das parcelas
    for (const key in novaProposta.valores.parcelas) {
        if (Object.hasOwnProperty.call(novaProposta.valores.parcelas, key)) {
            const numParcelas = parseInt(key.replace('parcela-', ''));
            const valorParcela = novoValorTotal / numParcelas;
            novaProposta.valores.parcelas[key] = valorParcela.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
    }

    // Calcula o novo payback com base no novo valor total e no consumo mensal
    const consumoMensal = parseFloat(propostaPremium.sistema.consumoMensal.replace(' kWh', ''));
    if (consumoMensal > 0 && propostaPremium.valores.economiaMensal && propostaPremium.valores.economiaMensal > 0) {
        const mesesPayback = novoValorTotal / propostaPremium.valores.economiaMensal;
        novaProposta.valores.payback = formatarPayback(mesesPayback);
    } else {
        novaProposta.valores.payback = "Não informado";
    }

    // Atualiza os caminhos das imagens
    novaProposta.caminhosImagens = {
        equipamentos: caminhosImagens.equipamentos.acessivel,
        instalacao: caminhosImagens.instalacao.acessivel
    };

    console.log("DEBUG: Proposta Acessível calculada e tratada.", novaProposta);
    return novaProposta;
}

/**
 * Função para tratar e formatar os dados brutos da API para o formato que a página precisa.
 * Esta é a função principal de transformação.
 * @param {object} dadosApi O objeto de dados brutos recebido da API.
 * @returns {object} Um objeto com os dados formatados para a página.
 */
function tratarDadosParaProposta(dadosApi) {
    if (!dadosApi || !dadosApi.dados) {
        console.error("Modelo: Dados da API não encontrados ou incompletos.");
        return null;
    }

    const {
        dados
    } = dadosApi;
    const variables = dados.variables || [];
    const pricingTable = dados.pricingTable || [];
    const nomeCliente = dados.project?.name || 'Não informado';
    const dataProposta = formatarData(dados.generatedAt) || 'Não informado';
    const idProposta = dados.id || null;
    const linkProposta = dados.linkPdf || '#';

    console.log("Modelo: Tratando dados para proposta premium");

    // Encontra os equipamentos
    const painel = pricingTable.find(item => item.category === 'Módulo');
    const inversor = pricingTable.find(item => item.category === 'Inversor');
    const instalacao = pricingTable.find(item => item.category === 'Instalação');
    const kit = pricingTable.find(item => item.category === 'KIT' && item.item === '123');

    // Encontra variáveis
    const consumoMensal = extrairValorVariavelPorChave(variables, 'consumo_mensal') || 'N/A';
    const geracaoMedia = extrairValorVariavelPorChave(variables, 'geracao_media') || 'N/A';
    const potenciaSistema = extrairValorVariavelPorChave(variables, 'potencia_kit') || 'N/A';
    const economiaMensal = extrairValorNumericoPorChave(variables, 'economia_mensal_valor') || 0;
    const payback = extrairValorVariavelPorChave(variables, 'payback') || 'Não informado';

    // Calcula os valores financeiros
    const valorTotal = (dados.salesValue || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const valorResumo = (dados.salesValue * 0.95).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const parcelas = {};
    [12, 24, 36, 48, 60, 72, 84].forEach(p => {
        if (dados.salesValue > 0) {
            parcelas[`parcela-${p}`] = (dados.salesValue / p).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } else {
            parcelas[`parcela-${p}`] = '0,00';
        }
    });

    const retorno = {
        id: dados.project.id,
        propostaId: idProposta,
        cliente: nomeCliente,
        consumoMensal: `${consumoMensal} kWh`,
        geracaoMensal: `${geracaoMedia} kWh`,
        local: `${dados.project.city || 'Não informado'} / ${dados.project.state || 'Não informado'}`,
        dataProposta: dataProposta,
        linkProposta: linkProposta,
        sistema: {
            geracaoMedia: `${geracaoMedia} kWh/mês`,
            potenciaSistema: `${potenciaSistema} kWp`,
            idealPara: (economiaMensal * 1.5).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }),
            instalacaoPaineis: 'Instalação no telhado (inclinação e orientação ideal)' // Valor estático
        },
        equipamentos: {
            quantidadePainel: painel?.qnt || 0,
            descricaoPainel: painel?.item || 'Não informado',
            quantidadeInversor: inversor?.qnt || 0,
            descricaoInversor: inversor?.item || 'Não informado'
        },
        instalacao: {
            detalhesInstalacao: [{
                icone: 'fa-truck-moving',
                texto: 'Transporte de todo o material'
            }, {
                icone: 'fa-tools',
                texto: 'Instalação do sistema fotovoltaico'
            }, {
                icone: 'fa-drafting-compass',
                texto: 'Projeto técnico e homologação'
            }, {
                icone: 'fa-check-circle',
                texto: 'Garantia e suporte técnico'
            }, ],
        },
        valores: {
            valorTotal: valorTotal,
            valorResumo: valorResumo,
            economiaMensal: economiaMensal,
            payback: payback,
            parcelas: parcelas,
            observacao: 'Os valores de financiamento são uma simulação e podem variar conforme o perfil do cliente e as condições do banco.'
        },
        validade: `3 dias corridos`
    };

    console.log("Modelo: Dados tratados para a página.", retorno);
    return retorno;
}

/**
 * Função principal para buscar e processar os dados das propostas.
 * @param {string} numeroProjeto O ID do projeto.
 * @returns {Promise<object>} Objeto com os dados das propostas Premium e Acessível.
 */
export async function buscarETratarProposta(numeroProjeto) {
    console.log(`Modelo: Iniciando busca e tratamento para o projeto: ${numeroProjeto}`);

    // Autentica para obter a token de acesso
    const authResponse = await authenticate(apiToken);
    if (!authResponse.sucesso) {
        console.error("Modelo: Falha na autenticação.", authResponse.mensagem);
        return authResponse;
    }
    const accessToken = authResponse.accessToken;

    // Busca os dados da proposta Premium
    const endpointPremium = `/projects/${numeroProjeto}/proposals`;
    const dadosApiPremium = await get(endpointPremium, accessToken);
    if (!dadosApiPremium.sucesso) {
        console.error("Modelo: Falha ao buscar dados da proposta Premium.");
        return dadosApiPremium;
    }

    const propostaPremium = tratarDadosParaProposta(dadosApiPremium);
    if (!propostaPremium) {
        console.error("Modelo: Falha ao tratar dados da proposta Premium.");
        return {
            sucesso: false,
            mensagem: 'Falha ao processar dados da proposta Premium.'
        };
    }
    dadosProposta.premium = propostaPremium;

    // Tenta encontrar e buscar a proposta acessível
    const idPropostaAcessivel = extrairValorVariavelPorChave(dadosApiPremium.dados.variables, 'id_proposta_acessivel');
    let propostaAcessivel = null;
    if (idPropostaAcessivel) {
        console.log(`Modelo: ID de proposta acessível encontrado: ${idPropostaAcessivel}`);
        const endpointAcessivel = `/projects/${idPropostaAcessivel}/proposals`;
        const dadosApiAcessivel = await get(endpointAcessivel, accessToken);
        if (dadosApiAcessivel.sucesso) {
            propostaAcessivel = tratarDadosParaProposta(dadosApiAcessivel);
            if (!propostaAcessivel) {
                console.warn("Modelo: Falha ao tratar dados da proposta Acessível. Calculando com base na Premium.");
                propostaAcessivel = calcularPropostaAcessivel(propostaPremium);
            }
        } else {
            console.warn("Modelo: Falha ao buscar dados da proposta Acessível. Calculando com base na Premium.");
            propostaAcessivel = calcularPropostaAcessivel(propostaPremium);
        }
    } else {
        console.warn("Modelo: ID da proposta acessível não encontrado. Calculando com base na Premium.");
        propostaAcessivel = calcularPropostaAcessivel(propostaPremium);
    }
    dadosProposta.acessivel = propostaAcessivel;

    console.log("DEBUG: Retornando dados das propostas:", dadosProposta);
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