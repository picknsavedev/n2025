import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"

export default function Success() {
  const { search } = useLocation()
  const [status, setStatus] = useState('Confirming your payment and emailing your e-ticket…')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const params = new URLSearchParams(search)
    const session_id = params.get('session_id')
    if (!session_id) { setStatus('Missing session id. If you paid, please contact support.'); return }
    ;(async () => {
      try {
        await axios.post(`${API_BASE}/api/issue-ticket`, { session_id })
        setStatus('E-ticket sent! Please check your email (and spam).')
      } catch (e) {
        const msg = e?.response?.data?.error || e?.message || 'Payment confirmed but failed to send ticket.'
        setStatus(msg); console.error(e)
      }
    })()
  }, [search])

  return (
    <section className="container py-16 text-center">
      <div className="mx-auto max-w-2xl card card-p">
        <h2 className="h1 brand-text">Payment Successful 🎉</h2>
        <p className="mt-4 text-lg">{status}</p>
        <Link to="/" className="btn-primary mt-8">Back to Home</Link>
      </div>
    </section>
  )
}
