from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from pymongo import MongoClient
from bs4 import BeautifulSoup
import requests
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize, word_tokenize
from collections import Counter
import heapq
import os
from datetime import datetime

# Download required NLTK data
nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)
nltk.download("stopwords", quiet=True)

app = FastAPI(title="URL Summarizer API")

# CORS - allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client["url_summarizer"]
summaries_collection = db["summaries"]

# Create index on URL for fast lookups
summaries_collection.create_index("url", unique=True)


class URLRequest(BaseModel):
    url: str


class SummaryResponse(BaseModel):
    url: str
    summary: str
    title: str
    cached: bool
    created_at: str


def extract_text_from_url(url: str) -> tuple[str, str]:
    """Fetch a URL and extract clean text using BeautifulSoup."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/91.0.4472.124 Safari/537.36"
        )
    }
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove unwanted tags
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else url

    # Extract main content text
    text = soup.get_text(separator=" ", strip=True)

    # Clean up whitespace
    lines = (line.strip() for line in text.splitlines())
    text = " ".join(chunk for chunk in lines if chunk)

    return title, text


def summarize_text(text: str, num_sentences: int = 5) -> str:
    """NLTK-based extractive summarization using sentence scoring."""
    sentences = sent_tokenize(text)
    if len(sentences) <= num_sentences:
        return " ".join(sentences)

    stop_words = set(stopwords.words("english"))
    words = word_tokenize(text.lower())
    word_freq = Counter(
        w for w in words if w.isalnum() and w not in stop_words and len(w) > 2
    )

    if not word_freq:
        return " ".join(sentences[:num_sentences])

    max_freq = max(word_freq.values())
    word_freq = {w: f / max_freq for w, f in word_freq.items()}

    # Score each sentence by the sum of its word frequencies
    sentence_scores = {}
    for sent in sentences:
        sent_words = word_tokenize(sent.lower())
        score = sum(word_freq.get(w, 0) for w in sent_words if w.isalnum())
        if len(sent_words) > 0:
            sentence_scores[sent] = score / len(sent_words)

    top_sentences = heapq.nlargest(num_sentences, sentence_scores, key=sentence_scores.get)

    # Preserve original sentence order
    ordered = [s for s in sentences if s in top_sentences]
    return " ".join(ordered)


@app.post("/summarize", response_model=SummaryResponse)
async def summarize_url(request: URLRequest):
    url = request.url.strip()

    # Validate basic URL structure
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    # Check cache first
    cached = summaries_collection.find_one({"url": url})
    if cached:
        return SummaryResponse(
            url=cached["url"],
            summary=cached["summary"],
            title=cached["title"],
            cached=True,
            created_at=cached["created_at"],
        )

    # Fetch and process
    try:
        title, text = extract_text_from_url(url)
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=422, detail=f"Could not fetch URL: {str(e)}")

    if len(text) < 100:
        raise HTTPException(status_code=422, detail="Page has too little readable content.")

    summary = summarize_text(text, num_sentences=5)
    created_at = datetime.utcnow().isoformat() + "Z"

    # Store in MongoDB
    doc = {"url": url, "title": title, "summary": summary, "created_at": created_at}
    summaries_collection.update_one({"url": url}, {"$set": doc}, upsert=True)

    return SummaryResponse(url=url, summary=summary, title=title, cached=False, created_at=created_at)


@app.get("/history")
async def get_history(limit: int = 10):
    """Return recent summarization history."""
    docs = list(
        summaries_collection.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    )
    return {"history": docs}


@app.get("/health")
async def health():
    return {"status": "ok"}
