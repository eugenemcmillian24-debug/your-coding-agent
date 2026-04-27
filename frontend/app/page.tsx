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
  const [result, setResult] = useState<any>(null)

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

    // Check for existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        checkSubscription(session.user.email || '')
      }
      setSessionLoading(false)
    })

    // Listen for auth state changes
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
          // Auto-confirmed (e.g. when email confirmation is disabled)
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

  // Show loading while checking session
  if (sessionLoading) {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 42, marginBottom: 8 }}>Forge Agent</h1>
        <p style={{ color: '#94a3b8' }}>Loading...</p>
      </main>
    )
  }

  // ── Auth View (not signed in) ──
  if (!user) {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 42, marginBottom: 8 }}>Forge Agent</h1>
          <p style={{ color: '#94a3b8', fontSize: 18 }}>AI-powered code generation & deployment pipeline</p>
        </div>

        {/* Auth form */}
        <div style={{ ...card, maxWidth: 420, margin: '0 auto 40px' }}>
          {/* Tab toggle */}
          <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1px solid #334155' }}>
            <button
              onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthSuccess('') }}
              style={{
                ...tabBtn,
                background: authMode === 'signin' ? '#1e293b' : 'transparent',
                color: authMode === 'signin' ? '#e2e8f0' : '#64748b',
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthSuccess('') }}
              style={{
                ...tabBtn,
                background: authMode === 'signup' ? '#1e293b' : 'transparent',
                color: authMode === 'signup' ? '#e2e8f0' : '#64748b',
              }}
            >
              Sign Up
            </button>
          </div>

          <input
            value={authEmail}
            onChange={e => setAuthEmail(e.target.value)}
            style={field}
            placeholder="your@email.com"
            type="email"
            onKeyDown={e => e.key === 'Enter' && (authMode === 'signin' ? handleSignIn() : handleSignUp())}
          />

          <input
            value={authPassword}
            onChange={e => setAuthPassword(e.target.value)}
            style={field}
            placeholder="Password"
            type="password"
            onKeyDown={e => e.key === 'Enter' && (authMode === 'signin' ? handleSignIn() : handleSignUp())}
          />

          {authMode === 'signup' && (
            <input
              value={authConfirmPassword}
              onChange={e => setAuthConfirmPassword(e.target.value)}
              style={field}
              placeholder="Confirm password"
              type="password"
              onKeyDown={e => e.key === 'Enter' && handleSignUp()}
            />
          )}

          {authError && (
            <div style={{ color: '#ef4444', fontSize: 14, padding: '8px 12px', background: '#1c1917', borderRadius: 8 }}>
              {authError}
            </div>
          )}

          {authSuccess && (
            <div style={{ color: '#22c55e', fontSize: 14, padding: '8px 12px', background: '#052e16', borderRadius: 8 }}>
              {authSuccess}
            </div>
          )}

          <button
            onClick={authMode === 'signin' ? handleSignIn : handleSignUp}
            disabled={authLoading}
            style={{ ...btn, width: '100%' }}
          >
            {authLoading ? 'Please wait...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        {/* Plan cards (visible even before sign in for marketing) */}
        <h2 style={{ textAlign: 'center', marginBottom: 24, color: '#94a3b8' }}>Choose a Plan</h2>
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
                    {f}
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

  // ── Pricing View (signed in but no subscription) ──
  if (!subscription?.subscribed) {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 42, marginBottom: 8 }}>Forge Agent</h1>
            <p style={{ color: '#94a3b8', fontSize: 18 }}>AI-powered code generation & deployment pipeline</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{user.email}</span>
            <button onClick={handleSignOut} style={{ ...btn, background: '#334155', fontSize: 13, padding: '6px 12px' }}>
              Sign Out
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8' }}>Checking subscription...</p>
        ) : (
          <>
            <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 24 }}>
              Choose a plan to get started
            </p>
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
                        {f}
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
          </>
        )}
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
            }}>Admin</span>
          ) : (
            <span style={{
              background: tierColors[subscription?.tier || 'basic'], color: '#0f172a',
              padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              textTransform: 'uppercase',
            }}>{subscription?.tier}</span>
          )}
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{user.email}</span>
          {!subscription?.is_admin && (
            <button onClick={openPortal} style={{ ...btn, background: '#334155', fontSize: 13, padding: '6px 12px' }}>
              Manage Plan
            </button>
          )}
          <button onClick={handleSignOut} style={{ ...btn, background: '#475569', fontSize: 13, padding: '6px 12px' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1px solid #334155', marginBottom: 20 }}>
        <button
          onClick={() => setBuilderTab('builder')}
          style={{
            ...tabBtn,
            background: builderTab === 'builder' ? '#1e293b' : 'transparent',
            color: builderTab === 'builder' ? '#e2e8f0' : '#64748b',
          }}
        >
          Code Builder
        </button>
        <button
          onClick={() => { setBuilderTab('invoice'); loadInvoiceCredits() }}
          style={{
            ...tabBtn,
            background: builderTab === 'invoice' ? '#1e293b' : 'transparent',
            color: builderTab === 'invoice' ? '#e2e8f0' : '#64748b',
          }}
        >
          Invoice Generator
        </button>
      </div>

      {builderTab === 'builder' ? (
        <>
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
                    <optgroup key={group} label={`${group === 'Free Models' ? 'Free' : 'Go'} ${group}`}>
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
        </>
      ) : (
        <>
          {/* Invoice Generator */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 20, color: '#e2e8f0' }}>AI Invoice Generator</h2>
              {invoiceCredits && (
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  Credits: <strong style={{ color: '#38bdf8' }}>
                    {invoiceCredits.credits_remaining === 'unlimited' ? 'Unlimited' : invoiceCredits.credits_remaining}
                  </strong>
                  {invoiceCredits.credits_used > 0 && ` (${invoiceCredits.credits_used} used this month)`}
                </span>
              )}
            </div>

            <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
              Paste your client and project details below. AI will structure the data and generate a professional PDF invoice.
            </p>

            <textarea
              value={invoiceInput}
              onChange={e => setInvoiceInput(e.target.value)}
              rows={10}
              style={field}
              placeholder={`Example:\nBill from: Acme Web Studio, 123 Main St, Springfield IL\nBill to: Client Corp, 456 Oak Ave, Chicago IL\n\nProject: E-commerce website redesign\n- UI/UX Design: 20 hours @ $150/hr\n- Frontend Development: 40 hours @ $175/hr\n- Backend API: 30 hours @ $175/hr\n- QA Testing: 10 hours @ $100/hr\n\nDue: Net 30\nNotes: Thank you for your business!`}
            />

            {invoiceError && (
              <div style={{ color: '#ef4444', fontSize: 14, padding: '8px 12px', background: '#1c1917', borderRadius: 8 }}>
                {invoiceError}
              </div>
            )}

            <button
              onClick={generateInvoice}
              disabled={invoiceLoading}
              style={{ ...btn, background: '#22c55e', color: '#fff' }}
            >
              {invoiceLoading ? 'Generating invoice...' : 'Generate Invoice (1 credit)'}
            </button>
          </div>

          {invoiceResult && (
            <div style={{ ...card, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#e2e8f0' }}>Invoice Generated</h3>
                <button onClick={downloadPdf} style={{ ...btn, background: '#38bdf8' }}>
                  Download PDF
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Invoice #</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{(invoiceResult.invoice_data as Record<string, string>).invoice_number}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Due Date</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{(invoiceResult.invoice_data as Record<string, string>).due_date}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>From</div>
                  <div style={{ color: '#e2e8f0' }}>{(invoiceResult.invoice_data as Record<string, string>).from_name}</div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>To</div>
                  <div style={{ color: '#e2e8f0' }}>{(invoiceResult.invoice_data as Record<string, string>).to_name}</div>
                </div>
              </div>

              {Array.isArray((invoiceResult.invoice_data as Record<string, unknown>).line_items) && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Line Items</div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {((invoiceResult.invoice_data as Record<string, unknown>).line_items as Array<{description: string; quantity: number; unit_price: number}>).map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#cbd5e1', padding: '4px 0', borderBottom: '1px solid #1e293b' }}>
                        <span>{item.description}</span>
                        <span>{item.quantity} x ${item.unit_price.toFixed(2)} = ${(item.quantity * item.unit_price).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#38bdf8', padding: '8px 0' }}>
                      <span>Total</span>
                      <span>${((invoiceResult.invoice_data as Record<string, unknown>).line_items as Array<{quantity: number; unit_price: number}>).reduce((s, it) => s + it.quantity * it.unit_price, 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                Credits remaining: {invoiceResult.credits_remaining === 'unlimited' ? 'Unlimited' : invoiceResult.credits_remaining}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}

const card: React.CSSProperties = { display: 'grid', gap: 12, background: '#0f172a', padding: 20, borderRadius: 16 }
const field: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 12, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', fontSize: 14 }
const btn: React.CSSProperties = { padding: '12px 18px', borderRadius: 12, border: 'none', background: '#38bdf8', color: '#04121a', fontWeight: 700, cursor: 'pointer', fontSize: 15 }
const tabBtn: React.CSSProperties = { flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }
const pre: React.CSSProperties = { marginTop: 20, padding: 16, borderRadius: 16, background: '#020617', overflowX: 'auto' }
