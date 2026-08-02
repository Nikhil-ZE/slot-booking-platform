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

module.exports = { sendBookingConfirmation };