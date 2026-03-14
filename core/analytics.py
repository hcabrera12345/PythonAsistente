import os
import json
import datetime
import gspread
from google.oauth2.service_account import Credentials

SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "11Iw-IhhtJ_uk2_Jti9e9cmysk45hivvGOl7tGkALtng")
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
HEADERS = ["Fecha y Hora", "Usuario", "Tipo", "Consulta (preview)", "Tokens", "Duración (s)"]


def _get_sheet():
    """Conecta con Google Sheets usando la Service Account almacenada en la variable de entorno."""
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not sa_json:
        raise ValueError("Variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON no encontrada.")
    sa_info = json.loads(sa_json)
    creds = Credentials.from_service_account_info(sa_info, scopes=SCOPES)
    client = gspread.authorize(creds)
    return client.open_by_key(SHEET_ID).sheet1


def ensure_headers():
    """Crea la fila de encabezados si la hoja está vacía."""
    try:
        sheet = _get_sheet()
        if sheet.row_values(1) != HEADERS:
            sheet.insert_row(HEADERS, 1)
    except Exception as e:
        print(f"[Analytics] Error inicializando cabeceras: {e}")


def log_activity(user_name: str, action_type: str, message_preview: str, tokens: int, duration_s: float):
    """
    Registra una fila de actividad en Google Sheets.
    action_type: 'Voz' | 'Code Lab'
    """
    try:
        sheet = _get_sheet()
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        preview = (message_preview[:80] + "...") if len(message_preview) > 80 else message_preview
        preview = preview.replace("\n", " ")
        row = [timestamp, user_name, action_type, preview, tokens, round(duration_s, 1)]
        sheet.append_row(row)
        print(f"[Analytics] Registrado: {user_name} | {action_type} | {tokens} tokens")
    except Exception as e:
        print(f"[Analytics] Error al registrar: {e}")


def get_daily_tokens_used(user_name: str) -> int:
    """
    Retorna el total de tokens consumidos HOY por este usuario.
    Ignora días anteriores (reseteo diario automático).
    """
    try:
        sheet = _get_sheet()
        today = datetime.date.today().strftime("%Y-%m-%d")
        all_rows = sheet.get_all_values()

        total = 0
        for row in all_rows[1:]:  # Saltar cabecera
            if len(row) < 5:
                continue
            row_date = row[0][:10]        # "YYYY-MM-DD" de la columna timestamp
            row_user = row[1].strip()     # Nombre de usuario
            row_tokens = row[4]           # Columna de tokens

            if row_date == today and row_user.lower() == user_name.lower():
                try:
                    total += int(row_tokens)
                except (ValueError, TypeError):
                    pass
        return total
    except Exception as e:
        print(f"[Analytics] Error leyendo tokens diarios: {e}")
        return 0  # En caso de error, no bloquear al usuario

