import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getEmailPreferences, updateEmailPreferences, type EmailPreferences as IEmailPreferences } from "../../services/preferences-service";
import { Loader2 } from "lucide-react";

const EmailPreferences = () => {
    const [preferences, setPreferences] = useState<IEmailPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPreferences();
    }, []);

    const fetchPreferences = async () => {
        try {
            const data = await getEmailPreferences();
            setPreferences(data);
        } catch (e) {
            console.error("Failed to fetch preferences:", e);
            setError("Could not load email preferences.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (key: keyof IEmailPreferences) => {
        if (!preferences) return;

        const newPreferences = {
            ...preferences,
            [key]: !preferences[key]
        };

        // Optimistic UI update
        setPreferences(newPreferences);
        setSaving(true);

        try {
            await updateEmailPreferences(newPreferences);
            toast.success("Preferences updated");
        } catch (e) {
            console.error(e);
            toast.error("Failed to update preference");
            // Revert
            setPreferences(preferences);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
                <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin w-4 h-4" /> Loading preferences...</div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="rounded-2xl border border-red-900/50 bg-slate-950/80 p-6">
                <p className="text-red-400">{error}</p>
            </section>
        );
    }

    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-100 mb-1">Email Preferences</h2>
                <p className="text-sm text-slate-400">Manage what types of emails you receive from us.</p>
            </div>

            <div className="flex flex-col gap-4">
                <PreferenceToggle
                    title="Onboarding & Guidance"
                    description="Helpful tips for setting up Boomerr and making the most out of your monitoring."
                    checked={preferences?.receives_onboarding_emails ?? true}
                    onChange={() => handleToggle("receives_onboarding_emails")}
                    disabled={saving}
                />
                <PreferenceToggle
                    title="Product Updates"
                    description="Announcements about new features, improvements, and system updates."
                    checked={preferences?.receives_product_updates ?? true}
                    onChange={() => handleToggle("receives_product_updates")}
                    disabled={saving}
                />
                <PreferenceToggle
                    title="Weekly Newsletters"
                    description="The Uptime Report: industry stats, uptime tips, and feature spotlights."
                    checked={preferences?.receives_newsletters ?? true}
                    onChange={() => handleToggle("receives_newsletters")}
                    disabled={saving}
                />
                <PreferenceToggle
                    title="Promotional Offers"
                    description="Special discounts, upgrade offers, and partnership announcements."
                    checked={preferences?.receives_promotional_emails ?? true}
                    onChange={() => handleToggle("receives_promotional_emails")}
                    disabled={saving}
                />
            </div>
            <p className="text-xs text-slate-500 mt-6">
                Note: You will always receive critical transactional emails such as billing receipts, password resets, and downtime alerts regardless of these settings.
            </p>
        </section>
    );
};

interface PreferenceToggleProps {
    title: string;
    description: string;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
}

const PreferenceToggle = ({ title, description, checked, onChange, disabled }: PreferenceToggleProps) => {
    return (
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="flex-1">
                <h3 className="text-sm font-medium text-slate-200">{title}</h3>
                <p className="text-sm text-slate-400 mt-1">{description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
            </label>
        </div>
    );
};

export default EmailPreferences;
