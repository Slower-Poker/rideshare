import { ArrowLeft, UserPlus, UserCheck, Star } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { client } from '../client';
import type { Schema } from '../../amplify/data/resource';
import type { SharedProps } from '../types';
import { toast } from '../utils/toast';
import { RateUserModal } from './RateUserModal';

type ConnectionType = Schema['Connection']['type'];
type UserProfileType = Schema['UserProfile']['type'];

interface ConnectionsViewProps extends SharedProps {}

export function ConnectionsView({ currentView: _currentView, setCurrentView, user }: ConnectionsViewProps) {
  const [connections, setConnections] = useState<ConnectionType[]>([]);
  const [profiles, setProfiles] = useState<Map<string, UserProfileType>>(new Map());
  const [loading, setLoading] = useState(true);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [rateTarget, setRateTarget] = useState<{ userId: string; username: string } | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!user?.userId) return;
    const { data: profilesList, errors: profileErrors } = await client.models.UserProfile.list({
      filter: { userId: { eq: user.userId } },
      limit: 1,
    });
    if (profileErrors || !profilesList?.length) return;
    const myProfile = profilesList[0] as UserProfileType;
    setUserProfileId(myProfile.id ?? null);
    if (!myProfile.id) return;

    const { data: fromList, errors: fromErrors } = await client.models.Connection.list({
      filter: { fromUserId: { eq: myProfile.id } },
      limit: 50,
    });
    const { data: toList, errors: toErrors } = await client.models.Connection.list({
      filter: { toUserId: { eq: myProfile.id } },
      limit: 50,
    });
    if (fromErrors || toErrors) {
      toast.error('Failed to load connections');
      return;
    }
    const all = [...(fromList ?? []), ...(toList ?? [])] as ConnectionType[];
    const seen = new Set<string>();
    const unique = all.filter((c) => {
      const key = `${c.fromUserId}-${c.toUserId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setConnections(unique);

    const ids = new Set<string>();
    unique.forEach((c) => {
      ids.add(c.fromUserId);
      ids.add(c.toUserId);
    });
    ids.delete(myProfile.id);
    if (ids.size === 0) return;
    const { data: userProfiles, errors: upErrors } = await client.models.UserProfile.list({ limit: 100 });
    if (upErrors || !userProfiles) return;
    const map = new Map<string, UserProfileType>();
    (userProfiles as UserProfileType[]).forEach((p) => {
      if (p.id && ids.has(p.id)) map.set(p.id, p);
    });
    setProfiles(map);
  }, [user?.userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchConnections().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchConnections]);

  const handleAccept = async (connectionId: string) => {
    try {
      const { errors } = await client.models.Connection.update({
        id: connectionId,
        status: 'accepted',
      });
      if (errors) {
        toast.error('Failed to accept connection');
        return;
      }
      toast.success('Connection accepted');
      fetchConnections();
    } catch {
      toast.error('Failed to accept connection');
    }
  };

  const acceptedConnections = connections.filter((c) => c.status === 'accepted');
  const pendingToMe = connections.filter(
    (c) => c.toUserId === userProfileId && c.status === 'pending'
  );
  const pendingFromMe = connections.filter(
    (c) => c.fromUserId === userProfileId && c.status === 'pending'
  );

  const getOtherUserId = (c: ConnectionType): string =>
    c.fromUserId === userProfileId ? c.toUserId : c.fromUserId;
  const getOtherProfile = (c: ConnectionType): UserProfileType | undefined =>
    profiles.get(getOtherUserId(c));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setCurrentView('account')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to account"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Connections</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-gray-600 mb-6">
          Connections let you rate people you know (know-person ratings). Send a request and they can accept.
        </p>

        {loading ? (
          <p className="text-gray-500">Loading connections...</p>
        ) : (
          <div className="space-y-6">
            {pendingToMe.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <UserCheck className="w-5 h-5" /> Pending (to you)
                </h2>
                <ul className="space-y-2">
                  {pendingToMe.map((c) => (
                    <li key={c.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {getOtherProfile(c)?.username ?? getOtherUserId(c).slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAccept(c.id)}
                        className="px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                      >
                        Accept
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Accepted connections
              </h2>
              {acceptedConnections.length === 0 ? (
                <p className="text-gray-500">No accepted connections yet. Send or accept requests to rate people you know.</p>
              ) : (
                <ul className="space-y-2">
                  {acceptedConnections.map((c) => {
                    const otherId = getOtherUserId(c);
                    const otherProfile = getOtherProfile(c);
                    const username = otherProfile?.username ?? otherId.slice(0, 8);
                    return (
                      <li key={c.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 flex items-center justify-between">
                        <span className="font-medium text-gray-900">{username}</span>
                        <button
                          type="button"
                          onClick={() => setRateTarget({ userId: otherId, username })}
                          className="flex items-center gap-1 px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200"
                        >
                          <Star className="w-4 h-4" /> Rate
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {pendingFromMe.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Pending (sent by you)</h2>
                <ul className="space-y-2">
                  {pendingFromMe.map((c) => (
                    <li key={c.id} className="bg-white p-4 rounded-lg shadow border border-gray-200">
                      <span className="font-medium text-gray-900">
                        {getOtherProfile(c)?.username ?? getOtherUserId(c).slice(0, 8)}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">Waiting for acceptance</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {rateTarget && user && (
          <RateUserModal
            currentView="connections"
            setCurrentView={setCurrentView}
            user={user}
            ratedUserId={rateTarget.userId}
            ratedUsername={rateTarget.username}
            ratingType="rider"
            ratingSource="know_person"
            onClose={() => setRateTarget(null)}
            onSuccess={() => fetchConnections()}
          />
        )}
      </main>
    </div>
  );
}
