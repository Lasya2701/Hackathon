import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  Sparkles, 
  CheckCircle, 
  MapPin, 
  Calendar, 
  Clock, 
  Search, 
  FolderOpen, 
  Camera, 
  MailCheck, 
  ShieldCheck,
  Building2
} from 'lucide-react';
import { createFoundItem, fetchLostItems, createMatch, fetchMatches, markMatchEmailSent, MATCH_CREATION_THRESHOLD } from '../services/dbService.ts';
import { analyzeItemImage, calculateAIMatch } from '../services/aiService.ts';
import { sendMatchNotificationEmail } from '../services/emailService.ts';
import { maskEmail } from '../services/privacyService.ts';
import { FoundItem, LostItem, PossibleMatch } from '../types.ts';
import confetti from 'canvas-confetti';

interface FoundItemFormProps {
  onBack: () => void;
  onSuccessReturnHome?: () => void;
  onViewMatch?: (match: PossibleMatch, lost: LostItem, found: FoundItem) => void;
  isFromQrScan?: boolean;
}

export const FoundItemForm: React.FC<FoundItemFormProps> = ({
  onBack,
  onSuccessReturnHome,
  onViewMatch,
  isFromQrScan = false,
}) => {
  // Form state - NO login or finder email required
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('11:00 AM');
  const [description, setDescription] = useState('');
  const [secretDetail, setSecretDetail] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedItem, setSubmittedItem] = useState<FoundItem | null>(null);
  const [discoveredMatch, setDiscoveredMatch] = useState<{
    match: PossibleMatch;
    lost: LostItem;
  } | null>(null);
  const [notifiedCount, setNotifiedCount] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Quick fill helper for testing matching flow
  const handleFillSample = () => {
    setTitle('Vivo mobile charger');
    setCategory('Charger');
    setBrand('Vivo');
    setModel('FlashCharge adapter');
    setColor('White');
    setLocation('College Canteen');
    setDate(new Date().toISOString().split('T')[0]);
    setTime('12:45 PM');
    setDescription('Found white Vivo phone charger with fast charge cable near canteen lunch seating.');
    setSecretDetail('Type-C cable has tiny blue tape around the neck and serial ending in 44W');
  };

  const processFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setDetectionMessage(null);

      // Trigger Gemini AI image analysis to auto-extract details
      setIsAnalyzing(true);
      const analysis = await analyzeItemImage(base64);
      setIsAnalyzing(false);

      if (analysis && (analysis.name || analysis.category || analysis.brand || analysis.description || analysis.generalAppearance)) {
        if (analysis.name && !title) setTitle(analysis.name);
        if (analysis.category) setCategory(analysis.category);
        if (analysis.brand && !brand) setBrand(analysis.brand);
        if (analysis.model && !model) setModel(analysis.model);
        if (analysis.color && !color) setColor(analysis.color);
        const descText = analysis.description || analysis.generalAppearance;
        if (descText && !description && !descText.includes('Image received')) {
          setDescription(descText);
        }
        setDetectionMessage('Details auto-extracted by Gemini Vision. You can review and edit below.');
      } else {
        setDetectionMessage("Couldn't detect details, please fill in manually.");
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
    if (!title.trim() || !location.trim()) {
      alert('Please provide an item name and the location where you found it.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Save Found Item in Firestore in foundItems collection with status = "UNCLAIMED"
      // NO email or personal info needed from finder!
      const created = await createFoundItem({
        finderName: 'Campus Finder',
        title: title.trim(),
        itemName: title.trim(),
        category,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        color: color.trim() || undefined,
        location: location.trim(),
        foundLocation: location.trim(),
        date,
        foundDate: date,
        time,
        foundTime: time,
        description: description.trim(),
        secretDetail: secretDetail.trim() || undefined,
        privateSecretDetail: secretDetail.trim() || undefined,
        imageUrl: imagePreview || undefined,
        image: imagePreview || undefined,
        status: 'UNCLAIMED',
        storageLocation: 'Campus Security Custody Desk',
        custodyBy: 'Campus Security Desk',
      });

      // 2. Run match check against all open LOST reports
      const lostItems = await fetchLostItems();
      const existingMatches = await fetchMatches();

      let bestMatch: { match: PossibleMatch; lost: LostItem } | null = null;
      let countDispatched = 0;

      for (const l of lostItems) {
        if (l.status === 'RETURNED' || l.status === 'CLAIMED') continue;

        // Perform AI match comparison
        const comparison = await calculateAIMatch(l, created);

        // Check if confidence is >= 70%
        if (comparison.confidenceScore >= MATCH_CREATION_THRESHOLD) {
          const existing = existingMatches.find(
            (m) => m.lostItemId === l.id && m.foundItemId === created.id
          );

          const matchRecord = existing || (await createMatch({
            lostItemId: l.id,
            foundItemId: created.id,
            ownerEmail: l.ownerEmail || '',
            matchScore: comparison.confidenceScore,
            confidenceScore: comparison.confidenceScore,
            breakdown: comparison.breakdown,
            matchedFields: comparison.reasons,
            reasons: comparison.reasons,
            aiNotes: comparison.aiNotes,
            status: 'PENDING_REVIEW',
          }));

          if (matchRecord) {
            // Check notified flag to prevent duplicate emails
            if (!matchRecord.notified && !matchRecord.emailSent) {
              const targetRecipient = (l.ownerEmail || '').trim();
              if (targetRecipient && targetRecipient.includes('@')) {
                try {
                  const emailRes = await sendMatchNotificationEmail({
                    to: targetRecipient,
                    lostItem: l,
                    foundItem: created,
                    confidenceScore: comparison.confidenceScore,
                    reasons: comparison.reasons,
                  });

                  if (emailRes && emailRes.sent) {
                    await markMatchEmailSent(matchRecord.id, targetRecipient);
                    matchRecord.notified = true;
                    matchRecord.emailSent = true;
                    countDispatched++;
                  }
                } catch (emailErr) {
                  console.error(`Failed sending match notification to owner ${targetRecipient}:`, emailErr);
                }
              }
            }

            if (!bestMatch || comparison.confidenceScore > bestMatch.match.confidenceScore) {
              bestMatch = { match: matchRecord, lost: l };
            }
          }
        }
      }

      setSubmittedItem(created);
      setDiscoveredMatch(bestMatch);
      setNotifiedCount(countDispatched);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Error reporting found item:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION VIEW (NO EMAIL WARNING OR FINDER ERROR MESSAGES)
  if (submittedItem) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 animate-fade-in">
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Found Item Reported Successfully</h2>
          <p className="text-slate-600 mb-6 text-sm sm:text-base">
            Thank you for being a responsible campus member! Your report for <span className="font-semibold text-slate-800">{submittedItem.title}</span> has been securely logged.
          </p>

          {/* AI MATCH DETECTED BANNER */}
          {discoveredMatch && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6 text-left space-y-3">
              <div className="flex items-center gap-2 text-purple-700 font-bold">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <span>AI Detected a Possible Match!</span>
                <span className="ml-auto bg-purple-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">
                  {discoveredMatch.match.confidenceScore}% Match
                </span>
              </div>
              <p className="text-sm text-purple-900">
                A student has reported losing a matching <span className="font-bold text-slate-900">{discoveredMatch.lost.title}</span> near <span className="font-medium text-slate-800">{discoveredMatch.lost.location}</span>.
              </p>

              {discoveredMatch.lost.ownerEmail && (
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
                  <MailCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Possible match email notification dispatched to the registered owner ({maskEmail(discoveredMatch.lost.ownerEmail)}).
                  </span>
                </div>
              )}

              {onViewMatch && (
                <button
                  onClick={() => onViewMatch(discoveredMatch.match, discoveredMatch.lost, submittedItem)}
                  className="w-full bg-purple-700 hover:bg-purple-800 text-white font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs text-xs cursor-pointer mt-2"
                >
                  <Search className="w-3.5 h-3.5" />
                  View Matched Report
                </button>
              )}
            </div>
          )}

          {/* NEXT CAMPUS STEPS */}
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs sm:text-sm text-slate-700 space-y-2">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Next Campus Steps:</span>
              </p>
              <p>• Please hand the physical item over to the nearest <strong>Campus Security Custody Desk</strong>.</p>
              <p>• Campus Security will securely hold the item in the custody vault.</p>
              <p>• The owner will present their Student ID and verification details to reclaim it.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={() => {
                  setSubmittedItem(null);
                  setDiscoveredMatch(null);
                  setNotifiedCount(0);
                  setTitle('');
                  setBrand('');
                  setModel('');
                  setColor('');
                  setLocation('');
                  setDescription('');
                  setSecretDetail('');
                  setImagePreview(null);
                }}
                className="px-5 py-2.5 rounded-lg border border-slate-300 font-medium text-slate-700 hover:bg-slate-50 transition-colors text-sm cursor-pointer"
              >
                Report Another Found Item
              </button>
              <button
                onClick={onSuccessReturnHome || onBack}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-sm cursor-pointer"
              >
                Return to Campus Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // FOUND ITEM FORM (NO LOGIN OR FINDER EMAIL REQUIRED)
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
            <h1 className="text-2xl font-bold text-slate-900">Report Found Item</h1>
            <button
              type="button"
              onClick={handleFillSample}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
            >
              Fill Sample Example
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Found an item on campus? Submit its details below. No login required.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 sm:p-7 shadow-sm border border-slate-200 space-y-5">
        {/* Photo Upload Box */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1.5">
            Item Photo <span className="text-slate-400 font-normal">(Upload photo for automatic AI matching)</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            tabIndex={-1}
            aria-label="Upload photo from device"
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
                ? 'border-emerald-600 bg-emerald-100/50 scale-[1.01]'
                : 'border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/40 bg-slate-50/50'
            }`}
          >
            {imagePreview ? (
              <div className="flex flex-col items-center">
                <div className="relative group-hover:scale-[1.02] transition-transform">
                  <img
                    src={imagePreview}
                    alt="Found Item Preview"
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
                    className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-700" />
                    Change Photo
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview(null);
                      setDetectionMessage(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Remove Photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center">
                <div className="w-14 h-14 bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 rounded-full flex items-center justify-center mb-3 transition-colors">
                  <FolderOpen className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                  Choose Photo of Found Item
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
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
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
            <div className="flex items-center gap-2 mt-2 text-xs font-medium text-emerald-700 animate-pulse">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Analyzing found item visual features...</span>
            </div>
          )}

          {detectionMessage && !isAnalyzing && (
            <div className="mt-2 p-2 bg-emerald-50 rounded-lg text-xs text-emerald-800 font-medium">
              {detectionMessage}
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
            placeholder="e.g. Vivo mobile charger, Biology Textbook, Hydro Flask bottle"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-hidden text-sm transition-all"
          />
        </div>

        {/* Category & Color */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-hidden text-sm bg-white"
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
              placeholder="e.g. White, Green, Silver, Black"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-hidden text-sm"
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
              placeholder="e.g. Vivo, Apple, Sony"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-hidden text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Model (Optional)</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. FlashCharge 44W, AirPods Pro"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-hidden text-sm"
            />
          </div>
        </div>

        {/* Found Location */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Location Found <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. College Canteen table, Library 2nd floor, Science Hall"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-hidden text-sm"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Date Found</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-hidden text-sm bg-white"
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
                placeholder="e.g. 12:45 PM"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-hidden text-sm bg-white"
              />
            </div>
          </div>
        </div>

        {/* Public Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">Public Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="General description visible to students (do not reveal secret details)..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-hidden text-sm resize-none"
          />
        </div>

        {/* Secret / Hidden Detail for Owner Claim Verification */}
        <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200">
          <label className="block text-xs font-bold text-emerald-900 mb-1">
            Secret / Hidden Detail (For Ownership Verification)
          </label>
          <p className="text-[11px] text-emerald-700 mb-2">
            This detail is <strong>HIDDEN</strong> from students and used by Security to verify the real owner when they claim the item.
          </p>
          <input
            type="text"
            value={secretDetail}
            onChange={(e) => setSecretDetail(e.target.value)}
            placeholder="e.g. Small scratch on corner, blue tape on cord, initials written inside"
            className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-emerald-300 focus:border-emerald-600 outline-none"
          />
        </div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-950 text-white font-bold text-base transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Logging Item & Checking Matches...</span>
            </>
          ) : (
            <span>LOG FOUND ITEM IN SYSTEM</span>
          )}
        </button>
      </form>
    </div>
  );
};
