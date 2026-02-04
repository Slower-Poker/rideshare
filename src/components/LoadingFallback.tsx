import { Loader2 } from 'lucide-react';

export function LoadingFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50"
      role="status"
      aria-live="polite"
      aria-label="Loading application"
    >
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" aria-hidden />
        <p className="text-gray-600">Loading RideShare.Click...</p>
      </div>
    </div>
  );
}
