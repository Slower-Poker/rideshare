import { useState, useEffect } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { SharedProps, ViewType } from '../types';
import { toast } from '../utils/toast';

interface TermsPageProps extends SharedProps {
  onAcceptTerms: () => Promise<boolean>;
  requireAcceptance: boolean;
}

const VIEW_STORAGE_KEY = 'rideshare_current_view';

export function TermsPage({ 
  setCurrentView, 
  onAcceptTerms,
  requireAcceptance 
}: TermsPageProps) {
  const [accepting, setAccepting] = useState(false);
  const [previousView, setPreviousView] = useState<ViewType>('home');

  // Determine the previous view to return to when back button is clicked
  useEffect(() => {
    // Check for stored previous view (set when navigating to terms)
    const prevView = sessionStorage.getItem('rideshare_previous_view');
    if (prevView && prevView !== 'terms') {
      // Valid previous view stored
      setPreviousView(prevView as ViewType);
    } else {
      // Fallback to stored current view (if any)
      const stored = sessionStorage.getItem(VIEW_STORAGE_KEY);
      if (stored && stored !== 'terms') {
        setPreviousView(stored as ViewType);
      } else {
        // Default to home if no previous view stored
        setPreviousView('home');
      }
    }
  }, []);

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
              onClick={() => setCurrentView(previousView)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={`Back to ${previousView}`}
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
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              RideShare.Click Terms of Service
            </h2>
            <p className="text-gray-600">
              Effective Date: December 31, 2025 | Version 1.0.0
            </p>
          </div>
          
          <div className="prose max-w-none space-y-8 text-gray-700">
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h3>
              <p className="mb-3">
                Welcome to RideShare.Click, a community-owned cooperative ride-sharing platform. By accessing, 
                browsing, or using our service, you acknowledge that you have read, understood, and agree to be 
                bound by these Terms of Service ("Terms") and all applicable laws and regulations.
              </p>
              <p>
                If you do not agree with any part of these Terms, you must not use our service. These Terms 
                constitute a legally binding agreement between you and RideShare.Click.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">2. Cooperative Model and Service Description</h3>
              <p className="mb-3">
                RideShare.Click operates as a community cooperative platform. This platform is owned by and for 
                the community it serves. There are no profit motives or corporate shareholders. Our mission is to 
                facilitate safe, affordable, and environmentally friendly transportation through community cooperation.
              </p>
              <p className="mb-3">
                RideShare.Click is a technology platform that connects users who wish to share rides. We do not 
                provide transportation services, nor do we employ, endorse, or recommend any drivers or riders. 
                We simply provide a platform where users can connect with each other.
              </p>
              <p>
                All arrangements, agreements, and interactions between users are solely between the users. 
                RideShare.Click is not a party to any such arrangements.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">3. Eligibility and User Requirements</h3>
              <p className="mb-3">To use RideShare.Click, you must:</p>
              <ul className="list-disc pl-6 space-y-2 mb-3">
                <li>Be at least 18 years of age to offer or join rides</li>
                <li>Have the legal capacity and authority to enter into binding agreements</li>
                <li>Provide accurate, current, and complete information during registration and at all times</li>
                <li>Maintain the security and confidentiality of your account credentials</li>
                <li>Be responsible for all activities that occur under your account</li>
              </ul>
              <p className="mb-3">
                <strong>For Drivers:</strong> You must possess and maintain:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-3">
                <li>A valid driver's license appropriate for the vehicle you will be driving</li>
                <li>Valid automobile insurance that meets or exceeds your jurisdiction's minimum requirements</li>
                <li>A registered, roadworthy vehicle that is safe for passenger transport</li>
                <li>Any other licenses, permits, or registrations required by your local jurisdiction</li>
              </ul>
              <p>
                You represent and warrant that all information you provide is accurate and truthful, and that 
                you will update your information promptly if it changes.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">4. User Responsibilities and Conduct</h3>
              <p className="mb-3">All users are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2 mb-3">
                <li>Treating all other users with respect, courtesy, and dignity</li>
                <li>Maintaining appropriate and professional behavior at all times</li>
                <li>Complying with all applicable local, state, and federal laws</li>
                <li>Not engaging in any illegal activities through or in connection with the platform</li>
                <li>Not using the platform for commercial purposes other than permitted ride-sharing</li>
                <li>Not soliciting, advertising, or promoting other services or products</li>
                <li>Respecting other users' time, property, and personal space</li>
                <li>Promptly reporting any unsafe, illegal, or inappropriate behavior</li>
              </ul>
              <p>
                Any violation of these responsibilities may result in immediate suspension or termination of your 
                account and access to the platform.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">5. Safety Guidelines</h3>
              <p className="mb-3">
                Your safety and the safety of other users is our highest priority. All users must take appropriate 
                safety measures:
              </p>
              <p className="mb-3"><strong>Before a Ride:</strong></p>
              <ul className="list-disc pl-6 space-y-2 mb-3">
                <li>Verify driver and vehicle information matches what is displayed in the app</li>
                <li>Check driver ratings and reviews before accepting a ride</li>
                <li>Share your ride details (driver name, vehicle, route, ETA) with a trusted contact</li>
                <li>Confirm the destination and route before starting the trip</li>
                <li>Ensure you have a way to contact emergency services if needed</li>
              </ul>
              <p className="mb-3"><strong>During a Ride:</strong></p>
              <ul className="list-disc pl-6 space-y-2 mb-3">
                <li>Trust your instincts - if something feels wrong, ask the driver to stop in a safe location and exit the vehicle</li>
                <li>Remain alert and aware of your surroundings</li>
                <li>Do not share personal information beyond what is necessary</li>
                <li>Follow traffic laws and safety regulations</li>
              </ul>
              <p className="mb-3"><strong>If You Feel Unsafe:</strong></p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Cancel the ride immediately if you feel uncomfortable before it begins</li>
                <li>If in a moving vehicle, ask to be let out at the nearest safe location</li>
                <li>Call emergency services (911) if you are in immediate danger</li>
                <li>Report any safety concerns, incidents, or violations to RideShare.Click immediately</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">6. Code of Conduct</h3>
              <p className="mb-3">All users must adhere to the following code of conduct. Violations may result in account suspension or termination:</p>
              <ul className="list-disc pl-6 space-y-2 mb-3">
                <li><strong>No Harassment or Discrimination:</strong> Harassment, discrimination, hate speech, or any form of verbal or physical abuse is strictly prohibited</li>
                <li><strong>No Illegal Activities:</strong> Users must not engage in or facilitate any illegal activities, including but not limited to transporting illegal substances, weapons, or stolen goods</li>
                <li><strong>No Solicitation:</strong> Users must not use the platform to solicit business, promote products or services, or engage in any commercial activity not related to ride-sharing</li>
                <li><strong>No Spam or Fraud:</strong> Users must not send unsolicited messages, create fake accounts, or engage in fraudulent activities</li>
                <li><strong>Respect Privacy:</strong> Users must respect the privacy of other users and not share personal information without consent</li>
                <li><strong>No Inappropriate Content:</strong> Users must not share, display, or distribute inappropriate, offensive, or explicit content</li>
                <li><strong>Punctuality:</strong> Users should arrive on time for scheduled rides and communicate promptly about delays or cancellations</li>
                <li><strong>Cleanliness:</strong> Drivers should maintain clean vehicles, and all users should respect the vehicle and other passengers</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">7. Liability and Disclaimers</h3>
              <p className="mb-3">
                <strong>IMPORTANT: PLEASE READ THIS SECTION CAREFULLY.</strong>
              </p>
              <p className="mb-3">
                RideShare.Click is a technology platform that facilitates connections between users. We do not 
                provide transportation services, employ drivers, own vehicles, or control the actions of users. 
                All ride-sharing arrangements are made directly between users.
              </p>
              <p className="mb-3">
                <strong>AS-IS SERVICE:</strong> The platform is provided "as is" and "as available" without warranties 
                of any kind, either express or implied. We do not guarantee the availability, reliability, or safety 
                of any rides arranged through our platform.
              </p>
              <p className="mb-3">
                <strong>NO LIABILITY FOR RIDES:</strong> To the fullest extent permitted by law, RideShare.Click, its 
                owners, operators, and affiliates disclaim all liability for any incidents, accidents, injuries, 
                damages, losses, or claims arising from or related to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-3">
                <li>Rides arranged through the platform</li>
                <li>Interactions between users</li>
                <li>Driver conduct, vehicle condition, or driving behavior</li>
                <li>Rider conduct or behavior</li>
                <li>Accidents, traffic violations, or incidents during rides</li>
                <li>Loss or damage to personal property</li>
                <li>Any disputes between users</li>
              </ul>
              <p className="mb-3">
                <strong>USER ASSUMPTION OF RISK:</strong> By using RideShare.Click, you acknowledge and agree that 
                you assume all risks associated with ride-sharing, including but not limited to risks of accidents, 
                injuries, property damage, and interactions with other users. You participate in rides at your own risk.
              </p>
              <p>
                <strong>INDEMNIFICATION:</strong> You agree to indemnify, defend, and hold harmless RideShare.Click 
                and its owners, operators, affiliates, and agents from any claims, damages, losses, liabilities, and 
                expenses (including legal fees) arising from your use of the platform, your violation of these Terms, 
                or your violation of any rights of another user or third party.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">8. Insurance and Financial Responsibility</h3>
              <p className="mb-3">
                <strong>Driver Insurance:</strong> Drivers are solely responsible for maintaining adequate automobile 
                insurance coverage. RideShare.Click does not provide insurance coverage for drivers or riders. Drivers 
                must ensure their insurance policy covers ride-sharing activities if required by their jurisdiction or 
                insurance provider.
              </p>
              <p className="mb-3">
                <strong>Cost Sharing:</strong> Ride-sharing arrangements may involve cost-sharing between users. All 
                financial arrangements are made directly between users. RideShare.Click is not a party to these 
                arrangements and is not responsible for payment disputes, refunds, or financial transactions between users.
              </p>
              <p>
                <strong>No Guarantee of Payment:</strong> RideShare.Click does not guarantee that drivers will receive 
                payment or that riders will receive refunds. Users are responsible for resolving all financial matters 
                directly with each other.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">9. Privacy and Data Protection</h3>
              <p className="mb-3">
                Your privacy is important to us. We collect and use your personal information solely to facilitate 
                ride-sharing and improve our service. We do not sell, rent, or share your personal data with third 
                parties for marketing purposes.
              </p>
              <p className="mb-3">We collect and use the following types of information:</p>
              <ul className="list-disc pl-6 space-y-2 mb-3">
                <li>Account information (username, email, profile information)</li>
                <li>Location data (to match riders with drivers and display routes)</li>
                <li>Ride history and preferences</li>
                <li>Communications between users (to facilitate ride arrangements)</li>
                <li>Device information and usage data (to improve the service)</li>
              </ul>
              <p>
                By using RideShare.Click, you consent to the collection and use of your information as described 
                in these Terms and our Privacy Policy. You may access, update, or delete your account information 
                at any time through your account settings.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">10. Account Termination</h3>
              <p className="mb-3">
                You may terminate your account at any time by contacting us or using the account deletion feature 
                in your account settings.
              </p>
              <p className="mb-3">
                We reserve the right to suspend or terminate your account immediately, without notice, if you:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-3">
                <li>Violate these Terms of Service or our Code of Conduct</li>
                <li>Engage in fraudulent, illegal, or harmful activities</li>
                <li>Provide false or misleading information</li>
                <li>Harass, threaten, or harm other users</li>
                <li>Fail to maintain required licenses, insurance, or registrations (for drivers)</li>
                <li>Create multiple accounts to circumvent restrictions or bans</li>
              </ul>
              <p>
                Upon termination, your right to use the platform will immediately cease. We may delete your account 
                and data, subject to applicable legal requirements. Provisions of these Terms that by their nature 
                should survive termination will survive, including but not limited to liability limitations and 
                indemnification obligations.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">11. Dispute Resolution</h3>
              <p className="mb-3">
                <strong>User Disputes:</strong> RideShare.Click is not responsible for resolving disputes between 
                users. If you have a dispute with another user, you should attempt to resolve it directly with that user. 
                If necessary, you may need to seek resolution through appropriate legal channels.
              </p>
              <p className="mb-3">
                <strong>Disputes with RideShare.Click:</strong> Any disputes, claims, or controversies arising out of 
                or relating to these Terms or your use of the platform shall be resolved through binding arbitration 
                in accordance with the rules of the American Arbitration Association, except where prohibited by law. 
                You agree to waive any right to a jury trial or to participate in a class action lawsuit.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">12. Changes to Terms</h3>
              <p className="mb-3">
                We reserve the right to modify these Terms at any time. We will notify users of material changes 
                through the platform, email, or other reasonable means. Your continued use of the service after 
                such modifications constitutes your acceptance of the updated Terms.
              </p>
              <p>
                If we make significant changes to these Terms, you may be required to accept the updated Terms 
                to continue using the service. If you do not agree to the modified Terms, you must stop using 
                the platform and may terminate your account.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">13. Intellectual Property</h3>
              <p className="mb-3">
                The RideShare.Click platform, including its design, features, functionality, and content, is owned 
                by RideShare.Click or its licensors and is protected by copyright, trademark, and other intellectual 
                property laws.
              </p>
              <p>
                You are granted a limited, non-exclusive, non-transferable license to access and use the platform 
                for personal, non-commercial purposes in accordance with these Terms. You may not reproduce, 
                distribute, modify, create derivative works, publicly display, or use any content from the platform 
                without our prior written permission.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-3">14. Contact Information</h3>
              <p className="mb-3">
                If you have questions, concerns, or need to report a violation of these Terms, please contact us through 
                the platform's support features or at the contact information provided in your account settings.
              </p>
              <p>
                For safety emergencies or immediate threats, contact local emergency services (911) immediately. 
                You may also report safety concerns through the platform's reporting features.
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-6 mt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Acknowledgement</h3>
              <p className="mb-3">
                By accepting these Terms of Service, you acknowledge that you have read, understood, and agree to 
                be bound by all terms and conditions contained herein. You understand that ride-sharing involves 
                inherent risks and that you assume all such risks.
              </p>
              <p className="font-semibold text-gray-900">
                These Terms of Service are effective as of December 31, 2025, and apply to all users of the 
                RideShare.Click platform.
              </p>
            </section>

            <div className="text-sm text-gray-500 mt-8 pt-6 border-t border-gray-200">
              <p><strong>Last updated:</strong> December 31, 2025</p>
              <p><strong>Version:</strong> 1.0.0</p>
            </div>
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
