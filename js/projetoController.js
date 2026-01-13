import db from './databaseService.js';
import { baseDadosAlagoas, obterHSPBruto } from './model.js';

// TRAVA DE SEGURANÇA: Verifica se o usuário está logado
if (!sessionStorage.getItem('auth_belenergy')) {
    window.location.href = 'central-belenergy.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // Busca o ID do cliente ativo que foi salvo na sessão pela tela de listagem
    const clienteIdAtivo = sessionStorage.getItem('cliente_ativo_id');
    if (!clienteIdAtivo) {
        alert("Nenhum cliente selecionado. Por favor, volte à lista de clientes.");
        window.location.href = 'clientes-lista.html';
        return;
    }

    // Busca os dados completos do cliente usando o ID
    const todosClientes = db.listar('clientes');
    const cliente = todosClientes.find(c => c.id === clienteIdAtivo);

    if (cliente) {
        prepararNovoProjeto(cliente);
    } else {
        alert("Erro: Cliente não encontrado no banco de dados local.");
        window.location.href = 'clientes-lista.html';
    }

    document.getElementById('btn-salvar-projeto').addEventListener('click', () => {
        const nomeProjeto = document.getElementById('nome_projeto').value;
        const consumo = document.getElementById('projeto_consumo').value;

        // --- VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS ---
        if (!nomeProjeto || nomeProjeto.trim() === "") {
            alert("Por favor, informe um Título para o Projeto.");
            document.getElementById('nome_projeto').focus();
            return;
        }

        if (!consumo || parseFloat(consumo) <= 0) {
            alert("Por favor, informe um Consumo Médio válido (maior que zero).");
            document.getElementById('projeto_consumo').focus();
            return;
        }

        const dadosProjeto = {
            clienteId: clienteIdAtivo, // VÍNCULO RELACIONAL
            nome_projeto: nomeProjeto,
            cidade: cliente.endereco.cidade, // Usa dado direto do objeto cliente (Segurança)
            uf: cliente.endereco.uf,         // Usa dado direto do objeto cliente
            concessionaria: document.getElementById('projeto_concessionaria').value,
            tipoTelhado: document.getElementById('tipo_telhado').value,
            // NOVOS CAMPOS: Dados da UC centralizados no projeto
            consumo: consumo,
            tipoLigacao: document.getElementById('projeto_tipo_ligacao').value || 'monofasico',
            origemVenda: document.getElementById('projeto_origem_venda')?.value || 'nenhum',
            hsp: parseFloat(document.getElementById('display_hsp').innerText) || 0
        };

        const projetoSalvo = db.salvar('projetos', dadosProjeto);
        alert(`Projeto "${projetoSalvo.nome_projeto}" criado com sucesso para ${cliente.nome}!`);
        
        // Salva o projeto recém-criado na sessão para a próxima etapa
        sessionStorage.setItem('projeto_ativo_id', projetoSalvo.id);
        window.location.href = `projeto-detalhes.html?id=${projetoSalvo.id}`;
    });
});

function prepararNovoProjeto(cliente) {
    document.getElementById('nome_cliente_projeto').innerHTML = `Criando projeto para: <strong>${cliente.nome}</strong>`;
    
    // Preenche os textos informativos (Labels)
    const elCidade = document.getElementById('projeto_cidade_display');
    const elUF = document.getElementById('projeto_uf_display');
    if(elCidade) elCidade.innerText = cliente.endereco.cidade;
    if(elUF) elUF.innerText = cliente.endereco.uf;
    
    // Cálculo automático do HSP baseado na cidade do cliente
    const cidadeNormalizada = cliente.endereco.cidade.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const dadosCidade = baseDadosAlagoas[cidadeNormalizada];
    const fatorHistorico = dadosCidade ? dadosCidade.fator : 126; // Fallback
    const hsp = obterHSPBruto(fatorHistorico);
    
    document.getElementById('display_hsp').innerText = hsp.toFixed(2);
    
    // Injeta o campo de Origem da Venda se ele não existir no HTML
    injetarCampoOrigemVenda();
    
    document.getElementById('nome_projeto').focus();
}

function injetarCampoOrigemVenda() {
    const consumoInput = document.getElementById('projeto_consumo');
    // Só injeta se o campo ainda não existir
    if (consumoInput && !document.getElementById('projeto_origem_venda')) {
        const container = consumoInput.closest('.form-group') || consumoInput.parentElement;
        if (container && container.parentElement) {
            const novoGrupo = document.createElement('div');
            novoGrupo.className = 'form-group'; // Mantém o padrão de estilo do formulário
            novoGrupo.style.marginTop = '15px';
            novoGrupo.innerHTML = `
                <label for="projeto_origem_venda" style="display:block; margin-bottom:5px; font-weight:500; color:#334155;">Origem da Venda / Comissão</label>
                <select id="projeto_origem_venda" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #fff; font-size: 1rem; color: #0f172a;">
                    <option value="nenhum">Venda Direta (Sem Comissão)</option>
                    <option value="indicador">Indicação (Parceiro)</option>
                    <option value="representante">Representante Comercial</option>
                </select>
                <small style="color: #64748b; font-size: 0.8rem;">Define a taxa de comissão aplicada na proposta.</small>
            `;
            // Insere logo após o campo de consumo
            container.parentElement.insertBefore(novoGrupo, container.nextSibling);
        }
    }
}