import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  CheckCircle, 
  MapPin, 
  Calendar, 
  Clock, 
  Search, 
  AlertCircle, 
  Download, 
  FolderOpen, 
  Camera, 
  Mail, 
  MailCheck,
  Phone,
  User
} from 'lucide-react';
import { createLostItem, fetchFoundItems, createMatch, markMatchEmailSent } from '../services/dbService.ts';
import { analyzeItemImage, calculateAIMatch } from '../services/aiService.ts';
import { sendLostReportConfirmationEmail, sendMatchNotificationEmail, EmailNotificationResponse } from '../services/emailService.ts';
import { generateLostReportPdf } from '../services/reportPdfService.ts';
import { maskEmail } from '../services/privacyService.ts';
import { LostItem, FoundItem, PossibleMatch } from '../types.ts';
import confetti from 'canvas-confetti';

interface LostItemFormProps {
  onBack: () => void;
  onViewMatch: (match: PossibleMatch, lost: LostItem, found: FoundItem) => void;
  onReportSuccess: (item: LostItem) => void;
}

export const LostItemForm: React.FC<LostItemFormProps> = ({
  onBack,
  onViewMatch,
  onReportSuccess,
}) => {
  // Owner Contact Information (NO login required)
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [emailError, setEmailError] = useState('');

  // Item details
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('10:30 AM');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [submittedItem, setSubmittedItem] = useState<LostItem | null>(null);
  const [discoveredMatch, setDiscoveredMatch] = useState<{
    match: PossibleMatch;
    found: FoundItem;
  } | null>(null);
  const [emailNotification, setEmailNotification] = useState<EmailNotificationResponse | null>(null);
  const [confirmationEmailSent, setConfirmationEmailSent] = useState<boolean>(false);
  const [emailSendFailed, setEmailSendFailed] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Quick fill helper for testing without manual typing
  const handleFillSample = () => {
    setTitle('Calculus Textbook (Stewart 9th Edition)');
    setCategory('Books / Notes');
    setBrand('Cengage');
    setModel('9th Edition Hardcover');
    setColor('Blue');
    setLocation('Science Building Room 204');
    setDate(new Date().toISOString().split('T')[0]);
    setTime('10:30 AM');
    setDescription('Blue hardcover Calculus textbook with highlighted chapter 4 and student name inside front cover.');
    if (!ownerEmail) setOwnerEmail('student.test@campus.edu');
    if (!ownerName) setOwnerName('Kavya Sri');
  };

  const processFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);

      // Trigger Gemini AI image analysis
      setIsAnalyzing(true);
      const analysis = await analyzeItemImage(base64);
      setIsAnalyzing(false);

      if (analysis) {
        if (analysis.name && !title) setTitle(analysis.name);
        if (analysis.category) setCategory(analysis.category);
        if (analysis.brand && !brand) setBrand(analysis.brand);
        if (analysis.model && !model) setModel(analysis.model);
        if (analysis.color && !color) setColor(analysis.color);
        if (analysis.generalAppearance && !description) {
          setDescription(analysis.generalAppearance);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    const cleanEmail = ownerEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setEmailError('Please provide a valid email address (e.g. name@campus.edu or name@gmail.com).');
      return;
    }

    if (!title.trim() || !location.trim()) {
      alert('Please provide an item name and the location where it was lost.');
      return;
    }

    setIsSubmitting(true);
    setEmailSendFailed(false);
    setConfirmationEmailSent(false);

    try {
      // 1. Save Lost Item in Firestore in lostItems collection with status = "LOST"
      const created = await createLostItem({
        ownerName: ownerName.trim() || 'Student',
        ownerEmail: cleanEmail,
        ownerPhone: ownerPhone.trim() || undefined,
        title: title.trim(),
        itemName: title.trim(),
        category,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        color: color.trim() || undefined,
        location: location.trim(),
        lostLocation: location.trim(),
        date,
        lostDate: date,
        time,
        lostTime: time,
        description: description.trim(),
        imageUrl: imagePreview || undefined,
        image: imagePreview || undefined,
        status: 'LOST',
      });

      // 1b. Immediately dispatch confirmation receipt email to that address
      try {
        const confirmResult = await sendLostReportConfirmationEmail({
          to: cleanEmail,
          reportId: created.reportId || created.id,
          ownerName: created.ownerName || 'Student',
          title: created.title,
          category: created.category,
          color: created.color,
          location: created.location,
          date: created.date,
          time: created.time,
        });
        if (confirmResult.sent) {
          setConfirmationEmailSent(true);
        } else {
          setEmailSendFailed(true);
        }
      } catch (confirmErr) {
        console.error('Error sending lost report confirmation email:', confirmErr);
        setEmailSendFailed(true);
      }

      // 2. Search existing active FOUND items for possible matches (>= 70% confidence)
      const foundItems = await fetchFoundItems();
      const potentialMatches: {
        found: FoundItem;
        score: number;
        reasons: string[];
        aiNotes: string;
        breakdown: any;
      }[] = [];

      for (const f of foundItems) {
        if (f.status === 'RETURNED') continue;
        const comparison = await calculateAIMatch(created, f);
        if (comparison.confidenceScore >= 70) {
          potentialMatches.push({
            found: f,
            score: comparison.confidenceScore,
            reasons: comparison.reasons,
            aiNotes: comparison.aiNotes,
            breakdown: comparison.breakdown,
          });
        }
      }

      // Sort by score descending and take up to top 3 matches
      potentialMatches.sort((a, b) => b.score - a.score);
      const topMatches = potentialMatches.slice(0, 3);

      let bestMatch: { match: PossibleMatch; found: FoundItem } | null = null;
      let lastMatchEmailResult: EmailNotificationResponse | null = null;

      for (let i = 0; i < topMatches.length; i++) {
        const item = topMatches[i];
        const matchRecord = await createMatch({
          lostItemId: created.id,
          foundItemId: item.found.id,
          ownerEmail: cleanEmail,
          matchScore: item.score,
          confidenceScore: item.score,
          matchedFields: item.reasons,
          reasons: item.reasons,
          aiNotes: item.aiNotes,
          status: 'PENDING_REVIEW',
          breakdown: item.breakdown,
        });

        if (matchRecord) {
          if (i === 0) {
            bestMatch = { match: matchRecord, found: item.found };
          }

          if (!matchRecord.notified && !matchRecord.emailSent) {
            try {
              const emailResult = await sendMatchNotificationEmail({
                to: cleanEmail,
                lostItem: created,
                foundItem: item.found,
                confidenceScore: item.score,
                reasons: item.reasons,
              });
              if (emailResult.sent) {
                await markMatchEmailSent(matchRecord.id, cleanEmail);
                matchRecord.notified = true;
                matchRecord.emailSent = true;
                lastMatchEmailResult = emailResult;
              }
            } catch (emailErr) {
              console.error('Error sending match email notification:', emailErr);
            }
          }
        }
      }

      setSubmittedItem(created);
      setDiscoveredMatch(bestMatch);
      setEmailNotification(lastMatchEmailResult);
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
      onReportSuccess(created);
    } catch (err) {
      console.error('Error reporting lost item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!submittedItem) return;
    setIsDownloadingPdf(true);
    try {
      await generateLostReportPdf(submittedItem);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // =========================================================================
  // SUCCESS SCREEN
  // =========================================================================
  if (submittedItem) {
    const reportId = submittedItem.reportId || 'CF-LOST-001';

    return (
      <div className="max-w-2xl mx-auto py-8 px-4 animate-fade-in">
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-9 h-9" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            Lost Item Report Submitted
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mb-6">
            Your report is permanently logged in the campus repository and active for automated matching
          </p>

          {/* Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 text-left">
            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
              {/* Item Photo */}
              <div className="w-32 h-32 bg-white rounded-xl border border-slate-200 p-2 shrink-0 flex items-center justify-center shadow-xs overflow-hidden">
                {submittedItem.imageUrl ? (
                  <img
                    src={submittedItem.imageUrl}
                    alt={submittedItem.title}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">Photo on record</span>
                )}
              </div>

              {/* Specific Required Fields */}
              <div className="flex-1 space-y-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Lost Report ID:</span>
                  <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    {reportId}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Owner:</span>
                  <span className="font-semibold text-slate-800">
                    {submittedItem.ownerName}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Notification Email:</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {submittedItem.ownerEmail ? maskEmail(submittedItem.ownerEmail) : 'Saved'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Item Name:</span>
                  <span className="font-bold text-slate-900">
                    {submittedItem.title}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Category / Color:</span>
                  <span className="font-medium text-slate-800">
                    {submittedItem.category} {submittedItem.color ? `(${submittedItem.color})` : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Lost Location:</span>
                  <span className="font-medium text-slate-800">
                    {submittedItem.location}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Date / Time:</span>
                  <span className="font-medium text-slate-800">
                    {submittedItem.date} {submittedItem.time ? `at ${submittedItem.time}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Email notification status notice */}
            {confirmationEmailSent ? (
              <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2">
                <MailCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>"Lost report received" confirmation email sent to {maskEmail(submittedItem.ownerEmail || '')}.</span>
              </div>
            ) : null}
          </div>

          {/* DOWNLOAD LOST ITEM REPORT BUTTON */}
          <div className="mb-6">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="w-full py-3.5 px-6 rounded-xl bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white font-bold text-sm sm:text-base transition-colors shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating A4 PDF Report...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>DOWNLOAD LOST ITEM REPORT (PDF)</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Generates an official A4 printable PDF with photo, report ID & verification guidelines
            </p>
          </div>

          {/* MATCH FOUND BANNER */}
          {discoveredMatch && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6 text-left">
              <div className="flex items-center gap-2 text-purple-700 font-bold mb-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>Possible Match Found Immediately!</span>
                <span className="ml-auto bg-purple-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">
                  {discoveredMatch.match.confidenceScore}% Match
                </span>
              </div>
              <p className="text-sm text-purple-950 mb-3">
                A matching <span className="font-semibold text-slate-900">{discoveredMatch.found.title}</span> was already turned in at <span className="font-medium">{discoveredMatch.found.location}</span>.
              </p>

              {emailNotification?.sent && (
                <div className="mt-2 mb-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-medium">
                  <MailCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Possible match notification emailed to {maskEmail(submittedItem.ownerEmail || '')}.</span>
                </div>
              )}

              <button
                onClick={() => onViewMatch(discoveredMatch.match, submittedItem, discoveredMatch.found)}
                className="w-full sm:w-auto bg-purple-700 hover:bg-purple-800 text-white font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm text-sm cursor-pointer"
              >
                <Search className="w-4 h-4" />
                View Possible Match & Claim
              </button>
            </div>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setSubmittedItem(null);
                setDiscoveredMatch(null);
                setTitle('');
                setBrand('');
                setModel('');
                setColor('');
                setLocation('');
                setDescription('');
                setImagePreview(null);
              }}
              className="px-5 py-2.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-white font-medium transition-colors text-sm cursor-pointer"
            >
              Report Another Lost Item
            </button>
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-lg border border-slate-300 font-medium text-slate-700 hover:bg-slate-50 transition-colors text-sm cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LOST ITEM FORM (NO LOGIN REQUIRED)
  // =========================================================================
  return (
    <div className="max-w-2xl mx-auto py-6 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900">Report Lost Item</h1>
            <button
              type="button"
              onClick={handleFillSample}
              className="text-xs text-purple-700 hover:text-purple-900 font-semibold underline cursor-pointer"
            >
              Fill Sample Example
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Submit your lost item details. Matches will be automatically emailed to your address.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 sm:p-7 shadow-sm border border-slate-200 space-y-5">
        {/* OWNER NOTIFICATION & CONTACT CARD (REQUIRED EMAIL, OPTIONAL PHONE/NAME) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <Mail className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Notification & Contact Information
            </h3>
          </div>

          {emailError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{emailError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Your Email <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={(e) => {
                    setOwnerEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="your.email@university.edu or personal@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 outline-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                This is the <strong>ONLY</strong> address used to notify you when a matching item is found.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Kavya Sri"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:border-purple-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="e.g. (555) 019-2834"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:border-purple-600 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Photo Upload */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">
            Item Photo <span className="text-slate-400 font-normal">(Optional, helps AI matching)</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            tabIndex={-1}
            aria-label="Upload photo from device file system"
          />

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="hidden"
            tabIndex={-1}
            aria-label="Take photo with camera"
          />

          {/* Clickable & Draggable Box to open File Explorer */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`relative border-2 border-dashed rounded-xl p-5 transition-all text-center cursor-pointer select-none group ${
              isDragging
                ? 'border-purple-600 bg-purple-100/50 scale-[1.01]'
                : 'border-slate-300 hover:border-purple-600 hover:bg-purple-50/40 bg-slate-50/50'
            }`}
          >
            {imagePreview ? (
              <div className="flex flex-col items-center">
                <div className="relative group-hover:scale-[1.02] transition-transform">
                  <img
                    src={imagePreview}
                    alt="Lost Item Preview"
                    className="max-h-48 rounded-lg object-contain mx-auto shadow-sm bg-white p-2 border border-slate-200"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2">
                    <FolderOpen className="w-5 h-5" />
                    <span>Upload New Photo</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-purple-700" />
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Remove Photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center">
                <div className="w-14 h-14 bg-purple-100 group-hover:bg-purple-200 text-purple-700 rounded-full flex items-center justify-center mb-3 transition-colors">
                  <FolderOpen className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                  Choose Photo from Device
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Browse device files or drag & drop photo here (JPG, PNG, WEBP)
                </p>
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Select Image from Device
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-600" /> Take Photo
                  </button>
                </div>
              </div>
            )}
          </div>

          {isAnalyzing && (
            <div className="flex items-center gap-2 mt-2 text-xs font-medium text-purple-700 animate-pulse">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Analyzing item visual features...</span>
            </div>
          )}
        </div>

        {/* Item Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Item Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dell Inspiron 15 Laptop, Graphing Calculator, Keys, Biology Textbook"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden text-sm transition-all"
          />
        </div>

        {/* Category & Color */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden text-sm bg-white"
            >
              <option value="Electronics">Electronics / Headphones</option>
              <option value="Charger">Charger / Adapter</option>
              <option value="Water Bottle">Water Bottle / Tumbler</option>
              <option value="Bag / Backpack">Bag / Backpack</option>
              <option value="ID / Card">Student ID / Wallet / Cards</option>
              <option value="Keys">Keys / Keychain</option>
              <option value="Apparel">Apparel / Jacket / Hat</option>
              <option value="Books / Notes">Books / Notebooks</option>
              <option value="Jewelry / Watch">Jewelry / Watch</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Color</label>
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="e.g. White, Green, Blue, Black"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden text-sm"
            />
          </div>
        </div>

        {/* Brand & Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Brand (Optional)</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Apple, Dell, Hydro Flask, Vivo"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Model (Optional)</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Inspiron 15, AirPods Pro, Stewart 9th Ed"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden text-sm"
            />
          </div>
        </div>

        {/* Lost Location */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Lost Location <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. College Canteen, Science Building Room 204, Library"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden text-sm"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Date Lost</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden text-sm bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Approximate Time</label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 10:30 AM"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden text-sm bg-white"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe distinguishing marks, stickers, scratches, or contents..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-100 outline-hidden text-sm resize-none"
          />
        </div>

        {/* SUBMIT BUTTON: REPORT ITEM AS LOST */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-xl bg-indigo-950 hover:bg-indigo-900 active:bg-slate-950 text-white font-bold text-base transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Saving Report & Checking AI Matches...</span>
            </>
          ) : (
            <span>REPORT ITEM AS LOST</span>
          )}
        </button>
      </form>
    </div>
  );
};
