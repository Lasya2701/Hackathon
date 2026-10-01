import { jsPDF } from 'jspdf';
import { LostItem } from '../types.ts';

// Helper to convert SVG data URL or any image URL into a high-res PNG data URL for jsPDF embedding
export async function imageToDataUrl(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // High resolution canvas for sharp PDF printing
      canvas.width = 600;
      canvas.height = 450;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
        return;
      }
      resolve(src);
    };
    img.onerror = () => {
      resolve(src);
    };
    img.src = src;
  });
}

export async function generateLostReportPdf(item: LostItem): Promise<void> {
  // A4 size: 210 x 297 mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // 1. Header Bar
  doc.setFillColor(15, 23, 42); // Navy slate (#0f172a)
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title: CAMPUSFIND AI
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('CAMPUSFIND AI', margin, 14);

  // Tagline: FIND IT. MATCH IT. RETURN IT.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(192, 132, 252); // Light purple (#c084fc)
  doc.text('FIND IT. MATCH IT. RETURN IT.', margin, 21);

  // Status Badge in Header: LOST
  doc.setFillColor(225, 29, 72); // Crimson red badge
  doc.roundedRect(pageWidth - margin - 28, 8, 28, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('STATUS: LOST', pageWidth - margin - 14, 15.5, { align: 'center' });

  // 2. Document Title
  let y = 42;
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LOST ITEM REPORT', margin, y);

  // Lost Report ID Badge
  const reportId = item.reportId || 'CF-LOST-001';
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(109, 40, 217); // Purple-700
  doc.text(`Lost Report ID: ${reportId}`, pageWidth - margin, y, { align: 'right' });

  // Subtle separator line
  y += 5;
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);

  // 3. Main Info Grid (Left column: metadata, Right column: actual photo)
  y += 10;
  const leftColX = margin;
  const colGap = 10;
  const imageBoxWidth = 75;
  const imageBoxHeight = 65;
  const leftColWidth = contentWidth - imageBoxWidth - colGap;

  // Owner Name & Role
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('OWNER', leftColX, y);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(item.ownerName || 'Kavya Sri', leftColX, y + 5);

  if (item.ownerRole) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(item.ownerRole, leftColX + 45, y + 5);
  }

  // Item Name
  y += 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ITEM NAME', leftColX, y);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(item.title || 'Vivo FlashCharge 44W Charger', leftColX, y + 5);

  // Category & Brand
  y += 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('CATEGORY', leftColX, y);
  doc.text('BRAND', leftColX + 45, y);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(item.category || 'Charger', leftColX, y + 5);
  doc.text(item.brand || 'vivo', leftColX + 45, y + 5);

  // Model & Color
  y += 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('MODEL', leftColX, y);
  doc.text('COLOR', leftColX + 45, y);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(item.model || 'V4440H0A1-IN', leftColX, y + 5);
  doc.text(item.color || 'White', leftColX + 45, y + 5);

  // Right Column: Actual Charger Photo Box
  const imageX = pageWidth - margin - imageBoxWidth;
  const imageY = 47;

  // Background frame
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.roundedRect(imageX, imageY, imageBoxWidth, imageBoxHeight, 3, 3, 'FD');

  if (item.imageUrl) {
    try {
      const pngData = await imageToDataUrl(item.imageUrl);
      doc.addImage(
        pngData,
        'PNG',
        imageX + 2,
        imageY + 2,
        imageBoxWidth - 4,
        imageBoxHeight - 4,
        undefined,
        'FAST'
      );
    } catch (e) {
      console.warn('PDF image embedding error:', e);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Item Photo on File', imageX + imageBoxWidth / 2, imageY + imageBoxHeight / 2, {
        align: 'center',
      });
    }
  }

  // Label under photo
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('VERIFIED ITEM PHOTO', imageX + imageBoxWidth / 2, imageY + imageBoxHeight + 5, {
    align: 'center',
  });

  // 4. Incident Details Card
  y = Math.max(y + 16, imageY + imageBoxHeight + 14);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 32, 3, 3, 'FD');

  // Lost Location
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('LOST LOCATION', margin + 6, y + 8);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(item.location || 'College Library', margin + 6, y + 14);

  // Lost Date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('LOST DATE', margin + 70, y + 8);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(item.date || '28 September 2026', margin + 70, y + 14);

  // Approximate Time
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('APPROXIMATE TIME', margin + 120, y + 8);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(item.time || '2:30 PM', margin + 120, y + 14);

  // Status Indicator
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('STATUS', margin + 6, y + 23);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72); // Red
  doc.text('LOST (Active AI Matching in Vault)', margin + 26, y + 23);

  // 5. Description Box
  y += 40;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DESCRIPTION', margin, y);

  y += 5;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const descText =
    item.description ||
    'I lost my white Vivo FlashCharge 44W charger near the college library. It has vivo FlashCharge branding and model V4440H0A1-IN.';
  const splitDesc = doc.splitTextToSize(descText, contentWidth - 12);
  doc.text(splitDesc, margin + 6, y + 8);

  // 6. Security & Verification Section
  y += 42;
  doc.setFillColor(245, 243, 255); // Purple-50
  doc.setDrawColor(221, 214, 254);
  doc.roundedRect(margin, y, contentWidth, 38, 3, 3, 'FD');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(109, 40, 217); // Purple-700
  doc.text('CAMPUS SECURITY VERIFICATION PROTOCOL', margin + 6, y + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(76, 29, 149);
  const protocolText =
    '1. When a found item matching this report is turned in or scanned via QR, CampusFind AI detects a candidate match.\n' +
    '2. The item owner is prompted to provide private identifying verification before release.\n' +
    '3. Campus Security verifies private proof, issues a secure 4-digit Pickup OTP, and oversees physical handover.';
  doc.text(protocolText, margin + 6, y + 15);

  // 7. Footer / Stamp
  const footerY = pageHeight - 16;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text('Generated by CampusFind AI', margin, footerY);

  const reportDateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  doc.text(`Official Campus Lost & Found Audit Copy • ${reportDateStr}`, pageWidth - margin, footerY, {
    align: 'right',
  });

  // Save the PDF
  const filename = `${reportId}_Lost_Report.pdf`;
  doc.save(filename);
}
