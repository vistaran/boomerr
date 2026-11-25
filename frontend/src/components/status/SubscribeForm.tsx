import React, { useState } from 'react';
import axios from 'axios';
import { Mail, Rss, CheckCircle2, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_SUBSCRIPTION_STORAGE_KEY = 'boomerr_status_subscribed_email';

export const SubscribeForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribedEmail, setSubscribedEmail] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STATUS_SUBSCRIPTION_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      const apiBase = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api');
      await axios.post(`${apiBase}/status/subscribe`, { email });
      setSubscribedEmail(email);
      try {
        localStorage.setItem(STATUS_SUBSCRIPTION_STORAGE_KEY, email);
      } catch {
        // ignore storage error
      }
      toast.success('Successfully subscribed to status updates.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Subscription failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribeLocal = () => {
    setSubscribedEmail(null);
    setEmail('');
    try {
      localStorage.removeItem(STATUS_SUBSCRIPTION_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="rounded-2xl border border-white/[0.07] overflow-hidden shadow-2xl relative"
      style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(99,102,241,0.08) 40%, rgba(5,11,20,0.95) 100%)' }}
    >
      {/* Top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
      {/* Subtle background orb */}
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />

      <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 tracking-wide">
              Stay Informed
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md leading-relaxed">
              Get real-time email notifications whenever an incident is created, updated, or resolved.
            </p>
          </div>
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
          {subscribedEmail ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Subscribed ({subscribedEmail})</span>
              </div>
              <button
                type="button"
                onClick={handleUnsubscribeLocal}
                className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
                title="Change or remove subscribed email"
              >
                Change
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full sm:w-64 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.06] transition-all duration-200"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all duration-200 whitespace-nowrap shadow-lg shadow-blue-500/25"
              >
                {loading ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
          )}

          <a
            href={`${import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api')}/status/feed.xml`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] text-slate-300 rounded-xl text-sm font-medium transition-all duration-200 border border-white/[0.07] w-full sm:w-auto"
          >
            <Rss className="w-4 h-4 text-orange-400" />
            RSS Feed
          </a>
        </div>
      </div>
    </div>
  );
};
