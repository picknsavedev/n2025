import { useMemo, useState } from 'react'
import axios from 'axios'

const PRICE = Number(import.meta.env.VITE_TICKET_PRICE_GBP || 12)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://n2025-iota.vercel.app"

// Day options with their own times
const DAY_OPTIONS = [
  { value: '2025-09-26', label: 'Day 1 • Fri 26 Sep 2025', time: '7:00 PM – 11:00 PM' },
  { value: '2025-09-28', label: 'Day 2 • Sun 28 Sep 2025', time: '6:00 PM – 10:00 PM' },
]

export default function Book() {
  const [eventDate, setEventDate] = useState(DAY_OPTIONS[0].value)
  const [quantity, setQuantity] = useState(1)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const total = useMemo(() => (PRICE * quantity).toFixed(2), [quantity])

  const selectedDay = DAY_OPTIONS.find(d => d.value === eventDate)

  const inc = () => setQuantity(q => Math.max(1, q + 1))
  const dec = () => setQuantity(q => Math.max(1, q - 1))

  const submit = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) return alert("Please enter name, email and phone.")
    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/api/checkout`, {
        eventDate, quantity, name, email, phone
      })
      if (res.data?.url) window.location.href = res.data.url
      else throw new Error(res.data?.error || 'No checkout URL returned')
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Unable to start checkout.'
      alert(msg)
      console.error('Checkout failed:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="container py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="badge">Ticket price £{PRICE} / person</span>
        <h2 className="h2">Book Your Tickets</h2>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Visual */}
        <div className="card overflow-hidden">
          <img src="/Screenshot (698).png" alt="Garba" className="h-full w-full object-cover" />
        </div>

        {/* Right: Form */}
        <div className="card card-p">
          {/* Day selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Choose your event day</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {DAY_OPTIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  data-active={eventDate === d.value}
                  onClick={() => setEventDate(d.value)}
                  className="day-card text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{d.label}</span>
                    <span className={`h-3 w-3 rounded-full ${eventDate === d.value ? 'bg-fuchsia-500' : 'bg-gray-300'}`} />
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{d.time}</div>
                </button>
              ))}
            </div>
            {selectedDay && (
              <p className="text-xs text-gray-500 mt-2">
                Selected: <b>{selectedDay.label}</b> • <b>{selectedDay.time}</b>
              </p>
            )}
          </div>

          {/* Buyer info */}
          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Full Name</label>
              <input className="mt-1 w-full rounded-xl border border-gray-300 p-3" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <label className="block text-sm font-medium">Email</label>
              <input type="email" className="mt-1 w-full rounded-xl border border-gray-300 p-3" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium">Phone</label>
              <input className="mt-1 w-full rounded-xl border border-gray-300 p-3" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+44 7..." />
            </div>
          </div>

          {/* Quantity + total */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium">Quantity</label>
              <div className="mt-1 stepper">
                <button className="stepper-btn" onClick={dec} type="button">−</button>
                <input className="stepper-input" value={quantity} readOnly />
                <button className="stepper-btn" onClick={inc} type="button">+</button>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-2xl font-extrabold">£{total}</div>
            </div>
          </div>

          {/* Submit */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button onClick={submit} disabled={loading} className="btn-primary">
              {loading ? 'Processing…' : 'Pay Now'}
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Card payments are handled securely by Stripe Checkout. DJ music both nights.
          </p>
        </div>
      </div>
    </section>
  )
}
