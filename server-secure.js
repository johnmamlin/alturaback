require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

const app = express();

// --- 1. GLOBAL MIDDLEWARE & SECURITY ---

// Add secure HTTP headers
app.use(helmet());

// Restrict CORS to only your frontend URL
app.use(cors({
  origin: ['http://localhost:5178', 'http://192.168.100.12:5178'],
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

// Parse JSON bodies, but strictly limit the size to prevent payload attacks
app.use(express.json({ limit: '10kb' })); 

// --- 2. RATE LIMITING ---
// Prevent spam: Allow max 5 booking attempts per IP every 15 minutes
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { error: 'Too many booking requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- 3. EMAIL TRANSPORT SETUP ---
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify email connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email config error:', error);
  } else {
    console.log('✅ Mail server is ready to send messages');
  }
});

// Log startup
console.log('🚀 Starting Altura Health Strategies secure backend...');

// --- 4. SECURE ROUTE WITH VALIDATION ---
app.post('/api/booking', 
  bookingLimiter, // Apply rate limiting
  [
    // Validate and sanitize incoming data
    body('fullName').trim().notEmpty().withMessage('Name is required').escape(),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('phone').trim().escape(),
    body('organization').trim().escape(),
    body('serviceType').trim().notEmpty().withMessage('Service type is required').escape(),
    body('preferredDate').trim().notEmpty().escape(),
    body('preferredTime').trim().notEmpty().escape(),
    body('notes').trim().escape() // escape() prevents HTML/script injection
  ], 
  async (req, res) => {
    console.log('📨 Received booking request:', req.body); // Debug log
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array()); // Debug log
      return res.status(400).json({ error: 'Invalid input data', details: errors.array() });
    }

    const { 
      fullName, email, phone, organization, 
      serviceType, preferredDate, preferredTime, notes 
    } = req.body;

    // Email for the visitor (friendly confirmation)
    const visitorEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%); padding: 30px; border-radius: 10px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 2rem;">ALTURA</h1>
          <p style="color: #14b8a6; margin: 10px 0 0 0; font-size: 1.2rem;">Health Strategies</p>
        </div>
        
        <div style="background: #f8fafc; padding: 30px; border-radius: 10px; margin: 20px 0;">
          <h2 style="color: #0f766e; margin-bottom: 20px;">Booking Confirmed! 🎉</h2>
          <p style="color: #1e293b; line-height: 1.6;">
            Dear <strong>${fullName}</strong>,
          </p>
          <p style="color: #1e293b; line-height: 1.6;">
            Thank you for choosing Altura Health Strategies! Your consultation booking has been successfully confirmed.
          </p>
          
          <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
            <h3 style="color: #0284c7; margin: 0 0 10px 0;">Your Booking Details:</h3>
            <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceType}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${preferredDate}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${preferredTime}</p>
          </div>
          
          <p style="color: #1e293b; line-height: 1.6;">
            Our team will review your booking and contact you shortly to confirm all details and answer any questions you may have.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #64748b; font-size: 0.9rem;">
              For immediate assistance, please contact us at:<br>
              📧 mamlinjohn@gmail.com
            </p>
          </div>
        </div>
        
        <div style="text-align: center; color: #64748b; font-size: 0.8rem; margin-top: 20px;">
          <p>© 2024 Altura Health Strategies. All rights reserved.</p>
        </div>
      </div>
    `;

    // Email for the company (detailed booking info)
    const companyEmail = `
      <div style="font-family: sans-serif; color: #1e293b; max-width: 600px;">
        <h2 style="color: #0f766e;">📋 New Consultation Booking</h2>
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 12px; width: 30%;">Field</th>
              <th style="border: 1px solid #cbd5e1; padding: 12px;">Client Data</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid #cbd5e1; padding: 10px;"><strong>Name</strong></td><td style="border: 1px solid #cbd5e1; padding: 10px;">${fullName}</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 10px;"><strong>Email</strong></td><td style="border: 1px solid #cbd5e1; padding: 10px;">${email}</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 10px;"><strong>Phone</strong></td><td style="border: 1px solid #cbd5e1; padding: 10px;">${phone || 'N/A'}</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 10px;"><strong>Organization</strong></td><td style="border: 1px solid #cbd5e1; padding: 10px;">${organization || 'N/A'}</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 10px;"><strong>Service</strong></td><td style="border: 1px solid #cbd5e1; padding: 10px;">${serviceType}</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 10px;"><strong>Date</strong></td><td style="border: 1px solid #cbd5e1; padding: 10px;">${preferredDate}</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 10px;"><strong>Time</strong></td><td style="border: 1px solid #cbd5e1; padding: 10px;">${preferredTime}</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 10px;"><strong>Notes</strong></td><td style="border: 1px solid #cbd5e1; padding: 10px;">${notes || 'N/A'}</td></tr>
          </tbody>
        </table>
      </div>
    `;

    try {
      console.log('📧 Sending visitor confirmation to:', email); // Debug log
      console.log('📧 Sending company copy to:', process.env.RECEIVER_EMAIL); // Debug log
      
      // Send friendly confirmation to visitor
      await transporter.sendMail({
        from: `"Altura Booking System" <${process.env.EMAIL_USER}>`,
        to: email, // Send to visitor's email who filled out form
        subject: `Booking Confirmation: ${fullName} - ${organization || 'Individual'}`,
        html: visitorEmail
      });

      // Send detailed booking info to company
      await transporter.sendMail({
        from: `"Altura Booking System" <${process.env.EMAIL_USER}>`,
        to: process.env.RECEIVER_EMAIL, // Send to your admin email for records
        replyTo: email, // Lets you easily hit "Reply" in your inbox to talk to client
        subject: `📋 New Booking: ${fullName} - ${organization || 'Individual'}`,
        html: companyEmail
      });

      console.log('✅ Both emails sent successfully'); // Debug log
      res.status(200).json({ message: 'Booking confirmed! Check your email for confirmation.' });
    } catch (error) {
      console.error('❌ SMTP Error:', error); // Debug log
      // Generic error to client, so we don't leak server details
      res.status(500).json({ error: 'Failed to process booking. Please try again later.' }); 
    }
});

// --- 5. START SERVER ---
const PORT = process.env.PORT || 5000;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

app.listen(PORT, () => console.log(`🔒 Secure Backend running on port ${PORT}`));
