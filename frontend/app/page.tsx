'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

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
  const [appName, setAppName] = useState('Real Integration Builder')
  const [prompt, setPrompt] = useState('Build and deploy a real integrated app.')
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [result, setResult] = useState<any>(null)

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
    </main>
  )
}

const card: React.CSSProperties = { display: 'grid', gap: 12, background: '#0f172a', padding: 20, borderRadius: 16 }
const field: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 12, border: '1px solid #334155', background: '#020617', color: '#e2e8f0', fontSize: 14 }
const btn: React.CSSProperties = { padding: '12px 18px', borderRadius: 12, border: 'none', background: '#38bdf8', color: '#04121a', fontWeight: 700, cursor: 'pointer', fontSize: 15 }
const tabBtn: React.CSSProperties = { flex: 1, padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }
const pre: React.CSSProperties = { marginTop: 20, padding: 16, borderRadius: 16, background: '#020617', overflowX: 'auto' }
