/**
 * model.js
 * * Este arquivo é o Modelo do projeto. Ele contém a lógica de negócios-,
 * se comunica com a camada de API e prepara os dados para o Controlador.
 */
// Importa as funções da API
import { get, patch, getSelicTaxa } from './api.js';

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
    { icone: 'fa-box-open', titulo: 'Infraestrutura Metálica: Feita para Durar', texto: 'Eletrocalhas galvanizadas em metal robusto garantem a proteção física total do cabeamento e, por gestão térmica, **auxiliam na dissipação de calor**, minimizando a dilatação e folga das conexões.' },
    { icone: 'fa-shield-alt', titulo: 'Sistema de Proteção Elétrica Coordenada', texto: 'Proteção robusta com sistemas de proteção dedicados, garantindo a **proteção total do sistema de geração e de toda a instalação elétrica interna do imóvel** contra anomalias da rede pública.' },
    { icone: 'fa-wrench', titulo: 'Instalação Padrão Ouro', texto: 'Cabos, conexões e quadros organizados e selados, o que minimiza o risco de falhas elétricas, devido por exemplo à entrada de umidade, resultando em um **sistema mais seguro e mais estável** ao longo de sua vida útil.' },
    { icone: 'fa-dollar-sign', titulo: 'Custo Real Baixo no Longo Prazo', texto: 'O investimento em durabilidade e segurança agora resulta em um **menor custo total de operação** do sistema, pois a infraestrutura reduz a necessidade de reparos e ajustes corretivos no futuro.' }
];

// Detalhes de instalação fixos para a proposta Acessível (dados corrigidos)
// ATUALIZADO: Foco em Viabilidade, Economia Imediata e Acompanhamento.
const detalhesInstalacaoAcessivel = [
    { icone: 'fa-dollar-sign', titulo: 'Investimento Inicial Reduzido', texto: 'Configuração que prioriza o custo mais baixo inicialmente.' },
    { icone: 'fa-bolt', titulo: 'Proteção Limitada e Focada no Inversor', texto: 'O sistema conta somente com as proteções internas que acompanham o Inversor. A ausência de sistemas de proteção coordenados e dedicados (externos) deixa o sistema de geração e os aparelhos elétricos do imóvel vulneráveis a surtos e anomalias provenientes da rede pública de energia.' },
    { icone: 'fa-search', titulo: 'Exige Manutenção Ativa e Custo Recorrente', texto: 'A infraestrutura mais simples (PVC) está sujeita a um desgaste mais rápido devido à mudança de temperatura. Além de não promover dissipação de calor para os cabos e conexões. Este fato aumenta a probabilidade de folgas, pontos quentes e desarmes indesejados, que interrompem a geração e geram custos extras com reparos.' }
];

// NOVO: Resumos para a seção de instalação
const resumoInstalacaoPremium = "O Projeto Premium garante maior segurança ao patrimônio, durabilidade dos equipamentos e eficiência na geração de energia, proporcionando tranquilidade e economia sustentável a longo prazo.";

const resumoInstalacaoAcessivel = "A opção +Acessível é conhecida no mercado como solução de entrada, com menor investimento inicial. No entanto, demanda manutenções mais frequentes e apresenta redução de eficiência em menos tempo.";

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
        resumoInstalacao: isVE ? (tipoProposta === 'premium' ? resumoInstalacaoPremiumVE : resumoInstalacaoAcessivelVE) : (tipoProposta === 'premium' ? resumoInstalacaoPremium : resumoInstalacaoAcessivel)
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
        sistema,
        equipamentos,
        instalacao,
        valores,
        validade: `Proposta válida por até 3 dias corridos ou enquanto houver disponibilidade em estoque.`
    };

    return retorno;
}

// **RESTANTE DO CÓDIGO** (permanece inalterado)
export async function buscarETratarProposta(numeroProjeto, primeiroNomeCliente) {
    const endpointPremium = `/projects/${numeroProjeto}/proposals`;
    const dadosApiPremium = await get(endpointPremium);

    if (!dadosApiPremium.sucesso) {
        console.error('Falha na busca da proposta premium.');
        return {
            sucesso: false,
            mensagem: 'Projeto não encontrado ou dados inválidos.'
        };
    }

    const proposta = dadosApiPremium.dados.data;

    // Acessa o nome do cliente a partir das variáveis
    const nomeCompletoApi = extrairValorVariavelPorChave(proposta.variables, 'cliente_nome');
    const primeiroNomeApi = nomeCompletoApi ? nomeCompletoApi.split(' ')[0] : null;

    if (!primeiroNomeApi || primeiroNomeApi.toLowerCase() !== primeiroNomeCliente.toLowerCase()) {
        console.error("Tentativa de acesso não autorizado. Nome não corresponde.");
        return { sucesso: false, mensagem: 'Nome do cliente não corresponde ao projeto.' };
    }

    // --- NOVA LÓGICA DE VALIDAÇÃO ANTECIPADA DA PROPOSTA PREMIUM ---
    // Cria um objeto temporário para a verificação de validade
    const propostaParaValidarPremium = {
        dataExpiracao: proposta.expirationDate,
    };
    if (!validarValidadeProposta(propostaParaValidarPremium)) {
        console.warn('DEBUG: Proposta premium expirada.');
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

    const propostaPremium = tratarDadosParaProposta(dadosApiPremium, 'premium', selicAtual);
    if (!propostaPremium) { return { sucesso: false, mensagem: 'Falha ao processar dados da proposta Premium.' }; }
    dadosProposta.premium = propostaPremium;

    // --- NOVA LÓGICA PARA BUSCAR E VALIDAR A PROPOSTA ACESSÍVEL ---
    const idProjetoAcessivel = extrairValorVariavelPorChave(proposta.variables, 'vc_projeto_acessivel');

    // Reseta a proposta acessível para 'null' para garantir o estado inicial
    dadosProposta.acessivel = null;

    if (idProjetoAcessivel) {
        const endpointAcessivel = `/projects/${idProjetoAcessivel}/proposals`;
        const dadosApiAcessivel = await get(endpointAcessivel);

        if (dadosApiAcessivel.sucesso) {
            // Cria um objeto temporário para a verificação de validade da proposta acessível
            const propostaParaValidarAcessivel = {
                dataExpiracao: dadosApiAcessivel.dados.data.expirationDate
            };


            // Valida a data de expiração da proposta acessível
            if (validarValidadeProposta(propostaParaValidarAcessivel)) {
                // Se estiver ativa, trata e armazena os dados
                const propostaAcessivel = tratarDadosParaProposta(dadosApiAcessivel, 'acessivel', selicAtual);
                if (propostaAcessivel) {
                    dadosProposta.acessivel = propostaAcessivel;
                } else {
                    console.error("Falha ao processar dados da proposta Acessível, mas a premium foi carregada.");
                }
            } else {
                // A proposta acessível existe, mas está expirada. Não faz nada, apenas a premium será retornada.
            }
        } else {
            // Falha ao buscar a proposta acessível. Não faz nada, apenas a premium será retornada.
        }
    } else {
        // Não há proposta acessível vinculada. Não faz nada, apenas a premium será retornada.
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