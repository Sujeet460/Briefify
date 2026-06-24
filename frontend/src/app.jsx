import { useState, useEffect } from "react";

const API_BASE = "https://briefify-backend.onrender.com";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "32px 0" }}>
      <div style={{
        width: 36, height: 36, border: "3px solid #e2e8f0",
        borderTop: "3px solid #6366f1", borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ color: "#64748b", fontSize: 14 }}>Fetching and summarizing…</span>
    </div>
  );
}

function SummaryCard({ result }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 16,
      padding: "28px 32px",
      marginTop: 28,
      boxShadow: "0 4px 24px rgba(99,102,241,0.07)",
      animation: "fadeIn 0.4s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            background: result.cached ? "#f0fdf4" : "#eef2ff",
            color: result.cached ? "#16a34a" : "#6366f1",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
            padding: "3px 10px", borderRadius: 20, textTransform: "uppercase",
          }}>
            {result.cached ? "⚡ From Cache" : "✦ New Summary"}
          </div>
        </div>
        <span style={{ color: "#94a3b8", fontSize: 12 }}>{formatDate(result.created_at)}</span>
      </div>

      <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>
        {result.title}
      </h2>
      <a href={result.url} target="_blank" rel="noopener noreferrer" style={{
        color: "#6366f1", fontSize: 12, textDecoration: "none", wordBreak: "break-all",
        display: "block", marginBottom: 20,
      }}>
        {result.url}
      </a>

      <div style={{ width: 40, height: 3, background: "linear-gradient(90deg,#6366f1,#a78bfa)", borderRadius: 2, marginBottom: 18 }} />

      <p style={{
        margin: 0, lineHeight: 1.75, color: "#374151", fontSize: 15,
        background: "#f8fafc", borderRadius: 10, padding: "16px 20px",
        borderLeft: "3px solid #6366f1",
      }}>
        {result.summary}
      </p>
    </div>
  );
}

function HistoryItem({ item, onReuse }) {
  return (
    <div
      onClick={() => onReuse(item.url)}
      title="Click to re-summarize"
      style={{
        cursor: "pointer",
        padding: "12px 16px",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        background: "#fff",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(99,102,241,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 3 }}>{item.title}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", wordBreak: "break-all" }}>{item.url}</div>
    </div>
  );
}

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/history?limit=8`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      // History is non-critical
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }

    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Something went wrong.");
      }

      setResult(data);
      fetchHistory();
    } catch (err) {
      setError(err.message || "Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleReuse = (u) => {
    setUrl(u);
    setResult(null);
    setError("");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Serif+Display&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: #f1f5f9; font-family: 'Inter', sans-serif; min-height: 100vh; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
        ::placeholder { color: #94a3b8; }
        :focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
      `}</style>

      {/* Header */}
      <header style={{
        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
        padding: "48px 24px 40px",
        textAlign: "center",
        boxShadow: "0 4px 32px rgba(79,70,229,0.3)",
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 32 }}>⬡</span>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#fff", letterSpacing: "-0.02em" }}>
            Briefify
          </span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.75)", margin: 0, fontSize: 16 }}>
          Paste any URL — get the gist in seconds.
        </p>
      </header>

      {/* Main layout */}
      <main style={{ maxWidth: 840, margin: "0 auto", padding: "36px 20px 60px", display: "grid", gridTemplateColumns: "1fr", gap: 32 }}>

        {/* Input card */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "32px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
          <label style={{ display: "block", fontWeight: 700, color: "#1e293b", marginBottom: 12, fontSize: 15 }}>
            Page URL
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="https://example.com/article"
              style={{
                flex: "1 1 260px",
                padding: "12px 16px",
                fontSize: 15,
                border: "1.5px solid #e2e8f0",
                borderRadius: 10,
                outline: "none",
                color: "#1e293b",
                transition: "border-color 0.15s",
              }}
              onFocus={e => e.target.style.borderColor = "#6366f1"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                background: loading ? "#a5b4fc" : "linear-gradient(135deg,#6366f1,#7c3aed)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                transition: "opacity 0.15s, transform 0.1s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              onMouseDown={e => { if (!loading) e.currentTarget.style.transform = "scale(0.97)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {loading ? "Summarizing…" : "Summarize →"}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: 14, padding: "10px 16px",
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 8, color: "#dc2626", fontSize: 14,
            }}>
              ⚠ {error}
            </div>
          )}

          {/* How it works */}
          <div style={{ marginTop: 24, display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { icon: "🌐", label: "Fetches the page" },
              { icon: "✂️", label: "Extracts key text" },
              { icon: "🧠", label: "NLTK summarization" },
              { icon: "💾", label: "Cached in MongoDB" },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 13 }}>
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Loading or result */}
        {loading && <div style={{ background: "#fff", borderRadius: 16, padding: "8px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}><Spinner /></div>}
        {result && <SummaryCard result={result} />}

        {/* History */}
        {history.length > 0 && (
          <div>
            <h3 style={{ margin: "0 0 14px", fontWeight: 700, color: "#475569", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Recent Summaries
            </h3>
            <div style={{ display: "grid", gap: 8 }}>
              {historyLoading
                ? <div style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</div>
                : history.map((item) => (
                  <HistoryItem key={item.url} item={item} onReuse={handleReuse} />
                ))
              }
            </div>
          </div>
        )}
      </main>
    </>
  );
}
