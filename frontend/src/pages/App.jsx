import { Routes, Route, Link, NavLink } from 'react-router-dom'
import Admin from './Admin'
import Home from './Home'
import Book from './Book'
import Success from './Success'
import Cancel from './Cancel'

const NavItem = ({ to, children }) => (
  <NavLink
    to={to}
    className={({isActive}) =>
      `rounded-xl px-4 py-2 font-semibold transition ${isActive ? 'text-primary bg-fuchsia-50' : 'text-gray-700 hover:text-primary'}`
    }
  >
    {children}
  </NavLink>
)

export default function App() {
  return (
    <div>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="container py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-extrabold tracking-tight">
            Navratri<span className="brand-text">2025</span>
          </Link>
          <nav className="flex items-center gap-2">
            <NavItem to="/">Home</NavItem>
            <Link to="/book" className="btn-primary">Book Tickets</Link>
          </nav>
        </div>
      </header>

      {/* Routes */}
      <main>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/" element={<Home />} />
          <Route path="/book" element={<Book />} />
          <Route path="/success" element={<Success />} />
          <Route path="/cancel" element={<Cancel />} />
      
        </Routes>
      </main>

      

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container py-8 text-sm text-gray-600 flex flex-col md:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Navratri 2025 • Graba Night With Family</p>
          <p className="text-gray-500">Secure card payments via Stripe</p>
        </div>
      </footer>
    </div>
  )
}
