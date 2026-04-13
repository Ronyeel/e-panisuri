// ─────────────────────────────────────────────────────────────────────────────
//  E-Panisuri — AI Document Summarizer
//  API: Groq (llama-3.3-70b-versatile)
//  Key loaded from env — no user input required
//  Limits: 20 MB file, 15 requests/day (localStorage)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from "react";
import * as mammoth from "mammoth";
import "./magsuriTayo.css";

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GROQ_API_KEY   = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL     = "llama-3.3-70b-versatile";
const GROQ_API_URL   = "https://api.groq.com/openai/v1/chat/completions";
const MAX_FILE_BYTES = 20 * 1024 * 1024;  // 20 MB
const DAILY_LIMIT    = 15;
const RATE_KEY       = "ms_rate";

const LOADING_MSGS = [
  "Binabasa ang dokumento...",
  "Sinusuri ang nilalaman...",
  "Ginagawa ang buod...",
  "Halos tapos na...",
];

// ─────────────────────────────────────────────────────────────────────────────
//  RATE LIMITER
// ─────────────────────────────────────────────────────────────────────────────

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getRateData() {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (!raw) return { date: "", count: 0 };
    return JSON.parse(raw);
  } catch {
    return { date: "", count: 0 };
  }
}

function getRemainingRequests() {
  const { date, count } = getRateData();
  if (date !== getTodayStr()) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - count);
}

function consumeRequest() {
  const today = getTodayStr();
  const data  = getRateData();
  const count = data.date === today ? data.count : 0;
  if (count >= DAILY_LIMIT) return false;
  localStorage.setItem(RATE_KEY, JSON.stringify({ date: today, count: count + 1 }));
  return true;
}

function refundRequest() {
  try {
    const today = getTodayStr();
    const data  = getRateData();
    if (data.date === today && data.count > 0) {
      localStorage.setItem(RATE_KEY, JSON.stringify({ date: today, count: data.count - 1 }));
    }
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}

async function extractPdfText(file) {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload  = resolve;
      script.onerror = () => reject(new Error("Hindi ma-load ang PDF reader."));
      document.head.appendChild(script);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf   = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(" "));
  }
  return pages.join("\n\n");
}

function truncateText(text, maxChars = 32000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) +
    "\n\n[... Ang dokumento ay naputol dahil sa limitasyon ng modelo ...]";
}

async function summarizeWithGroq(text, fileName, lang) {
  const langNote =
    lang === "fil"
      ? "Isulat ang buod sa Filipino/Tagalog."
      : "Write the summary in English.";

  const res = await fetch(GROQ_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      temperature: 0.4,
      max_tokens:  4096, // ← increased from 1024
      messages: [
        {
          role:    "system",
          content: `Ikaw ay isang expert document summarizer. ${langNote} Laging sagutin nang malinaw, detalyado, at organisado. Huwag mag-alinlangan na magbigay ng mahabang buod kung ang dokumento ay may maraming impormasyon.`,
        },
        {
          role:    "user",
          content: `Gawin ang isang malinaw, komprehensibo, at DETALYADONG buod ng dokumentong ito: "${fileName}"

Kasama ang lahat ng sumusunod na seksyon, at siguraduhing bawat seksyon ay may sapat na detalye:

1. **Pangunahing Paksa** - Ano ang tungkol sa dokumento? Ipaliwanag nang buong-buo.

2. **Konteksto at Layunin** - Bakit ginawa ang dokumentong ito? Para kanino ito?

3. **Mahahalagang Puntos** - Listahan ang LAHAT ng mahahalagang punto (hindi limitado sa 7). Bawat punto ay may maikling paliwanag.

4. **Mahahalagang Detalye** - Mga espesipikong impormasyon, numero, petsa, pangalan, o datos na makikita sa dokumento.

5. **Konklusyon at Rekomendasyon** - Ano ang pangunahing takeaway? May mga rekomendasyon ba?

6. **Pangkalahatang Pagtatasa** - Ano ang kahalagahan ng dokumentong ito?

Maging detalyado at komprehensibo. Huwag mag-iwan ng mahalagang impormasyon.

---DOKUMENTO---
${truncateText(text)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("API key error. Makipag-ugnayan sa admin.");
    if (res.status === 429) throw new Error("Busy ang server. Subukan ulit mamaya.");
    throw new Error(err.error?.message || `Groq error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "Walang buod na natanggap.";
}

function validateFile(file) {
  if (!file) return "Walang file na napili.";
  const ext = file.name.split(".").pop().toLowerCase();
  if (!["pdf", "docx", "doc"].includes(ext))
    return "PDF o Word (.docx / .doc) lamang ang tinatanggap.";
  if (file.size > MAX_FILE_BYTES)
    return "Ang file ay masyadong malaki (max 20 MB).";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function FileTypeIcon({ ext }) {
  const isPdf = ext === "pdf";
  const color = isPdf ? "#bf1e2e" : "#f5c518";
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4z"
        stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.1"
      />
      <path d="M13 2v6h6" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <text x="5" y="19" fontSize="4.5" fontWeight="800" fill={color} fontFamily="sans-serif">
        {isPdf ? "PDF" : "DOC"}
      </text>
    </svg>
  );
}

function RateBadge({ remaining }) {
  const pct   = remaining / DAILY_LIMIT;
  const color = pct > 0.4 ? "#f5c518" : pct > 0.15 ? "#e0882a" : "#bf1e2e";
  return (
    <div className="ms-rate">
      <span style={{ color }}>◉</span>
      <span>{remaining} / {DAILY_LIMIT} requests remaining ngayon</span>
    </div>
  );
}

function SummaryDisplay({ text }) {
  return (
    <div className="ms-summary-body">
      {text.split("\n").filter(Boolean).map((line, i) => {
        if (/^#{1,2}\s/.test(line))
          return <h3 key={i} className="ms-sum-heading">{line.replace(/^#{1,2}\s/, "")}</h3>;

        if (/^\*\*[^*]+\*\*$/.test(line))
          return <p key={i} className="ms-sum-bold">{line.slice(2, -2)}</p>;

        if (/\*\*.*\*\*/.test(line)) {
          const html = line.replace(
            /\*\*(.*?)\*\*/g,
            (_, m) => `<strong style="color:var(--gold);font-family:'Bebas Neue',sans-serif;letter-spacing:0.05em">${m}</strong>`
          );
          return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
        }

        if (/^[-•]\s/.test(line))
          return (
            <div key={i} className="ms-sum-bullet">
              <span className="ms-sum-bullet-dot">◆</span>
              <span>{line.slice(2)}</span>
            </div>
          );

        const numbered = line.match(/^(\d+)\.\s(.*)/);
        if (numbered)
          return (
            <div key={i} className="ms-sum-numbered">
              <span className="ms-sum-num-badge">{numbered[1]}</span>
              <span>{numbered[2]}</span>
            </div>
          );

        if (line === "---") return <hr key={i} className="ms-sum-divider" />;

        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function MagsuriTayo() {
  const [file,       setFile]       = useState(null);
  const [dragging,   setDragging]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [summary,    setSummary]    = useState("");
  const [error,      setError]      = useState("");
  const [lang,       setLang]       = useState("fil");
  const [copied,     setCopied]     = useState(false);
  const [remaining,  setRemaining]  = useState(getRemainingRequests);

  const fileRef     = useRef();
  const intervalRef = useRef(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const acceptFile = useCallback((f) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setFile(f);
    setSummary("");
    setError("");
  }, []);

  const clearFile = () => { setFile(null); setSummary(""); setError(""); };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, [acceptFile]);

  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);

  // ── Summarise ──────────────────────────────────────────────────────────────

  const handleSummarize = async () => {
    if (!file) return setError("Pumili muna ng dokumento.");

    if (!GROQ_API_KEY) {
      return setError("Hindi ma-load ang API key. Makipag-ugnayan sa admin.");
    }

    if (!consumeRequest()) {
      return setError(`Naabot na ang limitasyon ngayon (${DAILY_LIMIT} requests/day). Bumalik bukas!`);
    }
    setRemaining(getRemainingRequests());

    setLoading(true);
    setError("");
    setSummary("");

    let idx = 0;
    setLoadingMsg(LOADING_MSGS[0]);
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[idx]);
    }, 1800);

    try {
      const ext  = file.name.split(".").pop().toLowerCase();
      const text = ext === "pdf"
        ? await extractPdfText(file)
        : await extractDocxText(file);

      if (!text.trim())
        throw new Error("Hindi ma-extract ang text. Subukan ang ibang dokumento.");

      const result = await summarizeWithGroq(text, file.name, lang);
      setSummary(result);
    } catch (e) {
      refundRequest();
      setRemaining(getRemainingRequests());
      setError(e.message || "May nangyaring error. Subukan ulit.");
    } finally {
      clearInterval(intervalRef.current);
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileExt   = file?.name.split(".").pop().toLowerCase() ?? "";
  const fileSize  = file ? `${(file.size / 1024).toFixed(1)} KB` : "";
  const canSubmit = !loading && !!file && remaining > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ms-root">

      <div className="ms-header">
        <h1 className="ms-title">
          E-<span className="ms-title-gold">Panisuri</span>
        </h1>
        <p className="ms-subtitle">
          I-upload ang iyong dokument.
        </p>
      </div>

      <div className="ms-card">
        <div className="ms-corner ms-corner-tl" />
        <div className="ms-corner ms-corner-br" />

        <RateBadge remaining={remaining} />

        <div className="ms-label"> Wika ng Buod</div>
        <div className="ms-lang">
          <button className={`ms-lang-btn${lang === "fil" ? " on" : ""}`} onClick={() => setLang("fil")}>
            🇵🇭 Filipino
          </button>
          <button className={`ms-lang-btn${lang === "en" ? " on" : ""}`} onClick={() => setLang("en")}>
            🇺🇸 English
          </button>
        </div>

        <div className="ms-label">Dokumento</div>
        <div
          className={`ms-drop${dragging ? " active" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
        >
          <span className="ms-drop-icon"></span>
          <p className="ms-drop-text">I-drag dito ang iyong file, o mag-click para pumili</p>
          <p className="ms-drop-sub">Tinatanggap: PDF, DOCX · Max 20 MB</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files[0]) acceptFile(e.target.files[0]); }}
        />

        {file && (
          <div className="ms-file">
            <FileTypeIcon ext={fileExt} />
            <div className="ms-file-info">
              <div className="ms-file-name">{file.name}</div>
              <div className="ms-file-size">{fileSize}</div>
            </div>
            <button className="ms-rm-btn" onClick={clearFile}>✕</button>
          </div>
        )}
      </div>

      {error && <div className="ms-error">⚠ {error}</div>}

      <div className="ms-btn-row">
        <button className="ms-btn" onClick={handleSummarize} disabled={!canSubmit}>
          {loading
            ? <><div className="ms-spinner" style={{ width: 20, height: 20, margin: 0 }} />{loadingMsg}</>
            : remaining === 0
              ? "✦ UBOS NA ANG LIMIT NGAYON ✦"
              : "✦ SIMULAN ANG PAGSUSURI ✦"
          }
        </button>
      </div>

      {loading && (
        <div className="ms-summary">
          <div className="ms-loading">
            <div className="ms-spinner" />
            <p className="ms-loading-text">{loadingMsg}</p>
          </div>
        </div>
      )}

      {summary && !loading && (
        <div className="ms-summary">
          <div className="ms-corner ms-corner-tl" />
          <div className="ms-corner ms-corner-br" />
          <div className="ms-sum-header">
            <div className="ms-sum-title"> Buod ng Dokumento</div>
            <button className={`ms-copy-btn${copied ? " on" : ""}`} onClick={handleCopy}>
              {copied ? "✓ NAKOPYA" : "⎘ KOPYAHIN"}
            </button>
          </div>
          <SummaryDisplay text={summary} />
        </div>
      )}

      <div className="ms-footer">
        <span>Powered by Groq AI</span>
        <div className="ms-footer-dot" />
        <span>E-Panisuri</span>
      </div>

    </div>
  );
}