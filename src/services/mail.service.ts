import axios from 'axios';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email using the API mail service as primary method.
 * If the API fails, falls back to SMTP.
 * @param options - Email options (to, subject, html)
 * @returns Promise resolving to the response from the successful service
 */
export const sendMail = async (options: MailOptions) => {
  try {
    // Try API first
    const apiResponse = await axios.post(
      `${process.env.API_MAIL_URL}`,
      {
        to: options.to,
        subject: options.subject,
        html: options.html,
        // from: process.env.API_MAIL_FROM,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_MAIL_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('API mail sent successfully:', apiResponse.data);
    return apiResponse.data;
  } catch (apiError) {
    console.warn('API mail failed, falling back to SMTP:', apiError);

    // Fallback to SMTP
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('SMTP mail sent successfully:', info.messageId);
    return info;
  }
};