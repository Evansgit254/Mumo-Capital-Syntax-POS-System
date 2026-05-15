import nodemailer from 'nodemailer';
import { logger } from '../lib/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendApplicationReceived(data: {
  to: string;
  name: string;
  organizationName: string;
  applicationId: string;
}) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@mumo.app',
      to: data.to,
      subject: 'Mumo POS — Application Received',
      html: `
        <div style="font-family:Inter,sans-serif;
                    background:#121414;color:#e2e2e2;
                    padding:40px;max-width:600px">
          <h1 style="color:#6fd7d6;font-size:24px">
            Application Received
          </h1>
          <p>Hi ${data.name},</p>
          <p>We have received your application for 
             <strong>${data.organizationName}</strong> 
             to join the Mumo POS platform.</p>
          <p>Our team will review your application within 
             <strong>24 hours</strong>.</p>
          <p style="color:#8e9192">Application ID: 
             <code>${data.applicationId}</code></p>
          <p>You can track your status at:<br/>
             <a href="${process.env.VITE_CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/register/status/${data.applicationId}"
                style="color:#6fd7d6">
               Check Application Status
             </a>
          </p>
          <hr style="border-color:#444748;margin:32px 0"/>
          <p style="color:#8e9192;font-size:12px">
            © 2026 Mumo Global Systems
          </p>
        </div>
      `,
    });
    logger.info({ applicationId: data.applicationId }, 'Application received email sent');
  } catch (err) {
    logger.error({ err, applicationId: data.applicationId }, 'Failed to send application received email');
  }
}

export async function sendApplicationApproved(data: {
  to: string;
  name: string;
  organizationName: string;
  domain: string;
  loginUrl: string;
  tempPassword: string;
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@mumo.app',
    to: data.to,
    subject: 'Mumo POS — Your Account is Ready',
    html: `
      <div style="font-family:Inter,sans-serif;
                  background:#121414;color:#e2e2e2;
                  padding:40px;max-width:600px">
        <h1 style="color:#6fd7d6;font-size:24px">
          Welcome to Mumo POS
        </h1>
        <p>Hi ${data.name},</p>
        <p>Your property <strong>${data.organizationName}</strong> 
           has been approved and provisioned.</p>
        <div style="background:#1e2020;border:1px solid #444748;
                    border-radius:8px;padding:24px;margin:24px 0">
          <p style="margin:0 0 8px;color:#8e9192;font-size:12px;
                    text-transform:uppercase;letter-spacing:0.05em">
            YOUR LOGIN DETAILS
          </p>
          <p style="margin:4px 0">
            <strong>URL:</strong> 
            <a href="${data.loginUrl}" style="color:#6fd7d6">
              ${data.loginUrl}
            </a>
          </p>
          <p style="margin:4px 0">
            <strong>Email:</strong> ${data.to}
          </p>
          <p style="margin:4px 0">
            <strong>Temporary Password:</strong> 
            <code style="background:#282a2b;padding:2px 8px;
                         border-radius:4px">
              ${data.tempPassword}
            </code>
          </p>
        </div>
        <p style="color:#fbbc00">
          ⚠ Please change your password immediately after 
          your first login.
        </p>
        <hr style="border-color:#444748;margin:32px 0"/>
        <p style="color:#8e9192;font-size:12px">
          © 2026 Mumo Global Systems
        </p>
      </div>
    `,
  });
}

export async function sendApplicationRejected(data: {
  to: string;
  name: string;
  organizationName: string;
  reason: string;
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@mumo.app',
    to: data.to,
    subject: 'Mumo POS — Application Update',
    html: `
      <div style="font-family:Inter,sans-serif;
                  background:#121414;color:#e2e2e2;
                  padding:40px;max-width:600px">
        <h1 style="color:#ffb4ab;font-size:24px">
          Application Update
        </h1>
        <p>Hi ${data.name},</p>
        <p>After reviewing your application for 
           <strong>${data.organizationName}</strong>, 
           we are unable to proceed at this time.</p>
        <div style="background:#93000a;border-radius:8px;
                    padding:16px;margin:24px 0">
          <p style="margin:0;color:#ffdad6">
            <strong>Reason:</strong> ${data.reason}
          </p>
        </div>
        <p>If you believe this is an error, please contact 
           us at 
           <a href="mailto:support@mumo.app" 
              style="color:#6fd7d6">
             support@mumo.app
           </a>
        </p>
        <hr style="border-color:#444748;margin:32px 0"/>
        <p style="color:#8e9192;font-size:12px">
          © 2026 Mumo Global Systems
        </p>
      </div>
    `,
  });
}

export async function sendSuperAdminNotification(data: {
  organizationName: string;
  domain: string;
  adminEmail: string;
  propertyType: string;
  country: string;
  applicationId: string;
}) {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!superAdminEmail) return;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@mumo.app',
      to: superAdminEmail,
      subject: `New Application: ${data.organizationName}`,
      html: `
        <div style="font-family:Inter,sans-serif;
                    background:#121414;color:#e2e2e2;
                    padding:40px;max-width:600px">
          <h1 style="color:#6fd7d6;font-size:24px">
            New Tenant Application
          </h1>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:8px 0;color:#8e9192;width:140px">
                Organization:
              </td>
              <td>${data.organizationName}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#8e9192">Domain:</td>
              <td>${data.domain}.mumo.app</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#8e9192">Contact:</td>
              <td>${data.adminEmail}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#8e9192">Type:</td>
              <td>${data.propertyType}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#8e9192">Country:</td>
              <td>${data.country}</td>
            </tr>
          </table>
          <a href="${process.env.VITE_CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}/super-admin/applications"
             style="display:inline-block;margin-top:24px;
                    background:#008B8B;color:#fff;
                    padding:12px 24px;border-radius:8px;
                    text-decoration:none">
            Review Application
          </a>
          <hr style="border-color:#444748;margin:32px 0"/>
          <p style="color:#8e9192;font-size:12px">
            Application ID: ${data.applicationId}
          </p>
        </div>
      `,
    });
    logger.info({ applicationId: data.applicationId }, 'Super admin notification sent');
  } catch (err) {
    logger.error({ err }, 'Failed to send super admin notification');
  }
}
