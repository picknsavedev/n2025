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

  const [usingFront, setUsingFront] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

  const [scannedTickets, setScannedTickets] = useState([])

  const qrRef = useRef(null)
  const readerId = 'reader'

  useEffect(() => {
    if (stage !== 'scan') return
    startScanner(usingFront)

    return () => { stopScanner() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, usingFront])

  async function startScanner(front) {
    try {
      await stopScanner()
      if (!qrRef.current) qrRef.current = new Html5Qrcode(readerId, false)

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
    // ignore
  }

  async function onScanSuccess(text) {
    setMsg(`Raw scanned QR code: ${text}`)  // Show raw scanned text for debugging
    let scannedCode = text.trim().toUpperCase()
    if (!scannedCode || scannedCode === lastCode) return

    // Try validating with full scanned code first
    let valid = false
    try {
      await validate(scannedCode, true)
      valid = true
      setLastCode(scannedCode)
    } catch (e) {
      // If failed, try stripping "T|" prefix and validate again
      if (scannedCode.startsWith('T|')) {
        const strippedCode = scannedCode.slice(2)
        if (strippedCode && strippedCode !== lastCode) {
          try {
            await validate(strippedCode, true)
            valid = true
            setLastCode(strippedCode)
          } catch {}
        }
      }
    }
    if (!valid) {
      setMsg('Scan failed: invalid ticket code')
    }
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

      let statusMsg = ''
      if (data.status === 'valid_marked') statusMsg = `✅ VALID — marked used · ${data.event}`
      else if (data.status === 'already_used') statusMsg = `⚠️ ALREADY USED · ${new Date(data.usedAt).toLocaleString()}`
      else if (data.status === 'valid') statusMsg = `✅ VALID`
      else if (data.status === 'not_found') statusMsg = '❌ NOT FOUND'

      setMsg(statusMsg)

      // add ticket info to scanned history
      setScannedTickets(prev => [
        {
          code: data.code || code,
          status: data.status,
          event: data.event,
          usedAt: data.usedAt || null
        },
        ...prev
      ])
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
          <button className="px-4 py-2 rounded-xl border" onClick={() => { stopScanner().then(() => startScanner(usingFront)) }}>Refresh</button>
          <button className="px-4 py-2 rounded-xl border" onClick={() => setUsingFront(v => !v)}>
            {usingFront ? 'Use Back Camera' : 'Use Front Camera'}
          </button>
          <button onClick={logout} className="px-4 py-2 rounded-xl border bg-gray-50">Logout</button>
        </div>
      </div>

      <p className="text-gray-600 mb-4">{msg || (usingFront ? 'Using FRONT camera' : 'Using BACK camera')}</p>

      <div id={readerId} className="rounded-2xl overflow-hidden border" style={{ minHeight: 320 }} />

      {/* Manual entry */}
      <div className="mt-6 p-4 rounded-xl border bg-white/70">
        <div className="font-semibold mb-2">Manual Entry</div>
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
      </div>

      {/* Scanned Tickets History */}
      <div className="mt-6">
        <h3 className="font-bold mb-2">Scanned Tickets</h3>
        <ul className="space-y-2">
          {scannedTickets.map((t, i) => (
            <li key={i} className={`p-2 rounded-xl border ${t.status === 'valid_marked' ? 'bg-green-100' : t.status === 'already_used' ? 'bg-red-100' : 'bg-yellow-100'}`}>
              {t.code} → {t.status} {t.usedAt ? `(at ${new Date(t.usedAt).toLocaleString()})` : ''}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
