import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed?.error) {
        readable = `${parsed.error}${parsed.path ? ` (${parsed.operationType || 'read'} at ${parsed.path})` : ''}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: readable };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-white border border-[#E2E8F0] rounded-xl p-8">
            <div className="flex items-center gap-3 text-[#DC2626] mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="text-lg font-semibold text-[#0F172A]">
                Unable to load attendance workspace
              </h1>
            </div>
            <p className="text-sm text-[#475569] leading-relaxed mb-6 break-words">
              {this.state.message || 'An unexpected error interrupted this session.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-medium text-white bg-[#3F6212] rounded-lg hover:bg-[#365314] transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
