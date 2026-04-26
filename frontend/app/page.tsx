'use client'
import { useEffect, useState } from 'react'
const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'
export default function Home() {
  const [appName, setAppName] = useState('Real Integration Builder')
  const [prompt, setPrompt] = useState('Build and deploy a real integrated app.')
  const [jobs, setJobs] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  async function loadJobs() { const r = await fetch(`${API}/api/jobs`); setJobs(await r.json()) }
  useEffect(() => { loadJobs(); const t = setInterval(loadJobs, 4000); return () => clearInterval(t) }, [])
  async function submit() {
    const r = await fetch(`${API}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_name: appName, prompt, provider: 'opencode-go' }) })
    setResult(await r.json()); loadJobs()
  }
  return <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}><h1>Forge Agent</h1><p>GitHub + Cloudflare Pages deployment pipeline.</p><div style={card}><input value={appName} onChange={e=>setAppName(e.target.value)} style={field} placeholder="App name"/><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={6} style={field} placeholder="Describe what to build..."/><button onClick={submit} style={button}>Queue job</button></div>{result && <pre style={pre}>{JSON.stringify(result,null,2)}</pre>}<div style={{display:'grid',gap:12,marginTop:16}}>{jobs.map(j=><div key={j.id} style={card}><div><strong>{j.app_name}</strong></div><div>Status: {j.status}</div><div>PR: {j.pr_url ? <a href={j.pr_url} target="_blank" rel="noreferrer" style={{color:'#38bdf8'}}>{j.pr_url}</a> : '\u2014'}</div><div>Deploy: {j.deployment_url ? <a href={`https://${j.deployment_url}`} target="_blank" rel="noreferrer" style={{color:'#38bdf8'}}>{j.deployment_url}</a> : '\u2014'}</div><div>Deploy state: {j.deployment_state || '\u2014'}</div></div>)}</div></main>
}
const card: React.CSSProperties = { display:'grid', gap:12, background:'#0f172a', padding:16, borderRadius:16 }
const field: React.CSSProperties = { width:'100%', padding:12, borderRadius:12, border:'1px solid #334155', background:'#020617', color:'#e2e8f0' }
const button: React.CSSProperties = { padding:'12px 18px', borderRadius:12, border:'none', background:'#38bdf8', color:'#04121a', fontWeight:700, cursor:'pointer' }
const pre: React.CSSProperties = { marginTop:20, padding:16, borderRadius:16, background:'#020617', overflowX:'auto' }
