import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Save, RefreshCw } from 'lucide-react';

export const AdminSettingsPage: React.FC = () => {
  const { success, error } = useToast();

  const [name, setName] = useState('Smart Library');
  const [address, setAddress] = useState('Plot 42, Connaught Place, New Delhi');
  const [phone, setPhone] = useState('+91 9876543210');
  const [email, setEmail] = useState('admin@smartlibrary.com');
  const [openingTime, setOpeningTime] = useState('08:00 AM');
  const [closingTime, setClosingTime] = useState('10:00 PM');
  const [qrExpirySeconds, setQrExpirySeconds] = useState(45);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getSettings();
      if (res.data.success && res.data.data) {
        const s = res.data.data;
        setName(s.name || 'Smart Library');
        setAddress(s.address || '');
        setPhone(s.phone || '');
        setEmail(s.email || '');
        setOpeningTime(s.openingTime || '08:00 AM');
        setClosingTime(s.closingTime || '10:00 PM');
        setQrExpirySeconds(s.qrExpirySeconds || 45);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await settingsService.updateSettings({
        name,
        address,
        phone,
        email,
        openingTime,
        closingTime,
        qrExpirySeconds: Number(qrExpirySeconds),
      });
      if (res.data.success) {
        success('Library settings updated successfully!');
      }
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Library Settings
        </h2>
        <p className="text-xs text-slate-500">
          Configure physical library information, opening hours, capacity (50 Seats), and dynamic QR expiry.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4 text-xs">
        <div>
          <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
            Library Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
            Physical Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Contact Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Opening Time
            </label>
            <input
              type="text"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
              placeholder="08:00 AM"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Closing Time
            </label>
            <input
              type="text"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
              placeholder="10:00 PM"
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Total Seats
            </label>
            <input
              type="number"
              disabled
              value={50}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-500 font-bold"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Fixed at 50 physical seats</span>
          </div>

          <div>
            <label className="block font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Attendance QR Expiry (Seconds)
            </label>
            <input
              type="number"
              min={15}
              max={120}
              value={qrExpirySeconds}
              onChange={(e) => setQrExpirySeconds(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Recommended: 30-60s TTL</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Library Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
