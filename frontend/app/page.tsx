"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

interface Model {
  id: string;
  label: string;
  plan: "free" | "go" | "zen";
  endpoint: string;
}

export default function Home() {
  const [appName, setAppName] = useState("Real Integration Builder");
  const [prompt, setPrompt] = useState(
    "Build and deploy a real integrated app."
  );
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadModels() {
    try {
      const r = await fetch(`${API}/api/jobs/models`);
      if (r.ok) {
        const data = await r.json();
        setModels(data);
        // Default to first free model
        if (data.length > 0 && !selectedModel) {
          const free = data.find((m: Model) => m.plan === "free");
          setSelectedModel(free ? free.id : data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load models:", e);
    }
  }

  async function loadJobs() {
    try {
      const r = await fetch(`${API}/api/jobs`);
      if (r.ok) setJobs(await r.json());
    } catch (e) {
      console.error("Failed to load jobs:", e);
    }
  }

  useEffect(() => {
    loadModels();
    loadJobs();
    const t = setInterval(loadJobs, 4000);
    return () => clearInterval(t);
  }, []);

  async function submit() {
    setSubmitting(true);
    try {
      const body: any = {
        app_name: appName,
        prompt,
        provider: "opencode-go",
      };
      if (selectedModel) body.model = selectedModel;

      const r = await fetch(`${API}/api/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult(await r.json());
      loadJobs();
    } finally {
      setSubmitting(false);
    }
  }

  const freeModels = models.filter((m) => m.plan === "free");
  const goModels = models.filter((m) => m.plan === "go");

  function planBadge(plan: string) {
    if (plan === "free") return "🟢 Free";
    if (plan === "go") return "🔵 Go";
    return plan;
  }

  function statusColor(status: string) {
    if (status === "complete") return "#22c55e";
    if (status === "failed") return "#ef4444";
    if (status === "queued") return "#facc15";
    return "#38bdf8";
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
        Forge Agent
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 24 }}>
        AI-powered GitHub + Cloudflare Pages deployment pipeline
      </p>

      <div style={card}>
        <input
          value={appName}
          onChange={(e) => setAppName(e.target.value)}
          style={field}
          placeholder="App name"
        />

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          style={field}
          placeholder="Describe what to build..."
        />

        {/* Model selector */}
        <div>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontSize: 13,
              color: "#94a3b8",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            AI Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              ...field,
              cursor: "pointer",
              appearance: "none",
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%2394a3b8\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              paddingRight: 36,
            }}
          >
            {freeModels.length > 0 && (
              <optgroup label="🟢 Free Models (no cost)">
                {freeModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            )}
            {goModels.length > 0 && (
              <optgroup label="🔵 Go Plan ($10/mo — heavy lifting)">
                {goModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {selectedModel && (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: "#64748b",
              }}
            >
              {(() => {
                const m = models.find((x) => x.id === selectedModel);
                if (!m) return null;
                return (
                  <>
                    {planBadge(m.plan)} · {m.id} · {m.endpoint === "messages" ? "Anthropic" : "OpenAI"}-compatible
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={submitting || !appName.trim()}
          style={{
            ...button,
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Queuing..." : "Queue job"}
        </button>
      </div>

      {result && (
        <pre style={pre}>{JSON.stringify(result, null, 2)}</pre>
      )}

      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          marginTop: 32,
          marginBottom: 12,
        }}
      >
        Jobs
      </h2>

      <div style={{ display: "grid", gap: 12 }}>
        {jobs.length === 0 && (
          <div style={{ ...card, color: "#64748b", textAlign: "center" }}>
            No jobs yet. Queue one above.
          </div>
        )}
        {jobs.map((j) => (
          <div key={j.id} style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ fontSize: 16 }}>{j.app_name}</strong>
              <span
                style={{
                  fontSize: 12,
                  padding: "2px 10px",
                  borderRadius: 8,
                  background: statusColor(j.status) + "22",
                  color: statusColor(j.status),
                  fontWeight: 600,
                }}
              >
                {j.status}
              </span>
            </div>
            {j.model && (
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Model: {j.model}
              </div>
            )}
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              PR:{" "}
              {j.pr_url ? (
                <a
                  href={j.pr_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#38bdf8" }}
                >
                  {j.pr_url}
                </a>
              ) : (
                "\u2014"
              )}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              Deploy:{" "}
              {j.deployment_url ? (
                <a
                  href={`https://${j.deployment_url}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#38bdf8" }}
                >
                  {j.deployment_url}
                </a>
              ) : (
                "\u2014"
              )}
            </div>
            {j.deployment_state && (
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Deploy state: {j.deployment_state}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  display: "grid",
  gap: 12,
  background: "#0f172a",
  padding: 16,
  borderRadius: 16,
};
const field: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #334155",
  background: "#020617",
  color: "#e2e8f0",
  fontSize: 14,
};
const button: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "none",
  background: "#38bdf8",
  color: "#04121a",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};
const pre: React.CSSProperties = {
  marginTop: 20,
  padding: 16,
  borderRadius: 16,
  background: "#020617",
  overflowX: "auto",
  fontSize: 12,
};
