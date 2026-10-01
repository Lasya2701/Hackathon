import React from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  EyeOff, 
  UserCheck, 
  FileWarning, 
  ShieldAlert 
} from 'lucide-react';

interface SecurityGuideViewProps {
  onBack: () => void;
}

export const SecurityGuideView: React.FC<SecurityGuideViewProps> = ({ onBack }) => {
  const securityRules = [
    {
      title: 'Report Authentically',
      desc: 'Only report items you actually lost or found on campus.',
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'Keep OTPs and Passwords Confidential',
      desc: 'Do not share passwords or OTPs. Pickup OTPs should only be presented in person to campus security officers.',
      icon: Lock,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      title: 'Minimize Sensitive Information',
      desc: 'Do not upload unnecessary sensitive information such as government IDs, credit cards, or private passwords in public descriptions.',
      icon: EyeOff,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      title: 'No False Claims',
      desc: "Do not falsely claim another person's item. All claim attempts are recorded in the security audit log.",
      icon: AlertTriangle,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      title: 'Verify Details Before Claiming',
      desc: 'Carefully verify item details, brand, model, and physical markings before initiating a claim.',
      icon: UserCheck,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Follow Safe Recovery Procedures',
      desc: 'Always complete item handovers at official Campus Security desks or designated campus lost and found points.',
      icon: ShieldCheck,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'Zero Tolerance for Fake Reports',
      desc: 'Do not create fake reports or mock submissions. Misleading submissions disrupt real recovery efforts.',
      icon: FileWarning,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      title: 'Protect Your Credentials',
      desc: 'Protect your account credentials and log out when using shared campus lab computers.',
      icon: Lock,
      color: 'text-slate-600 bg-slate-100',
    },
    {
      title: 'Report Suspicious Activity',
      desc: 'Report suspicious activity, false claims, or suspicious behavior directly to the campus administrator.',
      icon: ShieldAlert,
      color: 'text-red-600 bg-red-50',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 animate-fade-in">
      {/* Navigation Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold text-slate-900">Campus Safety & Security Guide</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Policies and best practices to ensure safe and authentic item recovery
          </p>
        </div>
      </div>

      {/* Intro Notice */}
      <div className="mb-6 p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs sm:text-sm text-purple-900 leading-relaxed">
        <strong>Important Commitment:</strong> CampusFind AI connects honest finders with verified owners.
        All match notifications and recovery handoffs are designed to maintain physical security and prevent false claims.
      </div>

      {/* Rules Grid */}
      <div className="space-y-3 mb-8">
        {securityRules.map((rule, idx) => {
          const Icon = rule.icon;
          return (
            <div
              key={idx}
              className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-start gap-3.5 hover:border-slate-300 transition-colors"
            >
              <div className={`p-2 rounded-lg shrink-0 ${rule.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{idx + 1}. {rule.title}</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-normal">
                  {rule.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Security Desk Contact Box */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div>
          <p className="font-bold text-sm">Need to report an urgent incident?</p>
          <p className="text-slate-300 text-xs">Campus Security Central Desk: Main Gate Building 1</p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors cursor-pointer shrink-0"
        >
          Return to App
        </button>
      </div>
    </div>
  );
};
