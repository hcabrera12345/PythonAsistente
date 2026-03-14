import os
import time
import uuid
import re
import edge_tts
from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

load_dotenv()

app = FastAPI(title="MyAsistente — Revisor de Código Python")

os.makedirs("static/audio", exist_ok=True)
os.makedirs("static/downloads", exist_ok=True)
os.makedirs("templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Inicializar cabeceras de Google Sheets al arrancar
from core.analytics import ensure_headers, log_activity, get_daily_tokens_used
from core.ai_agent import process_chat_message

DAILY_TOKEN_LIMIT = int(os.environ.get("DAILY_TOKEN_LIMIT", 20000))


@app.on_event("startup")
async def startup_event():
    ensure_headers()

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# ─── Endpoint de validación de código de acceso ──────────────────────────────
class AccessRequest(BaseModel):
    code: str

@app.post("/api/verify-access")
async def verify_access(body: AccessRequest):
    expected = os.environ.get("ACCESS_CODE", "")
    if not expected:
        return {"valid": True}  # Sin código configurado, acceso libre
    if body.code.strip() == expected.strip():
        return {"valid": True}
    raise HTTPException(status_code=401, detail="Código de acceso incorrecto.")

# ─── Endpoint principal de chat ───────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    user_name: str = "Desconocido"
    action_type: str = "Voz"   # "Voz" | "Code Lab"
    access_code: str = ""

@app.post("/api/chat")
async def chat_endpoint(body: ChatRequest):
    # Validar código de acceso
    expected = os.environ.get("ACCESS_CODE", "")
    if expected and body.access_code.strip() != expected.strip():
        raise HTTPException(status_code=401, detail="Acceso no autorizado.")

    start_time = time.time()

    # ── Verificar límite diario de tokens ────────────────────────
    tokens_hoy = get_daily_tokens_used(body.user_name)
    if tokens_hoy >= DAILY_TOKEN_LIMIT:
        return JSONResponse(content={
            "response": f"Lo siento, {body.user_name}. Has alcanzado tu límite diario de {DAILY_TOKEN_LIMIT:,} tokens. Tu cupo se renueva automáticamente mañana. ¡Hasta entonces! 😊",
            "audio_url": None,
            "tokens": 0
        })

    # Procesar con Gemini (retorna texto + tokens)
    response_text, tokens_used = await process_chat_message(body.message)

    duration = time.time() - start_time

    # Registrar en Google Sheets (no bloqueante)
    try:
        log_activity(
            user_name=body.user_name,
            action_type=body.action_type,
            message_preview=body.message,
            tokens=tokens_used,
            duration_s=duration
        )
    except Exception as e:
        print(f"[Analytics] Fallo al loguear: {e}")

    # Generar audio TTS
    audio_filename = f"{uuid.uuid4()}.mp3"
    audio_path = os.path.join("static", "audio", audio_filename)

    clean_text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', response_text)
    clean_text = re.sub(r'```.*?```', ' He adjuntado el archivo. ', clean_text, flags=re.DOTALL)
    clean_text = re.sub(r'[#*_`]', '', clean_text)

    communicate = edge_tts.Communicate(clean_text, "es-MX-DaliaNeural", rate="+20%")
    await communicate.save(audio_path)

    return {
        "response": response_text,
        "audio_url": f"/static/audio/{audio_filename}",
        "tokens": tokens_used
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
