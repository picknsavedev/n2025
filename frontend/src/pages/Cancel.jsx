import { Link } from 'react-router-dom'

export default function Cancel() {
  return (
    <section className="container py-16 text-center">
      <div className="mx-auto max-w-xl card card-p">
        <h2 className="h1">Payment Cancelled</h2>
        <p className="mt-4 text-lg text-gray-700">No charges were made. You can try booking again when ready.</p>
        <Link to="/book" className="btn-primary mt-8">Try Again</Link>
      </div>
    </section>
  )
}
