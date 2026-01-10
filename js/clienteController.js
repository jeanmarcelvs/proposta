import { buscarEnderecoPorCEP, obterCidadesPorUF } from './model.js';
import db from './databaseService.js';

// Trava de Segurança
if (!sessionStorage.getItem('auth_belenergy')) {
    window.location.href = 'central-belenergy.html';
}

const form = document.getElementById('form-cliente');
const cepInput = document.getElementById('cep_cliente');
const ufSelect = document.getElementById('uf_cliente');
const cidadeSelect = document.getElementById('cidade_cliente');
const logradouroInput = document.getElementById('logradouro_cliente');
const numeroInput = document.getElementById('numero_cliente');
const bairroInput = document.getElementById('bairro_cliente');
const complementoInput = document.getElementById('complemento_cliente');
const emailInput = document.getElementById('email_cliente');
const documentoInput = document.getElementById('documento_cliente');
const whatsappInput = document.getElementById('whatsapp_cliente');

// --- LÓGICA DE MÁSCARAS ---

function aplicarMascara(event) {
    const input = event.target;
    const mascara = input.dataset.mascara;
    if (!mascara) return;

    let valor = input.value.replace(/\D/g, '');
    let valorFormatado = '';

    switch (mascara) {
        case 'cpf-cnpj':
            if (valor.length <= 11) { // CPF
                valorFormatado = valor
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else { // CNPJ
                valorFormatado = valor.slice(0, 14)
                    .replace(/(\d{2})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d)/, '$1/$2')
                    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
            }
            break;
        case 'cep':
            valorFormatado = valor.slice(0, 8).replace(/(\d{5})(\d{1,3})/, '$1-$2');
            break;
        case 'celular':
            valor = valor.slice(0, 11);
            valorFormatado = valor.length > 10 
                ? valor.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') 
                : valor.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            break;
    }
    input.value = valorFormatado;
}

// Lógica de CEP
cepInput.addEventListener('blur', async () => {
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length === 8) {
        const dados = await buscarEnderecoPorCEP(cep);
        if (dados && !dados.erro) {
            logradouroInput.value = dados.logradouro;
            bairroInput.value = dados.bairro;
            ufSelect.value = dados.uf;
            await carregarCidades(dados.uf, dados.localidade);
            numeroInput.focus(); // Foca no número para agilizar o preenchimento
        }
    }
});

// Mudança manual de UF
ufSelect.addEventListener('change', async () => {
    const uf = ufSelect.value;
    if (uf) {
        await carregarCidades(uf);
    } else {
        cidadeSelect.disabled = true;
        cidadeSelect.innerHTML = '<option value="">Selecione o Estado</option>';
    }
});

async function carregarCidades(uf, cidadePreSelecionada = null) {
    // Habilita o select e mostra loading
    cidadeSelect.disabled = false;
    cidadeSelect.innerHTML = '<option>Carregando...</option>';
    
    const cidades = await obterCidadesPorUF(uf);
    
    cidadeSelect.innerHTML = cidades.map(c => 
        `<option value="${c.nome}" ${cidadePreSelecionada === c.nome ? 'selected' : ''}>${c.nome}</option>`
    ).join('');
}

// Salvar e Avançar
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cliente = {
        nome: document.getElementById('nome_cliente').value,
        documento: document.getElementById('documento_cliente').value,
        whatsapp: document.getElementById('whatsapp_cliente').value,
        email: emailInput.value,
        endereco: {
            cep: cepInput.value,
            logradouro: logradouroInput.value,
            numero: numeroInput.value,
            bairro: bairroInput.value,
            complemento: complementoInput.value,
            cidade: cidadeSelect.value,
            uf: ufSelect.value
        }
    };

    const clienteSalvo = db.salvar('clientes', cliente);

    if (clienteSalvo) {
        alert(`Cliente "${clienteSalvo.nome}" cadastrado com sucesso!`);
        // Redireciona de volta para o dashboard para ver a lista atualizada
        window.location.href = 'dashboard-admin.html';
    } else {
        alert("Ocorreu um erro ao salvar o cliente.");
    }
});

// --- INICIALIZAÇÃO DOS LISTENERS DE MÁSCARA ---
documentoInput.dataset.mascara = 'cpf-cnpj';
whatsappInput.dataset.mascara = 'celular';
cepInput.dataset.mascara = 'cep';

documentoInput.addEventListener('input', aplicarMascara);
whatsappInput.addEventListener('input', aplicarMascara);
cepInput.addEventListener('input', aplicarMascara);