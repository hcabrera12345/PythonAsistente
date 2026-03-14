import os
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
import uvicorn

load_dotenv()

app = FastAPI(title="MyAsistente — Revisor de Código Python")

os.makedirs("static/audio", exist_ok=True)
os.makedirs("static/downloads", exist_ok=True)
os.makedirs("templates", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

import uuid
import re
import edge_tts
from pydantic import BaseModel
from core.ai_agent import process_chat_message

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    response_text = await process_chat_message(request.message)

    audio_filename = f"{uuid.uuid4()}.mp3"
    audio_path = os.path.join("static", "audio", audio_filename)

    # Limpiar markdown para la voz
    clean_text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', response_text)
    clean_text = re.sub(r'```.*?```', ' He adjuntado el archivo. ', clean_text, flags=re.DOTALL)
    clean_text = re.sub(r'[#*_`]', '', clean_text)

    communicate = edge_tts.Communicate(clean_text, "es-MX-DaliaNeural", rate="+20%")
    await communicate.save(audio_path)

    return {
        "response": response_text,
        "audio_url": f"/static/audio/{audio_filename}"
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "MyAsistente en línea."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), reload=True)
