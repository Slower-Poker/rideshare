import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';

interface TermsPageProps extends SharedProps {
  onAcceptTerms: () => Promise<boolean>;
  requireAcceptance: boolean;
}

export function TermsPage({ 
  setCurrentView, 
  onAcceptTerms,
  requireAcceptance 
}: TermsPageProps) {
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const success = await onAcceptTerms();
      if (success) {
        toast.success('Terms accepted');
        setCurrentView('home');
      } else {
        toast.error('Failed to accept terms');
      }
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          {!requireAcceptance && (
            <button
              onClick={() => setCurrentView('home')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">Terms of Service</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {requireAcceptance && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <p className="text-blue-900 font-medium">
              Please review and accept our terms of service to continue using RideShare.Click.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            RideShare.Click Terms of Service
          </h2>
          
          <div className="prose max-w-none space-y-6 text-gray-700">
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">1. Overview</h3>
              <p>
                Welcome to RideShare.Click, a cooperative ride-sharing platform. By using our service, 
                you agree to these terms and conditions.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">2. Cooperative Model</h3>
              <p>
                RideShare.Click operates as a community cooperative. This platform is owned by and for 
                the community it serves. There are no profit motives or corporate shareholders.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">3. User Responsibilities</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Users must be 18 years or older to offer or join rides</li>
                <li>All users must treat each other with respect and courtesy</li>
                <li>Drivers must have valid licenses and insurance</li>
                <li>Users must provide accurate information</li>
                <li>Any unsafe behavior should be reported immediately</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">4. Liability</h3>
              <p>
                RideShare.Click is a platform that connects users. We do not employ drivers or 
                provide transportation services. Users arrange rides at their own risk. 
                RideShare.Click is not liable for any incidents that occur during rides.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">5. Privacy</h3>
              <p>
                We respect your privacy. Location data and personal information are used only 
                to facilitate ride sharing and improve the service. We do not sell user data.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">6. Safety</h3>
              <p>
                Your safety is paramount. We encourage users to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Verify driver and vehicle information before getting in</li>
                <li>Share your ride details with trusted contacts</li>
                <li>Trust your instincts and cancel if something feels wrong</li>
                <li>Report any safety concerns immediately</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">7. Code of Conduct</h3>
              <p>
                All users must follow our code of conduct:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>No harassment, discrimination, or hate speech</li>
                <li>No illegal activities</li>
                <li>No solicitation or spam</li>
                <li>Respect other users' time and property</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">8. Changes to Terms</h3>
              <p>
                We may update these terms from time to time. Users will be notified of 
                significant changes and must accept updated terms to continue using the service.
              </p>
            </section>

            <p className="text-sm text-gray-500 mt-8">
              Last updated: December 31, 2025 | Version 1.0.0
            </p>
          </div>
        </div>

        {requireAcceptance && (
          <div className="bg-white rounded-lg shadow-md p-8">
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-4 px-6 rounded-lg hover:bg-primary-700 transition-colors text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-6 h-6" />
              {accepting ? 'Accepting...' : 'I Accept the Terms of Service'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
