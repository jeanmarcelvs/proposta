import { validarDispositivoService } from './api.js';

/**
 * Coleta dados estáveis para o Fingerprint (compatível com o seu Worker)
 */
function extrairFingerprint() {
    const ua = navigator.userAgent;
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const pixelRatio = window.devicePixelRatio || 1;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    let deviceId = localStorage.getItem('cap_device_id');
    
    if (!deviceId) {
        // Gera um ID único persistente caso não exista
        const randomPart = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
        deviceId = 'dev_' + randomPart;
        localStorage.setItem('cap_device_id', deviceId);
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const os = /Android/i.test(ua) ? "Android" : 
               /iPhone|iPad|iPod/i.test(ua) ? "iOS" : 
               ua.includes("Win") ? "Windows" : 
               ua.includes("Mac") ? "MacOS" : "Linux";
    
    let browser = "Chrome";
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Edg")) browser = "Edge";
    else if (ua.includes("OPR") || ua.includes("Opera")) browser = "Opera";
    else if (ua.includes("SamsungBrowser")) browser = "Samsung Internet";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

    return {
        os,
        tipoDispositivo: isMobile ? "Mobile" : "Desktop",
        navegador: browser,
        deviceId: deviceId,
        fingerprintCompleto: `${os}|${browser}|${screenRes}|${pixelRatio}|${timezone}|${language}`,
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
    
    // Opcional: Tenta obter o IP público via cliente apenas como metadado, 
    // mas não bloqueia se falhar ou se for um IP de proxy do Safari.
    let ipPublico = 'IP_RESTRITO';
    try {
        const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) });
        const ipData = await ipRes.json();
        ipPublico = ipData.ip;
    } catch (e) {
        console.warn("Aviso: IP mascarado pelo navegador (Safari/Private Relay). Usando Fingerprint de Hardware.");
    }

    const payload = {
        propostaId: propostaId,
        deviceId: info.deviceId, // Chave primária de autorização
        dispositivoNome: `${info.tipoDispositivo} (${info.os})`,
        fingerprint: info.fingerprintCompleto,
        os: info.os,
        ipInformado: ipPublico,
        navegador: info.navegadorLimpo,
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