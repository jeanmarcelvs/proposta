/**
 * Funções Utilitárias
 */

export const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
};

export const mostrarLoading = (status) => {
    const splash = document.getElementById('loading-overlay');
    const body = document.body;

    if (status) {
        if (splash) splash.classList.remove('hidden');
        body.classList.add('loading-active');
    } else {
        // Delay reduzido para 400ms: equilíbrio entre esconder o reflow e agilidade
        setTimeout(() => {
            if (splash) splash.classList.add('hidden');
            body.classList.remove('loading-active');
            console.log("Pronto");
        }, 400);
    }
};