/**
 * Funções utilitárias de Interface (UI) compartilhadas entre os controladores.
 */

export function mostrarLoadingOverlay() {
    const overlay = document.querySelector('.loading-overlay');
    const mainContent = document.querySelector('main');

    if (mainContent) {
        mainContent.classList.add('main-oculto');
        mainContent.classList.remove('main-visivel');
    }

    if (overlay) {
        overlay.classList.remove('oculto');
    }
}

export function esconderLoadingOverlay() {
    const overlay = document.querySelector('.loading-overlay');
    const mainContent = document.querySelector('main');

    if (mainContent) {
        mainContent.classList.remove('main-oculto');
        mainContent.classList.add('main-visivel');
    }

    if (overlay) {
        overlay.classList.add('oculto');
    }
}

export function exibirMensagemBloqueio() {
    esconderLoadingOverlay();
    
    // Captura o link do WhatsApp configurado no rodapé antes de limpar o DOM
    const whatsappBtn = document.querySelector('footer a[href*="wa.me"]');
    const whatsappUrl = whatsappBtn ? whatsappBtn.href : 'https://wa.me/5582999469016'; // Fallback seguro

    // 1. Limpa o body para remover a aplicação e focar na mensagem
    document.body.innerHTML = '';
    
    // 2. Define estilos base do corpo para centralizar
    Object.assign(document.body.style, {
        backgroundColor: '#121212',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        margin: '0',
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        overflow: 'hidden'
    });

    // 3. Injeta o CSS Minimalista
    const style = document.createElement('style');
    style.textContent = `
        .proposal-access-minimal {
            width: 85%;
            max-width: 380px;
            padding: 20px;
            border-left: 4px solid #ff6b6b; /* Vermelho elegante */
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            gap: 20px;
            animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .access-header {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .access-title {
            color: #ff6b6b;
            font-weight: 600;
            font-size: 1rem;
            line-height: 1.4;
        }
        .whatsapp-link {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            background: #25d366;
            color: #0b3d1c;
            font-weight: 700;
            text-decoration: none;
            padding: 14px;
            border-radius: 8px;
            font-size: 1rem;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .whatsapp-link:active {
            transform: scale(0.98);
        }
        .whatsapp-link:hover {
            box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
        }
        .whatsapp-link i {
            font-size: 1.2rem;
        }
    `;
    document.head.appendChild(style);

    // 4. Cria o elemento HTML
    const container = document.createElement('div');
    container.className = 'proposal-access-minimal';
    container.innerHTML = `
        <div class="access-header">
            <span style="font-size: 1.4rem;">❗</span>
            <span class="access-title">Proposta com acesso personalizado</span>
        </div>
        <a href="${whatsappUrl}" target="_blank" class="whatsapp-link">
            <i class="fab fa-whatsapp"></i>
            Falar com Engenheiro
        </a>
    `;
    
    document.body.appendChild(container);
}

export function organizarSecaoConfiabilidade() {
    const container = document.getElementById('secao-video-instalacao');
    if (!container) return;
    if (container.classList.contains('secao-organizada')) return;

    let videos = Array.from(container.querySelectorAll('.video-somente-container'));
    if (videos.length === 0) videos = Array.from(container.querySelectorAll('iframe, video, .video-container'));

    let imagens = Array.from(container.querySelectorAll('.imagem-garantia-container'));
    if (imagens.length === 0) imagens = Array.from(container.querySelectorAll('img, .banner-container'));

    if (videos.length === 0 && imagens.length === 0) return;

    container.innerHTML = '';
    container.classList.add('secao-organizada');

    if (videos.length > 0) {
        const divConfiabilidade = document.createElement('div');
        divConfiabilidade.className = 'secao-confiabilidade';
        divConfiabilidade.style.marginBottom = '50px';
        divConfiabilidade.innerHTML = `
            <h2 class="titulo-secao" style="text-align: center; margin-bottom: 40px;">Confiabilidade</h2>
            <div class="grid-videos" style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;"></div>
        `;
        const grid = divConfiabilidade.querySelector('.grid-videos');
        videos.forEach(v => { v.style.maxWidth = '100%'; grid.appendChild(v); });
        container.appendChild(divConfiabilidade);
    }

    if (imagens.length > 0) {
        const divGarantias = document.createElement('div');
        divGarantias.className = 'secao-garantias';
        divGarantias.innerHTML = `
            <h2 class="titulo-secao" style="text-align: center; margin-bottom: 40px;">Garantias e Respaldo</h2>
            <div class="grid-banners" style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;"></div>
        `;
        const grid = divGarantias.querySelector('.grid-banners');
        imagens.forEach(img => { img.style.maxWidth = '100%'; img.style.height = 'auto'; grid.appendChild(img); });
        container.appendChild(divGarantias);
    }
}