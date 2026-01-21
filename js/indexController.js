// Controlador da Página de Apresentação (Index)
// Gerencia a exibição de mensagens de erro/aviso caso o usuário seja redirecionado para cá.

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const erro = urlParams.get('erro');
    const msg = urlParams.get('msg');

    if (erro || msg) {
        let titulo = 'Atenção';
        let mensagemTexto = msg || 'Ocorreu uma situação inesperada.';
        let iconeClass = 'fa-exclamation-circle';
        let corIcone = '#ef4444'; // Vermelho padrão

        // Tratamento de códigos de erro específicos
        if (erro === 'parametros-ausentes') {
            titulo = 'Link Incompleto';
            mensagemTexto = 'O link que você acessou parece estar incompleto ou incorreto.';
            iconeClass = 'fa-link';
            corIcone = '#f59e0b';
        } else if (erro === 'proposta-expirada') {
            titulo = 'Proposta Expirada';
            mensagemTexto = 'O prazo de validade desta proposta encerrou. Entre em contato para uma atualização.';
            iconeClass = 'fa-clock';
            corIcone = '#f59e0b';
        } else if (erro === 'acesso-negado') {
            titulo = 'Acesso Indisponível';
            mensagemTexto = 'Não foi possível carregar a proposta solicitada.';
        }

        exibirModalAvisoIndex(titulo, mensagemTexto, iconeClass, corIcone);
        
        // Limpa a URL para não mostrar o erro novamente ao recarregar
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

function exibirModalAvisoIndex(titulo, mensagem, icone, cor) {
    // Cria o HTML do modal dinamicamente
    const modalHTML = `
        <div id="modal-aviso-index" class="modal-overlay" style="display:flex; align-items:center; justify-content:center; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; backdrop-filter:blur(5px); opacity:0; transition:opacity 0.3s ease;">
            <div class="modal-conteudo" style="background:#1e293b; border:1px solid rgba(255,255,255,0.1); padding:30px; border-radius:16px; max-width:90%; width:350px; text-align:center; box-shadow:0 20px 50px rgba(0,0,0,0.5); transform:scale(0.9); transition:transform 0.3s ease;">
                <div style="margin-bottom:15px;">
                    <i class="fas ${icone}" style="font-size:3rem; color:${cor};"></i>
                </div>
                <h3 style="color:#f1f5f9; margin:0 0 10px 0; font-size:1.3rem;">${titulo}</h3>
                <p style="color:#cbd5e1; font-size:0.95rem; line-height:1.5; margin-bottom:25px;">${mensagem}</p>
                <button id="btn-fechar-aviso" style="background:var(--primaria, #16a34a); color:#fff; border:none; padding:12px 25px; border-radius:8px; font-weight:600; cursor:pointer; width:100%; transition:filter 0.2s;">
                    Entendi
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Animação de entrada
    setTimeout(() => {
        const modal = document.getElementById('modal-aviso-index');
        const conteudo = modal.querySelector('.modal-conteudo');
        if (modal) modal.style.opacity = '1';
        if (conteudo) conteudo.style.transform = 'scale(1)';
        
        document.getElementById('btn-fechar-aviso').onclick = () => {
            modal.style.opacity = '0';
            setTimeout(() => modal.remove(), 300);
        };
    }, 100);
}