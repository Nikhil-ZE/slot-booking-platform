const nodemailer = require('nodemailer');
const dns = require('dns');

// Force Node to prefer IPv4 resolution — Render's network can't reach
// Gmail over IPv6, which causes ENETUNREACH errors otherwise.
dns.setDefaultResultOrder('ipv4first');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // uses STARTTLS instead of implicit SSL on 465
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendBookingConfirmation({ to, patientName, doctorName, slotDate, startTime, endTime }) {
  const mailOptions = {
    from: `"Slot Booking Portal" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Appointment Confirmed',
    html: `
      <h2>Your appointment is confirmed!</h2>
      <p>Hi ${patientName},</p>
      <p>Your appointment with <strong>${doctorName}</strong> has been booked:</p>
      <ul>
        <li><strong>Date:</strong> ${slotDate}</li>
        <li><strong>Time:</strong> ${startTime} - ${endTime}</li>
      </ul>
      <p>Thank you for booking with us.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = { sendBookingConfirmation };