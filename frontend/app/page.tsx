'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

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

/* ── SVG Icons ── */
const Icons = {
  code: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  fileText: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  logOut: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  zap: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  creditCard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  externalLink: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
}

function StatusDot({ status }: { status: string }) {
  const cls = status === 'complete' ? 'status-dot-complete'
    : status === 'failed' ? 'status-dot-failed'
    : status === 'running' || status === 'building' ? 'status-dot-running'
    : 'status-dot-pending'
  return <span className={`status-dot ${cls}`} />
}

export default function Home() {
  const [view, setView] = useState<'pricing' | 'builder'>('pricing')
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(false)

  // Auth state
  const [user, setUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)

  // Builder state
  const [builderTab, setBuilderTab] = useState<'builder' | 'invoice'>('builder')
  const [appName, setAppName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  // Invoice state
  const [invoiceInput, setInvoiceInput] = useState('')
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<{
    invoice_id: string; invoice_data: Record<string, unknown>; pdf_base64: string; credits_remaining: number | string;
  } | null>(null)
  const [invoiceError, setInvoiceError] = useState('')
  const [invoiceCredits, setInvoiceCredits] = useState<{ credits_remaining: number | string; credits_used: number } | null>(null)

  // Load plans and check existing session on mount
  useEffect(() => {
    fetch(`${API}/api/stripe/plans`).then(r => r.json()).then(setPlans).catch(() => {})

    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success') {
      setView('builder')
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        checkSubscription(session.user.email || '')
      }
      setSessionLoading(false)
    })

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          checkSubscription(session.user.email || '')
        } else {
          setUser(null)
          setSubscription(null)
          setView('pricing')
        }
      }
    )

    return () => { authSub.unsubscribe() }
  }, [])

  useEffect(() => {
    if (subscription?.subscribed) {
      setView('builder')
      loadModels()
      loadJobs()
      loadInvoiceCredits()
      const t = setInterval(loadJobs, 4000)
      return () => clearInterval(t)
    }
  }, [subscription])

  async function checkSubscription(email: string) {
    if (!email) return
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/stripe/subscription/${encodeURIComponent(email)}`)
      const data = await r.json()
      setSubscription(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignIn() {
    if (!authEmail || !authPassword) {
      setAuthError('Email and password are required')
      return
    }
    setAuthLoading(true)
    setAuthError('')
    setAuthSuccess('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      })
      if (error) {
        setAuthError(error.message)
      } else if (data.user) {
        setAuthEmail('')
        setAuthPassword('')
      }
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignUp() {
    if (!authEmail || !authPassword) {
      setAuthError('Email and password are required')
      return
    }
    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters')
      return
    }
    if (authPassword !== authConfirmPassword) {
      setAuthError('Passwords do not match')
      return
    }
    setAuthLoading(true)
    setAuthError('')
    setAuthSuccess('')
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      })
      if (error) {
        setAuthError(error.message)
      } else if (data.user) {
        if (data.user.identities?.length === 0) {
          setAuthError('An account with this email already exists. Please sign in instead.')
        } else if (data.session) {
          setAuthEmail('')
          setAuthPassword('')
          setAuthConfirmPassword('')
        } else {
          setAuthSuccess('Account created! Check your email to confirm your account, then sign in.')
          setAuthMode('signin')
          setAuthPassword('')
          setAuthConfirmPassword('')
        }
      }
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    setSubscription(null)
    setView('pricing')
    setJobs([])
    setResult(null)
  }

  async function startCheckout(tier: string) {
    if (!user?.email) { alert('Please sign in first'); return }
    const r = await fetch(`${API}/api/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, email: user.email }),
    })
    const data = await r.json()
    if (data.checkout_url) window.location.href = data.checkout_url
    else if (data.detail) alert(data.detail)
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

  async function loadInvoiceCredits() {
    if (!user?.email) return
    try {
      const r = await fetch(`${API}/api/invoice/credits/${encodeURIComponent(user.email)}`)
      const data = await r.json()
      setInvoiceCredits(data)
    } catch { /* ignore */ }
  }

  async function generateInvoice() {
    if (!user?.email) return
    if (invoiceInput.length < 10) {
      setInvoiceError('Please provide at least 10 characters of client/project info')
      return
    }
    setInvoiceLoading(true)
    setInvoiceError('')
    setInvoiceResult(null)
    try {
      const r = await fetch(`${API}/api/invoice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, input_text: invoiceInput }),
      })
      if (!r.ok) {
        const err = await r.json()
        setInvoiceError(err.detail || 'Generation failed')
        return
      }
      const data = await r.json()
      setInvoiceResult(data)
      loadInvoiceCredits()
    } catch (e: unknown) {
      setInvoiceError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setInvoiceLoading(false)
    }
  }

  function downloadPdf() {
    if (!invoiceResult?.pdf_base64) return
    const bytes = Uint8Array.from(atob(invoiceResult.pdf_base64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const invNum = (invoiceResult.invoice_data as Record<string, string>).invoice_number || invoiceResult.invoice_id.slice(0, 8)
    a.href = url
    a.download = `invoice-${invNum}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tierColors: Record<string, string> = {
    basic: '#64748b', starter: '#38bdf8', pro: '#a78bfa', premium: '#f59e0b'
  }

  /* ── Loading Screen ── */
  if (sessionLoading) {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, color: 'var(--accent)' }}>
            {Icons.zap}
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>Forge Agent</span>
          </div>
        </div>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </main>
    )
  }

  /* ────────────────────────────────────────
     AUTH VIEW (not signed in)
     ──────────────────────────────────────── */
  if (!user) {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {/* Hero */}
        <div className="animate-fade-in" style={{ textAlign: 'center', paddingTop: 48, marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16, color: 'var(--accent)' }}>
            {Icons.zap}
            <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              AI-Powered Platform
            </span>
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 800, margin: '0 0 12px',
            letterSpacing: '-1px', lineHeight: 1.1,
            background: 'linear-gradient(135deg, #f0f4f8, #38bdf8, #a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundSize: '200% 200%', animation: 'gradientShift 6s ease infinite',
          }}>
            Build, Deploy &<br />Invoice with AI
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 18, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            Code generation, Cloudflare deployment pipeline, and smart invoice creation — all in one platform.
          </p>
        </div>

        {/* Auth Form */}
        <div className="glass animate-fade-in-up" style={{ maxWidth: 440, margin: '0 auto 56px', padding: 28 }}>
          <div className="tab-bar" style={{ marginBottom: 20 }}>
            <button
              onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthSuccess('') }}
              className={`tab-btn ${authMode === 'signin' ? 'active' : ''}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthSuccess('') }}
              className={`tab-btn ${authMode === 'signup' ? 'active' : ''}`}
            >
              Sign Up
            </button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <input
              value={authEmail} onChange={e => setAuthEmail(e.target.value)}
              className="input" placeholder="your@email.com" type="email"
              onKeyDown={e => e.key === 'Enter' && (authMode === 'signin' ? handleSignIn() : handleSignUp())}
            />
            <input
              value={authPassword} onChange={e => setAuthPassword(e.target.value)}
              className="input" placeholder="Password" type="password"
              onKeyDown={e => e.key === 'Enter' && (authMode === 'signin' ? handleSignIn() : handleSignUp())}
            />
            {authMode === 'signup' && (
              <input
                value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)}
                className="input" placeholder="Confirm password" type="password"
                onKeyDown={e => e.key === 'Enter' && handleSignUp()}
              />
            )}

            {authError && (
              <div style={{
                color: 'var(--danger)', fontSize: 13, padding: '10px 14px',
                background: 'var(--danger-glow)', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}>
                {authError}
              </div>
            )}
            {authSuccess && (
              <div style={{
                color: 'var(--success)', fontSize: 13, padding: '10px 14px',
                background: 'var(--success-glow)', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
              }}>
                {authSuccess}
              </div>
            )}

            <button
              onClick={authMode === 'signin' ? handleSignIn : handleSignUp}
              disabled={authLoading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px 20px', fontSize: 15 }}
            >
              {authLoading && <span className="spinner" style={{ width: 16, height: 16 }} />}
              {authLoading ? 'Please wait...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Choose a Plan</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>Start building with AI today</p>
        </div>
        <PricingGrid plans={plans} tierColors={tierColors} onCheckout={startCheckout} />
      </main>
    )
  }

  /* ────────────────────────────────────────
     PRICING VIEW (signed in, no subscription)
     ──────────────────────────────────────── */
  if (!subscription?.subscribed) {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <NavBar user={user} subscription={null} onSignOut={handleSignOut} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Checking subscription...</p>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div style={{ textAlign: 'center', margin: '40px 0 28px' }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Choose a Plan</h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Select a plan to unlock the builder</p>
            </div>
            <PricingGrid plans={plans} tierColors={tierColors} onCheckout={startCheckout} />
          </div>
        )}
      </main>
    )
  }

  /* ────────────────────────────────────────
     BUILDER VIEW (subscribed or admin)
     ──────────────────────────────────────── */
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <NavBar
        user={user}
        subscription={subscription}
        tierColors={tierColors}
        onSignOut={handleSignOut}
        onManagePlan={openPortal}
      />

      {/* Tab Navigation */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        <button
          onClick={() => setBuilderTab('builder')}
          className={`tab-btn ${builderTab === 'builder' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {Icons.code} Code Builder
        </button>
        <button
          onClick={() => { setBuilderTab('invoice'); loadInvoiceCredits() }}
          className={`tab-btn ${builderTab === 'invoice' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {Icons.fileText} Invoice Generator
        </button>
      </div>

      {builderTab === 'builder' ? (
        <div className="animate-fade-in">
          {/* Build Form */}
          <div className="glass" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  App Name
                </label>
                <input value={appName} onChange={e => setAppName(e.target.value)} className="input" placeholder="my-awesome-app" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Prompt
                </label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={5} className="input"
                  placeholder="Describe what you want to build..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  AI Model
                </label>
                <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="input">
                  {['Free Models', 'Go Plan'].map(group => {
                    const groupModels = models.filter(m => m.group === group)
                    if (groupModels.length === 0) return null
                    return (
                      <optgroup key={group} label={group}>
                        {groupModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
              <button onClick={submit} className="btn btn-primary" style={{ width: '100%' }}>
                {Icons.zap} Queue Build
              </button>
            </div>
          </div>

          {result && (
            <pre style={{
              marginBottom: 20, padding: 16, borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              overflowX: 'auto', fontSize: 13, color: 'var(--text-secondary)',
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}

          {/* Job List */}
          <div style={{ display: 'grid', gap: 10 }}>
            {jobs.map(j => (
              <div key={j.id} className="glass" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusDot status={j.status} />
                    <strong style={{ fontSize: 15 }}>{j.app_name}</strong>
                  </div>
                  {j.model && (
                    <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      {j.model}
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 13 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                    <span style={{
                      color: j.status === 'complete' ? 'var(--success)' : j.status === 'failed' ? 'var(--danger)' : 'var(--accent)',
                      fontWeight: 500,
                    }}>
                      {j.status}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>PR: </span>
                    {j.pr_url ? (
                      <a href={j.pr_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        View PR {Icons.externalLink}
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>}
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Deploy: </span>
                    {j.deployment_url ? (
                      <a href={`https://${j.deployment_url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        {j.deployment_url} {Icons.externalLink}
                      </a>
                    ) : <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>}
                  </div>
                </div>
              </div>
            ))}
            {jobs.length === 0 && (
              <div className="glass" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{Icons.code}</div>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No builds yet. Create your first one above!</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          {/* Invoice Generator */}
          <div className="glass" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>AI Invoice Generator</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                  Paste client &amp; project details. AI structures the data and generates a professional PDF.
                </p>
              </div>
              {invoiceCredits && (
                <div className="badge" style={{
                  background: 'var(--accent-glow)', color: 'var(--accent)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap',
                }}>
                  {Icons.creditCard}
                  {invoiceCredits.credits_remaining === 'unlimited' ? 'Unlimited' : `${invoiceCredits.credits_remaining} credits`}
                </div>
              )}
            </div>

            <textarea
              value={invoiceInput}
              onChange={e => setInvoiceInput(e.target.value)}
              rows={10}
              className="input"
              placeholder={`Example:\nBill from: Acme Web Studio, 123 Main St, Springfield IL\nBill to: Client Corp, 456 Oak Ave, Chicago IL\n\nProject: E-commerce website redesign\n- UI/UX Design: 20 hours @ $150/hr\n- Frontend Development: 40 hours @ $175/hr\n- Backend API: 30 hours @ $175/hr\n- QA Testing: 10 hours @ $100/hr\n\nDue: Net 30\nNotes: Thank you for your business!`}
              style={{ marginBottom: 14 }}
            />

            {invoiceError && (
              <div style={{
                color: 'var(--danger)', fontSize: 13, padding: '10px 14px', marginBottom: 14,
                background: 'var(--danger-glow)', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}>
                {invoiceError}
              </div>
            )}

            <button
              onClick={generateInvoice}
              disabled={invoiceLoading}
              className="btn btn-success"
              style={{ width: '100%' }}
            >
              {invoiceLoading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> Generating...</>
              ) : (
                <>{Icons.zap} Generate Invoice (1 credit)</>
              )}
            </button>
          </div>

          {/* Invoice Result */}
          {invoiceResult && (
            <div className="glass animate-fade-in-up" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Invoice Generated</h3>
                <button onClick={downloadPdf} className="btn btn-primary" style={{ padding: '10px 18px' }}>
                  {Icons.download} Download PDF
                </button>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16,
                background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', marginBottom: 16,
              }}>
                <InfoCell label="Invoice #" value={(invoiceResult.invoice_data as Record<string, string>).invoice_number} />
                <InfoCell label="Due Date" value={(invoiceResult.invoice_data as Record<string, string>).due_date} />
                <InfoCell label="From" value={(invoiceResult.invoice_data as Record<string, string>).from_name} />
                <InfoCell label="To" value={(invoiceResult.invoice_data as Record<string, string>).to_name} />
              </div>

              {Array.isArray((invoiceResult.invoice_data as Record<string, unknown>).line_items) && (
                <div style={{
                  background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: 16,
                }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8,
                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    <span>Description</span><span>Qty x Price</span><span style={{ textAlign: 'right' }}>Amount</span>
                  </div>
                  {((invoiceResult.invoice_data as Record<string, unknown>).line_items as Array<{description: string; quantity: number; unit_price: number}>).map((item, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
                      padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 14,
                    }}>
                      <span style={{ color: 'var(--text-primary)' }}>{item.description}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{item.quantity} x ${item.unit_price.toFixed(2)}</span>
                      <span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        ${(item.quantity * item.unit_price).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', padding: '14px 0 4px',
                    borderTop: '2px solid var(--border-bright)', marginTop: 4,
                    fontSize: 18, fontWeight: 700, color: 'var(--accent)',
                  }}>
                    <span>Total</span>
                    <span>
                      ${((invoiceResult.invoice_data as Record<string, unknown>).line_items as Array<{quantity: number; unit_price: number}>)
                        .reduce((s, it) => s + it.quantity * it.unit_price, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'right' }}>
                Credits remaining: {invoiceResult.credits_remaining === 'unlimited' ? 'Unlimited' : invoiceResult.credits_remaining}
              </div>
            </div>
          )}

          {!invoiceResult && (
            <div className="glass" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{Icons.fileText}</div>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Your generated invoice will appear here
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

/* ── Sub-components ── */

function NavBar({
  user, subscription, tierColors, onSignOut, onManagePlan,
}: {
  user: User
  subscription: Subscription | null
  tierColors?: Record<string, string>
  onSignOut: () => void
  onManagePlan?: () => void
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--accent)', display: 'flex' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>Forge Agent</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>AI Code &amp; Invoice Platform</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {subscription?.is_admin ? (
          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            Admin
          </span>
        ) : subscription?.tier && tierColors ? (
          <span className="badge" style={{
            background: `color-mix(in srgb, ${tierColors[subscription.tier]} 15%, transparent)`,
            color: tierColors[subscription.tier],
            border: `1px solid color-mix(in srgb, ${tierColors[subscription.tier]} 25%, transparent)`,
          }}>
            {subscription.tier}
          </span>
        ) : null}
        <span className="hide-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user.email}</span>
        {onManagePlan && subscription && !subscription.is_admin && (
          <button onClick={onManagePlan} className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }}>
            {Icons.settings} <span className="hide-mobile">Manage</span>
          </button>
        )}
        <button onClick={onSignOut} className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }}>
          {Icons.logOut} <span className="hide-mobile">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

function PricingGrid({
  plans, tierColors, onCheckout,
}: {
  plans: Plan[]
  tierColors: Record<string, string>
  onCheckout: (tier: string) => void
}) {
  return (
    <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
      {plans.map((plan, idx) => (
        <div
          key={plan.tier}
          className={`pricing-card tier-${plan.tier} animate-fade-in-up`}
          style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
        >
          {plan.tier === 'pro' && (
            <div style={{
              position: 'absolute', top: 12, right: 12,
              background: 'var(--pro)', color: '#0f172a', padding: '3px 10px',
              borderRadius: 'var(--radius-full)', fontSize: 10, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Popular
            </div>
          )}
          <h3 style={{ margin: '4px 0 8px', color: 'var(--tier-color)', fontSize: 18, fontWeight: 700 }}>
            {plan.name}
          </h3>
          <div style={{ fontSize: 40, fontWeight: 800, margin: '4px 0 4px', letterSpacing: '-1px' }}>
            ${(plan.amount / 100).toFixed(2)}
            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {plan.builds_per_month === -1 ? 'Unlimited builds' : `${plan.builds_per_month} builds/month`}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
            {plan.features.map((f, i) => (
              <li key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0',
                fontSize: 13, color: 'var(--text-secondary)',
              }}>
                <span style={{ color: 'var(--tier-color)', flexShrink: 0, marginTop: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => onCheckout(plan.tier)}
            className="btn"
            style={{
              width: '100%',
              background: `linear-gradient(135deg, ${tierColors[plan.tier]}, color-mix(in srgb, ${tierColors[plan.tier]} 70%, #fff))`,
              color: '#0f172a', fontWeight: 700,
              boxShadow: `0 2px 12px color-mix(in srgb, ${tierColors[plan.tier]} 30%, transparent)`,
            }}
          >
            Get {plan.name}
          </button>
        </div>
      ))}
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
        {value || '\u2014'}
      </div>
    </div>
  )
}
