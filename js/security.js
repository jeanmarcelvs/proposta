import { validarDispositivoService } from './api.js';

/**
 * Coleta dados estáveis para o Fingerprint (compatível com o seu Worker)
 */
function extrairFingerprint() {
    const ua = navigator.userAgent;
    let deviceId = localStorage.getItem('cap_device_id');
    
    if (!deviceId) {
        deviceId = crypto.randomUUID?.() || Math.random().toString(36).substring(2);
        localStorage.setItem('cap_device_id', deviceId);
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    const os = ua.includes("Win") ? "Windows" : ua.includes("Mac") ? "MacOS" : ua.includes("Android") ? "Android" : ua.includes("iOS") ? "iOS" : "Linux";
    
    let browser = "Chrome";
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Edg")) browser = "Edge";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

    return {
        os,
        tipoDispositivo: isMobile ? "Mobile" : "Desktop",
        navegador: `${browser}::${deviceId}`,
        navegadorLimpo: browser
    };
}

/**
 * Validação de Data de Expiração (Fail Closed)
 */
export function isPropostaValida(dataValidade) {
    if (!dataValidade || dataValidade === 'Não informado' || dataValidade === 'N/A') return true;
    
    try {
        let dataString = String(dataValidade);
        let exp;
        
        // 1. Formato ISO ou D1 (YYYY-MM-DD...)
        if (/^\d{4}-\d{2}-\d{2}/.test(dataString)) {
            const partes = dataString.split('T')[0].split('-');
            exp = new Date(partes[0], partes[1] - 1, partes[2], 23, 59, 59);
        } 
        // 2. Formato Brasileiro (DD/MM/YYYY)
        else if (/^\d{2}\/\d{2}\/\d{4}/.test(dataString)) {
            const partes = dataString.split(' ')[0].split('/');
            exp = new Date(partes[2], partes[1] - 1, partes[0], 23, 59, 59);
        }
        // 3. Fallback para outros formatos reconhecidos pelo Date
        else {
            exp = new Date(dataString);
        }

        if (isNaN(exp.getTime())) return false;
        const agora = new Date();
        return agora <= exp;
    } catch (e) {
        return false;
    }
}

/**
 * Verifica se o dispositivo está autorizado via Cloudflare Worker
 */
export async function verificarAutorizacaoHardware(propostaId) {
    const info = extrairFingerprint();
    const payload = {
        propostaId: propostaId,
        dispositivoNome: `${info.tipoDispositivo} via ${info.navegadorLimpo}`,
        os: info.os,
        navegador: info.navegador,
        tipoDispositivo: info.tipoDispositivo
    };

    const resultado = await validarDispositivoService(payload);
    
    if (resultado.sucesso) {
        // Se for o dono ou autorizado, permite. Se pendente, bloqueia.
        const statusPermitidos = ['dono', 'autorizado'];
        if (statusPermitidos.includes(resultado.status)) {
            if (resultado.status === 'dono') {
                localStorage.setItem(`dono_${propostaId}`, 'true');
            }
            return { autorizado: true };
        }
        
        if (resultado.status === 'pendente') {
            return { autorizado: false, motivo: 'pendente' };
        }
    }
    
    return { autorizado: false, motivo: resultado.mensagem || 'bloqueado' };
}