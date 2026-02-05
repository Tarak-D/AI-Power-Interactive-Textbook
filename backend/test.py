import os
from dotenv import load_dotenv
from openai import OpenAI

def main():
    load_dotenv()

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise SystemExit(
            "OPENAI_API_KEY not found.\n"
            "Create backend/.env with:\n"
            "OPENAI_API_KEY=your_key_here\n"
        )

    # default to cheapest strong choice for MVP
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1-mini").strip()

    client = OpenAI(api_key=api_key)

    # Use Chat Completions for reliable plain text
    # API reference: /v1/chat/completions :contentReference[oaicite:3]{index=3}
    r = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "Reply with exactly two words: OK WORKS. Output only those two words."},
            {"role": "user", "content": "Test"},
        ],
        max_tokens=16,
        temperature=0
    )

    out = (r.choices[0].message.content or "").strip()

    print("Model:", model)
    print("OUTPUT:", out if out else "(empty)")

if __name__ == "__main__":
    main()