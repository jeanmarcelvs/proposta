import db from './databaseService.js';

// Trava de Segurança
if (!sessionStorage.getItem('auth_belenergy')) {
    window.location.href = 'central-belenergy.html';
}

let projetoId; // Armazena o ID do projeto para uso nas funções de ação

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    projetoId = urlParams.get('id');

    if (!projetoId) {
        alert("ID do projeto não encontrado na URL.");
        window.location.href = 'dashboard-admin.html';
        return;
    }

    carregarDetalhesProjeto(projetoId);
});

function carregarDetalhesProjeto(id) {
    const projeto = db.buscarPorId('projetos', id);
    if (!projeto) {
        alert("Projeto não encontrado.");
        window.location.href = 'dashboard-admin.html';
        return;
    }

    const cliente = db.buscarPorId('clientes', projeto.clienteId);
    if (!cliente) {
        alert("Cliente associado ao projeto não encontrado.");
        window.location.href = 'dashboard-admin.html';
        return;
    }

    // Preenche os detalhes do projeto
    document.getElementById('titulo-projeto').innerHTML = `<i class="fas fa-project-diagram"></i> ${projeto.nome_projeto}`;
    document.getElementById('detalhe_cliente_nome').value = cliente.nome;
    document.getElementById('detalhe_localizacao').value = `${projeto.cidade} / ${projeto.uf}`;
    document.getElementById('detalhe_concessionaria').value = projeto.concessionaria;
    document.getElementById('detalhe_estrutura').value = projeto.tipoTelhado;
    
    const origemMap = {
        'nenhum': 'Venda Direta',
        'venda_direta': 'Venda Direta',
        'indicador': 'Indicação',
        'representante': 'Representante'
    };
    document.getElementById('detalhe_origem').value = origemMap[projeto.origemVenda] || 'Venda Direta';

    // Carrega a lista de propostas associadas
    carregarPropostasDoProjeto(id);
}

function carregarPropostasDoProjeto(projetoId) {
    const propostas = db.buscarPorRelacao('propostas', 'projetoId', projetoId)
                        .sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
    
    const tbody = document.getElementById('corpo_lista_propostas');
    if (!tbody) return;

    if (propostas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">Nenhuma proposta encontrada para este projeto.</td></tr>`;
        return;
    }

    tbody.innerHTML = propostas.map(prop => {
        const valorFormatado = (prop.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `
            <tr class="linha-dado">
                <td>${new Date(prop.dataCriacao).toLocaleDateString()}</td>
                <td><strong>${(prop.potenciaKwp || 0).toFixed(2)} kWp</strong></td>
                <td>${valorFormatado}</td>
                <td style="text-align: right;">
                    <button class="btn-icon" onclick="window.visualizarProposta('${prop.id}')" title="Visualizar Proposta"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" onclick="window.editarPropostaDoProjeto('${prop.id}')" title="Editar Proposta"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-icon" onclick="window.excluirPropostaDoProjeto('${prop.id}')" title="Excluir Proposta"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// Ações de CRUD para propostas dentro do projeto

window.novaPropostaParaProjeto = function() {
    const projeto = db.buscarPorId('projetos', projetoId);
    if (!projeto) return;
    sessionStorage.setItem('cliente_ativo_id', projeto.clienteId);
    sessionStorage.setItem('projeto_ativo_id', projeto.id);
    sessionStorage.removeItem('proposta_ativa_id'); // Garante que é uma NOVA proposta
    window.location.href = 'gerador-proposta.html';
};

window.editarPropostaDoProjeto = function(propostaId) {
    const projeto = db.buscarPorId('projetos', projetoId);
    if (!projeto) return;
    
    sessionStorage.setItem('cliente_ativo_id', projeto.clienteId);
    sessionStorage.setItem('projeto_ativo_id', projeto.id);
    sessionStorage.setItem('proposta_ativa_id', propostaId); // Define qual proposta carregar
    window.location.href = 'gerador-proposta.html';
};

window.excluirPropostaDoProjeto = function(propostaId) {
    if (confirm('Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita.')) {
        if (db.excluir('propostas', propostaId)) {
            alert('Proposta excluída.');
            carregarPropostasDoProjeto(projetoId); // Recarrega a lista
        } else {
            alert('Erro ao excluir a proposta.');
        }
    }
};

window.visualizarProposta = function(propostaId) {
    const proposta = db.buscarPorId('propostas', propostaId);
    if (!proposta) return alert('Proposta não encontrada.');
    const projeto = db.buscarPorId('projetos', proposta.projetoId);
    if (!projeto) return alert('Projeto associado não encontrado.');
    const cliente = db.buscarPorId('clientes', projeto.clienteId);
    if (!cliente) return alert('Cliente associado não encontrado.');
    const primeiroNome = cliente.nome.split(' ')[0];
    window.open(`proposta.html?id=${projeto.id}&nome=${primeiroNome}`, '_blank');
};