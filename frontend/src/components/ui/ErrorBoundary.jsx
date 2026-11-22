import React from 'react';
import Button from './Button';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('formbot_active_job_id');
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">
                Application Error Encountered
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              An unexpected error occurred while rendering the workflow. Your form configuration is preserved.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-[11px] font-mono text-slate-700 break-words">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={this.handleReset}
                icon={RotateCcw}
                className="w-full"
              >
                Reset & Return to Form
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

