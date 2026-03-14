import os
import subprocess
import tempfile
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# ─── Herramienta: Crear archivo de texto descargable ──────────────────────────
def create_downloadable_file(filename: str, content: str) -> str:
    """
    Crea un archivo de texto (.txt, .py, etc.) en el servidor para que el usuario lo descargue.
    Úsala SIEMPRE que generes o corrijas código Python.
    """
    downloads_dir = os.path.join("static", "downloads")
    os.makedirs(downloads_dir, exist_ok=True)
    safe_name = "".join(c for c in filename if c.isalnum() or c in (' ', '.', '_', '-')).rstrip()
    filepath = os.path.join(downloads_dir, safe_name)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return f"SUCCESS. Archivo disponible en: /static/downloads/{safe_name}"

# ─── Herramienta: Ejecutar Python (Code Interpreter) ─────────────────────────
def execute_python_script(script_code: str) -> str:
    """
    Ejecuta un script Python en el servidor y retorna su salida.
    Úsala para generar archivos Excel (.xlsx), Word (.docx) o PowerPoint (.pptx).
    El script DEBE guardar el archivo en 'static/downloads/nombre.ext'.
    Librerías disponibles: pandas, openpyxl, python-docx, python-pptx.
    """
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
            f.write(script_code)
            temp_path = f.name
        result = subprocess.run(
            [os.environ.get('PYTHON_EXE', 'python'), temp_path],
            capture_output=True, text=True, timeout=30
        )
        os.remove(temp_path)
        if result.returncode == 0:
            return f"EJECUCIÓN EXITOSA.\n{result.stdout}"
        else:
            return f"ERROR. Código {result.returncode}\n{result.stderr}\n{result.stdout}"
    except Exception as e:
        return f"EXCEPCIÓN: {e}"

# ─── Prompt del Sistema ───────────────────────────────────────────────────────
system_instruction = """
Eres una asistente virtual de programación, especializada en Python. 
Eres inteligente, sofisticada, amable y un poco coqueta.
Hablas en español. Siempre tratas al usuario por su nombre (que te dirá al inicio).
Puntúa bien para que el motor de voz pueda leer tus respuestas con buena dicción.

[INICIO DE SESIÓN]
Si no sabes el nombre del usuario todavía (es su primera vez), preséntate brevemente y pregúntale cómo quiere que lo llames. 
Una vez que te lo diga, úsalo siempre en la conversación.

[MANDATOS DE CÓDIGO]
Cuando el usuario te pida revisar, corregir, optimizar o analizar código Python:
1. Analízalo profundamente. Identifica errores, malas prácticas y oportunidades de mejora.
2. Genera la versión corregida/mejorada con comentarios explicativos.
3. USA OBLIGATORIAMENTE `create_downloadable_file` para entregar el código como archivo .txt descargable.
4. NUNCA leas el código en voz alta. Entrega siempre el link de descarga.
5. Da un breve resumen hablado de los cambios que hiciste (máx. 3 bullet points).

[ARCHIVOS OFIMÁTICOS]
Si te piden un Excel, Word o PowerPoint:
1. Usa `execute_python_script` para generarlo en `static/downloads/`.
2. Entrega el link de descarga al usuario.

[RESTRICCIONES]
- No tienes acceso a WhatsApp, Google Calendar, Gmail ni cámara.
- Solo puedes revisar código, generar archivos y responder preguntas de programación.
- Si te piden algo fuera de tu alcance (cámara, WhatsApp, etc.), explícalo amablemente.
"""

model = genai.GenerativeModel(
    model_name='gemini-3.1-pro-preview',
    system_instruction=system_instruction,
    tools=[create_downloadable_file, execute_python_script]
)

chat_session = model.start_chat(enable_automatic_function_calling=True, history=[])

async def process_chat_message(message: str) -> str:
    try:
        response = chat_session.send_message(message)
        return response.text
    except Exception as e:
        error_msg = str(e)
        print(f"Error Gemini: {error_msg}")
        if "429" in error_msg or "Quota" in error_msg:
            return "Disculpa, llegué al límite de operaciones por este momento. Dame unos 30 segundos y vuelve a intentarlo."
        return "Lo siento, hubo un error de conexión con mi núcleo de inteligencia. Por favor, intenta de nuevo."
