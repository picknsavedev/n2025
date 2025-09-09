import { useEffect, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

const API = import.meta.env.VITE_API_BASE_URL || 'https://n2025-iota.vercel.app'

export default function Admin() {
  const [stage, setStage] = useState(localStorage.getItem('admin_token') ? 'scan' : 'login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [lastCode, setLastCode] = useState('')
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const scannerRef = useRef(null)

  useEffect(() => {
    if (stage !== 'scan') return
    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 260 })
    scanner.render(onScanSuccess, onScanError)
    scannerRef.current = scanner
    return () => { try { scanner.clear() } catch {} }
  }, [stage])

  async function login() {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Login failed')
      localStorage.setItem('admin_token', data.token)
      setStage('scan')
      setMsg('Logged in. Scanner ready.')
    } catch (e) {
      setMsg(e.message)
    } finally { setBusy(false) }
  }

  function logout() {
    localStorage.removeItem('admin_token')
    setStage('login')
    setMsg('')
    setUsername(''); setPassword('')
  }

  async function validate(code, markUsed = true) {
    if (!code) return
    setBusy(true)
    try {
      const r = await fetch(`${API}/api/admin/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`
        },
        body: JSON.stringify({ code, markUsed, gate: 'Gate A' })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Scan failed')

      setLastCode(code)
      if (data.status === 'valid_marked') setMsg(`✅ VALID — marked used · ${data.event}`)
      else if (data.status === 'already_used') setMsg(`⚠️ ALREADY USED · ${new Date(data.usedAt).toLocaleString()}`)
      else if (data.status === 'valid') setMsg(`✅ VALID`)
      else if (data.status === 'not_found') setMsg(`❌ NOT FOUND`)
    } catch (e) {
      setMsg(`Error: ${e.message}`)
    } finally { setBusy(false) }
  }

  function onScanSuccess(text) {
    let code = text.trim()
    if (code.startsWith('T|')) code = code.slice(2)
    // prevent rapid duplicate submits of same code
    if (code && code !== lastCode) validate(code, true)
  }
  function onScanError() {}

  if (stage === 'login') {
    return (
      <section className="container max-w-md py-16">
        <h1 className="text-3xl font-bold mb-6">Admin Login</h1>
        <div className="space-y-4">
          <input
            className="w-full border p-3 rounded-xl"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full border p-3 rounded-xl"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button
            onClick={login}
            disabled={busy}
            className="bg-primary text-white px-5 py-3 rounded-xl disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {msg && <p className="text-sm text-gray-600">{msg}</p>}
        </div>
      </section>
    )
  }

  return (
    <section className="container py-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-3xl font-bold">Ticket Scanner</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl border">
            Refresh Camera
          </button>
          <button onClick={logout} className="px-4 py-2 rounded-xl border bg-gray-50">
            Logout
          </button>
        </div>
      </div>

      <p className="text-gray-600 mb-4">
        Point the camera at the ticket QR. Each successful scan will validate and mark the ticket as used.
      </p>

      <div id="reader" className="rounded-2xl overflow-hidden border" />

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="p-4 rounded-xl border bg-white/70">
          <div className="font-semibold mb-1">Status</div>
          <div className="text-sm">{msg || 'Awaiting scan…'}</div>
        </div>

        <div className="p-4 rounded-xl border bg-white/70">
          <div className="font-semibold mb-2">Manual Entry (fallback)</div>
          <div className="flex gap-2">
            <input
              className="flex-1 border p-3 rounded-xl"
              placeholder="Enter ticket code"
              value={manual}
              onChange={e => setManual(e.target.value.toUpperCase())}
            />
            <button
              className="bg-primary text-white px-4 py-3 rounded-xl disabled:opacity-60"
              disabled={busy || !manual.trim()}
              onClick={() => validate(manual.trim(), true)}
            >
              Validate
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Tip: The QR encodes <code>T|&lt;code&gt;</code>. You can paste either the full text or just the code.
          </p>
        </div>
      </div>
    </section>
  )
}
