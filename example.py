from google import genai
import os

client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"]
)

response = client.models.generate_content(
    model="gemini-3.8-flash",
    contents="Give me three tips for improving a LinkedIn profile."
)

print(response.text)