import { Star, X } from 'lucide-react';
import { useState } from 'react';
import { client } from '../client';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';
import { validate, trustRideRatingSchema } from '../utils/validation';

type RatingSource = 'verified_ride' | 'know_person';

interface RateUserModalProps extends SharedProps {
  ratedUserId: string;
  ratedUsername: string;
  ratingType: 'driver' | 'rider';
  ratingSource: RatingSource;
  rideOfferId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RateUserModal({
  currentView: _currentView,
  setCurrentView: _setCurrentView,
  user,
  ratedUserId,
  ratedUsername,
  ratingType,
  ratingSource,
  rideOfferId,
  onClose,
  onSuccess,
}: RateUserModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user?.userId) {
      toast.error('You must be signed in to rate');
      return;
    }
    const { data: profiles, errors: profileErrors } = await client.models.UserProfile.list({
      filter: { userId: { eq: user.userId } },
      limit: 1,
    });
    if (profileErrors || !profiles?.length) {
      toast.error('Profile not found');
      return;
    }
    const raterId = (profiles[0] as { id: string }).id;
    const input = {
      rideOfferId: rideOfferId ?? undefined,
      ratedUserId,
      rating,
      comment: comment.trim() || undefined,
      ratingType,
      ratingSource,
    };
    const parsed = validate(trustRideRatingSchema, input);
    if (!parsed.success) {
      toast.error(parsed.errors[0] ?? 'Invalid input');
      return;
    }
    setSubmitting(true);
    try {
      const createInput: {
        rideOfferId?: string | null;
        raterId: string;
        ratedUserId: string;
        rating: number;
        comment: string | null;
        ratingType: 'driver' | 'rider';
        ratingSource: 'verified_ride' | 'know_person';
        createdAt: string;
      } = {
        raterId,
        ratedUserId: parsed.data.ratedUserId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? null,
        ratingType: parsed.data.ratingType,
        ratingSource: parsed.data.ratingSource,
        createdAt: new Date().toISOString(),
      };
      if (parsed.data.rideOfferId) {
        createInput.rideOfferId = parsed.data.rideOfferId;
      }
      // @ts-expect-error TS2590 - Amplify Schema return type is too complex to represent
      const result = await client.models.RideRating.create(createInput) as { data?: unknown; errors?: unknown[] };
      const { data, errors } = result;
      if (errors) {
        toast.error('Failed to submit rating');
        return;
      }
      if (data) {
        toast.success('Rating submitted');
        onSuccess?.();
        onClose();
      }
    } catch {
      toast.error('Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-20" role="dialog" aria-modal="true" aria-labelledby="rate-user-title">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="rate-user-title" className="text-lg font-semibold text-gray-900">
            Rate {ratedUsername}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {ratingSource === 'verified_ride' ? 'Rate based on your completed ride.' : 'Rate based on knowing this person.'}
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Rating (1–5)</label>
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`p-2 rounded ${rating >= n ? 'text-amber-500' : 'text-gray-300'}`}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star className="w-6 h-6 fill-current" />
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            rows={2}
            placeholder="Optional feedback"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit rating'}
          </button>
        </div>
      </div>
    </div>
  );
}
