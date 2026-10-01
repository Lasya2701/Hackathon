import React from 'react';
import { 
  ArrowLeft, 
  Search, 
  Camera, 
  Sparkles, 
  Mail, 
  ShieldCheck, 
  ArrowRight,
  UserCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface DemoGuideViewProps {
  onBack: () => void;
  onOpenReportLost: () => void;
  onOpenReportFound: () => void;
  onOpenAdmin: () => void;
}

export const DemoGuideView: React.FC<DemoGuideViewProps> = ({
  onBack,
  onOpenReportLost,
  onOpenReportFound,
  onOpenAdmin,
}) => {
  const { openAuthModal, currentUser } = useAuth();

  const steps = [
    {
      step: 'Step 1',
      title: 'Select "I Lost Something" and submit details.',
      description: 'Report the item name, category, location, date/time, and physical characteristics. The report automatically binds to your logged-in email address.',
      icon: Search,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      actionLabel: 'Try "I Lost Something"',
      action: onOpenReportLost,
    },
    {
      step: 'Step 2',
      title: 'Select "I Found Something" and upload the found item\'s information/photo.',
      description: 'Finders can report where and when an item was discovered and attach a photo via file upload, camera, or drag and drop.',
      icon: Camera,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      actionLabel: 'Try "I Found Something"',
      action: onOpenReportFound,
    },
    {
      step: 'Step 3',
      title: 'CampusFind AI compares Lost and Found reports.',
      description: 'The system matches item names, categories, descriptions, locations, timestamps, and visual attributes to determine match probability.',
      icon: Sparkles,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      step: 'Step 4',
      title: 'If a possible match is detected, the original Lost Item owner receives an email.',
      description: 'The backend reads the ownerEmail stored with the original Lost Item (e.g. 24951a05e0@gmail.com) and sends an automated notification email directly to that owner.',
      icon: Mail,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      step: 'Step 5',
      title: 'The owner reviews the match and follows the safe recovery process.',
      description: 'The student reviews the report in CampusFind AI, presents private verification details to campus security, and securely collects their item.',
      icon: ShieldCheck,
      color: 'bg-teal-50 text-teal-700 border-teal-200',
      actionLabel: 'View Security Portal',
      action: onOpenAdmin,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">How CampusFind AI Works</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            A simple 5-step overview of the automated lost-and-found recovery flow
          </p>
        </div>
      </div>

      {/* Account Info Bar */}
      <div className="mb-6 p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
            {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">
              Logged in as: <span className="text-purple-700">{currentUser?.name || 'Guest'}</span>
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              {currentUser?.email || 'No email set'}
            </p>
          </div>
        </div>
        <button
          onClick={openAuthModal}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          Switch Account
        </button>
      </div>

      {/* 5 Steps List */}
      <div className="space-y-4 mb-8">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          return (
            <div
              key={idx}
              className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl border ${s.color} shrink-0`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 block mb-0.5">
                    {s.step}
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {s.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </div>

              {s.action && (
                <button
                  onClick={s.action}
                  className="px-4 py-2 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 self-end sm:self-center"
                >
                  <span>{s.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
