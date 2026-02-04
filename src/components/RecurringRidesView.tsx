import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Calendar, Plus, Trash2, Pause, Play } from 'lucide-react';
import { client } from '../client';
import type { SharedProps, RecurringRideTemplate } from '../types';
import { toast } from '../utils/toast';
import { 
  parseDaysOfWeek, 
  stringifyDaysOfWeek, 
  parseSkipDates,
  stringifySkipDates,
  formatDaysOfWeek,
  getShortDayName,
  generateJoinCode,
} from '../utils/rideUtils';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WINNIPEG = { lat: 49.8954, lng: -97.1385 };
const BRANDON = { lat: 49.8484, lng: -99.9501 };

interface FormState {
  name: string;
  originRegion: string;
  destinationRegion: string;
  patternType: 'weekly' | 'biweekly' | 'custom';
  daysOfWeek: number[];
  departureTime: string;
  validFrom: string;
  validUntil: string;
  isRoundTrip: boolean;
  returnDepartureTime: string;
  totalSeats: number;
  pricePerSeat: number;
  graceMinutes: number;
}

const defaultForm: FormState = {
  name: '',
  originRegion: 'Winnipeg',
  destinationRegion: 'Brandon',
  patternType: 'weekly',
  daysOfWeek: [1], // Monday
  departureTime: '08:00',
  validFrom: new Date().toISOString().slice(0, 10),
  validUntil: '',
  isRoundTrip: false,
  returnDepartureTime: '17:00',
  totalSeats: 3,
  pricePerSeat: 25,
  graceMinutes: 60,
};

export function RecurringRidesView({ setCurrentView, user }: SharedProps) {
  const [templates, setTemplates] = useState<RecurringRideTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [skipDateInput, setSkipDateInput] = useState('');
  const [skipDates, setSkipDates] = useState<string[]>([]);

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
    if (form.daysOfWeek.length === 0) {
      toast.error('Please select at least one day of the week');
      return;
    }
    
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
        name: form.name || undefined,
        rideType: 'offer',
        originLatitude: WINNIPEG.lat,
        originLongitude: WINNIPEG.lng,
        originAddress: undefined,
        originRegion: form.originRegion,
        destinationLatitude: BRANDON.lat,
        destinationLongitude: BRANDON.lng,
        destinationAddress: undefined,
        destinationRegion: form.destinationRegion,
        patternType: form.patternType,
        daysOfWeek: stringifyDaysOfWeek(form.daysOfWeek),
        departureTime: form.departureTime,
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || undefined,
        skipDates: skipDates.length > 0 ? stringifySkipDates(skipDates) : undefined,
        isRoundTrip: form.isRoundTrip,
        returnDepartureTime: form.isRoundTrip ? form.returnDepartureTime : undefined,
        totalSeats: form.totalSeats,
        pricePerSeat: form.pricePerSeat,
        graceMinutes: form.graceMinutes,
        vehicleInfo: undefined,
        notes: undefined,
        pickupRadius: undefined,
        dropoffRadius: undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
      });
      
      toast.success('Template created.');
      setShowCreate(false);
      setForm(defaultForm);
      setSkipDates([]);
      
      const raw = (await model.list({ limit: 50 })) as { data?: RecurringRideTemplate[] };
      setTemplates(raw.data ?? []);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Create template:', e);
      toast.error('Failed to create template.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (template: RecurringRideTemplate) => {
    try {
      const newStatus = template.status === 'active' ? 'paused' : 'active';
      await client.models.RecurringRideTemplate.update({
        id: template.id,
        status: newStatus,
      });
      toast.success(`Template ${newStatus === 'active' ? 'activated' : 'paused'}`);
      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, status: newStatus } : t));
    } catch (e) {
      toast.error('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await client.models.RecurringRideTemplate.delete({ id: templateId });
      toast.success('Template deleted');
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (e) {
      toast.error('Failed to delete template');
    }
  };

  const handleGenerateRides = async (template: RecurringRideTemplate, weeksAhead: number) => {
    if (!user) return;
    setGenerating(template.id);
    
    try {
      const profileRes = (await client.models.UserProfile.list({
        filter: { userId: { eq: user.userId } },
        limit: 1,
      })) as { data?: { id: string }[] };
      const profile = profileRes.data?.[0];
      if (!profile?.id) {
        toast.error('Profile not found.');
        setGenerating(null);
        return;
      }
      
      const daysOfWeek = parseDaysOfWeek(template.daysOfWeek);
      const templateSkipDates = parseSkipDates(template.skipDates);
      const parts = (template.departureTime ?? '08:00').split(':').map(Number);
      const hours = parts[0] ?? 8;
      const minutes = parts[1] ?? 0;
      
      const validFrom = template.validFrom ? new Date(template.validFrom) : new Date();
      const validUntil = template.validUntil ? new Date(template.validUntil) : null;
      
      let created = 0;
      const now = new Date();
      
      for (let w = 0; w < weeksAhead; w++) {
        for (const dayOfWeek of daysOfWeek) {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          while (d.getDay() !== dayOfWeek) d.setDate(d.getDate() + 1);
          d.setDate(d.getDate() + w * 7);
          d.setHours(hours, minutes, 0, 0);
          
          // Skip if in past
          if (d <= now) continue;
          
          // Skip if outside valid range
          if (d < validFrom) continue;
          if (validUntil && d > validUntil) continue;
          
          // Skip if in skip dates
          const dateStr = d.toISOString().slice(0, 10);
          if (templateSkipDates.includes(dateStr)) continue;
          
          const iso = d.toISOString();
          const expiresAt = new Date(d.getTime() + (template.graceMinutes || 60) * 60 * 1000);
          const joinCode = generateJoinCode();
          
          // Create outbound ride
          const result = await client.models.Ride.create({
            hostId: profile.id,
            name: template.name || undefined,
            rideType: 'offer',
            status: 'open',
            originLatitude: template.originLatitude,
            originLongitude: template.originLongitude,
            originAddress: template.originAddress ?? undefined,
            originRegion: template.originRegion ?? undefined,
            destinationLatitude: template.destinationLatitude,
            destinationLongitude: template.destinationLongitude,
            destinationAddress: template.destinationAddress ?? undefined,
            destinationRegion: template.destinationRegion ?? undefined,
            departureTime: iso,
            expiresAt: expiresAt.toISOString(),
            graceMinutes: template.graceMinutes || 60,
            totalSeats: template.totalSeats,
            seatsBooked: 0,
            pricePerSeat: template.pricePerSeat,
            vehicleInfo: template.vehicleInfo ?? undefined,
            notes: template.notes ?? undefined,
            pickupRadius: template.pickupRadius ?? undefined,
            dropoffRadius: template.dropoffRadius ?? undefined,
            joinCode: joinCode,
            isReturnTrip: false,
            recurringTemplateId: template.id,
            createdAt: new Date().toISOString(),
          }) as { data?: { id: string } | null; errors?: unknown[] };
          
          if (!result.errors) {
            created++;
            
            // Create return trip if round-trip
            if (template.isRoundTrip && template.returnDepartureTime && result.data?.id) {
              const [returnHours, returnMinutes] = template.returnDepartureTime.split(':').map(Number);
              const returnDate = new Date(d);
              returnDate.setHours(returnHours, returnMinutes, 0, 0);
              
              if (returnDate <= d) {
                returnDate.setDate(returnDate.getDate() + 1);
              }
              
              const returnExpiresAt = new Date(returnDate.getTime() + (template.graceMinutes || 60) * 60 * 1000);
              const returnJoinCode = generateJoinCode();
              
              const returnResult = await client.models.Ride.create({
                hostId: profile.id,
                name: template.name ? `${template.name} (Return)` : undefined,
                rideType: 'offer',
                status: 'open',
                // Swap origin and destination
                originLatitude: template.destinationLatitude,
                originLongitude: template.destinationLongitude,
                originAddress: template.destinationAddress ?? undefined,
                originRegion: template.destinationRegion ?? undefined,
                destinationLatitude: template.originLatitude,
                destinationLongitude: template.originLongitude,
                destinationAddress: template.originAddress ?? undefined,
                destinationRegion: template.originRegion ?? undefined,
                departureTime: returnDate.toISOString(),
                expiresAt: returnExpiresAt.toISOString(),
                graceMinutes: template.graceMinutes || 60,
                totalSeats: template.totalSeats,
                seatsBooked: 0,
                pricePerSeat: template.pricePerSeat,
                vehicleInfo: template.vehicleInfo ?? undefined,
                notes: template.notes ?? undefined,
                pickupRadius: template.dropoffRadius ?? undefined,
                dropoffRadius: template.pickupRadius ?? undefined,
                joinCode: returnJoinCode,
                linkedRideId: result.data.id,
                isReturnTrip: true,
                recurringTemplateId: template.id,
                createdAt: new Date().toISOString(),
              }) as { data?: { id: string } | null; errors?: unknown[] };
              
              if (!returnResult.errors && returnResult.data?.id) {
                // Link outbound to return
                await client.models.Ride.update({
                  id: result.data.id,
                  linkedRideId: returnResult.data.id,
                });
                created++;
              }
            }
          }
        }
      }
      
      toast.success(`Created ${created} ride(s) from template.`);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Create from template:', e);
      toast.error('Failed to create rides from template.');
    } finally {
      setGenerating(null);
    }
  };

  const addSkipDate = () => {
    if (skipDateInput && !skipDates.includes(skipDateInput)) {
      setSkipDates([...skipDates, skipDateInput].sort());
      setSkipDateInput('');
    }
  };

  const removeSkipDate = (date: string) => {
    setSkipDates(skipDates.filter(d => d !== date));
  };

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter(d => d !== day)
        : [...f.daysOfWeek, day].sort((a, b) => a - b),
    }));
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
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCurrentView('account')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Back to account"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Recurring Rides</h1>
            <p className="text-sm text-gray-600">Create templates for regular trips</p>
          </div>
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
              Create a template for your regular trips and generate rides automatically.
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
            <div className="space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name (optional)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Daily Commute"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Origin/Destination */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From (region)</label>
                  <input
                    type="text"
                    value={form.originRegion}
                    onChange={(e) => setForm(f => ({ ...f, originRegion: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To (region)</label>
                  <input
                    type="text"
                    value={form.destinationRegion}
                    onChange={(e) => setForm(f => ({ ...f, destinationRegion: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Days of Week */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
                <div className="flex flex-wrap gap-1">
                  {SHORT_DAY_NAMES.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors min-w-[44px] ${
                        form.daysOfWeek.includes(i)
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, daysOfWeek: [1, 2, 3, 4, 5] }))}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Weekdays
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, daysOfWeek: [0, 6] }))}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Weekends
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, daysOfWeek: [] }))}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
                  <input
                    type="time"
                    value={form.departureTime}
                    onChange={(e) => setForm(f => ({ ...f, departureTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (minutes)</label>
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={form.graceMinutes}
                    onChange={(e) => setForm(f => ({ ...f, graceMinutes: Number(e.target.value) || 60 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Valid Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => setForm(f => ({ ...f, validFrom: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until (optional)</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm(f => ({ ...f, validUntil: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Skip Dates */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skip Dates (holidays, etc.)</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={skipDateInput}
                    onChange={(e) => setSkipDateInput(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={addSkipDate}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
                {skipDates.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {skipDates.map(date => (
                      <span key={date} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm">
                        {date}
                        <button type="button" onClick={() => removeSkipDate(date)} className="text-gray-500 hover:text-red-600">
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Round-trip Toggle */}
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-indigo-900">Round Trip</label>
                    <p className="text-xs text-indigo-700">Create return trips automatically</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, isRoundTrip: !f.isRoundTrip }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                      form.isRoundTrip ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={form.isRoundTrip}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        form.isRoundTrip ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {form.isRoundTrip && (
                  <div className="mt-3">
                    <label className="block text-xs text-indigo-700 mb-1">Return Time</label>
                    <input
                      type="time"
                      value={form.returnDepartureTime}
                      onChange={(e) => setForm(f => ({ ...f, returnDepartureTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Seats and Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seats</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.totalSeats}
                    onChange={(e) => setForm(f => ({ ...f, totalSeats: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price per seat ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.pricePerSeat}
                    onChange={(e) => setForm(f => ({ ...f, pricePerSeat: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setForm(defaultForm);
                  setSkipDates([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTemplate}
                disabled={creating || form.daysOfWeek.length === 0}
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
              {templates.map((t) => {
                const days = parseDaysOfWeek(t.daysOfWeek);
                const isGenerating = generating === t.id;
                return (
                  <li key={t.id} className={`bg-white rounded-lg shadow border p-4 ${t.status === 'paused' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {t.name && (
                          <p className="font-semibold text-gray-900 mb-1">{t.name}</p>
                        )}
                        <p className="font-medium text-gray-900">
                          {t.originRegion || t.originAddress || 'Origin'} → {t.destinationRegion || t.destinationAddress || 'Destination'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDaysOfWeek(days)} at {t.departureTime} • ${t.pricePerSeat}/seat • {t.totalSeats} seats
                        </p>
                        {t.isRoundTrip && (
                          <p className="text-sm text-indigo-600">
                            Round trip (return at {t.returnDepartureTime})
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(t)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                          title={t.status === 'active' ? 'Pause template' : 'Activate template'}
                        >
                          {t.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          title="Delete template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                      <button
                        type="button"
                        onClick={() => handleGenerateRides(t, 4)}
                        disabled={isGenerating || t.status === 'paused'}
                        className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Generate next 4 weeks
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateRides(t, 8)}
                        disabled={isGenerating || t.status === 'paused'}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        8 weeks
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateRides(t, 12)}
                        disabled={isGenerating || t.status === 'paused'}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        12 weeks
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
