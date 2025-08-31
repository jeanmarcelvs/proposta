/**
 * model.js
 * * Este arquivo é o Modelo do projeto. Ele contém a lógica de negócios,
 * se comunica com a camada de API e prepara os dados para o Controlador.
 */
// Importa as funções da API, incluindo a nova 'authenticate' e 'patch'
import { get, post, authenticate, patch } from './api.js';

// **ATENÇÃO: SUBSTITUA COM A SUA TOKEN DE API PESSOAL**
// Para fins de teste, ela está aqui. Em produção, use um método mais seguro.
const apiToken = '3649:y915jaWXevVcFJWaIdzNZJHlYfXL3MdbOwXX041T';

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
    const fatorReducao = 0.8; // Redução de 20%
    const novaProposta = JSON.parse(JSON.stringify(propostaPremium));

    // Converte o valor total formatado para um número para o cálculo
    const valorTotalNumerico = parseFloat(novaProposta.valores.valorTotal.replace('.', '').replace(',', '.'));
    console.log(`DEBUG: Valor Total Premium: ${valorTotalNumerico}`);
    novaProposta.valores.valorTotal = (valorTotalNumerico * fatorReducao).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    console.log(`DEBUG: Novo Valor Total Acessível: ${novaProposta.valores.valorTotal}`);

    // Calcula os valores das parcelas com base no fator de redução
    for (const key in novaProposta.valores.parcelas) {
        const valorParcelaNumerico = parseFloat(novaProposta.valores.parcelas[key].replace('.', '').replace(',', '.'));
        novaProposta.valores.parcelas[key] = (valorParcelaNumerico * fatorReducao).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        console.log(`DEBUG: Nova Parcela ${key}: ${novaProposta.valores.parcelas[key]}`);
    }

    // NOVO: Cálculo do payback proporcional
    const paybackPremiumEmMeses = (propostaPremium.valores.paybackAnos * 12) + propostaPremium.valores.paybackMeses;
    const paybackAcessivelEmMeses = paybackPremiumEmMeses * fatorReducao;
    novaProposta.valores.payback = formatarPayback(paybackAcessivelEmMeses);

    novaProposta.equipamentos.imagemAcessivel = caminhosImagens.equipamentos.acessivel;
    
    // NOVO: Detalhes de instalação para a proposta +Acessível (Texto corrigido)
    novaProposta.instalacao = {
        imagemInstalacaoAcessivel: caminhosImagens.instalacao.acessivel,
        detalhesInstalacao: [
            { icone: 'fa-shield-alt', texto: 'O projeto considera as proteções internas já existentes na propriedade e as internas do inversor.' },
            { icone: 'fa-bolt', texto: 'Conexões elétricas simples.' },
            { icone: 'fa-solar-panel', texto: 'Utilização de cabos simples.' },
            { icone: 'fa-plug', texto: 'Ramal de Entrada de **responsabilidade da concessionária**, geralmente de alumínio, **Não fazemos a sua substituição**.' },
            { icone: 'fa-cogs', texto: 'Instalação elétrica simples, sem as otimizações de uma instalação especializada padrão premium.' }
        ]
    };
    console.log("DEBUG: Proposta Acessível finalizada.");
    return novaProposta;
}

/**
 * Busca e trata os dados de uma proposta da API.
 * @param {string} numeroProjeto O número do projeto a ser buscado.
 * @returns {Promise<object>} Objeto com a proposta tratada ou um erro.
 */
export async function buscarETratarProposta(numeroProjeto) {
    try {
        console.log("Modelo: Iniciando o processo de autenticação...");
        const authResponse = await authenticate(apiToken);

        if (!authResponse.sucesso) {
            console.error("Modelo: Falha na autenticação.", authResponse.mensagem);
            return authResponse;
        }

        const accessToken = authResponse.accessToken;
        
        console.log("Modelo: Autenticação bem-sucedida. Buscando dados da proposta...");
        // Usa o endpoint correto com o número do projeto e passa o accessToken
        const respostaApi = await get(`/projects/${numeroProjeto}/proposals`, accessToken);
        console.log("Modelo: Resposta da API recebida:", respostaApi);

        if (!respostaApi.sucesso || !respostaApi.dados) {
            console.error("Modelo: Resposta da API indica falha ou dados ausentes.");
            throw new Error(respostaApi.mensagem || 'Proposta não encontrada.');
        }

        const dadosOriginais = respostaApi.dados;
        const variables = dadosOriginais.variables || [];
        const pricingTable = dadosOriginais.pricingTable || [];
        
        const expirationDate = dadosOriginais.expirationDate;

        if (!expirationDate) {
            console.error("Modelo: A proposta não possui uma data de expiração. Retornando erro.");
            return {
                sucesso: false,
                mensagem: 'Esta proposta não é válida, pois não possui uma data de expiração definida.'
            };
        }

        const expirationDateLocalString = expirationDate.replace('Z', '');
        const validade = new Date(expirationDateLocalString);
        const hoje = new Date();
        const diasRestantes = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        // Verifica a validade da proposta antes de processar todos os dados
        if (diasRestantes <= 0) {
            return {
                sucesso: false,
                expirada: true,
                mensagem: 'Esta proposta está expirada.'
            };
        }

        console.log("Modelo: Extraindo variáveis e dados da pricingTable...");

        // Dados do cliente
        const nomeCliente = extrairValorVariavelPorChave(variables, 'cliente_nome') || dadosOriginais.cliente?.nome || 'Não informado';
        const cidade = extrairValorVariavelPorChave(variables, 'cliente_cidade') || 'Não informada';
        const estado = extrairValorVariavelPorChave(variables, 'cliente_estado') || 'Não informado';
        
        // Dados do sistema
        const geracaoMensalFormatada = extrairValorVariavelPorChave(variables, 'geracao_mensal') || 'N/A';
        const geracaoMensalNumerica = extrairValorNumericoPorChave(variables, 'geracao_mensal');
        const potenciaSistema = extrairValorVariavelPorChave(variables, 'potencia_sistema') || 'N/A';
        const instalacaoPaineis = extrairValorVariavelPorChave(variables, 'vc_tipo_de_estrutura') || 'Não informado';
        const tarifaNumerica = extrairValorNumericoPorChave(variables, 'tarifa_distribuidora_uc1');
        
        // Cálculo do valor "Ideal para contas de até"
        const idealParaValor = (geracaoMensalNumerica && tarifaNumerica) ? 
                                (geracaoMensalNumerica * tarifaNumerica).toLocaleString('pt-BR', { 
                                    minimumFractionDigits: 2, 
                                    maximumFractionDigits: 2 
                                }) : 
                                'Não informado';
        
        // Dados dos equipamentos a partir das chaves corretas
        const potenciaInversor = extrairValorVariavelPorChave(variables, 'inversor_potencia_nominal_1') || '0';
        const quantidadeInversor = extrairValorVariavelPorChave(variables, 'inversor_quantidade_1') || '0';
        const potenciaModulo = extrairValorVariavelPorChave(variables, 'modulo_potencia') || '0';
        const quantidadeModulo = extrairValorVariavelPorChave(variables, 'modulo_quantidade') || '0';

        // Valores financeiros
        const valorTotal = extrairValorVariavelPorChave(variables, 'preco') || 'Não informado';
        const paybackDados = extrairValorPayback(extrairValorVariavelPorChave(variables, 'payback'));

        // Extração dos valores das parcelas
        const parcelas = {};
        for (let i = 1; i <= 7; i++) {
            const prazoKey = `f_prazo_${i}`;
            const parcelaKey = `f_parcela_${i}`;
            const prazo = extrairValorVariavelPorChave(variables, prazoKey);
            const valorParcela = extrairValorVariavelPorChave(variables, parcelaKey);
            
            if (prazo && valorParcela) {
                parcelas[prazo] = valorParcela;
            }
        }

        const dadosProposta = {
            premium: {
                cliente: {
                    nome: nomeCliente,
                    local: `${cidade}-${estado}`,
                    dataProposta: formatarData(dadosOriginais.generatedAt),
                },
                sistema: {
                    geracaoMedia: `${geracaoMensalFormatada} kWh/mês`,
                    potenciaSistema: `${potenciaSistema} kWp`,
                    instalacaoPaineis: instalacaoPaineis,
                    idealPara: idealParaValor,
                },
                equipamentos: {
                    descricaoInversor: `${potenciaInversor} W`,
                    quantidadeInversor: quantidadeInversor,
                    descricaoPainel: `${potenciaModulo} W`,
                    quantidadePainel: quantidadeModulo,
                    imagemPremium: caminhosImagens.equipamentos.premium,
                },
                valores: {
                    valorTotal: valorTotal,
                    paybackAnos: paybackDados.anos,
                    paybackMeses: paybackDados.meses,
                    payback: formatarPayback((paybackDados.anos * 12) + paybackDados.meses), // Adicionado para manter a estrutura
                    parcelas: parcelas,
                },
                instalacao: {
                    imagemInstalacaoPremium: caminhosImagens.instalacao.premium,
                    detalhesInstalacao: [
                        { icone: 'fa-shield-alt', texto: 'Sistema de proteção **coordenado completo**, projetado para garantir a **segurança total** dos seus equipamentos e da sua residência contra surtos e descargas atmosféricas. Um escudo de proteção para o seu investimento.' },
                        { icone: 'fa-bolt', texto: 'Utilização de componentes e materiais elétricos de **padrão superior**, com certificação técnica que assegura a máxima integridade e **longevidade** de toda a sua instalação.' },
                        { icone: 'fa-solar-panel', texto: 'Cabos solares com **dupla camada de proteção**, resistentes a raios UV e retardantes de chamas, garantindo um desempenho seguro e ininterrupto por décadas.' },
                        { icone: 'fa-plug', texto: 'O ramal de entrada, de **responsabilidade da concessionária** e geralmente de alumínio, é **totalmente substituído** por um ramal de cobre, otimizando o fluxo de energia e elevando o nível de segurança da sua propriedade.' },
                        { icone: 'fa-cogs', texto: 'Instalação executada por mão de obra especializada que segue rigorosamente as **normas técnicas da ABNT**, garantindo o desempenho máximo do seu sistema e eliminando riscos.' }
                    ]
                }
            }
        };

        const propostaAcessivel = calcularPropostaAcessivel(dadosProposta.premium);
        dadosProposta.acessivel = propostaAcessivel;

        dadosProposta.validade = {
            dias: diasRestantes,
            texto: `Válida por mais ${diasRestantes} dias`
        };

        localStorage.setItem('propostaData', JSON.stringify(dadosProposta));
        return {
            sucesso: true,
            proposta: dadosProposta
        };

    } catch (erro) {
        console.error("Modelo: Erro no modelo:", erro);
        return {
            sucesso: false,
            mensagem: erro.message
        };
    }
}

/**
 * Função para atualizar o status de visualização na API.
 * @param {object} dados Os dados a serem enviados (ex: numeroProjeto e tipo de visualização).
 */
export async function atualizarStatusVisualizacao(dados) {
    try {
        console.log("Modelo: Recebendo dados para atualização.");
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
    }
}