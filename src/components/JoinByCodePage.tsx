import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, DollarSign, Users, Loader2, CheckCircle } from 'lucide-react';
import { getCurrentUser } from 'aws-amplify/auth';
import { client } from '../client';
import { toast } from '../utils/toast';
import type { RideOffer } from '../types';

function formatDeparture(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function JoinByCodePage() {
  const { code } = useParams<{ code: string }>();
  const [offer, setOffer] = useState<RideOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [user, setUser] = useState<{ userId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const currentUser = await getCurrentUser();
        if (!cancelled) setUser({ userId: currentUser.userId });
      } catch {
        if (!cancelled) setUser(null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!code) {
      setLoading(false);
      return;
    }
    const codeUpper = code.toUpperCase();
    let cancelled = false;
    async function fetchOffer() {
      try {
        const raw: { data?: RideOffer[]; errors?: unknown[] } = await client.models.RideOffer.list({
          filter: { joinCode: { eq: codeUpper } },
          limit: 1,
        });
        const data = raw.data;
        const errors = raw.errors;
        if (cancelled) return;
        if (errors?.length) {
          if (import.meta.env.DEV) console.error('JoinByCode fetch errors:', errors);
          setOffer(null);
          setLoading(false);
          return;
        }
        const first = data?.[0];
        if (first && first.status === 'available') {
          setOffer(first as RideOffer);
        } else {
          setOffer(null);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('JoinByCode fetch error:', e);
        if (!cancelled) setOffer(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchOffer();
    return () => { cancelled = true; };
  }, [code]);

  const handleRequestToJoin = async () => {
    if (!offer?.id || !user) return;
    setJoining(true);
    try {
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
        limit: 1,
      });
      const profile = profiles?.[0];
      if (!profile?.id) {
        toast.error('Profile not found. Please complete your profile in Account.');
        setJoining(false);
        return;
      }
      // @ts-expect-error TS2590 - Amplify create return type is too complex
      const createRaw: { data?: unknown; errors?: { message?: string }[] } = await client.models.RideParticipant.create({
        rideOfferId: offer.id,
        riderId: profile.id,
        status: 'pending',
        joinedAt: new Date().toISOString(),
      });
      const participant = createRaw.data;
      const errors = createRaw.errors;
      if (errors?.length) {
        const msg = errors[0]?.message ?? 'Failed to join ride.';
        toast.error(msg);
        setJoining(false);
        return;
      }
      if (participant) {
        setJoined(true);
        toast.success('Join request sent. The host will approve or decline.');
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('Join error:', e);
      toast.error('Failed to join ride. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading ride...</p>
        </div>
      </main>
    );
  }

  if (!code || !offer) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">This ride isn&apos;t available</h1>
          <p className="text-gray-600 mb-6">
            The link may be wrong or the ride may have been cancelled or filled.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Go to home
          </Link>
        </div>
      </main>
    );
  }

  if (joined) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-primary-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Request sent</h1>
          <p className="text-gray-600 mb-6">
            The host will review your request. Check your account or the app for updates.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Go to home
          </Link>
        </div>
      </main>
    );
  }

  const seatsLeft = (offer.availableSeats ?? 0) - (offer.seatsBooked ?? 0);

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Join this ride</h1>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">{offer.originAddress ?? 'Origin'}</p>
                <p className="text-sm text-gray-500">to</p>
                <p className="font-medium text-gray-900">{offer.destinationAddress ?? 'Destination'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Clock className="w-5 h-5 text-primary-600" />
              <span>{formatDeparture(offer.departureTime)}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <DollarSign className="w-5 h-5 text-primary-600" />
              <span>${offer.price}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Users className="w-5 h-5 text-primary-600" />
              <span>{seatsLeft} seat{seatsLeft !== 1 ? 's' : ''} left</span>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-4">
            {!user ? (
              <div>
                <p className="text-gray-600 mb-3">
                  Sign in to request a seat on this ride.
                </p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Go to home to sign in
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRequestToJoin}
                disabled={joining || seatsLeft < 1}
                className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {joining ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending request...
                  </>
                ) : (
                  'Request to join'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
