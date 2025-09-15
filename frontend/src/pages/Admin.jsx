import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'

export default function Admin() {
  const [stage, setStage] = useState(localStorage.getItem('admin_token') ? 'scan' : 'login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [lastCode, setLastCode] = useState('')
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)

  const [usingFront, setUsingFront] = useState(true) // default to FRONT camera
  const [isRunning, setIsRunning] = useState(false)

  const qrRef = useRef(null)       // Html5Qrcode instance
  const readerId = 'reader'        // div id for camera preview

  useEffect(() => {
    if (stage !== 'scan') return
    startScanner(usingFront)

    return () => { stopScanner() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, usingFront])

  async function startScanner(front) {
    try {
      await stopScanner()
      if (!qrRef.current) qrRef.current = new Html5Qrcode(readerId, /* verbose= */ false)

      // Ask for specific facing mode
      // - "user"       => front/selfie camera
      // - "environment"=> rear/back camera
      const constraints = { facingMode: front ? 'user' : { exact: 'environment' } }

      await qrRef.current.start(
        constraints,
        {
          fps: 10,
          qrbox: 260,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        },
        onScanSuccess,
        onScanError
      )
      setIsRunning(true)
      setMsg(front ? 'Using FRONT camera' : 'Using BACK camera')
    } catch (e) {
      // If exact "environment" fails (e.g., device has only one camera), retry with generic constraint
      if (!usingFront) {
        try {
          const fallback = { facingMode: 'environment' }
          await qrRef.current.start(fallback, { fps: 10, qrbox: 260 }, onScanSuccess, onScanError)
          setIsRunning(true)
          setMsg('Using BACK camera (fallback)')
          return
        } catch {}
      }
      setMsg(`Camera error: ${e?.message || e}`)
    }
  }

  async function stopScanner() {
    try {
      if (qrRef.current && isRunning) {
        await qrRef.current.stop()
        await qrRef.current.clear()
        setIsRunning(false)
      }
    } catch {}
  }

  function onScanError() {
    // ignore noisy scan errors
  }

  async function onScanSuccess(text) {
    let code = text.trim()
    if (code.startsWith('T|')) code = code.slice(2)
    if (!code || code === lastCode) return
    await validate(code, true)
    setLastCode(code)
  }

  async function login() {
    setBusy(true); setMsg('')
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
    stopScanner()
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

      if (data.status === 'valid_marked') setMsg(`✅ VALID — marked used · ${data.event}`)
      else if (data.status === 'already_used') setMsg(`⚠️ ALREADY USED · ${new Date(data.usedAt).toLocaleString()}`)
      else if (data.status === 'valid') setMsg(`✅ VALID`)
      else if (data.status === 'not_found') setMsg('❌ NOT FOUND')
    } catch (e) {
      setMsg(`Error: ${e.message}`)
    } finally { setBusy(false) }
  }

  /* ---------- UI ---------- */

  if (stage === 'login') {
    return (
      <section className="container max-w-md py-16">
        <h1 className="text-3xl font-bold mb-6">Admin Login</h1>
        <div className="space-y-4">
          <input className="w-full border p-3 rounded-xl" placeholder="Username"
            value={username} onChange={e => setUsername(e.target.value)} />
          <input type="password" className="w-full border p-3 rounded-xl" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={login} disabled={busy} className="bg-primary text-white px-5 py-3 rounded-xl disabled:opacity-60">
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
          <button
            className="px-4 py-2 rounded-xl border"
            onClick={() => { stopScanner().then(() => startScanner(usingFront)) }}>
            Refresh
          </button>
          <button
            className="px-4 py-2 rounded-xl border"
            onClick={() => setUsingFront(v => !v)}>
            {usingFront ? 'Use Back Camera' : 'Use Front Camera'}
          </button>
          <button onClick={logout} className="px-4 py-2 rounded-xl border bg-gray-50">Logout</button>
        </div>
      </div>

      <p className="text-gray-600 mb-4">
        {msg || (usingFront ? 'Using FRONT camera' : 'Using BACK camera')}
      </p>

      <div id={readerId} className="rounded-2xl overflow-hidden border" style={{ minHeight: 320 }} />

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
            Tip: The QR encodes <code>T|&lt;code&gt;</code>. You can scan or type just the code.
          </p>
        </div>
      </div>
    </section>
  )
}
