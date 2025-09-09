import { Link } from 'react-router-dom'

const title = import.meta.env.VITE_EVENT_TITLE || "Navratri 2025 Garba Night"
const venue = import.meta.env.VITE_EVENT_VENUE || "136 Greenford Road"
const time  = import.meta.env.VITE_EVENT_TIME || "7:00 PM – 11:30 PM"

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -right-24 h-72 w-72 rounded-full bg-fuchsia-200 blur-3xl opacity-50" />
        <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-orange-200 blur-3xl opacity-60" />
        <div className="container py-12 md:py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="badge">Garba • Dandiya • Celebration</span>
            <h1 className="h1 mt-4">
              {title} <span className="block brand-text">Two Magical Nights</span>
            </h1>
            <p className="mt-4 text-lg text-gray-700">
              Choose your day and get your e-ticket instantly by email. Family-friendly, colorful, and unforgettable.
            </p>
            <ul className="mt-6 space-y-2 text-gray-700">
              <li>📅 <b>Day 1:</b> Fri 26 Sep 2025 </li>🕖<b>07:00 PM to 11:00 PM </b>
              <li>📅 <b>Day 2:</b> Sun 28 Sep 2025 </li>🕖<b>06:00 PM to 10:00 PM</b>
            
              <li>📍 <b>136 Greenford Road Sudbury Postoffice Club,
                HA1 3Ql</b></li>
            </ul>
            <div className="mt-8 flex gap-3">
              <Link to="/book" className="btn-primary">Book Tickets</Link>
              <a href="#details" className="btn-ghost">Event Details</a>
            </div>
          </div>
          <div className="card">
            <img src="/Home.jpg" alt="Navratri Garba" className="rounded-2xl" />
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section id="details" className="container py-10 grid md:grid-cols-3 gap-6">
        {[
          { title: "DJ Night", desc: "High-energy mixes to keep you dancing all evening." },
          { title: "Family Friendly", desc: "Kids welcome. Safe, vibrant, and joyful atmosphere for everyone." },
          { title: "Snacks & Stalls", desc: "Indian snacks and merch available at the venue." },
        ].map((f,i)=>(
          <div key={i} className="card card-p">
            <h3 className="h3 mb-2">{f.title}</h3>
            <p className="text-gray-600">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="container py-12">
        <div className="card card-p flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="h2 mb-2">Ready to dance the night away?</h3>
            <p className="text-gray-600">Tickets are limited. Secure yours today for either night.</p>
          </div>
          <Link to="/book" className="btn-primary">Book Tickets</Link>
        </div>
      </section>
    </>
  )
}
