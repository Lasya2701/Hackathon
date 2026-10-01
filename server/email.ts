import { Express, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface ServerEmailLogEntry {
  id: string;
  type: 'LOST_CONFIRMATION' | 'FOUND_CONFIRMATION' | 'MATCH_NOTIFICATION' | 'CLAIM_APPROVED' | 'ITEM_RETURNED' | 'TEST_EMAIL';
  recipient: string;
  recipientMasked: string;
  subject: string;
  status: 'SENT' | 'FAILED';
  messageId?: string;
  error?: string;
  timestamp: string;
  details?: Record<string, any>;
}

// In-memory persistent server audit logs for admin inspection
const emailAuditLogs: ServerEmailLogEntry[] = [];

function maskEmailAddress(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export function recordServerAuditLog(entry: Omit<ServerEmailLogEntry, 'id' | 'timestamp' | 'recipientMasked'> & { recipientMasked?: string }): ServerEmailLogEntry {
  const log: ServerEmailLogEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    ...entry,
    recipientMasked: entry.recipientMasked || maskEmailAddress(entry.recipient),
    timestamp: new Date().toISOString(),
  };
  emailAuditLogs.unshift(log);
  if (emailAuditLogs.length > 250) {
    emailAuditLogs.pop();
  }
  return log;
}

export function getSmtpCredentials() {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (
    process.env.SMTP_APP_PASSWORD ||
    process.env.SMTP_PASSWORD ||
    process.env.SMTP_PASS ||
    ''
  ).trim();
  const rawPort = process.env.SMTP_PORT;
  const smtpPort = rawPort ? parseInt(rawPort, 10) : 465;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  const fromAddr = process.env.EMAIL_FROM || process.env.SMTP_FROM || (smtpUser ? `"CampusFind AI" <${smtpUser}>` : '');
  const smtpFrom = fromAddr.includes('<') ? fromAddr : (smtpUser ? `"CampusFind AI" <${fromAddr}>` : '');

  const missing: string[] = [];
  if (!smtpHost) missing.push('SMTP_HOST');
  if (!smtpUser) missing.push('SMTP_USER');
  if (!smtpPass) missing.push('SMTP_APP_PASSWORD');

  const isConfigured = Boolean(smtpHost && smtpUser && smtpPass);

  return {
    smtpHost,
    smtpUser,
    smtpPass,
    smtpPort,
    smtpSecure,
    smtpFrom,
    isConfigured,
    missing,
  };
}

function createSmtpTransporter(creds: ReturnType<typeof getSmtpCredentials>) {
  return nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpSecure, // true for port 465 (SSL)
    auth: {
      user: creds.smtpUser,
      pass: creds.smtpPass,
    },
  });
}

export function registerEmailRoutes(app: Express) {
  // Check if SMTP environment is configured and list missing variables
  app.get('/api/email-status', (_req: Request, res: Response) => {
    const creds = getSmtpCredentials();
    return res.json({
      configured: creds.isConfigured,
      host: creds.smtpHost,
      user: creds.smtpUser,
      port: creds.smtpPort,
      from: creds.smtpFrom,
      missingVariables: creds.missing,
    });
  });

  // Return server audit logs for admin portal inspection (includes message-IDs and delivery statuses)
  app.get('/api/email-audit-logs', (_req: Request, res: Response) => {
    return res.json({
      logs: emailAuditLogs,
      total: emailAuditLogs.length,
    });
  });

  // Verify SMTP Authentication without sending any email
  app.get('/api/verify-smtp', async (_req: Request, res: Response) => {
    const creds = getSmtpCredentials();

    if (!creds.isConfigured) {
      return res.status(400).json({
        success: false,
        authenticated: false,
        message: 'SMTP authentication failed',
        reason: `Missing required environment variables: ${creds.missing.join(', ')}`,
        missingVariables: creds.missing,
        user: creds.smtpUser || 'not configured',
        host: creds.smtpHost,
        port: creds.smtpPort,
      });
    }

    try {
      const transporter = createSmtpTransporter(creds);
      await transporter.verify();

      return res.json({
        success: true,
        authenticated: true,
        message: 'SMTP authentication successful',
        user: creds.smtpUser,
        host: creds.smtpHost,
        port: creds.smtpPort,
        secure: creds.smtpSecure,
      });
    } catch (err: any) {
      let safeError = err?.message || 'SMTP authentication failed';
      if (safeError.includes('535-5.7.8') || safeError.includes('BadCredentials')) {
        safeError = 'Gmail Authentication Failed: Bad credentials. Check that SMTP_USER is your full Gmail address and SMTP_APP_PASSWORD is the 16-character App Password.';
      }
      if (creds.smtpPass) {
        safeError = safeError.replaceAll(creds.smtpPass, '[REDACTED]');
      }

      return res.status(401).json({
        success: false,
        authenticated: false,
        message: 'SMTP authentication failed',
        error: safeError,
        user: creds.smtpUser,
        host: creds.smtpHost,
        port: creds.smtpPort,
      });
    }
  });

  // 1. Send Test Email (Both GET and POST supported for easy testing in browser and Admin UI)
  const handleTestEmail = async (req: Request, res: Response) => {
    const creds = getSmtpCredentials();
    const to = (req.body?.to || req.query?.to as string || creds.smtpUser || '').trim();

    if (!to || !to.includes('@')) {
      const errorMsg = 'A valid recipient email address is required for sending a test email';
      recordServerAuditLog({
        type: 'TEST_EMAIL',
        recipient: to || 'unknown',
        subject: 'CampusFind AI — Test Connection Email',
        status: 'FAILED',
        error: errorMsg,
      });
      return res.status(400).json({ success: false, sent: false, error: errorMsg });
    }

    if (!creds.isConfigured) {
      const errorMsg = `SMTP credentials not configured. Missing: ${creds.missing.join(', ')}`;
      recordServerAuditLog({
        type: 'TEST_EMAIL',
        recipient: to,
        subject: 'CampusFind AI — Test Connection Email',
        status: 'FAILED',
        error: errorMsg,
      });
      return res.status(400).json({ success: false, sent: false, error: errorMsg, missingVariables: creds.missing });
    }

    try {
      const transporter = createSmtpTransporter(creds);
      const subject = 'CampusFind AI — Test Connection Email';
      const text = `CampusFind AI SMTP connection test successful!\n\nSender: ${creds.smtpUser}\nRecipient: ${to}\nTimestamp: ${new Date().toISOString()}\n\nAll notification pipelines (Lost confirmation, Found confirmation, Match alerts, Claim OTPs, Return receipts) are operational.`;

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background-color: #1e1b4b; padding: 20px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 18px; margin: 0; font-weight: 800;">CampusFind <span style="color: #c084fc;">AI</span></h1>
      <p style="color: #cbd5e1; font-size: 12px; margin: 4px 0 0 0;">System Diagnostic Test Email</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 14px; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; font-weight: 600; margin-top: 0;">
        ✓ SMTP Connection & Delivery Test Successful!
      </p>
      <p style="font-size: 13px; color: #334155; line-height: 1.5;">
        This email confirms that the CampusFind AI Gmail SMTP integration is functioning and authorized to dispatch live notifications to students and staff.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; margin: 16px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Sender:</strong> ${creds.smtpUser}</p>
        <p style="margin: 0 0 6px 0;"><strong>Recipient:</strong> ${to}</p>
        <p style="margin: 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

      const info = await transporter.sendMail({
        from: creds.smtpFrom,
        to,
        subject,
        text,
        html,
      });

      recordServerAuditLog({
        type: 'TEST_EMAIL',
        recipient: to,
        subject,
        status: 'SENT',
        messageId: info.messageId,
      });

      return res.json({
        success: true,
        sent: true,
        sender: creds.smtpUser,
        recipient: to,
        messageId: info.messageId,
      });
    } catch (err: any) {
      console.error('[Email Service] Test email error:', err);
      let errorNote = err?.message || 'SMTP delivery failure';
      if (creds.smtpPass) {
        errorNote = errorNote.replaceAll(creds.smtpPass, '[REDACTED]');
      }

      recordServerAuditLog({
        type: 'TEST_EMAIL',
        recipient: to,
        subject: 'CampusFind AI — Test Connection Email',
        status: 'FAILED',
        error: errorNote,
      });

      return res.status(500).json({
        success: false,
        sent: false,
        error: errorNote,
        recipient: to,
      });
    }
  };

  app.get('/api/send-test-email', handleTestEmail);
  app.post('/api/send-test-email', handleTestEmail);

  // 2. Send Lost Report Confirmation Email to Reporter Immediately
  app.post('/api/send-lost-confirmation', async (req: Request, res: Response) => {
    const creds = getSmtpCredentials();
    const { to, reportId, ownerName, title, category, location, date, time } = req.body;

    if (!to || !to.includes('@')) {
      const errorMsg = 'A valid recipient email address is required';
      recordServerAuditLog({
        type: 'LOST_CONFIRMATION',
        recipient: to || 'missing',
        subject: 'Lost Report Confirmation',
        status: 'FAILED',
        error: errorMsg,
      });
      return res.status(400).json({ success: false, sent: false, error: errorMsg });
    }

    const recipient = to.trim();
    const displayName = ownerName || 'Student';
    const repId = reportId || 'CF-LOST-' + Math.floor(100 + Math.random() * 900);
    const itemTitle = title || 'Reported Lost Item';
    const itemCategory = category || 'Item';
    const itemColor = req.body?.color || 'N/A';
    const lostLoc = location || 'Campus Location';
    const lostDate = date || new Date().toISOString().split('T')[0];
    const lostTime = time || '';

    const subject = `Lost report received: ${itemTitle} (${repId})`;

    const textMessage = `Hello ${displayName},

Your lost item report has been successfully registered in the CampusFind AI system.

Report Details:
- Report ID: ${repId}
- Item Name: ${itemTitle}
- Category: ${itemCategory}
- Color: ${itemColor}
- Location Lost: ${lostLoc}
- Date/Time: ${lostDate} ${lostTime ? 'at ' + lostTime : ''}
- Status: LOST (Active Monitoring)

Note: We will email you as soon as a matching found item is reported.

Thank you,
CampusFind AI Team`;

    const htmlMessage = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #1e1b4b; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 20px; margin: 0; font-weight: 800;">CampusFind <span style="color: #c084fc;">AI</span></h1>
      <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">Lost Report Confirmation</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 15px; margin-top: 0; color: #1e293b;">Hello <strong>${displayName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        Your lost item report has been securely registered in the campus repository.
      </p>
      <div style="background-color: #f1f5f9; border-left: 4px solid #7c3aed; padding: 14px 16px; margin: 18px 0; border-radius: 6px;">
        <p style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #6d28d9; margin: 0 0 6px 0;">Registered Report Summary</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Report ID:</strong> <span style="font-family: monospace; color: #4338ca;">${repId}</span></p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Item Name:</strong> ${itemTitle}</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Category:</strong> ${itemCategory}</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Color:</strong> ${itemColor}</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Location Lost:</strong> ${lostLoc}</p>
        <p style="font-size: 14px; margin: 0;"><strong>Date / Time:</strong> ${lostDate} ${lostTime ? 'at ' + lostTime : ''}</p>
      </div>
      <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 14px 16px; margin: 18px 0; font-size: 13px; color: #581c87; line-height: 1.5;">
        <strong>Important Note:</strong>
        <p style="margin: 6px 0 0 0; font-weight: 600;">We will email you as soon as a matching found item is reported.</p>
      </div>
      <p style="font-size: 14px; color: #64748b; margin: 24px 0 0 0;">
        Thank you,<br><strong>CampusFind AI</strong>
      </p>
    </div>
  </div>
</body>
</html>`;

    if (!creds.isConfigured) {
      const errorMsg = `SMTP credentials not configured on server. Missing: ${creds.missing.join(', ')}`;
      recordServerAuditLog({
        type: 'LOST_CONFIRMATION',
        recipient,
        subject,
        status: 'FAILED',
        error: errorMsg,
        details: { reportId: repId, itemTitle },
      });
      return res.status(500).json({ success: false, sent: false, error: errorMsg });
    }

    try {
      const transporter = createSmtpTransporter(creds);
      const info = await transporter.sendMail({
        from: creds.smtpFrom,
        to: recipient,
        subject,
        text: textMessage,
        html: htmlMessage,
      });

      recordServerAuditLog({
        type: 'LOST_CONFIRMATION',
        recipient,
        subject,
        status: 'SENT',
        messageId: info.messageId,
        details: { reportId: repId, itemTitle },
      });

      return res.json({
        success: true,
        sent: true,
        recipient,
        messageId: info.messageId,
      });
    } catch (err: any) {
      console.error('[Email Service] Lost confirmation error:', err);
      let errorNote = err?.message || 'SMTP delivery failure';
      if (creds.smtpPass) errorNote = errorNote.replaceAll(creds.smtpPass, '[REDACTED]');

      recordServerAuditLog({
        type: 'LOST_CONFIRMATION',
        recipient,
        subject,
        status: 'FAILED',
        error: errorNote,
        details: { reportId: repId, itemTitle },
      });

      return res.status(500).json({ success: false, sent: false, error: errorNote, recipient });
    }
  });

  // 3. Send Found Report Confirmation Email to Finder
  app.post('/api/send-found-confirmation', async (req: Request, res: Response) => {
    const creds = getSmtpCredentials();
    const { to, finderName, title, category, location, date, time, storageLocation } = req.body;

    if (!to || !to.includes('@')) {
      const errorMsg = 'A valid finder email address is required';
      recordServerAuditLog({
        type: 'FOUND_CONFIRMATION',
        recipient: to || 'missing',
        subject: 'Found Report Confirmation',
        status: 'FAILED',
        error: errorMsg,
      });
      return res.status(400).json({ success: false, sent: false, error: errorMsg });
    }

    const recipient = to.trim();
    const displayName = finderName || 'Campus Citizen';
    const itemTitle = title || 'Found Item';
    const itemCategory = category || 'Item';
    const foundLoc = location || 'Campus Area';
    const foundDate = date || new Date().toISOString().split('T')[0];
    const foundTime = time || '';
    const storage = storageLocation || 'Campus Security Custody Vault';

    const subject = `CampusFind AI — Thank You for Turning in a Found Item`;

    const textMessage = `Hello ${displayName},

Thank you for being a responsible campus member and registering a found item with CampusFind AI.

Found Item Details:
- Item: ${itemTitle}
- Category: ${itemCategory}
- Location Found: ${foundLoc}
- Date/Time: ${foundDate} ${foundTime ? 'at ' + foundTime : ''}
- Custody / Storage: ${storage}
- Status: UNCLAIMED (Active Vault Custody)

Our AI matching engine is currently cross-referencing this item against active lost item reports. If a compatible match is verified, the original owner will be notified to claim it from the security desk using an encrypted pickup OTP.

Thank you for helping keep our campus honest and connected!

CampusFind AI Team`;

    const htmlMessage = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #064e3b; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 20px; margin: 0; font-weight: 800;">CampusFind <span style="color: #6ee7b7;">AI</span></h1>
      <p style="color: #d1fae5; font-size: 13px; margin: 4px 0 0 0;">Found Item Receipt & Confirmation</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 15px; margin-top: 0; color: #1e293b;">Hello <strong>${displayName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        Thank you for turning in a lost item and registering it on CampusFind AI. Your report helps reconnect students with their belongings.
      </p>
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 16px; margin: 18px 0; border-radius: 6px;">
        <p style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #047857; margin: 0 0 6px 0;">Registered Found Item</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Item:</strong> ${itemTitle}</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Category:</strong> ${itemCategory}</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Location Found:</strong> ${foundLoc}</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Custody Storage:</strong> ${storage}</p>
        <p style="font-size: 14px; margin: 0;"><strong>Date:</strong> ${foundDate} ${foundTime ? 'at ' + foundTime : ''}</p>
      </div>
      <p style="font-size: 13px; color: #475569; line-height: 1.5;">
        Our AI matching system is actively comparing this record with student lost reports. When the owner claims the item, custody will be securely verified at the desk.
      </p>
      <p style="font-size: 14px; color: #64748b; margin: 24px 0 0 0;">
        Thank you,<br><strong>CampusFind AI</strong>
      </p>
    </div>
  </div>
</body>
</html>`;

    if (!creds.isConfigured) {
      const errorMsg = `SMTP credentials not configured on server. Missing: ${creds.missing.join(', ')}`;
      recordServerAuditLog({
        type: 'FOUND_CONFIRMATION',
        recipient,
        subject,
        status: 'FAILED',
        error: errorMsg,
        details: { itemTitle },
      });
      return res.status(500).json({ success: false, sent: false, error: errorMsg });
    }

    try {
      const transporter = createSmtpTransporter(creds);
      const info = await transporter.sendMail({
        from: creds.smtpFrom,
        to: recipient,
        subject,
        text: textMessage,
        html: htmlMessage,
      });

      recordServerAuditLog({
        type: 'FOUND_CONFIRMATION',
        recipient,
        subject,
        status: 'SENT',
        messageId: info.messageId,
        details: { itemTitle },
      });

      return res.json({
        success: true,
        sent: true,
        recipient,
        messageId: info.messageId,
      });
    } catch (err: any) {
      console.error('[Email Service] Found confirmation error:', err);
      let errorNote = err?.message || 'SMTP delivery failure';
      if (creds.smtpPass) errorNote = errorNote.replaceAll(creds.smtpPass, '[REDACTED]');

      recordServerAuditLog({
        type: 'FOUND_CONFIRMATION',
        recipient,
        subject,
        status: 'FAILED',
        error: errorNote,
        details: { itemTitle },
      });

      return res.status(500).json({ success: false, sent: false, error: errorNote, recipient });
    }
  });

  // 4. Send Match Notification Email to Lost Item Owner (>=70% confidence)
  app.post('/api/send-match-email', async (req: Request, res: Response) => {
    const creds = getSmtpCredentials();
    const { to, lostItem, foundItem, confidenceScore, matchScore } = req.body;

    if (!to || !to.includes('@')) {
      const errorMsg = 'A valid recipient email address is required';
      recordServerAuditLog({
        type: 'MATCH_NOTIFICATION',
        recipient: to || 'missing',
        subject: 'CampusFind AI - Possible Match Found for Your Lost Item',
        status: 'FAILED',
        error: errorMsg,
      });
      return res.status(400).json({ success: false, sent: false, error: errorMsg });
    }

    if (!lostItem || !foundItem) {
      const errorMsg = 'lostItem and foundItem details are required';
      return res.status(400).json({ success: false, sent: false, error: errorMsg });
    }

    const recipient = to.trim();
    const ownerDisplayName = lostItem.ownerName || 'Student';
    const confidence = confidenceScore || matchScore || 75;
    const itemLostName = lostItem.title || 'item';
    const matchedFoundName = foundItem.title || 'Found Item';
    const reasonsList = Array.isArray(req.body?.reasons) && req.body.reasons.length > 0
      ? req.body.reasons
      : (req.body?.matchedFields || ['Compatible category', 'Matching physical attributes', 'Nearby campus location', 'Correlated timeframe']);
    const storageLocation = foundItem.storageLocation || 'Campus Security Custody Desk / Vault';
    const reportId = lostItem.reportId || lostItem.id || '';
    const hostHeader = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'https';
    const appUrl = `${protocol}://${hostHeader}`;
    const claimLink = `${appUrl}/?reportId=${encodeURIComponent(reportId)}`;

    const subject = `Possible match found for your lost ${itemLostName}`;

    const textMessage = `Hello ${ownerDisplayName},

CampusFind AI has identified a possible match for your lost item!

Match Overview:
- Your Lost Item: ${itemLostName}
- Matched Found Item: ${matchedFoundName}
- Match Confidence: ${confidence}%
- Reasons: ${reasonsList.join(', ')}
- Where Item is Kept: ${storageLocation}

Next Steps to Reclaim Your Item:
Please visit the ${storageLocation} with proof of ownership, or open the app directly to review and claim:
${claimLink}

In the app, click "View Possible Match & Claim" and answer 2-3 questions about hidden details of your item to verify ownership and receive your security pickup OTP.

Thank you,
CampusFind AI Team`;

    const htmlMessage = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #1e1b4b; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 20px; margin: 0; font-weight: 800;">CampusFind <span style="color: #c084fc;">AI</span></h1>
      <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">Automated Match Alert</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 15px; margin-top: 0; color: #1e293b;">Hello <strong>${ownerDisplayName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        A possible match has been found for your lost <strong style="color: #4338ca;">${itemLostName}</strong>!
      </p>

      <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 16px; margin: 16px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #6d28d9; letter-spacing: 0.5px;">Match Overview</span>
          <span style="background-color: #7c3aed; color: #ffffff; font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">${confidence}% Confidence</span>
        </div>
        <p style="font-size: 14px; margin: 4px 0; color: #0f172a;"><strong>Matched Found Item:</strong> ${matchedFoundName}</p>
        <p style="font-size: 13px; margin: 4px 0; color: #334155;"><strong>Custody Location:</strong> ${storageLocation}</p>
        <p style="font-size: 13px; margin: 4px 0; color: #334155;"><strong>Matching Factors:</strong> ${reasonsList.join(', ')}</p>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 16px 0; font-size: 13px; line-height: 1.5; color: #334155;">
        <strong style="color: #0f172a;">Instructions to Reclaim:</strong>
        <p style="margin: 6px 0 12px 0;">
          Please visit the <strong>${storageLocation}</strong> with proof of ownership, or open the link below and click <strong>"View Possible Match & Claim"</strong> to answer 2-3 verification questions and request your security pickup code.
        </p>
        <div style="text-align: center; margin: 14px 0 6px 0;">
          <a href="${claimLink}" style="display: inline-block; background-color: #7c3aed; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(124, 58, 237, 0.2);">
            View Possible Match & Claim
          </a>
        </div>
        <p style="font-size: 11px; color: #64748b; text-align: center; margin: 6px 0 0 0;">
          Report ID: <code style="font-weight: 700; color: #4338ca;">${reportId}</code>
        </p>
      </div>

      <p style="font-size: 13px; color: #64748b; margin: 20px 0 0 0;">
        Thank you,<br><strong>CampusFind AI Team</strong>
      </p>
    </div>
  </div>
</body>
</html>`;

    if (!creds.isConfigured) {
      const errorMsg = `SMTP credentials not configured on server. Missing: ${creds.missing.join(', ')}`;
      recordServerAuditLog({
        type: 'MATCH_NOTIFICATION',
        recipient,
        subject,
        status: 'FAILED',
        error: errorMsg,
        details: { lostTitle: lostItem.title, foundTitle: foundItem.title, confidence },
      });
      return res.status(500).json({ success: false, sent: false, error: errorMsg });
    }

    try {
      const transporter = createSmtpTransporter(creds);
      const info = await transporter.sendMail({
        from: creds.smtpFrom,
        to: recipient,
        subject,
        text: textMessage,
        html: htmlMessage,
      });

      recordServerAuditLog({
        type: 'MATCH_NOTIFICATION',
        recipient,
        subject,
        status: 'SENT',
        messageId: info.messageId,
        details: { lostTitle: lostItem.title, foundTitle: foundItem.title, confidence },
      });

      return res.json({
        success: true,
        sent: true,
        recipient,
        messageId: info.messageId,
      });
    } catch (err: any) {
      console.error('[Email Service] Match notification error:', err);
      let errorNote = err?.message || 'SMTP delivery failure';
      if (creds.smtpPass) errorNote = errorNote.replaceAll(creds.smtpPass, '[REDACTED]');

      recordServerAuditLog({
        type: 'MATCH_NOTIFICATION',
        recipient,
        subject,
        status: 'FAILED',
        error: errorNote,
        details: { lostTitle: lostItem.title, foundTitle: foundItem.title, confidence },
      });

      return res.status(500).json({ success: false, sent: false, error: errorNote, recipient });
    }
  });

  // 5. Send Claim Approved (Pickup Code) and Item Returned Emails
  app.post('/api/send-claim-email', async (req: Request, res: Response) => {
    const creds = getSmtpCredentials();
    const { type, to, claimantName, itemTitle, pickupOtp, officerName, location } = req.body;

    if (!to || !to.includes('@')) {
      const errorMsg = 'A valid recipient email address is required';
      return res.status(400).json({ success: false, sent: false, error: errorMsg });
    }

    const recipient = to.trim();
    const name = claimantName || 'Student';
    const title = itemTitle || 'Item';
    const desk = location || 'Campus Security Custody Vault Desk';
    const officer = officerName || 'Campus Security Officer';

    let subject = '';
    let textMessage = '';
    let htmlMessage = '';

    if (type === 'CLAIM_APPROVED') {
      subject = `CampusFind AI — Ownership Claim Approved! (Pickup OTP: ${pickupOtp})`;
      textMessage = `Hello ${name},

Good news! Your ownership claim for "${title}" has been reviewed and APPROVED by campus security.

Your One-Time Pickup Code (OTP):
${pickupOtp}

Pickup Instructions:
1. Visit the ${desk}.
2. Present your Student/Faculty ID card.
3. Provide this 4-digit Pickup Code: ${pickupOtp}
4. The security officer will verify the code and release your item to you.

Desk Officer: ${officer}

Thank you for using CampusFind AI!`;

      htmlMessage = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #065f46; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 20px; margin: 0; font-weight: 800;">CampusFind <span style="color: #6ee7b7;">AI</span></h1>
      <p style="color: #d1fae5; font-size: 13px; margin: 4px 0 0 0;">Ownership Claim Approved</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 15px; margin-top: 0; color: #1e293b;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        Your ownership claim for <strong>${title}</strong> has been successfully verified and approved by campus security!
      </p>

      <div style="background-color: #ecfdf5; border: 2px dashed #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #047857; letter-spacing: 1px;">Your Official Pickup Code</span>
        <div style="font-size: 36px; font-weight: 900; letter-spacing: 6px; color: #065f46; font-family: monospace; margin: 8px 0;">
          ${pickupOtp}
        </div>
        <p style="font-size: 12px; color: #047857; margin: 0;">Show this code at the security desk to release your item.</p>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 13px; color: #334155;">
        <strong>Pickup Details:</strong>
        <p style="margin: 4px 0 2px 0;"><strong>Location:</strong> ${desk}</p>
        <p style="margin: 0 0 2px 0;"><strong>Officer in Charge:</strong> ${officer}</p>
        <p style="margin: 0;"><strong>Requirement:</strong> Valid Student / Staff ID card</p>
      </div>

      <p style="font-size: 14px; color: #64748b; margin: 24px 0 0 0;">
        Thank you,<br><strong>CampusFind AI</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
    } else {
      // ITEM_RETURNED
      subject = `CampusFind AI — Item Returned Successfully (${title})`;
      textMessage = `Hello ${name},

This email confirms that "${title}" has been successfully returned and custody handed over to you at the security desk.

Return Details:
- Item: ${title}
- Handed Over By: ${officer}
- Location: ${desk}
- Timestamp: ${new Date().toLocaleString()}
- Status: RETURNED (Closed)

Thank you for using CampusFind AI!`;

      htmlMessage = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <div style="background-color: #1e1b4b; padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; font-size: 20px; margin: 0; font-weight: 800;">CampusFind <span style="color: #c084fc;">AI</span></h1>
      <p style="color: #cbd5e1; font-size: 13px; margin: 4px 0 0 0;">Item Returned Confirmation</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 15px; margin-top: 0; color: #1e293b;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        This email confirms that <strong>${title}</strong> has been successfully returned and custody transferred to you at ${desk}.
      </p>
      <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px 16px; margin: 18px 0; border-radius: 6px;">
        <p style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #15803d; margin: 0 0 4px 0;">Custody Finalized</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Item:</strong> ${title}</p>
        <p style="font-size: 14px; margin: 0 0 4px 0;"><strong>Verified By:</strong> ${officer}</p>
        <p style="font-size: 14px; margin: 0;"><strong>Status:</strong> RETURNED TO OWNER</p>
      </div>
      <p style="font-size: 14px; color: #64748b; margin: 24px 0 0 0;">
        Thank you,<br><strong>CampusFind AI</strong>
      </p>
    </div>
  </div>
</body>
</html>`;
    }

    const logType = type === 'CLAIM_APPROVED' ? 'CLAIM_APPROVED' : 'ITEM_RETURNED';

    if (!creds.isConfigured) {
      const errorMsg = `SMTP credentials not configured on server. Missing: ${creds.missing.join(', ')}`;
      recordServerAuditLog({
        type: logType,
        recipient,
        subject,
        status: 'FAILED',
        error: errorMsg,
        details: { itemTitle: title, pickupOtp },
      });
      return res.status(500).json({ success: false, sent: false, error: errorMsg });
    }

    try {
      const transporter = createSmtpTransporter(creds);
      const info = await transporter.sendMail({
        from: creds.smtpFrom,
        to: recipient,
        subject,
        text: textMessage,
        html: htmlMessage,
      });

      recordServerAuditLog({
        type: logType,
        recipient,
        subject,
        status: 'SENT',
        messageId: info.messageId,
        details: { itemTitle: title, pickupOtp },
      });

      return res.json({
        success: true,
        sent: true,
        recipient,
        messageId: info.messageId,
      });
    } catch (err: any) {
      console.error('[Email Service] Claim email error:', err);
      let errorNote = err?.message || 'SMTP delivery failure';
      if (creds.smtpPass) errorNote = errorNote.replaceAll(creds.smtpPass, '[REDACTED]');

      recordServerAuditLog({
        type: logType,
        recipient,
        subject,
        status: 'FAILED',
        error: errorNote,
        details: { itemTitle: title, pickupOtp },
      });

      return res.status(500).json({ success: false, sent: false, error: errorNote, recipient });
    }
  });
}
