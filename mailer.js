const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendBookingConfirmation({ to, patientName, doctorName, slotDate, startTime, endTime }) {
  await resend.emails.send({
    from: 'Slot Booking Portal <onboarding@resend.dev>',
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
  });
}

async function sendOtpEmail({ to, name, otp }) {
  await resend.emails.send({
    from: 'Slot Booking Portal <onboarding@resend.dev>',
    to,
    subject: 'Verify your account',
    html: `
      <h2>Verify your email</h2>
      <p>Hi ${name},</p>
      <p>Your verification code is:</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
      <p>This code expires in 10 minutes.</p>
    `,
  });
}

module.exports = { sendBookingConfirmation, sendOtpEmail };