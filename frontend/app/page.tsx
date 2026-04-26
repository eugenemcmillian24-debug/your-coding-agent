'use client'
import { useEffect, useState } from 'react'

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'

type Plan = {
  tier: string; name: string; amount: number; currency: string;
  builds_per_month: number; features: string[]; models: string[];
}
type Model = { id: string; name: string; group: string; endpoint: string; plan: string }
type Job = {
  id: string; app_name: string; status: string; model: string;
  pr_url: string | null; deployment_url: string | null; deployment_state: string | null;
}
type Subscription = {
  subscribed: boolean; tier: string | null; status?: string;
  customer_id?: string; builds_per_month?: number; models?: string[];
  is_admin?: boolean;
}

export default function Home() {
  const [view, setView] = useState<'pricing' | 'builder'>('pricing')
  const [plans, setPlans] = useState<Plan[]>([])
  const [email, setEmail] = useState('')
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(false)

  // Builder state
  const [appName, setAppName] = useState('Real Integration Builder')
  const [prompt, setPrompt] = useState('Build and deploy a real integrated app.')
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    fetch(`${API}/api/stripe/plans`).then(r => r.json()).then(setPlans).catch(() => {})
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success') {
      setView('builder')
    }
  }, [])

  useEffect(() => {
    if (subscription?.subscribed) {
      setView('builder')
      loadModels()
      loadJobs()
      const t = setInterval(loadJobs, 4000)
      return () => clearInterval(t)
    }
  }, [subscription])

  async function checkSubscription() {
    if (!email) return
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/stripe/subscription/${encodeURIComponent(email)}`)
      const data = await r.json()
      setSubscription(data)
      if (!data.subscribed) {
        alert('No active subscription found for this email. Choose a plan below.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function startCheckout(tier: string) {
    if (!email) { alert('Enter your email first'); return }
    const r = await fetch(`${API}/api/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, email }),
    })
    const data = await r.json()
    if (data.checkout_url) window.location.href = data.checkout_url
  }

  async function openPortal() {
    if (!subscription?.customer_id) return
    const r = await fetch(`${API}/api/stripe/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: subscription.customer_id }),
    })
    const data = await r.json()
    if (data.portal_url) window.location.href = data.portal_url
  }

  async function loadModels() {
    const r = await fetch(`${API}/api/jobs/models`)
    const data = await r.json()
    setModels(data)
    if (data.length > 0 && !selectedModel) setSelectedModel(data[0].id)
  }

  async function loadJobs() {
    const r = await fetch(`${API}/api/jobs`)
    setJobs(await r.json())
  }

  async function submit() {
    const r = await fetch(`${API}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_name: appName, prompt, provider: 'opencode-go', model: selectedModel || undefined }),
    })
    setResult(await r.json()); loadJobs()
  }

  const tierColors: Record<string, string> = {
    basic: '#64748b', starter: '#38bdf8', pro: '#a78bfa', premium: '#f59e0b'
  }

  // ── Pricing View ──
  if (view === 'pricing' || !subscription?.subscribed) {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 42, marginBottom: 8 }}>Forge Agent</h1>
          <p style={{ color: '#94a3b8', fontSize: 18 }}>AI-powered code generation & deployment pipeline</p>
        </div>

        {/* Email login */}
        <div style={{ ...card, maxWidth: 500, margin: '0 auto 40px', display: 'flex', gap: 12 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} style={{ ...field, flex: 1 }}
            placeholder="your@email.com" type="email" onKeyDown={e => e.key === 'Enter' && checkSubscription()} />
          <button onClick={checkSubscription} disabled={loading} style={{ ...btn, background: '#475569', whiteSpace: 'nowrap' }}>
            {loading ? 'Checking...' : 'Sign In'}
          </button>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
          {plans.map(plan => (
            <div key={plan.tier} style={{
              ...card, border: `2px solid ${tierColors[plan.tier] || '#334155'}`,
              display: 'flex', flexDirection: 'column', position: 'relative',
            }}>
              {plan.tier === 'pro' && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: '#a78bfa', color: '#0f172a', padding: '4px 16px', borderRadius: 20,
                  fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                }}>Most Popular</div>
              )}
              <h2 style={{ margin: '8px 0 4px', color: tierColors[plan.tier] }}>{plan.name}</h2>
              <div style={{ fontSize: 36, fontWeight: 800, margin: '8px 0' }}>
                ${(plan.amount / 100).toFixed(2)}
                <span style={{ fontSize: 16, fontWeight: 400, color: '#94a3b8' }}>/mo</span>
              </div>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
                {plan.builds_per_month === -1 ? 'Unlimited builds' : `${plan.builds_per_month} builds/month`}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', flex: 1 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ padding: '6px 0', fontSize: 14, color: '#cbd5e1' }}>
                    ✓ {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => startCheckout(plan.tier)} style={{
                ...btn, background: tierColors[plan.tier], color: '#0f172a', width: '100%',
              }}>
                Get {plan.name}
              </button>
            </div>
          ))}
        </div>
      </main>
    )
  }

  // ── Builder View (subscribed or admin) ──
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Forge Agent</h1>
          <p style={{ margin: 0, color: '#94a3b8' }}>GitHub + Cloudflare Pages deployment pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {subscription?.is_admin ? (
            <span style={{
              background: '#ef4444', color: '#fff',
              padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              textTransform: 'uppercase',
            }}>⚡ Admin</span>
          ) : (
            <span style={{
              background: tierColors[subscription?.tier || 'basic'], color: '#0f172a',
              padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              textTransform: 'uppercase',
            }}>{subscription?.tier}</span>
          )}
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{email}</span>
          {!subscription?.is_admin && (
            <button onClick={openPortal} style={{ ...btn, background: '#334155', fontSize: 13, padding: '6px 12px' }}>
              Manage Plan
            </button>
          )}
        </div>
      </div>

      <div style={card}>
        <input value={appName} onChange={e => setAppName(e.target.value)} style={field} placeholder="App name" />
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={6} style={field}
          placeholder="Describe what to build..." />

        {/* Model selector */}
        <div>
          <label style={{ display: 'block', marginBottom: 6, color: '#94a3b8', fontSize: 13 }}>AI Model</label>
          <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} style={field}>
            {['Free Models', 'Go Plan'].map(group => {
              const groupModels = models.filter(m => m.group === group)
              if (groupModels.length === 0) return null
              return (
                <optgroup key={group} label={`${group === 'Free Models' ? '🟢' : '🔵'} ${group}`}>
                  {groupModels.map(m => <option key={m.id} value={m.id}>{m.name} ({m.id})</option>)}
                </optgroup>
              )
            })}
          </select>
        </div>

        <button onClick={submit} style={btn}>Queue job</button>
      </div>

      {result && <pre style={pre}>{JSON.stringify(result, null, 2)}</pre>}

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {jobs.map(j => (
          <div key={j.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{j.app_name}</strong>
              {j.model && <span style={{ fontSize: 12, color: '#64748b', background: '#1e293b', padding: '2px 8px', borderRadius: 8 }}>{j.model}</span>}
            </div>
            <div>Status: {j.status}</div>
            <div>PR: {j.pr_url ? <a href={j.pr_url} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>{j.pr_url}</a> : '\u2014'}</div>
            <div>Deploy: {j.deployment_url ? <a href={`https://${j.deployment_url}`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>{j.deployment_url}</a> : '\u2014'}</div>
            <div>Deploy state: {j.deployment_state || '\u2014'}</div>
          </div>
        ))}
      </div>
    </main>
  )
}

const card: React.CSSProperties = { display: 'grid', gap: 12, background: '#0f172a', padding: 20, borderRadius: 16 }
const field: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 12, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', fontSize: 14 }
const btn: React.CSSProperties = { padding: '12px 18px', borderRadius: 12, border: 'none', background: '#38bdf8', color: '#04121a', fontWeight: 700, cursor: 'pointer', fontSize: 15 }
const pre: React.CSSProperties = { marginTop: 20, padding: 16, borderRadius: 16, background: '#020617', overflowX: 'auto' }
