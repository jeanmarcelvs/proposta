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
    // Você pode implementar um spinner aqui depois
    console.log(status ? "Carregando..." : "Pronto");
};