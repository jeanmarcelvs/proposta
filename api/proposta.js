/**
 * Arquivo: proposta.js
 * * Este script é responsável por gerenciar a lógica de consulta de propostas
 * de clientes e a manipulação do DOM para exibir os dados da proposta.
 * Ele utiliza uma API externa para buscar os dados.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Adiciona event listener ao botão de busca quando o DOM estiver carregado.
    const searchButton = document.querySelector('.search-button');
    if (searchButton) {
        searchButton.addEventListener('click', async () => {
            // Obtém o CPF do input
            const cpfInput = document.getElementById('cpf');
            const cpf = cpfInput.value.replace(/\D/g, ''); // Remove caracteres não numéricos

            // Verifica se o CPF tem 11 dígitos
            if (cpf.length === 11) {
                // Exibe o spinner de carregamento e esconde o conteúdo
                const spinner = document.querySelector('.spinner');
                const content = document.querySelector('.main-content');
                if (spinner && content) {
                    spinner.style.display = 'block';
                    content.style.display = 'none';
                }

                // Inicia o processo de busca
                await buscarEExibirProposta(cpf);
            } else {
                // Exibe uma mensagem de erro se o CPF for inválido
                alert("Por favor, digite um CPF válido com 11 dígitos.");
            }
        });
    }

    /**
     * Busca a proposta e atualiza a interface do usuário.
     * @param {string} cpf - O CPF do cliente.
     */
    async function buscarEExibirProposta(cpf) {
        try {
            // Primeiro, gera o token de acesso temporário
            const accessToken = await gerarAccessToken();
            if (!accessToken) {
                throw new Error("Não foi possível gerar o token de acesso.");
            }

            // Em seguida, consulta a proposta usando o token de acesso
            const proposta = await consultarProposta(cpf, accessToken);
            if (proposta && proposta.status === 'ok') {
                // Se a proposta for encontrada, atualiza a UI
                atualizarUIComProposta(proposta);
            } else {
                // Se não for encontrada, exibe mensagem de erro
                throw new Error(proposta.message || "Proposta não encontrada para o CPF informado.");
            }
        } catch (error) {
            console.error("Erro no fluxo principal:", error);
            alert(`Erro: ${error.message}`);
        } finally {
            // Esconde o spinner e mostra o conteúdo no final
            const spinner = document.querySelector('.spinner');
            const content = document.querySelector('.main-content');
            if (spinner && content) {
                spinner.style.display = 'none';
                content.style.display = 'block';
            }
        }
    }
    
    /**
     * Gera um token de acesso temporário usando o Token de Credencial (variável de ambiente do Vercel).
     * @returns {Promise<string>} O token de acesso.
     */
    async function gerarAccessToken() {
        // A API_TOKEN deve ser configurada como uma variável de ambiente no Vercel
        const apiToken = process.env.API_TOKEN;
        const url = 'https://business.solarmarket.com.br/api/v2/auth/signin';
    
        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json'
            },
            body: JSON.stringify({ token: apiToken })
        };
    
        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(`Erro HTTP ao gerar token: ${res.status} - ${errorData.message || 'Erro desconhecido'}`);
            }
            const data = await res.json();
            return data.access_token;
        } catch (err) {
            console.error("Erro ao gerar token de acesso:", err);
            return null;
        }
    }


    /**
     * Consulta a proposta de um cliente chamando o backend.
     * @param {string} cpf - O CPF do cliente.
     * @param {string} accessToken - O token de acesso para a consulta.
     * @returns {Promise<Object|null>} Um objeto com a proposta ou null em caso de falha.
     */
    async function consultarProposta(cpf, accessToken) {
        const backendUrl = `https://gdissolarproposta.vercel.app/api/proposta?cpf=${cpf}`;
        try {
            // Adiciona o token de acesso ao cabeçalho da requisição
            const res = await fetch(backendUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(`Erro HTTP: ${res.status} - ${errorData.message || 'Erro desconhecido'}`);
            }
            const dados = await res.json();
            return dados;
        } catch (err) {
            console.error("Erro ao consultar proposta:", err);
            return null;
        }
    }

    /**
     * Atualiza o DOM com os dados da proposta.
     * @param {Object} proposta - O objeto da proposta recebido da API.
     */
    function atualizarUIComProposta(proposta) {
        // Obtém elementos do DOM
        const paybackYears = document.getElementById('paybackYears');
        const propostaId = document.getElementById('proposta-id');
        const propostaAvistaPrice = document.getElementById('proposta-avista-price');
        const pagamentoParcelaMinima = document.getElementById('pagamento-parcela-minima');
        const navBarAvistaPrice = document.getElementById('nav-bar-avista-price');
        const navBarMinParcel = document.getElementById('nav-bar-min-parcel');
        const propostaAjuste = document.getElementById('proposta-ajuste');

        // Adiciona um listener para o botão de ajuste
        if (propostaAjuste) {
            propostaAjuste.addEventListener('click', () => {
                alert('Ajuste de proposta ainda não implementado.');
            });
        }

        // Verifica se todos os elementos existem para evitar erros
        if (propostaId && propostaAvistaPrice && pagamentoParcelaMinima && paybackYears && navBarAvistaPrice && navBarMinParcel) {
            propostaId.textContent = proposta.id || 'N/A';
            propostaAvistaPrice.textContent = (proposta.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' });
            pagamentoParcelaMinima.textContent = `R$ ${(proposta.valor_parcela || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
            paybackYears.textContent = `${proposta.payback_anos || 4} anos`;
            navBarAvistaPrice.textContent = (proposta.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' });
            navBarMinParcel.textContent = `R$ ${(proposta.valor_parcela || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
        }
    }
});
