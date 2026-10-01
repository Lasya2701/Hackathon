import { LostItem, FoundItem, EmailAuditLogEntry } from '../types.ts';
import { logAuditEmail } from './dbService.ts';

export interface EmailNotificationResponse {
  success: boolean;
  sent: boolean;
  configured?: boolean;
  sender?: string;
  recipient?: string;
  messageId?: string;
  timestamp?: string;
  error?: string;
  missingVariables?: string[];
}

/**
 * 1. Sends immediate confirmation email to the user when they submit a LOST report.
 */
export async function sendLostReportConfirmationEmail(params: {
  to: string;
  reportId: string;
  ownerName: string;
  title: string;
  category: string;
  color?: string;
  location: string;
  date: string;
  time?: string;
}): Promise<EmailNotificationResponse> {
  const { to, reportId, ownerName, title, category, color, location, date, time } = params;

  const subject = `Lost report received: ${title} (${reportId})`;

  if (!to || !to.trim() || !to.includes('@')) {
    const errorMsg = 'No valid recipient email address stored on the lost item report';
    await logAuditEmail({
      type: 'LOST_CONFIRMATION',
      recipient: to || 'missing',
      subject,
      status: 'FAILED',
      error: errorMsg,
      details: { reportId, title },
    });
    return { success: false, sent: false, error: errorMsg };
  }

  try {
    const response = await fetch('/api/send-lost-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to.trim(),
        reportId,
        ownerName,
        title,
        category,
        color,
        location,
        date,
        time,
      }),
    });

    const data: EmailNotificationResponse = await response.json();
    await logAuditEmail({
      type: 'LOST_CONFIRMATION',
      recipient: to.trim(),
      subject,
      status: data.sent ? 'SENT' : 'FAILED',
      messageId: data.messageId,
      error: data.error,
      details: { reportId, title },
    });
    return data;
  } catch (err: any) {
    const errorMsg = err?.message || 'Network connection to email service failed';
    await logAuditEmail({
      type: 'LOST_CONFIRMATION',
      recipient: to.trim(),
      subject,
      status: 'FAILED',
      error: errorMsg,
      details: { reportId, title },
    });
    return { success: false, sent: false, recipient: to, error: errorMsg };
  }
}

/**
 * 2. Sends immediate confirmation email to the finder when they submit a FOUND report.
 */
export async function sendFoundReportConfirmationEmail(params: {
  to: string;
  finderName: string;
  title: string;
  category: string;
  location: string;
  date: string;
  time?: string;
  storageLocation?: string;
}): Promise<EmailNotificationResponse> {
  const { to, finderName, title, category, location, date, time, storageLocation } = params;

  if (!to || !to.trim() || !to.includes('@')) {
    const errorMsg = 'No valid recipient email address stored on the found item report';
    await logAuditEmail({
      type: 'FOUND_CONFIRMATION',
      recipient: to || 'missing',
      subject: 'CampusFind AI — Thank You for Turning in a Found Item',
      status: 'FAILED',
      error: errorMsg,
      details: { title },
    });
    return { success: false, sent: false, error: errorMsg };
  }

  try {
    const response = await fetch('/api/send-found-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to.trim(),
        finderName,
        title,
        category,
        location,
        date,
        time,
        storageLocation,
      }),
    });

    const data: EmailNotificationResponse = await response.json();
    await logAuditEmail({
      type: 'FOUND_CONFIRMATION',
      recipient: to.trim(),
      subject: 'CampusFind AI — Thank You for Turning in a Found Item',
      status: data.sent ? 'SENT' : 'FAILED',
      messageId: data.messageId,
      error: data.error,
      details: { title },
    });
    return data;
  } catch (err: any) {
    const errorMsg = err?.message || 'Network connection to email service failed';
    await logAuditEmail({
      type: 'FOUND_CONFIRMATION',
      recipient: to.trim(),
      subject: 'CampusFind AI — Thank You for Turning in a Found Item',
      status: 'FAILED',
      error: errorMsg,
      details: { title },
    });
    return { success: false, sent: false, recipient: to, error: errorMsg };
  }
}

/**
 * 3. Triggers "possible match found" email to the lost-item owner (>= 70% confidence).
 */
export async function sendMatchNotificationEmail(params: {
  to: string;
  lostItem: LostItem;
  foundItem: FoundItem;
  confidenceScore?: number;
  reasons?: string[];
}): Promise<EmailNotificationResponse> {
  const { to, lostItem, foundItem, confidenceScore, reasons } = params;
  const subject = `Possible match found for your lost ${lostItem.title || 'item'}`;

  if (!to || !to.trim() || !to.includes('@')) {
    const errorMsg = 'No valid recipient email address stored on the lost item report';
    await logAuditEmail({
      type: 'MATCH_NOTIFICATION',
      recipient: to || 'missing',
      subject,
      status: 'FAILED',
      error: errorMsg,
      details: { lostTitle: lostItem.title, foundTitle: foundItem.title, confidence: confidenceScore },
    });
    return { success: false, sent: false, error: errorMsg };
  }

  try {
    const response = await fetch('/api/send-match-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to.trim(),
        confidenceScore: confidenceScore ?? 75,
        matchScore: confidenceScore ?? 75,
        reasons: reasons || [],
        lostItem: {
          id: lostItem.id,
          reportId: lostItem.reportId || lostItem.id,
          title: lostItem.title,
          category: lostItem.category,
          brand: lostItem.brand,
          model: lostItem.model,
          color: lostItem.color,
          location: lostItem.location,
          date: lostItem.date,
          time: lostItem.time,
          ownerName: lostItem.ownerName,
        },
        foundItem: {
          id: foundItem.id,
          title: foundItem.title,
          category: foundItem.category,
          location: foundItem.location,
          storageLocation: foundItem.storageLocation || 'Campus Security Custody Vault Desk',
          date: foundItem.date,
          time: foundItem.time,
          description: foundItem.description,
        },
      }),
    });

    const data: EmailNotificationResponse = await response.json();
    await logAuditEmail({
      type: 'MATCH_NOTIFICATION',
      recipient: to.trim(),
      subject,
      status: data.sent ? 'SENT' : 'FAILED',
      messageId: data.messageId,
      error: data.error,
      details: { lostTitle: lostItem.title, foundTitle: foundItem.title, confidence: confidenceScore },
    });
    return data;
  } catch (err: any) {
    const errorMsg = err?.message || 'Network connection to notification service failed';
    await logAuditEmail({
      type: 'MATCH_NOTIFICATION',
      recipient: to.trim(),
      subject,
      status: 'FAILED',
      error: errorMsg,
      details: { lostTitle: lostItem.title, foundTitle: foundItem.title, confidence: confidenceScore },
    });
    return { success: false, sent: false, recipient: to, error: errorMsg };
  }
}

/**
 * 4. Sends claim approved (with pickup OTP) email to claimant.
 */
export async function sendClaimApprovedEmail(params: {
  to: string;
  claimantName: string;
  itemTitle: string;
  pickupOtp: string;
  officerName?: string;
  location?: string;
}): Promise<EmailNotificationResponse> {
  const { to, claimantName, itemTitle, pickupOtp, officerName, location } = params;

  if (!to || !to.trim() || !to.includes('@')) {
    const errorMsg = 'No valid claimant email address';
    await logAuditEmail({
      type: 'CLAIM_APPROVED',
      recipient: to || 'missing',
      subject: `CampusFind AI — Ownership Claim Approved! (Pickup OTP: ${pickupOtp})`,
      status: 'FAILED',
      error: errorMsg,
      details: { itemTitle, pickupOtp },
    });
    return { success: false, sent: false, error: errorMsg };
  }

  try {
    const response = await fetch('/api/send-claim-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CLAIM_APPROVED',
        to: to.trim(),
        claimantName,
        itemTitle,
        pickupOtp,
        officerName,
        location,
      }),
    });

    const data: EmailNotificationResponse = await response.json();
    await logAuditEmail({
      type: 'CLAIM_APPROVED',
      recipient: to.trim(),
      subject: `CampusFind AI — Ownership Claim Approved! (Pickup OTP: ${pickupOtp})`,
      status: data.sent ? 'SENT' : 'FAILED',
      messageId: data.messageId,
      error: data.error,
      details: { itemTitle, pickupOtp },
    });
    return data;
  } catch (err: any) {
    const errorMsg = err?.message || 'Network connection to email service failed';
    await logAuditEmail({
      type: 'CLAIM_APPROVED',
      recipient: to.trim(),
      subject: `CampusFind AI — Ownership Claim Approved! (Pickup OTP: ${pickupOtp})`,
      status: 'FAILED',
      error: errorMsg,
      details: { itemTitle, pickupOtp },
    });
    return { success: false, sent: false, recipient: to, error: errorMsg };
  }
}

/**
 * 5. Sends item returned confirmation email to claimant.
 */
export async function sendItemReturnedEmail(params: {
  to: string;
  claimantName: string;
  itemTitle: string;
  officerName?: string;
  location?: string;
}): Promise<EmailNotificationResponse> {
  const { to, claimantName, itemTitle, officerName, location } = params;

  if (!to || !to.trim() || !to.includes('@')) {
    const errorMsg = 'No valid claimant email address';
    await logAuditEmail({
      type: 'ITEM_RETURNED',
      recipient: to || 'missing',
      subject: `CampusFind AI — Item Returned Successfully (${itemTitle})`,
      status: 'FAILED',
      error: errorMsg,
      details: { itemTitle },
    });
    return { success: false, sent: false, error: errorMsg };
  }

  try {
    const response = await fetch('/api/send-claim-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ITEM_RETURNED',
        to: to.trim(),
        claimantName,
        itemTitle,
        officerName,
        location,
      }),
    });

    const data: EmailNotificationResponse = await response.json();
    await logAuditEmail({
      type: 'ITEM_RETURNED',
      recipient: to.trim(),
      subject: `CampusFind AI — Item Returned Successfully (${itemTitle})`,
      status: data.sent ? 'SENT' : 'FAILED',
      messageId: data.messageId,
      error: data.error,
      details: { itemTitle },
    });
    return data;
  } catch (err: any) {
    const errorMsg = err?.message || 'Network connection to email service failed';
    await logAuditEmail({
      type: 'ITEM_RETURNED',
      recipient: to.trim(),
      subject: `CampusFind AI — Item Returned Successfully (${itemTitle})`,
      status: 'FAILED',
      error: errorMsg,
      details: { itemTitle },
    });
    return { success: false, sent: false, recipient: to, error: errorMsg };
  }
}

/**
 * 6. Sends test email (used in Admin Portal).
 */
export async function sendTestEmail(to?: string): Promise<EmailNotificationResponse> {
  try {
    const response = await fetch('/api/send-test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: to?.trim() }),
    });
    const data = await response.json();
    await logAuditEmail({
      type: 'TEST_EMAIL',
      recipient: to?.trim() || data.sender || 'unknown',
      subject: 'CampusFind AI — Test Connection Email',
      status: data.sent ? 'SENT' : 'FAILED',
      messageId: data.messageId,
      error: data.error,
    });
    return data;
  } catch (err: any) {
    return {
      success: false,
      sent: false,
      error: err?.message || 'Failed to dispatch test email',
    };
  }
}

/**
 * 7. Fetches server email audit logs for the Admin Portal.
 */
export async function fetchServerEmailLogs(): Promise<EmailAuditLogEntry[]> {
  try {
    const res = await fetch('/api/email-audit-logs');
    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
  } catch (err) {
    console.warn('Failed to fetch server audit logs:', err);
  }
  return [];
}

/**
 * 8. Fetches SMTP configuration status.
 */
export async function fetchSmtpStatus(): Promise<{
  configured: boolean;
  host: string;
  user: string;
  port: number;
  from: string;
  missingVariables?: string[];
}> {
  try {
    const res = await fetch('/api/email-status');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch SMTP status:', err);
  }
  return {
    configured: false,
    host: 'smtp.gmail.com',
    user: '',
    port: 465,
    from: '',
    missingVariables: ['SMTP_USER', 'SMTP_APP_PASSWORD'],
  };
}
