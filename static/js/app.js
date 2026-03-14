// static/js/app.js — MyAsistente (Versión Pública)

document.addEventListener('DOMContentLoaded', () => {
    const aiOrb = document.getElementById('ai-orb');
    const systemStatus = document.getElementById('system-status');
    const assistantText = document.getElementById('assistant-text');
    const statusDot = document.querySelector('.dot');
    const btnListen = document.getElementById('btn-listen');
    const globalAudio = document.getElementById('audio-player');

    // ──────────────────────────────────────────────────────────────
    // GESTIÓN DEL NOMBRE DE USUARIO (localStorage)
    // ──────────────────────────────────────────────────────────────
    const welcomeModal = document.getElementById('welcome-modal');
    const userNameInput = document.getElementById('user-name-input');
    const welcomeBtn = document.getElementById('welcome-btn');

    let userName = localStorage.getItem('myasistente_username');

    function initSession(name) {
        userName = name;
        welcomeModal.style.display = 'none';
        assistantText.textContent = 'Hola, estoy lista para ayudarte.';
        // Enviar saludo inicial al cerebro con el nombre
        sendCommandToBrain(`Hola, mi nombre es ${name}. Preséntate brevemente.`);
    }

    if (!userName) {
        // Primer uso: mostrar modal
        welcomeModal.style.display = 'flex';
        userNameInput.focus();
    } else {
        // Usuario conocido
        welcomeModal.style.display = 'none';
        assistantText.textContent = `Bienvenido de nuevo, ${userName}.`;
        sendCommandToBrain(`Hola de nuevo, soy ${userName}. Salúdame brevemente.`);
    }

    welcomeBtn.addEventListener('click', () => {
        const name = userNameInput.value.trim();
        if (!name) { userNameInput.focus(); return; }
        localStorage.setItem('myasistente_username', name);
        initSession(name);
    });

    userNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') welcomeBtn.click();
    });

    // ──────────────────────────────────────────────────────────────
    // RECONOCIMIENTO DE VOZ
    // ──────────────────────────────────────────────────────────────
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
            await sendCommandToBrain(speechResult);
        };

        recognition.onspeechend = () => recognition.stop();
        recognition.onerror = (event) => {
            assistantText.textContent = 'Error al escuchar: ' + event.error;
            resetUI();
        };
        recognition.onend = () => resetUI();
    } else {
        assistantText.textContent = 'Tu navegador no soporta reconocimiento de voz.';
        btnListen.disabled = true;
    }

    // Animaciones del audio
    globalAudio.onplay = () => aiOrb.classList.add('listening');
    globalAudio.onended = () => { aiOrb.classList.remove('listening'); resetUI(); };

    function resetUI() {
        aiOrb.classList.remove('listening');
        systemStatus.textContent = 'SISTEMA EN LÍNEA';
        btnListen.textContent = 'ACTIVAR MICRÓFONO';
        statusDot.style.backgroundColor = '#0f0';
    }

    btnListen.addEventListener('click', () => {
        // Desbloquear contexto de audio en móvil
        globalAudio.src = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
        globalAudio.play().catch(() => {});
        globalAudio.pause();

        if (aiOrb.classList.contains('listening')) {
            recognition.stop();
        } else {
            try { recognition.start(); } catch (e) { }
        }
    });

    // ──────────────────────────────────────────────────────────────
    // COMUNICACIÓN CON EL BACKEND
    // ──────────────────────────────────────────────────────────────
    async function sendCommandToBrain(text) {
        systemStatus.textContent = 'PROCESANDO...';
        aiOrb.style.boxShadow = '0 0 80px rgba(128,0,255,0.8), inset 0 0 30px rgba(255,255,255,0.8)';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await response.json();

            // Convertir markdown links en HTML
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

    // ──────────────────────────────────────────────────────────────
    // CODE LAB
    // ──────────────────────────────────────────────────────────────
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
    btnCloseLab.addEventListener('click', () => {
        codeLabPanel.style.display = 'none';
    });

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
        await sendCommandToBrain(fullMessage);
    });

});
