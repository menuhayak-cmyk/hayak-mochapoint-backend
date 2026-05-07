'use strict';
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a 2FA OTP email to the admin
 */
async function sendOTPEmail(toEmail, otp) {
  const { data, error } = await resend.emails.send({
    from: 'Mocha Point Admin <admin@hayak-menu.com>',
    to: toEmail,
    subject: `🔐 رمز التحقق الخاص بك: ${otp}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #1a1a1a; color: #fff; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #3d2817, #6b4423); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; color: #D5C69E;">☕ Mocha Point</h1>
          <p style="margin: 8px 0 0; color: #c8b89a; font-size: 14px;">لوحة الإدارة</p>
        </div>
        <div style="padding: 40px 32px; text-align: center;">
          <h2 style="color: #D5C69E; margin-bottom: 8px;">رمز التحقق الخاص بك</h2>
          <p style="color: #aaa; margin-bottom: 32px; font-size: 14px;">أدخل هذا الرمز لإكمال تسجيل الدخول. صالح لـ 10 دقائق فقط.</p>
          <div style="background: #2a2a2a; border: 2px solid #3d2817; border-radius: 12px; padding: 24px; display: inline-block; margin-bottom: 32px;">
            <span style="font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #D5C69E; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #666; font-size: 12px;">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
        </div>
        <div style="background: #111; padding: 16px; text-align: center;">
          <p style="color: #555; font-size: 11px; margin: 0;">© 2024 Mocha Point — Istanbul</p>
        </div>
      </div>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return data;
}

module.exports = { resend, sendOTPEmail };
