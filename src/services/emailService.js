const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTP = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Yatri Car Rental Access Code",
    text: `Your OTP is: ${otp}. It will expire in 5 minutes.`,
    html: `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @media only screen and (max-width: 600px) {
            .container { padding: 20px !important; }
            .content { padding: 24px !important; }
            .otp { font-size: 28px !important; letter-spacing: 4px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc;">
        <div class="container" style="font-family: 'Inter', -apple-system, sans-serif; background-color: #f8fafc; padding: 40px; color: #0f172a;">
          <div class="content" style="max-width: 100%; width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03); box-sizing: border-box;">
            <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.025em; color: #0f172a;">Yatri Car Rental</h1>
            <p style="color: #64748b; font-size: 16px; margin-bottom: 32px; line-height: 1.5;">Please use the code below to verify your account.</p>
            
            <div class="otp" style="background: #0f172a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px; color: #ffffff; font-size: 36px; font-weight: 700; letter-spacing: 8px;">
              ${otp}
            </div>
            
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">
              This code expires in <b>5 minutes</b>. If you didn't request this, you can safely ignore this email.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 32px 0;">
            
            <p style="font-size: 12px; color: #cbd5e1; text-align: center; margin: 0;">
              &copy; ${new Date().getFullYear()} Yatri Car Rental. Secure & Reliable.
            </p>
          </div>
        </div>
      </body>
    </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP sent to ${email}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send OTP email");
  }
};

module.exports = { sendOTP };
