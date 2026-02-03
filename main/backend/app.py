from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI
import os

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "running"}

@app.post("/explain")
async def explain(data: dict):
    text = data.get("text")

    if not text:
        return {"error": "No text provided"}

    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": f"Explain this in simple student language:\n{text}"
                }
            ],
        )

        return {
            "result": completion.choices[0].message.content
        }

    except Exception as e:
        return {"error": str(e)}