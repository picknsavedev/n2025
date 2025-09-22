require('dotenv').config()
const express = require('express')
const cors = require('cors')
const Stripe = require('stripe')
const nodemailer = require('nodemailer')
const QRCode = require('qrcode')
const PDFDocument = require('pdfkit')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const app = express()
const PORT = Number(process.env.PORT || 5001)
const FRONTEND = process.env.FRONTEND_URL || 'https://n2025-iota.vercel.app'
const PRICE_GBP = Number(process.env.TICKET_PRICE_GBP || 12)

const EVENT = {
  title: process.env.EVENT_TITLE || 'Navratri 2025 Garba Night',
  time:  process.env.EVENT_TIME  || '7:00 PM – 11:30 PM',
  venue: process.env.EVENT_VENUE || '136 Greenford Road Sudbury Postoffice Club, HA1 3Ql',
  days: {
    '2025-09-26': 'Fri 26 Sep 2025',
    '2025-09-28': 'Sun 28 Sep 2025',
  }
}

const DAY_LIMITS = {
  '2025-09-26': 90,
  '2025-09-28': 95,
}

/* -------------------- Mongo -------------------- */
mongoose.connect(process.env.MONGODB_URI)
  .then(()=>console.log('✅ MongoDB Atlas connected'))
  .catch(e=>console.error('Mongo error:', e.message))

/* -------------------- Schemas -------------------- */
const orderSchema = new mongoose.Schema({
  sessionId: { type:String, unique:true },
  name: String,
  email: String,
  phone: String,
  quantity: Number,
  eventDate: String,
  eventLabel: String,
  amount: Number,
  paid: { type:Boolean, default:false },
  createdAt: { type:Date, default:Date.now }
})

const ticketSchema = new mongoose.Schema({
  orderId: String,
  code: { type:String, unique:true },
  name: String,
  email: String,
  eventDate: String,
  eventLabel: String,
  used: { type:Boolean, default:false },
  usedAt: Date,
  usedBy: String,
  createdAt: { type:Date, default:Date.now }
})

const Order  = mongoose.model('Order', orderSchema)
const Ticket = mongoose.model('Ticket', ticketSchema)

/* -------------------- Middleware -------------------- */
app.use(express.json())

// ✅ Updated CORS config
const allowedOrigins = [
  'http://localhost:5173',         // Vite local dev
  'http://localhost:3000',         // CRA dev
  'https://n2025-iota.vercel.app'  // Vercel deployed frontend
]

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true) // allow Postman/curl
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy: Origin ${origin} not allowed`
      return callback(new Error(msg), false)
    }
    return callback(null, true)
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}))

// quick health
app.get('/api/health', (req,res)=>{
  res.json({ ok:true, mongo:true, hasStripeKey:!!process.env.STRIPE_SECRET_KEY, days:EVENT.days })
})

/* -------------------- Stripe Checkout -------------------- */
app.post('/api/checkout', async (req,res)=>{
  try {
    const { quantity=1, name, email, phone, eventDate } = req.body || {}
    if (!name || !email || !phone) return res.status(400).json({ error:'Name, email and phone are required.' })
    if (!EVENT.days[eventDate]) return res.status(400).json({ error:'Please select a valid event day.' })

    // ✅ Ticket limit check
    const sold = await Ticket.countDocuments({ eventDate })
    if (sold + Number(quantity) > DAY_LIMITS[eventDate]) {
      return res.status(400).json({
        error: `Sorry, only ${DAY_LIMITS[eventDate] - sold} tickets left for ${EVENT.days[eventDate]}.`
      })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const unit_amount = Math.round(PRICE_GBP * 100)

    const session = await stripe.checkout.sessions.create({
      mode:'payment',
      payment_method_types:['card'],
      customer_email: email,
      line_items:[{
        price_data:{
          currency:'gbp',
          product_data:{ name:`${EVENT.title} — ${EVENT.days[eventDate]}` },
          unit_amount
        },
        quantity: Math.max(1, Number(quantity))
      }],
      metadata:{ name,email,phone,quantity:String(quantity),eventDate },
      success_url:`${FRONTEND}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${FRONTEND}/cancel`
    })

    // Save pending order
    await Order.findOneAndUpdate(
      { sessionId: session.id },
      {
        sessionId: session.id,
        name, email, phone,
        quantity:Number(quantity),
        eventDate,
        eventLabel: EVENT.days[eventDate],
        amount: (unit_amount*Number(quantity))/100,
        paid:false
      },
      { upsert:true }
    )

    res.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/* -------------------- Verify & Issue tickets -------------------- */
app.post('/api/issue-ticket', async (req,res)=>{
  try {
    const { session_id } = req.body || {}
    if (!session_id) return res.status(400).json({ error:'session_id required' })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.checkout.sessions.retrieve(session_id)
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error:`Payment status is ${session.payment_status}` })
    }

    const order = await Order.findOne({ sessionId: session_id })
    if (!order) return res.status(404).json({ error:'Order not found' })
    if (order.paid) return res.json({ ok:true, alreadySent:true })

    // ensure tickets exist (one per quantity)
    let tickets = await Ticket.find({ orderId: order.sessionId })
    if (tickets.length === 0) {
      const docs = []
      for (let i=0;i<order.quantity;i++){
        const code = makeTicketCode()
        docs.push({
          orderId: order.sessionId,
          code,
          name: order.name,
          email: order.email,
          eventDate: order.eventDate,
          eventLabel: order.eventLabel
        })
      }
      tickets = await Ticket.insertMany(docs)
    }

    // email PDF
    await sendTicketEmail({ order, tickets })

    order.paid = true
    await order.save()

    res.json({ ok:true })
  } catch (e) {
    console.error('Issue-ticket error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

/* -------------------- Admin Auth + Scanner APIs -------------------- */
app.post('/api/admin/login', (req,res)=>{
  const { username, password } = req.body || {}
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS){
    const token = jwt.sign({ role:'admin' }, process.env.ADMIN_JWT_SECRET, { expiresIn:'12h' })
    return res.json({ token })
  }
  res.status(401).json({ error:'Invalid credentials' })
})

function requireAdmin(req,res,next){
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error:'Missing token' })
  try{
    jwt.verify(token, process.env.ADMIN_JWT_SECRET)
    next()
  }catch(e){ res.status(401).json({ error:'Invalid token' }) }
}

app.get('/api/admin/ticket/:code', requireAdmin, async (req,res)=>{
  const t = await Ticket.findOne({ code: req.params.code })
  if (!t) return res.status(404).json({ error:'Ticket not found' })
  res.json({ code:t.code, used:t.used, usedAt:t.usedAt, event:t.eventLabel, name:t.name, email:t.email })
})

app.post('/api/admin/scan', requireAdmin, async (req,res)=>{
  const { code, markUsed=true, gate } = req.body || {}
  if (!code) return res.status(400).json({ error:'code required' })
  const t = await Ticket.findOne({ code })
  if (!t) return res.status(404).json({ status:'not_found' })

  if (t.used) {
    return res.json({ status:'already_used', usedAt:t.usedAt, code:t.code, name:t.name, event:t.eventLabel })
  }

  if (markUsed){
    t.used = true
    t.usedAt = new Date()
    if (gate) t.usedBy = gate
    await t.save()
  }

  res.json({ status: markUsed ? 'valid_marked' : 'valid', code:t.code, name:t.name, event:t.eventLabel })
})

/* -------------------- Mailer & PDF -------------------- */
async function createTransporter() {
  if (String(process.env.USE_ETHEREAL).toLowerCase()==='true') {
    const test = await nodemailer.createTestAccount()
    return nodemailer.createTransport({
      host:'smtp.ethereal.email', port:587, secure:false,
      auth:{ user:test.user, pass:test.pass }
    })
  }
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = (process.env.SMTP_SECURE || '').toString().toLowerCase()==='true' || port===465
  const transporter = nodemailer.createTransport({
    host:process.env.SMTP_HOST, port, secure,
    auth:{ user:process.env.SMTP_USER, pass:process.env.SMTP_PASS }
  })
  await transporter.verify()
  return transporter
}

async function sendTicketEmail({ order, tickets }) {
  const title = EVENT.title, time = EVENT.time, venue = EVENT.venue

  const qrBuffers = await Promise.all(
    tickets.map(async t => {
      const dataURL = await QRCode.toDataURL(`T|${t.code}`, { margin: 1, width: 240 })
      return Buffer.from(dataURL.split(',')[1], 'base64')
    })
  )

  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const chunks = []
  doc.on('data', chunks.push.bind(chunks))
  const done = new Promise(r => doc.on('end', r))

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i]
    if (i > 0) doc.addPage()

    const pageW = doc.page.width
    const pageH = doc.page.height

    doc.save().rect(0, 0, pageW, pageH).fill('#fff7ed').restore()

    doc.fillColor('#d946ef').fontSize(24).text(title, { align: 'center' })
    doc.moveDown(0.5)
    doc.fillColor('#111').fontSize(13)
       .text(`${t.eventLabel} • ${time}`, { align: 'center' })
       .text(venue, { align: 'center' })
    doc.moveDown(1)

    doc.fontSize(14).fillColor('#111')
       .text(`Ticket for: ${t.name}`)
       .text(`Email: ${t.email}`)
       .text(`Order: ${order.sessionId}`)
       .text(`Ticket Code: ${t.code}`)

    doc.image(qrBuffers[i], pageW - 300, 180, { width: 200 })
    doc.fontSize(10).fillColor('#6b7280')
       .text('Present this QR at entry. One scan = one entry.',
             pageW - 300, 390, { width: 200, align: 'center' })
  }

  doc.end(); await done
  const pdfBuffer = Buffer.concat(chunks)

  const transporter = await createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `Navratri Tickets <${process.env.SMTP_USER}>`,
    to: order.email,
    subject: `Your Navratri 2025 E-Ticket(s) — ${order.eventLabel}`,
    html: `<p>Hi ${order.name},</p>
           <p>Thanks for booking <b>${order.quantity}</b> ticket(s) for <b>${title}</b> on <b>${order.eventLabel}</b>.</p>
           <p>Your tickets are attached. Each page contains one unique QR code and ticket code.</p>`,
    attachments: [{ filename: `Navratri-2025-Tickets-${order.sessionId}.pdf`, content: pdfBuffer }]
  })
}

/* -------------------- Helpers -------------------- */
function makeTicketCode() {
  return crypto.randomBytes(7).toString('base64url').toUpperCase()
}

/* -------------------- Start -------------------- */
app.listen(PORT, ()=> {
  console.log(`🚀 Backend running on https://n2025.onrender.com`)
})

