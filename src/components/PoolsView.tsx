import { ArrowLeft, Users, Plus } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { client } from '../client';
import type { Schema } from '../../amplify/data/resource';
import type { SharedProps } from '../types';
import { canCreateHostPool } from '../utils/trustApi';
import { toast } from '../utils/toast';
import { validate, riderPoolCreateSchema, hostPoolCreateSchema } from '../utils/validation';

type HostPoolType = Schema['HostPool']['type'];
type RiderPoolType = Schema['RiderPool']['type'];
type UserProfileType = Schema['UserProfile']['type'];

interface PoolsViewProps extends SharedProps {}

export function PoolsView({ currentView: _currentView, setCurrentView, user }: PoolsViewProps) {
  const [userProfile, setUserProfile] = useState<UserProfileType | null>(null);
  const [activeTab, setActiveTab] = useState<'rider' | 'host'>('rider');
  const [riderPools, setRiderPools] = useState<RiderPoolType[]>([]);
  const [hostPools, setHostPools] = useState<HostPoolType[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState<'rider' | 'host' | null>(null);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.userId) return;
    let cancelled = false;
    (async () => {
      const { data: profiles, errors } = await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
        limit: 1,
      });
      if (cancelled || errors || !profiles?.length) return;
      setUserProfile(profiles[0] as UserProfileType);
    })();
    return () => { cancelled = true; };
  }, [user?.userId]);

  const fetchRiderPools = useCallback(async () => {
    try {
      const { data, errors } = await client.models.RiderPool.list({ limit: 50 });
      if (errors) {
        toast.error('Failed to load rider pools');
        return;
      }
      setRiderPools((data ?? []) as RiderPoolType[]);
    } catch {
      toast.error('Failed to load rider pools');
    }
  }, []);

  const fetchHostPools = useCallback(async () => {
    try {
      const { data, errors } = await client.models.HostPool.list({ limit: 50 });
      if (errors) {
        toast.error('Failed to load driver pools');
        return;
      }
      setHostPools((data ?? []) as HostPoolType[]);
    } catch {
      toast.error('Failed to load driver pools');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchRiderPools(), fetchHostPools()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchRiderPools, fetchHostPools]);

  const handleCreateRiderPool = async () => {
    const parsed = validate(riderPoolCreateSchema, { name: createName, description: createDescription || undefined });
    if (!parsed.success) {
      toast.error(parsed.errors[0] ?? 'Invalid input');
      return;
    }
    if (!user?.userId || !userProfile?.id) {
      toast.error('You must be signed in to create a pool');
      return;
    }
    setSubmitting(true);
    try {
      const { data, errors } = await client.models.RiderPool.create({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        creatorId: userProfile.id,
        createdAt: new Date().toISOString(),
      });
      if (errors) {
        toast.error('Failed to create rider pool');
        return;
      }
      if (data) {
        toast.success('Rider pool created');
        setCreateModal(null);
        setCreateName('');
        setCreateDescription('');
        fetchRiderPools();
      }
    } catch {
      toast.error('Failed to create rider pool');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateHostPool = async () => {
    if (!canCreateHostPool(userProfile)) {
      toast.error('Only verified members can create a driver pool');
      return;
    }
    const parsed = validate(hostPoolCreateSchema, { name: createName, description: createDescription || undefined });
    if (!parsed.success) {
      toast.error(parsed.errors[0] ?? 'Invalid input');
      return;
    }
    if (!user?.userId || !userProfile?.id) {
      toast.error('You must be signed in to create a pool');
      return;
    }
    setSubmitting(true);
    try {
      const { data, errors } = await client.models.HostPool.create({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        creatorId: userProfile.id,
        createdAt: new Date().toISOString(),
      });
      if (errors) {
        toast.error('Failed to create driver pool');
        return;
      }
      if (data) {
        toast.success('Driver pool created');
        setCreateModal(null);
        setCreateName('');
        setCreateDescription('');
        fetchHostPools();
      }
    } catch {
      toast.error('Failed to create driver pool');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubmit = () => {
    if (createModal === 'rider') handleCreateRiderPool();
    else if (createModal === 'host') handleCreateHostPool();
  };

  const canCreateHost = canCreateHostPool(userProfile);

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
          <h1 className="text-xl font-bold text-gray-900">Pools</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('rider')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium ${activeTab === 'rider' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
          >
            Rider Pools
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('host')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium ${activeTab === 'host' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
          >
            Driver Pools
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading pools...</p>
        ) : (
          <>
            {activeTab === 'rider' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Rider Pools</h2>
                  <button
                    type="button"
                    onClick={() => { setCreateModal('rider'); setCreateName(''); setCreateDescription(''); }}
                    className="flex items-center gap-2 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700"
                  >
                    <Plus className="w-4 h-4" /> Create
                  </button>
                </div>
                {riderPools.length === 0 ? (
                  <p className="text-gray-500">No rider pools yet. Create one to get started.</p>
                ) : (
                  <ul className="space-y-2">
                    {riderPools.map((pool) => (
                      <li key={pool.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 flex items-center gap-3">
                        <Users className="w-5 h-5 text-primary-600" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{pool.name}</p>
                          {pool.description && <p className="text-sm text-gray-600">{pool.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {activeTab === 'host' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Driver Pools</h2>
                  {canCreateHost && (
                    <button
                      type="button"
                      onClick={() => { setCreateModal('host'); setCreateName(''); setCreateDescription(''); }}
                      className="flex items-center gap-2 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700"
                    >
                      <Plus className="w-4 h-4" /> Create
                    </button>
                  )}
                </div>
                {!canCreateHost && (
                  <p className="text-sm text-gray-600">Only verified members can create driver pools.</p>
                )}
                {hostPools.length === 0 ? (
                  <p className="text-gray-500">No driver pools yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {hostPools.map((pool) => (
                      <li key={pool.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 flex items-center gap-3">
                        <Users className="w-5 h-5 text-primary-600" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{pool.name}</p>
                          {pool.description && <p className="text-sm text-gray-600">{pool.description}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}

        {createModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-10" role="dialog" aria-modal="true" aria-labelledby="create-pool-title">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 id="create-pool-title" className="text-lg font-semibold text-gray-900 mb-4">
                Create {createModal === 'rider' ? 'Rider' : 'Driver'} Pool
              </h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
                placeholder="Pool name"
              />
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
                rows={2}
                placeholder="Brief description"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setCreateModal(null); setCreateName(''); setCreateDescription(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateSubmit}
                  disabled={submitting || !createName.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
