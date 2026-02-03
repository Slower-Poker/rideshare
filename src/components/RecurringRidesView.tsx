import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Calendar, Plus } from 'lucide-react';
import { client } from '../client';
import type { SharedProps } from '../types';
import type { RecurringRideTemplate } from '../types';
import { toast } from '../utils/toast';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WINNIPEG = { lat: 49.8954, lng: -97.1385 };
const BRANDON = { lat: 49.8484, lng: -99.9501 };

export function RecurringRidesView({ setCurrentView, user }: SharedProps) {
  const [templates, setTemplates] = useState<RecurringRideTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    originRegion: 'Winnipeg',
    destinationRegion: 'Brandon',
    dayOfWeek: 1,
    departureTime: '08:00',
    availableSeats: 3,
    price: 25,
  });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const model = client.models.RecurringRideTemplate;
        if (!model) {
          setLoading(false);
          return;
        }
        // @ts-expect-error TS2590 - Amplify list return type is too complex
        const raw = (await model.list({ limit: 50 })) as { data?: RecurringRideTemplate[]; errors?: unknown[] };
        if (cancelled) return;
        setTemplates(raw.data ?? []);
      } catch (e) {
        if (import.meta.env.DEV) console.error('Load recurring templates:', e);
        if (!cancelled) setTemplates([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const handleCreateTemplate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const profileRes = (await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
        limit: 1,
      })) as { data?: { id: string }[] };
      const profile = profileRes.data?.[0];
      if (!profile?.id) {
        toast.error('Profile not found.');
        setCreating(false);
        return;
      }
      const model = client.models.RecurringRideTemplate;
      if (!model) {
        toast.error('Recurring rides not available yet.');
        setCreating(false);
        return;
      }
      await model.create({
        hostId: profile.id,
        originLatitude: WINNIPEG.lat,
        originLongitude: WINNIPEG.lng,
        originAddress: undefined,
        originRegion: form.originRegion,
        destinationLatitude: BRANDON.lat,
        destinationLongitude: BRANDON.lng,
        destinationAddress: undefined,
        destinationRegion: form.destinationRegion,
        dayOfWeek: form.dayOfWeek,
        departureTime: form.departureTime,
        availableSeats: form.availableSeats,
        price: form.price,
        vehicleInfo: undefined,
        notes: undefined,
        pickupRadius: undefined,
        dropoffRadius: undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      toast.success('Template created.');
      setShowCreate(false);
      const raw = (await model.list({ limit: 50 })) as { data?: RecurringRideTemplate[] };
      setTemplates(raw.data ?? []);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Create template:', e);
      toast.error('Failed to create template.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateNextFourWeeks = async (template: RecurringRideTemplate) => {
    if (!user) return;
    setGenerating(true);
    try {
      const profileRes = (await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
        limit: 1,
      })) as { data?: { id: string }[] };
      const profile = profileRes.data?.[0];
      if (!profile?.id) {
        toast.error('Profile not found.');
        setGenerating(false);
        return;
      }
      const dayOfWeek = template.dayOfWeek ?? 1;
      const parts = (template.departureTime ?? '08:00').split(':').map(Number);
      const hours = parts[0] ?? 8;
      const minutes = parts[1] ?? 0;
      let created = 0;
      for (let w = 0; w < 4; w++) {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + w * 7);
        d.setHours(hours, minutes, 0, 0);
        if (d <= new Date()) continue;
        const iso = d.toISOString();
        const dateStr = iso.slice(0, 10);
        const createPayload = {
          hostId: profile.id,
          originLatitude: template.originLatitude,
          originLongitude: template.originLongitude,
          originAddress: template.originAddress ?? undefined,
          originRegion: template.originRegion ?? undefined,
          destinationLatitude: template.destinationLatitude,
          destinationLongitude: template.destinationLongitude,
          destinationAddress: template.destinationAddress ?? undefined,
          destinationRegion: template.destinationRegion ?? undefined,
          departureTime: iso,
          departureDate: dateStr,
          availableSeats: template.availableSeats,
          seatsBooked: 0,
          status: 'available' as const,
          price: template.price,
          vehicleInfo: template.vehicleInfo ?? undefined,
          notes: template.notes ?? undefined,
          pickupRadius: template.pickupRadius ?? undefined,
          dropoffRadius: template.dropoffRadius ?? undefined,
        };
        await client.models.RideOffer.create(createPayload);
        created++;
      }
      toast.success(`Created ${created} ride offer(s) from template.`);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Create from template:', e);
      toast.error('Failed to create ride offers from template.');
    } finally {
      setGenerating(false);
    }
  };

  if (!user) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600 mb-4">Sign in to manage recurring rides.</p>
          <button
            type="button"
            onClick={() => setCurrentView('account')}
            className="text-primary-600 hover:underline"
          >
            Go to account
          </button>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setCurrentView('home')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Recurring rides</h1>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : templates.length === 0 && !showCreate ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No recurring templates yet</h2>
            <p className="text-gray-600 mb-4">
              Create a template (e.g. every Monday 8am) and generate ride offers for the next weeks.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-5 h-5" />
              Add template
            </button>
          </div>
        ) : showCreate ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add recurring template</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From (region)</label>
                <input
                  type="text"
                  value={form.originRegion}
                  onChange={(e) => setForm((f) => ({ ...f, originRegion: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To (region)</label>
                <input
                  type="text"
                  value={form.destinationRegion}
                  onChange={(e) => setForm((f) => ({ ...f, destinationRegion: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of week</label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {DAY_NAMES.map((name, i) => (
                    <option key={name} value={i}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={form.departureTime}
                  onChange={(e) => setForm((f) => ({ ...f, departureTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seats</label>
                <input
                  type="number"
                  min={1}
                  value={form.availableSeats}
                  onChange={(e) => setForm((f) => ({ ...f, availableSeats: Number(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                <input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTemplate}
                disabled={creating}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create template
              </button>
            </div>
          </div>
        ) : (
          <>
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-5 h-5" />
              Add template
            </button>
          </div>
          <ul className="space-y-3">
            {templates.map((t) => (
              <li key={t.id} className="bg-white rounded-lg shadow border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {t.originRegion || t.originAddress || 'Origin'} → {t.destinationRegion || t.destinationAddress || 'Destination'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {DAY_NAMES[t.dayOfWeek ?? 0]} at {t.departureTime}, ${t.price}, {t.availableSeats} seats
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCreateNextFourWeeks(t)}
                  disabled={generating}
                  className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create next 4 weeks
                </button>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>
    </main>
  );
}
