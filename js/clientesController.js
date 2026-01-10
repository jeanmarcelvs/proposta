// This script would be used on the clientes-lista.html page

document.addEventListener('DOMContentLoaded', () => {
    // In a real application, you would fetch the client list from a database (e.g., IndexedDB, Firebase)
    // and populate the table here.
});

window.filtrarClientes = function() {
    const termo = document.getElementById('busca_cliente').value.toLowerCase();
    const uf = document.getElementById('filtro_uf').value;
    const linhas = document.querySelectorAll('.linha-cliente');

    linhas.forEach(linha => {
        const textoLinha = linha.innerText.toLowerCase();
        const localizacao = linha.children[1].innerText; // Assumes the second column is 'Localização'
        
        const correspondeTermo = textoLinha.includes(termo);
        const correspondeUF = uf === "" || localizacao.includes(uf);

        if (correspondeTermo && correspondeUF) {
            linha.style.display = ""; // Show row
        } else {
            linha.style.display = "none"; // Hide row
        }
    });
}

// Mock function for navigation
window.gerenciarCliente = function(id) {
    alert('Gerenciando cliente com ID: ' + id);
    // For a real implementation, you would navigate to the client's detail page
    // window.location.href = `cliente-detalhes.html?id=${id}`;
}