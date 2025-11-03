const express = require('express');
const Razorpay = require('razorpay');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Nodemailer config
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

app.get('/', (req, res) => {
  res.render('register');
});

app.post('/create/order', async (req, res) => {
  const { name, email, amount } = req.body;

  const options = {
    amount: amount * 100, // in paise
    currency: 'INR',
    receipt: `receipt_order_${Math.random().toString(36).substring(7)}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({ order, name, email });
  } catch (err) {
    console.error(err);
    res.status(500).send('Payment initialization failed');
  }
});

app.post('/verify/payment', async (req, res) => {
  const { paymentId, orderId, amount, name, email } = req.body;

  // Generate PDF invoice
  const doc = new PDFDocument();
  const invoicesDir = path.join(__dirname, 'invoices');
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
  }
  const invoicePath = path.join(invoicesDir, `${paymentId}.pdf`);
  doc.pipe(fs.createWriteStream(invoicePath));
  doc.fontSize(25).text('Tourism Invoice', { align: 'center' });
  doc.text(`\n\nName: ${name}`);
  doc.text(`Email: ${email}`);
  doc.text(`Payment ID: ${paymentId}`);
  doc.text(`Order ID: ${orderId}`);
  doc.text(`Amount Paid: ₹${amount}`);
  doc.end();

  // Send Email
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Tourism Booking Invoice',
    text: 'Please find attached your invoice.',
    attachments: [{ filename: 'invoice.pdf', path: invoicePath }],
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Email error:', error);
      return res.status(500).send('Email failed');
    }
    res.send('Payment Successful and Invoice Sent!');
  });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));