/**
 * model.js
 * * Este arquivo é o Modelo do projeto. Ele contém a lógica de negócios-,
 * se comunica com a camada de API e prepara os dados para o Controlador.
 */
// Importa as funções da API, incluindo a nova 'authenticate' e 'patch'
import { get, post, patch, getSelicTaxa } from './api.js';

// **ATENÇÃO: SUBSTITUA COM A SUA TOKEN DE API PESSOAL**
// Para fins de teste, ela está aqui. Em produção, use um método mais seguro.
//const apiToken = process.env.API_TOKEN;


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

// **NOVO: Função para validar se a proposta está expirada, usando o formato ISO 8601.**
/**
 * @param {object} proposta O objeto de dados da proposta (versão premium ou acessivel).
 * @returns {boolean} Retorna true se a proposta estiver ativa, false se estiver expirada.
 */
export function validarValidadeProposta(proposta) {
    if (!proposta || !proposta.dataExpiracao) {
        console.warn('Aviso: Data de expiração não encontrada na proposta.');
        return false;
    }

    const dataAtual = new Date();
    const dataExpiracao = new Date(proposta.dataExpiracao);

    // Ajusta o fuso horário para a data de expiração, garantindo que a comparação seja precisa.
    // O `Date` do JavaScript já faz o ajuste automático, mas é bom ter certeza.
    // O `expirationDate` do JSON já vem em UTC, então a comparação é direta.

    const estaAtiva = dataAtual <= dataExpiracao;

    if (!estaAtiva) {
        console.warn(`Proposta expirada em: ${proposta.dataExpiracao}`);
    }

    return estaAtiva;
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
    // PONTO DE LOG: Exibir as entradas do cálculo
    console.log('--- INÍCIO DO CÁLCULO DE FINANCIAMENTO ---');
    console.log(`Valor do Projeto: R$ ${valorProjeto}`);
    console.log(`Taxa SELIC Anual: ${selicAnual}%`);
    console.log('---');

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

    console.log(`Valor do Projeto: R$ ${valorProjeto.toFixed(2)}`);
    console.log(`IOF Fixo: R$ ${iofFixoCalculado.toFixed(2)}`);
    console.log(`IOF Diário (120 dias): R$ ${iofDiarioCalculado.toFixed(2)}`);
    console.log(`Valor Total Financiado (Projeto + IOF): R$ ${valorFinanciado.toFixed(2)}`);
    console.log('---');

    opcoesParcelas.forEach(n => {
        // PONTO DE LOG: Exibir os valores intermediários para cada parcela
        console.log(`\n--- Cálculo para ${n} parcelas ---`);

        // A nova lógica de spread agora inclui o fator de risco.
        const jurosAnualNominal = selicDecimal + spreadBaseAnual + (n * FATOR_RISCO_PRAZO);
        console.log(`Juros Anual Nominal: ${jurosAnualNominal.toFixed(6)}`);

        const jurosMensalNominal = (Math.pow((1 + jurosAnualNominal), (1 / 12))) - 1;
        console.log(`Juros Mensal Nominal: ${jurosMensalNominal.toFixed(6)}`);

        if (jurosMensalNominal <= 0) {
            const valorParcela = (valorFinanciado / n);
            simulacao[`parcela-${n}`] = valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            taxasNominais[`taxaNominal-${n}`] = 0;
            taxasEfetivas[`taxaAnualEfetiva-${n}`] = 0;
            return;
        }

        // CORREÇÃO: Usando o valor financiado SEM os juros de carência.
        const parcela = (valorFinanciado * jurosMensalNominal * Math.pow((1 + jurosMensalNominal), n)) / (Math.pow((1 + jurosMensalNominal), n) - 1);

        // PONTO DE LOG: O valor final da parcela
        console.log(`VALOR DA PARCELA FINAL: R$ ${parcela.toFixed(2)}`);

        simulacao[`parcela-${n}`] = parcela.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        taxasNominais[`taxaNominal-${n}`] = jurosMensalNominal;
        const taxaMensalEfetiva = calcularTIRMensal(valorFinanciado, parcela, n);
        taxasEfetivas[`taxaAnualEfetiva-${n}`] = Math.pow(1 + taxaMensalEfetiva, 12) - 1;
    });

    console.log('\n--- FIM DO CÁLCULO ---');

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
    // NOVO: Extrai a data de expiração diretamente da propriedade 'expirationDate'
    const dataExpiracao = dados.expirationDate || 'Não informado';


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
        // NOVO: Adiciona a data de expiração ao objeto de retorno
        dataExpiracao: dataExpiracao,
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

    const endpointPremium = `/projects/${numeroProjeto}/proposals`;
    const dadosApiPremium = await get(endpointPremium);

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

    // --- NOVA LÓGICA DE VALIDAÇÃO ANTECIPADA DA PROPOSTA PREMIUM ---
    // Cria um objeto temporário para a verificação de validade
    const propostaParaValidarPremium = {
        dataExpiracao: dadosApiPremium.dados.expirationDate,
    };
    if (!validarValidadeProposta(propostaParaValidarPremium)) {
        return {
            sucesso: false,
            mensagem: 'Proposta premium expirada. Por favor, solicite uma nova.'
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

    // Trata a proposta Premium, já validada
    const propostaPremium = tratarDadosParaProposta(dadosApiPremium, 'premium', selicAtual);
    if (!propostaPremium) { return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Premium.' }; }
    dadosProposta.premium = propostaPremium;

    // --- NOVA LÓGICA PARA BUSCAR E VALIDAR A PROPOSTA ACESSÍVEL ---
    const idProjetoAcessivel = extrairValorVariavelPorChave(dadosApiPremium.dados.variables, 'vc_projeto_acessivel');

    // Reseta a proposta acessível para 'null' para garantir o estado inicial
    dadosProposta.acessivel = null;

    if (idProjetoAcessivel) {
        const endpointAcessivel = `/projects/${idProjetoAcessivel}/proposals`;
        const dadosApiAcessivel = await get(endpointAcessivel, accessToken);

        if (dadosApiAcessivel.sucesso) {
            // Cria um objeto temporário para a verificação de validade da proposta acessível
            const propostaParaValidarAcessivel = {
                dataExpiracao: dadosApiAcessivel.dados.expirationDate
            };

            // Valida a data de expiração da proposta acessível
            if (validarValidadeProposta(propostaParaValidarAcessivel)) {
                // Se estiver ativa, trata e armazena os dados
                const propostaAcessivel = tratarDadosParaProposta(dadosApiAcessivel, 'acessivel', selicAtual);
                if (propostaAcessivel) {
                    dadosProposta.acessivel = propostaAcessivel;
                } else {
                    console.error("Falha ao processar dados da proposta Acessível, mas a premium foi carregada.");
                    // Continua o fluxo, mas apenas com a proposta premium
                }
            } else {
                console.warn("Proposta acessível encontrada, mas está expirada. Carregando apenas a proposta premium.");
                // Continua o fluxo, mas apenas com a proposta premium
            }
        } else {
            console.warn("Falha ao buscar dados da proposta acessível. Carregando apenas a proposta premium.");
            // Continua o fluxo, mas apenas com a proposta premium
        }
    } else {
        console.log("ID do projeto acessível não encontrado na proposta premium. Carregando apenas a proposta premium.");
        // Continua o fluxo, pois não há uma proposta acessível para buscar
    }

    return { sucesso: true, dados: dadosProposta };
}

export async function atualizarStatusVisualizacao(dados) {
    try {
        const agora = new Date();
        const dataHoraFormatada = `${agora.getDate().toString().padStart(2, '0')}-${(agora.getMonth() + 1).toString().padStart(2, '0')}-${agora.getFullYear()} ${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`;
        const novaDescricao = `${dados.tipoVisualizacao}: ${dataHoraFormatada}`;
        const endpoint = `/projects/${dados.propostaId}`;
        const body = { description: novaDescricao };

        const respostaApi = await patch(endpoint, body);
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