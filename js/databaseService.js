/**
 * Camada de Serviço de Persistência (Service Layer)
 * Abstrai a lógica de banco de dados. Atualmente usa localStorage,
 * mas está pronto para ser migrado para uma API/Cloudflare D1.
 */

const db = {
    /**
     * Lista todos os registros de uma "tabela".
     * @param {string} tabela - O nome da tabela (ex: 'clientes').
     */
    listar: (tabela) => { return JSON.parse(localStorage.getItem(`db_${tabela}`)) || [] },
    
    /**
     * Salva um novo registro, gerando um ID único.
     * @param {string} tabela - O nome da tabela.
     * @param {object} dados - O objeto a ser salvo.
     */
    salvar: (tabela, dados) => {
        const registros = db.listar(tabela);
        const novoRegistro = { 
            id: crypto.randomUUID(), // Gera ID único estilo banco de dados
            dataCriacao: new Date().toISOString(),
            ...dados 
        };
        registros.push(novoRegistro);
        localStorage.setItem(`db_${tabela}`, JSON.stringify(registros));
        return novoRegistro;
    },

    /**
     * Busca registros com base em um campo relacional.
     * @param {string} tabela - O nome da tabela.
     * @param {string} campo - O nome do campo (ex: 'clienteId').
     * @param {string} valor - O valor a ser buscado.
     */
    buscarPorRelacao: (tabela, campo, valor) =>
        db.listar(tabela).filter(item => item[campo] === valor),

    /**
     * Busca um único registro pelo seu ID.
     * @param {string} tabela - O nome da tabela.
     * @param {string} id - O ID do registro a ser buscado.
     */
    buscarPorId: (tabela, id) => db.listar(tabela).find(item => item.id === id),

    /**
     * Exclui um registro de uma tabela pelo seu ID.
     * @param {string} tabela - O nome da tabela.
     * @param {string} id - O ID do registro a ser excluído.
     * @returns {boolean} - Retorna true se a exclusão foi bem-sucedida, false caso contrário.
     */
    excluir: (tabela, id) => {
        let registros = db.listar(tabela);
        const registrosFiltrados = registros.filter(item => item.id !== id);
        if (registros.length === registrosFiltrados.length) return false;
        localStorage.setItem(`db_${tabela}`, JSON.stringify(registrosFiltrados));
        return true;
    },

    /**
     * Salva ou atualiza um objeto de configuração único.
     * @param {string} chave - A chave da configuração (ex: 'premissas_globais').
     * @param {object} dados - O objeto de configuração a ser salvo.
     * @returns {boolean} - Retorna true se foi salvo com sucesso.
     */
    salvarConfiguracao: (chave, dados) => {
        localStorage.setItem(`config_${chave}`, JSON.stringify(dados));
        return true;
    },

    /**
     * Busca um objeto de configuração.
     * @param {string} chave - A chave da configuração.
     * @returns {object|null} O objeto de configuração ou null.
     */
    buscarConfiguracao: (chave) => {
        const dados = localStorage.getItem(`config_${chave}`);
        return dados ? JSON.parse(dados) : null;
    },

    /**
     * Versão Async para compatibilidade futura com API
     */
    listarAsync: async (tabela) => {
        // Simula delay de rede
        await new Promise(r => setTimeout(r, 50));
        return db.listar(tabela);
    }
};

export default db;