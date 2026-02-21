import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Validate required environment variables
if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL || !process.env.ADMIN_EMAIL) {
  console.error('Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many booking requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Input validation middleware
const validateBooking = (req, res, next) => {
  const { fullName, email, serviceType, preferredDate, preferredTime } = req.body;
  
  if (!fullName || !email || !serviceType || !preferredDate || !preferredTime) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  next();
};

app.post('/api/booking', limiter, validateBooking, async (req, res) => {
  const { fullName, email, phone, organization, serviceType, preferredDate, preferredTime, notes } = req.body;

  try {
    const data = await resend.emails.send({
      from: `Altura Health <${process.env.FROM_EMAIL}>`,
      to: [process.env.ADMIN_EMAIL],
      subject: `New Booking Request: ${fullName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 10px;">
            New Consultation Booking
          </h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Client:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
            <p><strong>Organization:</strong> ${organization || 'Not provided'}</p>
            <p><strong>Service:</strong> ${serviceType}</p>
            <p><strong>Schedule:</strong> ${preferredDate} at ${preferredTime}</p>
            <p><strong>Notes:</strong> ${notes || 'None'}</p>
          </div>
          
          <p style="color: #64748b; font-size: 14px;">
            This booking was submitted via the Altura Health website contact form.
          </p>
        </div>
      `
    });

    res.status(200).json({ 
      message: 'Booking submitted successfully', 
      id: data.id,
      status: 'confirmed'
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ 
      error: 'Failed to send booking. Please try again or contact us directly.' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Altura booking server running on port ${PORT}`));