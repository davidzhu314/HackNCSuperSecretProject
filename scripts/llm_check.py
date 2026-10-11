"""Check that GEMINI_API_KEY in .env.local works, and that GEMINI_MODEL returns valid JSON.
Never prints the key.

Run: .venv/bin/python scripts/llm_check.py
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")

key = os.environ.get("GEMINI_API_KEY", "").strip()
model = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash").strip()
if not key:
    raise SystemExit("GEMINI_API_KEY is empty in .env.local")

client = OpenAI(api_key=key, base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
schema = {
    "name": "check",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {"rating": {"type": "string", "enum": ["not_evident", "weak", "moderate", "strong"]},
                       "reason": {"type": "string"}},
        "required": ["rating", "reason"],
        "additionalProperties": False,
    },
}
try:
    r = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[{"role": "user", "content": "Rate how strongly this sentence shows technical specificity: "
                   "'I built a Python ML project.' Respond as JSON."}],
        response_format={"type": "json_schema", "json_schema": schema},
    )
except Exception as e:
    raise SystemExit(f"Request failed: {type(e).__name__}: {str(e).replace(key, '<key>')[:300]}")

text = r.choices[0].message.content
print("raw:", text)
data = json.loads(text)
assert data["rating"] in schema["schema"]["properties"]["rating"]["enum"]
print(f"OK: {model} returned schema-valid JSON.")
