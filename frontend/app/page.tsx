'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
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
type Template = { id: string; name: string; description: string; icon: string }
type Workspace = {
  id: string; name: string; files: Record<string, string>;
  chat_history: { role: string; content: string }[];
  created_at: string; updated_at: string;
}
type ChatMessage = { role: 'user' | 'assistant'; content: string }

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
  play: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  send: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  folder: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  eye: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  arrowLeft: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  layout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  grid: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  shoppingCart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  checkSquare: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  file: Icons.fileText,
  layout: Icons.layout,
  grid: Icons.grid,
  user: Icons.user,
  'shopping-cart': Icons.shoppingCart,
  'check-square': Icons.checkSquare,
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

  // Main tab
  const [builderTab, setBuilderTab] = useState<'workspace' | 'builder' | 'invoice'>('workspace')

  // Builder state
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

  // Workspace state
  const [templates, setTemplates] = useState<Template[]>([])
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; created_at: string; updated_at: string }[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [activeFile, setActiveFile] = useState<string>('index.html')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    fetch(`${API}/api/stripe/plans`).then(r => r.json()).then(setPlans).catch(() => {})

    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success') setView('builder')

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
          setUser(null); setSubscription(null); setView('pricing')
        }
      }
    )
    return () => { authSub.unsubscribe() }
  }, [])

  useEffect(() => {
    if (subscription?.subscribed) {
      setView('builder')
      loadModels(); loadJobs(); loadInvoiceCredits()
      loadTemplates(); loadWorkspaces()
      const t = setInterval(loadJobs, 4000)
      return () => clearInterval(t)
    }
  }, [subscription])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, streamingText])

  // Update preview when workspace files change
  const updatePreview = useCallback(() => {
    if (!activeWorkspace || !iframeRef.current) return
    const files = activeWorkspace.files
    const html = files['index.html'] || '<html><body><p>No index.html</p></body></html>'
    const css = files['style.css'] || ''
    const js = files['main.js'] || ''
    const doc = html
      .replace('</head>', `<style>${css}</style></head>`)
      .replace('</body>', `<script>${js}<\/script></body>`)
    iframeRef.current.srcdoc = doc
  }, [activeWorkspace])

  useEffect(() => {
    updatePreview()
  }, [updatePreview])

  async function checkSubscription(email: string) {
    if (!email) return
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/stripe/subscription/${encodeURIComponent(email)}`)
      setSubscription(await r.json())
    } finally { setLoading(false) }
  }

  async function handleSignIn() {
    if (!authEmail || !authPassword) { setAuthError('Email and password are required'); return }
    setAuthLoading(true); setAuthError(''); setAuthSuccess('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      if (error) setAuthError(error.message)
      else if (data.user) { setAuthEmail(''); setAuthPassword('') }
    } finally { setAuthLoading(false) }
  }

  async function handleSignUp() {
    if (!authEmail || !authPassword) { setAuthError('Email and password are required'); return }
    if (authPassword.length < 6) { setAuthError('Password must be at least 6 characters'); return }
    if (authPassword !== authConfirmPassword) { setAuthError('Passwords do not match'); return }
    setAuthLoading(true); setAuthError(''); setAuthSuccess('')
    try {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
      if (error) setAuthError(error.message)
      else if (data.user) {
        if (data.user.identities?.length === 0) {
          setAuthError('An account with this email already exists. Please sign in instead.')
        } else if (data.session) {
          setAuthEmail(''); setAuthPassword(''); setAuthConfirmPassword('')
        } else {
          setAuthSuccess('Account created! Check your email to confirm, then sign in.')
          setAuthMode('signin'); setAuthPassword(''); setAuthConfirmPassword('')
        }
      }
    } finally { setAuthLoading(false) }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null); setSubscription(null); setView('pricing'); setJobs([]); setResult(null)
    setActiveWorkspace(null); setChatMessages([])
  }

  async function startCheckout(tier: string) {
    if (!user?.email) { alert('Please sign in first'); return }
    const r = await fetch(`${API}/api/stripe/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, email: user.email }),
    })
    const data = await r.json()
    if (data.checkout_url) window.location.href = data.checkout_url
    else if (data.detail) alert(data.detail)
  }

  async function openPortal() {
    if (!subscription?.customer_id) return
    const r = await fetch(`${API}/api/stripe/portal`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_name: appName, prompt, provider: 'opencode-go', model: selectedModel || undefined }),
    })
    setResult(await r.json()); loadJobs()
  }

  async function loadInvoiceCredits() {
    if (!user?.email) return
    try {
      const r = await fetch(`${API}/api/invoice/credits/${encodeURIComponent(user.email)}`)
      setInvoiceCredits(await r.json())
    } catch { /* ignore */ }
  }

  async function generateInvoice() {
    if (!user?.email) return
    if (invoiceInput.length < 10) { setInvoiceError('Please provide at least 10 characters of client/project info'); return }
    setInvoiceLoading(true); setInvoiceError(''); setInvoiceResult(null)
    try {
      const r = await fetch(`${API}/api/invoice/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, input_text: invoiceInput }),
      })
      if (!r.ok) { const err = await r.json(); setInvoiceError(err.detail || 'Generation failed'); return }
      const data = await r.json()
      setInvoiceResult(data); loadInvoiceCredits()
    } catch (e: unknown) { setInvoiceError(e instanceof Error ? e.message : 'Network error') }
    finally { setInvoiceLoading(false) }
  }

  function downloadPdf() {
    if (!invoiceResult?.pdf_base64) return
    const bytes = Uint8Array.from(atob(invoiceResult.pdf_base64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const invNum = (invoiceResult.invoice_data as Record<string, string>).invoice_number || invoiceResult.invoice_id.slice(0, 8)
    a.href = url; a.download = `invoice-${invNum}.pdf`; a.click(); URL.revokeObjectURL(url)
  }

  // ── Workspace functions ──

  async function loadTemplates() {
    try {
      const r = await fetch(`${API}/api/workspace/templates`)
      setTemplates(await r.json())
    } catch { /* ignore */ }
  }

  async function loadWorkspaces() {
    if (!user?.email) return
    try {
      const r = await fetch(`${API}/api/workspace/list/${encodeURIComponent(user.email)}`)
      setWorkspaces(await r.json())
    } catch { /* ignore */ }
  }

  async function createWorkspace(templateId?: string) {
    if (!user?.email) return
    const name = templateId ? `${templateId}-project` : 'untitled-project'
    try {
      const r = await fetch(`${API}/api/workspace/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name, template_id: templateId }),
      })
      const ws = await r.json()
      setActiveWorkspace(ws)
      setActiveFile(Object.keys(ws.files)[0] || 'index.html')
      setChatMessages([])
      loadWorkspaces()
    } catch (e) { console.error('Failed to create workspace:', e) }
  }

  async function openWorkspace(id: string) {
    try {
      const r = await fetch(`${API}/api/workspace/${id}`)
      const ws = await r.json()
      setActiveWorkspace(ws)
      setActiveFile(Object.keys(ws.files)[0] || 'index.html')
      setChatMessages(ws.chat_history?.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })) || [])
    } catch (e) { console.error('Failed to open workspace:', e) }
  }

  async function deleteWorkspace(id: string) {
    try {
      await fetch(`${API}/api/workspace/${id}`, { method: 'DELETE' })
      if (activeWorkspace?.id === id) { setActiveWorkspace(null); setChatMessages([]) }
      loadWorkspaces()
    } catch { /* ignore */ }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || !activeWorkspace || !user?.email || isStreaming) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: msg }])
    setIsStreaming(true)
    setStreamingText('')

    try {
      const r = await fetch(`${API}/api/workspace/${activeWorkspace.id}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, message: msg, model: selectedModel || undefined }),
      })

      if (!r.ok) {
        const err = await r.json()
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.detail || 'Failed'}` }])
        setIsStreaming(false)
        return
      }

      const reader = r.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'token') {
                accumulated += data.content
                setStreamingText(accumulated)
              } else if (data.type === 'files') {
                setActiveWorkspace(prev => prev ? { ...prev, files: data.files } : prev)
                setActiveFile(Object.keys(data.files)[0] || 'index.html')
              } else if (data.type === 'done') {
                // done
              }
            } catch { /* skip malformed lines */ }
          }
        }
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: accumulated || 'Done' }])
      setStreamingText('')
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Network error'}` }])
    } finally {
      setIsStreaming(false)
    }
  }

  async function generateFromPrompt(prompt: string) {
    if (!activeWorkspace || !user?.email || isStreaming) return
    setChatMessages(prev => [...prev, { role: 'user', content: prompt }])
    setIsStreaming(true)
    setStreamingText('')

    try {
      const r = await fetch(`${API}/api/workspace/${activeWorkspace.id}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, prompt, model: selectedModel || undefined }),
      })

      if (!r.ok) {
        const err = await r.json()
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.detail || 'Failed'}` }])
        setIsStreaming(false)
        return
      }

      const reader = r.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'token') {
                accumulated += data.content
                setStreamingText(accumulated)
              } else if (data.type === 'files') {
                setActiveWorkspace(prev => prev ? { ...prev, files: data.files } : prev)
                setActiveFile(Object.keys(data.files)[0] || 'index.html')
              }
            } catch { /* skip */ }
          }
        }
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: accumulated || 'Done' }])
      setStreamingText('')
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : 'Network error'}` }])
    } finally {
      setIsStreaming(false)
    }
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

  /* ── AUTH VIEW ── */
  if (!user) {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <div className="animate-fade-in" style={{ textAlign: 'center', paddingTop: 48, marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16, color: 'var(--accent)' }}>
            {Icons.zap}
            <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px' }}>AI-Powered Platform</span>
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
            Live preview, real-time streaming, and smart invoice creation — all in one platform.
          </p>
        </div>

        <div className="glass animate-fade-in-up" style={{ maxWidth: 440, margin: '0 auto 56px', padding: 28 }}>
          <div className="tab-bar" style={{ marginBottom: 20 }}>
            <button onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthSuccess('') }} className={`tab-btn ${authMode === 'signin' ? 'active' : ''}`}>Sign In</button>
            <button onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthSuccess('') }} className={`tab-btn ${authMode === 'signup' ? 'active' : ''}`}>Sign Up</button>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <input value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="input" placeholder="your@email.com" type="email"
              onKeyDown={e => e.key === 'Enter' && (authMode === 'signin' ? handleSignIn() : handleSignUp())} />
            <input value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="input" placeholder="Password" type="password"
              onKeyDown={e => e.key === 'Enter' && (authMode === 'signin' ? handleSignIn() : handleSignUp())} />
            {authMode === 'signup' && (
              <input value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} className="input" placeholder="Confirm password" type="password"
                onKeyDown={e => e.key === 'Enter' && handleSignUp()} />
            )}
            {authError && <div style={{ color: 'var(--danger)', fontSize: 13, padding: '10px 14px', background: 'var(--danger-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{authError}</div>}
            {authSuccess && <div style={{ color: 'var(--success)', fontSize: 13, padding: '10px 14px', background: 'var(--success-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>{authSuccess}</div>}
            <button onClick={authMode === 'signin' ? handleSignIn : handleSignUp} disabled={authLoading} className="btn btn-primary" style={{ width: '100%', padding: '14px 20px', fontSize: 15 }}>
              {authLoading && <span className="spinner" style={{ width: 16, height: 16 }} />}
              {authLoading ? 'Please wait...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Choose a Plan</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 15 }}>Start building with AI today</p>
        </div>
        <PricingGrid plans={plans} tierColors={tierColors} onCheckout={startCheckout} />
      </main>
    )
  }

  /* ── PRICING VIEW ── */
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

  /* ── BUILDER VIEW ── */
  return (
    <main style={{ maxWidth: builderTab === 'workspace' && activeWorkspace ? undefined : 1100, margin: '0 auto', padding: builderTab === 'workspace' && activeWorkspace ? '0' : 24, height: builderTab === 'workspace' && activeWorkspace ? '100vh' : 'auto' }}>
      {/* Only show NavBar when not in active workspace (workspace has its own header) */}
      {!(builderTab === 'workspace' && activeWorkspace) && (
        <>
          <NavBar user={user} subscription={subscription} tierColors={tierColors} onSignOut={handleSignOut} onManagePlan={openPortal} />
          <div className="tab-bar" style={{ marginBottom: 24 }}>
            <button onClick={() => setBuilderTab('workspace')} className={`tab-btn ${builderTab === 'workspace' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {Icons.layout} Workspace
            </button>
            <button onClick={() => setBuilderTab('builder')} className={`tab-btn ${builderTab === 'builder' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {Icons.code} Code Builder
            </button>
            <button onClick={() => { setBuilderTab('invoice'); loadInvoiceCredits() }} className={`tab-btn ${builderTab === 'invoice' ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {Icons.fileText} Invoice
            </button>
          </div>
        </>
      )}

      {/* ══════ WORKSPACE TAB ══════ */}
      {builderTab === 'workspace' && !activeWorkspace && (
        <div className="animate-fade-in">
          {/* Template Gallery */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Start a New Project</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>Choose a template or start from scratch</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              {templates.map((t, idx) => (
                <button key={t.id} onClick={() => createWorkspace(t.id)} className="glass animate-fade-in-up"
                  style={{ animationDelay: `${idx * 60}ms`, animationFillMode: 'both', padding: 20, border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left', background: 'none' }}>
                  <div style={{ color: 'var(--accent)', marginBottom: 10 }}>
                    {TEMPLATE_ICONS[t.icon] || Icons.fileText}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: 'var(--text-primary)' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Workspaces */}
          {workspaces.length > 0 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Recent Projects</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>Continue where you left off</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {workspaces.map(ws => (
                  <div key={ws.id} className="glass" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => openWorkspace(ws.id)}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{ws.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        Last edited {new Date(ws.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openWorkspace(ws.id)} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>Open</button>
                      <button onClick={() => deleteWorkspace(ws.id)} className="btn btn-danger" style={{ padding: '8px 12px', fontSize: 13 }}>{Icons.trash}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ ACTIVE WORKSPACE ══════ */}
      {builderTab === 'workspace' && activeWorkspace && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          {/* Workspace Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setActiveWorkspace(null)} className="btn btn-ghost" style={{ padding: '6px 10px' }}>{Icons.arrowLeft}</button>
              <span style={{ color: 'var(--accent)', display: 'flex' }}>{Icons.zap}</span>
              <strong style={{ fontSize: 15 }}>{activeWorkspace.name}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setShowPreview(!showPreview)} className={`btn ${showPreview ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '6px 12px', fontSize: 12 }}>
                {Icons.eye} Preview
              </button>
              <NavBar user={user} subscription={subscription} tierColors={tierColors} onSignOut={handleSignOut} onManagePlan={openPortal} compact />
            </div>
          </div>

          {/* Main workspace area */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left panel: Chat */}
            <div style={{ width: 360, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                AI Chat
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chatMessages.length === 0 && !isStreaming && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                    <p style={{ marginBottom: 12 }}>Describe what you want to build or change.</p>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {['Build a calculator app', 'Add a dark mode toggle', 'Make the layout responsive'].map(suggestion => (
                        <button key={suggestion} onClick={() => { setChatInput(suggestion); }}
                          style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, lineHeight: 1.5,
                    ...(msg.role === 'user'
                      ? { background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.15)', alignSelf: 'flex-end', maxWidth: '85%' }
                      : { background: 'var(--bg-elevated)', border: '1px solid var(--border)', maxWidth: '90%' }),
                    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                  }}>
                    {msg.role === 'assistant' ? truncateResponse(msg.content) : msg.content}
                  </div>
                ))}
                {isStreaming && streamingText && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border)', maxWidth: '90%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    <div className="animate-pulse" style={{ color: 'var(--accent)', fontSize: 11, marginBottom: 4 }}>Generating...</div>
                    {truncateResponse(streamingText)}
                  </div>
                )}
                {isStreaming && !streamingText && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', color: 'var(--text-muted)', fontSize: 13 }}>
                    <span className="spinner" style={{ width: 14, height: 14 }} /> Thinking...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input
                  value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatInput.trim() && (chatMessages.length === 0 ? generateFromPrompt(chatInput.trim()) : sendChatMessage()) } }}
                  className="input" placeholder="Describe a change..." disabled={isStreaming}
                  style={{ fontSize: 13, padding: '10px 14px' }}
                />
                <button
                  onClick={() => chatInput.trim() && (chatMessages.length === 0 ? generateFromPrompt(chatInput.trim()) : sendChatMessage())}
                  disabled={isStreaming || !chatInput.trim()} className="btn btn-primary"
                  style={{ padding: '10px 14px', flexShrink: 0 }}>
                  {Icons.send}
                </button>
              </div>
            </div>

            {/* Center: File Tree + Code Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* File tabs */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface)', overflowX: 'auto', flexShrink: 0,
              }}>
                {Object.keys(activeWorkspace.files).map(fname => (
                  <button key={fname} onClick={() => setActiveFile(fname)}
                    style={{
                      padding: '10px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, fontWeight: activeFile === fname ? 600 : 400,
                      color: activeFile === fname ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: activeFile === fname ? 'var(--bg-elevated)' : 'transparent',
                      borderBottom: activeFile === fname ? '2px solid var(--accent)' : '2px solid transparent',
                      display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
                    }}>
                    {fname.endsWith('.html') ? Icons.code : fname.endsWith('.css') ? Icons.layout : Icons.fileText}
                    {fname}
                  </button>
                ))}
              </div>

              {/* Code editor + Preview split */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Code area */}
                <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                  <textarea
                    value={activeWorkspace.files[activeFile] || ''}
                    onChange={e => {
                      const newFiles = { ...activeWorkspace.files, [activeFile]: e.target.value }
                      setActiveWorkspace(prev => prev ? { ...prev, files: newFiles } : prev)
                    }}
                    spellCheck={false}
                    style={{
                      width: '100%', height: '100%', resize: 'none', border: 'none', outline: 'none',
                      background: 'var(--bg-base)', color: 'var(--text-primary)',
                      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
                      fontSize: 13, lineHeight: 1.6, padding: 16, tabSize: 2,
                    }}
                  />
                </div>

                {/* Live Preview */}
                {showPreview && (
                  <div style={{ width: '50%', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {Icons.eye} Live Preview
                    </div>
                    <iframe
                      ref={iframeRef}
                      sandbox="allow-scripts allow-same-origin"
                      style={{ flex: 1, border: 'none', background: '#fff', width: '100%' }}
                      title="preview"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ CODE BUILDER TAB ══════ */}
      {builderTab === 'builder' && (
        <div className="animate-fade-in">
          <div className="glass" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>App Name</label>
                <input value={appName} onChange={e => setAppName(e.target.value)} className="input" placeholder="my-awesome-app" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Prompt</label>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={5} className="input" placeholder="Describe what you want to build..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>AI Model</label>
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
              <button onClick={submit} className="btn btn-primary" style={{ width: '100%' }}>{Icons.zap} Queue Build</button>
            </div>
          </div>

          {result && (
            <pre style={{ marginBottom: 20, padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)', overflowX: 'auto', fontSize: 13, color: 'var(--text-secondary)' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {jobs.map(j => (
              <div key={j.id} className="glass" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusDot status={j.status} />
                    <strong style={{ fontSize: 15 }}>{j.app_name}</strong>
                  </div>
                  {j.model && <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{j.model}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 13 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                    <span style={{ color: j.status === 'complete' ? 'var(--success)' : j.status === 'failed' ? 'var(--danger)' : 'var(--accent)', fontWeight: 500 }}>{j.status}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>PR: </span>
                    {j.pr_url ? <a href={j.pr_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>View PR {Icons.externalLink}</a> : <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>}
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Deploy: </span>
                    {j.deployment_url ? <a href={`https://${j.deployment_url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{j.deployment_url} {Icons.externalLink}</a> : <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>}
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
      )}

      {/* ══════ INVOICE TAB ══════ */}
      {builderTab === 'invoice' && (
        <div className="animate-fade-in">
          <div className="glass" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700 }}>AI Invoice Generator</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>Paste client &amp; project details. AI structures the data and generates a professional PDF.</p>
              </div>
              {invoiceCredits && (
                <div className="badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid rgba(56, 189, 248, 0.2)', fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap' }}>
                  {Icons.creditCard}
                  {invoiceCredits.credits_remaining === 'unlimited' ? 'Unlimited' : `${invoiceCredits.credits_remaining} credits`}
                </div>
              )}
            </div>
            <textarea value={invoiceInput} onChange={e => setInvoiceInput(e.target.value)} rows={10} className="input"
              placeholder={`Example:\nBill from: Acme Web Studio, 123 Main St, Springfield IL\nBill to: Client Corp, 456 Oak Ave, Chicago IL\n\nProject: E-commerce website redesign\n- UI/UX Design: 20 hours @ $150/hr\n- Frontend Development: 40 hours @ $175/hr\n- Backend API: 30 hours @ $175/hr\n- QA Testing: 10 hours @ $100/hr\n\nDue: Net 30\nNotes: Thank you for your business!`}
              style={{ marginBottom: 14 }} />
            {invoiceError && <div style={{ color: 'var(--danger)', fontSize: 13, padding: '10px 14px', marginBottom: 14, background: 'var(--danger-glow)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{invoiceError}</div>}
            <button onClick={generateInvoice} disabled={invoiceLoading} className="btn btn-success" style={{ width: '100%' }}>
              {invoiceLoading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Generating...</> : <>{Icons.zap} Generate Invoice (1 credit)</>}
            </button>
          </div>

          {invoiceResult && (
            <div className="glass animate-fade-in-up" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Invoice Generated</h3>
                <button onClick={downloadPdf} className="btn btn-primary" style={{ padding: '10px 18px' }}>{Icons.download} Download PDF</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                <InfoCell label="Invoice #" value={(invoiceResult.invoice_data as Record<string, string>).invoice_number} />
                <InfoCell label="Due Date" value={(invoiceResult.invoice_data as Record<string, string>).due_date} />
                <InfoCell label="From" value={(invoiceResult.invoice_data as Record<string, string>).from_name} />
                <InfoCell label="To" value={(invoiceResult.invoice_data as Record<string, string>).to_name} />
              </div>
              {Array.isArray((invoiceResult.invoice_data as Record<string, unknown>).line_items) && (
                <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <span>Description</span><span>Qty x Price</span><span style={{ textAlign: 'right' }}>Amount</span>
                  </div>
                  {((invoiceResult.invoice_data as Record<string, unknown>).line_items as Array<{description: string; quantity: number; unit_price: number}>).map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{item.description}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{item.quantity} x ${item.unit_price.toFixed(2)}</span>
                      <span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>${(item.quantity * item.unit_price).toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 4px', borderTop: '2px solid var(--border-bright)', marginTop: 4, fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                    <span>Total</span>
                    <span>${((invoiceResult.invoice_data as Record<string, unknown>).line_items as Array<{quantity: number; unit_price: number}>).reduce((s, it) => s + it.quantity * it.unit_price, 0).toFixed(2)}</span>
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
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Your generated invoice will appear here</p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

/* ── Helper ── */

function truncateResponse(text: string, maxLen = 600): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...\n[response truncated in chat — full code applied to files]'
}

/* ── Sub-components ── */

function NavBar({
  user, subscription, tierColors, onSignOut, onManagePlan, compact,
}: {
  user: User
  subscription: Subscription | null
  tierColors?: Record<string, string>
  onSignOut: () => void
  onManagePlan?: () => void
  compact?: boolean
}) {
  if (compact) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {subscription?.is_admin ? (
          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)' }}>Admin</span>
        ) : subscription?.tier && tierColors ? (
          <span className="badge" style={{ background: `color-mix(in srgb, ${tierColors[subscription.tier]} 15%, transparent)`, color: tierColors[subscription.tier], border: `1px solid color-mix(in srgb, ${tierColors[subscription.tier]} 25%, transparent)` }}>{subscription.tier}</span>
        ) : null}
        <button onClick={onSignOut} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }}>{Icons.logOut}</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--accent)', display: 'flex' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>Forge Agent</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12 }}>AI Code &amp; Invoice Platform</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {subscription?.is_admin ? (
          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)' }}>Admin</span>
        ) : subscription?.tier && tierColors ? (
          <span className="badge" style={{ background: `color-mix(in srgb, ${tierColors[subscription.tier]} 15%, transparent)`, color: tierColors[subscription.tier], border: `1px solid color-mix(in srgb, ${tierColors[subscription.tier]} 25%, transparent)` }}>{subscription.tier}</span>
        ) : null}
        <span className="hide-mobile" style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user.email}</span>
        {onManagePlan && subscription && !subscription.is_admin && (
          <button onClick={onManagePlan} className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }}>{Icons.settings} <span className="hide-mobile">Manage</span></button>
        )}
        <button onClick={onSignOut} className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }}>{Icons.logOut} <span className="hide-mobile">Sign Out</span></button>
      </div>
    </div>
  )
}

function PricingGrid({ plans, tierColors, onCheckout }: { plans: Plan[]; tierColors: Record<string, string>; onCheckout: (tier: string) => void }) {
  return (
    <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
      {plans.map((plan, idx) => (
        <div key={plan.tier} className={`pricing-card tier-${plan.tier} animate-fade-in-up`} style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}>
          {plan.tier === 'pro' && (
            <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--pro)', color: '#0f172a', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Popular</div>
          )}
          <h3 style={{ margin: '4px 0 8px', color: 'var(--tier-color)', fontSize: 18, fontWeight: 700 }}>{plan.name}</h3>
          <div style={{ fontSize: 40, fontWeight: 800, margin: '4px 0 4px', letterSpacing: '-1px' }}>
            ${(plan.amount / 100).toFixed(2)}<span style={{ fontSize: 15, fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{plan.builds_per_month === -1 ? 'Unlimited builds' : `${plan.builds_per_month} builds/month`}</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', flex: 1 }}>
            {plan.features.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--tier-color)', flexShrink: 0, marginTop: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
          <button onClick={() => onCheckout(plan.tier)} className="btn" style={{
            width: '100%', background: `linear-gradient(135deg, ${tierColors[plan.tier]}, color-mix(in srgb, ${tierColors[plan.tier]} 70%, #fff))`,
            color: '#0f172a', fontWeight: 700, boxShadow: `0 2px 12px color-mix(in srgb, ${tierColors[plan.tier]} 30%, transparent)`,
          }}>Get {plan.name}</button>
        </div>
      ))}
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{value || '\u2014'}</div>
    </div>
  )
}
