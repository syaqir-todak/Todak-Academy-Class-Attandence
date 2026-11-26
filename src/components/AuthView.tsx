import { useState } from 'react';
import { QrCode, RefreshCw, ShieldCheck } from 'lucide-react';

interface AuthViewProps {
  onSignIn: () => Promise<void>;
  signingIn: boolean;
  authError: string | null;
  pendingScan: { sessionId: string; token: string } | null;
}

const TODAK_LOGO_PATH = '/assets/aistudio/NEW_TODAK_ACADEMY_BLACK_ENG_cac8403d.png';

export function AuthView({
  onSignIn,
  signingIn,
  authError,
  pendingScan,
}: AuthViewProps) {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] flex items-center">
      <div className="w-full max-w-6xl mx-auto px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-6">
          {!logoFailed && (
            <img
              src={TODAK_LOGO_PATH}
              alt="Todak Academy TVET College — Digital & Creative Education"
              referrerPolicy="no-referrer"
              onError={() => setLogoFailed(true)}
              className="h-12 sm:h-14 w-auto object-contain object-left"
            />
          )}
          <p className="text-sm font-medium text-[#3F6212] tracking-tight">
            Classroom Attendance System
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#0F172A] leading-[1.12] max-w-2xl">
            Simultaneous classroom QR check-in with zero queues.
          </h1>
          <p className="text-base text-[#475569] leading-relaxed max-w-xl">
            Sign in directly with your Google account—no registration forms required. Everyone in class can scan the live classroom QR code at the same time.
          </p>

          {pendingScan && (
            <div className="p-4 bg-white border border-[#D9F99D] rounded-xl max-w-xl">
              <p className="text-sm font-semibold text-[#0F172A]">
                Scanned QR link detected
              </p>
              <p className="text-sm text-[#475569] mt-1">
                Sign in with your Google account to complete check-in for session{' '}
                <span className="font-mono text-xs text-[#0F172A]">
                  {pendingScan.sessionId}
                </span>
                .
              </p>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              type="button"
              onClick={() => void onSignIn()}
              disabled={signingIn}
              className="inline-flex items-center justify-center gap-3 px-6 py-3 min-h-[48px] text-sm font-semibold text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              {signingIn ? 'Connecting Google Account...' : 'Sign in with Google'}
            </button>
            <span className="text-xs text-[#64748B]">
              Uses your verified Google name and email automatically
            </span>
          </div>

          {authError && (
            <p role="alert" className="text-sm text-[#DC2626] font-medium">
              {authError}
            </p>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl divide-y divide-[#E2E8F0]">
            <div className="p-6 flex items-start gap-4">
              <QrCode className="w-5 h-5 text-[#4D7C0F] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  Scan Together, No Queues
                </h2>
                <p className="text-sm text-[#475569] mt-1 leading-relaxed">
                  All students in the room can scan and clock in at the exact same time without blocking one another.
                </p>
              </div>
            </div>

            <div className="p-6 flex items-start gap-4">
              <RefreshCw className="w-5 h-5 text-[#4D7C0F] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  Timed Rolling QR Protection
                </h2>
                <p className="text-sm text-[#475569] mt-1 leading-relaxed">
                  The classroom QR refreshes automatically on a timer with a transition grace window so old screenshots expire.
                </p>
              </div>
            </div>

            <div className="p-6 flex items-start gap-4">
              <ShieldCheck className="w-5 h-5 text-[#4D7C0F] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A]">
                  One Account Per Phone
                </h2>
                <p className="text-sm text-[#475569] mt-1 leading-relaxed">
                  Students authenticate in one tap with Google while device locks prevent multiple accounts on a single phone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
