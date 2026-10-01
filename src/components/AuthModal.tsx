import React, { useState } from 'react';
import { X, User, Mail, ShieldCheck, ArrowRight, Check, KeyRound, Sparkles, Shield, RefreshCw } from 'lucide-react';
import { useAuth, DEMO_PRESET_USERS } from '../context/AuthContext.tsx';
import { maskEmail } from '../services/privacyService.ts';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, currentUser, login, switchUser } = useAuth();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'enter_email' | 'enter_otp'>('enter_email');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSentMessage, setOtpSentMessage] = useState('');
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid campus or personal email address.');
      return;
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtp(code); // Pre-fill for seamless testing experience
    setStep('enter_otp');
    setOtpSentMessage(`Verification code generated for ${maskEmail(cleanEmail)}`);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (otp.trim() !== generatedOtp.trim()) {
      setErrorMsg('Incorrect verification code. Please check and try again.');
      return;
    }

    login(email, name || undefined);
    setStep('enter_email');
    setOtp('');
    closeAuthModal();
  };

  const handleQuickSwitch = (user: typeof DEMO_PRESET_USERS[0]) => {
    switchUser(user);
    closeAuthModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-950 via-purple-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h2 className="text-base font-bold">Campus Sign In</h2>
              <p className="text-xs text-purple-200">
                {step === 'enter_email' ? 'Enter your college email' : 'Verify 6-digit access code'}
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: ENTER COLLEGE EMAIL */}
          {step === 'enter_email' && (
            <form onSubmit={handleSendOtp} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  College or Personal Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. 24951a05e0@gmail.com or student@campus.edu"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Your Full Name (Optional)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kavya Sri"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-950 hover:bg-purple-900 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Send 6-Digit Verification Code</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STEP 2: ENTER 6-DIGIT OTP */}
          {step === 'enter_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-in">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1">
                <p className="font-semibold">{otpSentMessage}</p>
                <p className="text-[11px] text-purple-700 font-mono">
                  Demo Security Code: <span className="font-bold tracking-widest text-sm bg-purple-100 px-2 py-0.5 rounded">{generatedOtp}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Enter 6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="w-full text-center text-xl tracking-widest font-mono py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('enter_email')}
                  className="flex-1 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700"
                >
                  Change Email
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Verify & Sign In
                </button>
              </div>
            </form>
          )}

          {/* DEMO MODE SWITCHER (Collapsible, for Admin / Evaluation testing) */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDemoProfiles(!showDemoProfiles)}
              className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-purple-700 py-1 cursor-pointer font-medium"
            >
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                Demo Mode: Switch Test Profiles
              </span>
              <span className="text-[11px] underline">
                {showDemoProfiles ? 'Hide Profiles' : 'Show Profiles'}
              </span>
            </button>

            {showDemoProfiles && (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 animate-fade-in">
                {DEMO_PRESET_USERS.map((user, idx) => {
                  const isSelected = currentUser?.email.toLowerCase() === user.email.toLowerCase();
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleQuickSwitch(user)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-400/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                          {idx === 0 ? 'Lost Owner' : idx === 1 ? 'Finder' : 'Security Desk'}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-600" />}
                      </div>
                      <p className="font-bold text-xs text-slate-900 truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{maskEmail(user.email)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
