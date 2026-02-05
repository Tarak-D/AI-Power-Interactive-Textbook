import os
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from openai import OpenAI

# Load .env
load_dotenv()

# App setup
app = FastAPI(title="Textbook of Tomorrow - MVP")

# Simple dev CORS (avoid headaches in MVP)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI client
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
MODEL_NAME = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini").strip()  # ✅ cheap + strong for MVP

if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY is missing.\n"
        "Fix: create backend/.env with:\n"
        "OPENAI_API_KEY=your_key_here\n"
    )

client = OpenAI(api_key=OPENAI_API_KEY)


class TextIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=12000)


def _clean_input(text: str) -> str:
    t = text.strip()
    return " ".join(t.split())


def _ask_ai(system_instructions: str, user_text: str, max_tokens: int) -> str:
    """
    Reliable plain-text output for MVP:
    Uses Chat Completions (works consistently with your current setup).
    """
    r = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_instructions},
            {"role": "user", "content": user_text},
        ],
        max_tokens=max_tokens,
        temperature=0.4,
    )
    return (r.choices[0].message.content or "").strip()


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME}


@app.post("/explain")
def explain(payload: TextIn):
    selected = _clean_input(payload.text)

    instructions = (
        "You are a helpful tutor for students.\n"
        "Explain the user's selected text in very simple, student-friendly language.\n"
        "Rules:\n"
        "- Keep it short (6-10 sentences)\n"
        "- Use plain words\n"
        "- If the text includes a formula or term, explain what it means\n"
        "- Output ONLY the explanation text\n"
    )

    result = _ask_ai(instructions, selected, max_tokens=320)
    return {"result": result}


@app.post("/summarize")
def summarize(payload: TextIn):
    selected = _clean_input(payload.text)

    instructions = (
        "You are a helpful tutor for students.\n"
        "Summarize the user's selected text.\n"
        "Rules:\n"
        "- Output EXACTLY 3 to 5 bullet points\n"
        "- Each bullet must be one short line\n"
        "- Max 5 bullets\n"
        "- Output ONLY the bullets (no title, no intro)\n"
        "Bullet format example:\n"
        "- Point one\n"
        "- Point two\n"
    )

    result = _ask_ai(instructions, selected, max_tokens=220)
    return {"result": result}


@app.post("/quiz")
def quiz(payload: TextIn):
    selected = _clean_input(payload.text)

    instructions = (
        "You are a quiz maker for students.\n"
        "Create EXACTLY 3 multiple-choice questions based ONLY on the user's selected text.\n"
        "Rules:\n"
        "- Each question must have 4 options labeled A, B, C, D\n"
        "- After options, include: Answer: <LETTER>\n"
        "- Keep questions easy and directly from the text\n"
        "- Output ONLY the quiz text, in this exact structure:\n"
        "Q1) ...?\n"
        "A) ...\n"
        "B) ...\n"
        "C) ...\n"
        "D) ...\n"
        "Answer: A\n"
        "\n"
        "Q2) ...?\n"
        "... and so on until Q3\n"
    )

    result = _ask_ai(instructions, selected, max_tokens=420)
    return {"result": result}
