// static/js/app.js — MyAsistente (Versión Pública con Analytics + Control de Acceso)

document.addEventListener('DOMContentLoaded', () => {
    const aiOrb = document.getElementById('ai-orb');
    const systemStatus = document.getElementById('system-status');
    const assistantText = document.getElementById('assistant-text');
    const statusDot = document.querySelector('.dot');
    const btnListen = document.getElementById('btn-listen');
    const globalAudio = document.getElementById('audio-player');

    // ── Estado de sesión ──────────────────────────────────────────
    let userName = localStorage.getItem('myasistente_username') || 'Desconocido';
    let accessCode = sessionStorage.getItem('myasistente_access_code') || '';
    let sessionStart = Date.now();

    // ── Modal de Bienvenida / Acceso ──────────────────────────────
    const welcomeModal = document.getElementById('welcome-modal');
    const stepAccess = document.getElementById('step-access');
    const stepName = document.getElementById('step-name');
    const accessCodeInput = document.getElementById('access-code-input');
    const btnVerifyAccess = document.getElementById('btn-verify-access');
    const accessError = document.getElementById('access-error');
    const userNameInput = document.getElementById('user-name-input');
    const welcomeBtn = document.getElementById('welcome-btn');

    async function verifyAccessCode(code) {
        try {
            const res = await fetch('/api/verify-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async function initApp() {
        // Si ya tiene código de acceso válido en sesión y nombre guardado
        if (accessCode && userName && userName !== 'Desconocido') {
            welcomeModal.style.display = 'none';
            assistantText.textContent = `Bienvenido de nuevo, ${userName}.`;
            sendCommandToBrain(`Hola de nuevo, soy ${userName}. Salúdame brevemente.`, 'Voz');
        } else if (accessCode) {
            // Tiene código pero no nombre → pedir nombre
            welcomeModal.style.display = 'flex';
            stepAccess.style.display = 'none';
            stepName.style.display = 'block';
        } else {
            // Primera visita → pedir código
            welcomeModal.style.display = 'flex';
        }
    }

    // Verificar código de acceso
    btnVerifyAccess.addEventListener('click', async () => {
        const code = accessCodeInput.value.trim();
        if (!code) { accessCodeInput.focus(); return; }

        btnVerifyAccess.textContent = 'Verificando...';
        const valid = await verifyAccessCode(code);
        btnVerifyAccess.textContent = 'VERIFICAR →';

        if (valid) {
            accessCode = code;
            sessionStorage.setItem('myasistente_access_code', code);
            accessError.style.display = 'none';
            stepAccess.style.display = 'none';
            stepName.style.display = 'block';
            userNameInput.focus();
        } else {
            accessError.style.display = 'block';
            accessCodeInput.value = '';
            accessCodeInput.focus();
        }
    });

    accessCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnVerifyAccess.click(); });

    // Confirmar nombre y comenzar
    welcomeBtn.addEventListener('click', () => {
        const name = userNameInput.value.trim();
        if (!name) { userNameInput.focus(); return; }
        userName = name;
        localStorage.setItem('myasistente_username', name);
        welcomeModal.style.display = 'none';
        sendCommandToBrain(`Hola, mi nombre es ${name}. Preséntate brevemente.`, 'Voz');
    });

    userNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') welcomeBtn.click(); });

    initApp();

    // ── Reconocimiento de voz ─────────────────────────────────────
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            aiOrb.classList.add('listening');
            systemStatus.textContent = 'ESCUCHANDO...';
            btnListen.textContent = 'DETENER';
            statusDot.style.backgroundColor = '#ffbb00';
            assistantText.textContent = 'Te escucho...';
        };

        recognition.onresult = async (event) => {
            const speechResult = event.results[0][0].transcript;
            assistantText.textContent = `Tú: "${speechResult}"`;
            await sendCommandToBrain(speechResult, 'Voz');
        };

        recognition.onspeechend = () => recognition.stop();
        recognition.onerror = (e) => { assistantText.textContent = 'Error al escuchar: ' + e.error; resetUI(); };
        recognition.onend = () => resetUI();
    } else {
        assistantText.textContent = 'Tu navegador no soporta reconocimiento de voz.';
        btnListen.disabled = true;
    }

    globalAudio.onplay = () => aiOrb.classList.add('listening');
    globalAudio.onended = () => { aiOrb.classList.remove('listening'); resetUI(); };

    function resetUI() {
        aiOrb.classList.remove('listening');
        systemStatus.textContent = 'SISTEMA EN LÍNEA';
        btnListen.textContent = 'ACTIVAR MICRÓFONO';
        statusDot.style.backgroundColor = '#0f0';
    }

    btnListen.addEventListener('click', () => {
        globalAudio.src = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
        globalAudio.play().catch(() => {});
        globalAudio.pause();
        if (aiOrb.classList.contains('listening')) {
            recognition.stop();
        } else {
            try { recognition.start(); } catch (e) { }
        }
    });

    // ── Comunicación con Backend ──────────────────────────────────
    async function sendCommandToBrain(text, actionType = 'Voz') {
        systemStatus.textContent = 'PROCESANDO...';
        aiOrb.style.boxShadow = '0 0 80px rgba(128,0,255,0.8), inset 0 0 30px rgba(255,255,255,0.8)';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    user_name: userName,
                    action_type: actionType,
                    access_code: accessCode
                })
            });

            if (response.status === 401) {
                // Código expirado o inválido — volver al modal
                sessionStorage.removeItem('myasistente_access_code');
                accessCode = '';
                welcomeModal.style.display = 'flex';
                stepAccess.style.display = 'block';
                stepName.style.display = 'none';
                resetUI();
                return;
            }

            const data = await response.json();

            const htmlText = data.response.replace(
                /\[([^\]]+)\]\(([^)]+)\)/g,
                '<a href="$2" target="_blank" style="color:#00c3ff; text-decoration:underline;">$1</a>'
            );
            assistantText.innerHTML = htmlText;

            if (data.audio_url) {
                globalAudio.src = data.audio_url;
                globalAudio.play().catch(() => resetUI());
            }
        } catch (error) {
            assistantText.textContent = 'Error de conexión con el núcleo.';
            console.error(error);
            resetUI();
            aiOrb.style.boxShadow = '';
        }
    }

    // ── Code Lab ──────────────────────────────────────────────────
    const btnCodeLab = document.getElementById('btn-code-lab');
    const codeLabPanel = document.getElementById('code-lab-panel');
    const btnCloseLab = document.getElementById('btn-close-lab');
    const btnAnalyzeCode = document.getElementById('btn-analyze-code');
    const codeFileInput = document.getElementById('code-file-input');
    const codePasteArea = document.getElementById('code-paste-area');
    const codeInstruction = document.getElementById('code-instruction');

    btnCodeLab.addEventListener('click', () => {
        codeLabPanel.style.display = codeLabPanel.style.display === 'none' ? 'block' : 'none';
    });
    btnCloseLab.addEventListener('click', () => { codeLabPanel.style.display = 'none'; });

    codeFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => { codePasteArea.value = e.target.result; };
        reader.readAsText(file, 'UTF-8');
    });

    btnAnalyzeCode.addEventListener('click', async () => {
        const code = codePasteArea.value.trim();
        if (!code) {
            assistantText.textContent = 'Por favor, sube un archivo o pega tu código antes de analizar.';
            return;
        }
        const instruction = codeInstruction.value.trim() || 'Revisa este código Python, corrígelo, mejóralo y añade comentarios útiles.';
        const fullMessage = `${instruction}\n\nAquí está el código:\n\`\`\`python\n${code}\n\`\`\`\n\nDevuélveme el código corregido en un archivo descargable .txt usando tu herramienta create_downloadable_file. No leas el código en voz alta.`;

        codeLabPanel.style.display = 'none';
        assistantText.textContent = '🔍 Analizando tu código con Gemini 3.1 Pro...';
        await sendCommandToBrain(fullMessage, 'Code Lab');
    });

});
