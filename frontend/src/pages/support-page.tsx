import React, { useState } from 'react';
import {
    LifeBuoy,
    Mail,
    Copy,
    Check,
    ExternalLink,
    Send,
    MessageSquare,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    Clock,
    Activity,
    ArrowRight,
    Sparkles,
    Settings,
    ScrollText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { User } from '../types/user';

type SupportPageProps = {
    currentUser?: User;
};

// Official Discord vector icon
function DiscordIcon({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
    );
}

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "community@boomerr.org";
const DISCORD_INVITE_URL = "https://discord.gg/SwfzDwxExc";

const FAQS = [
    {
        question: "How do multi-region checks prevent false alarms?",
        answer: "Boomerr evaluates response anomalies simultaneously across distributed AWS regions before raising an incident. An alert triggers only when consensus is reached across independent vantage points, eliminating false positives caused by local network transit blips."
    },
    {
        question: "How can I configure notification channels (Discord, Slack, SMS, Telegram)?",
        answer: "Navigate to Settings > Integrations or click into an individual domain from the Overview screen. You can configure webhook URLs for Slack and Discord, connect Telegram bots, or set up SMS alerts for critical downtime events."
    },
    {
        question: "How does automated ad protection work during downtime?",
        answer: "When a monitored website or checkout goes down, Boomerr can automatically pause active Facebook and Google advertising campaigns to prevent wasted ad spend, and automatically resume them once your site recovers (only if they were active before the outage)."
    },
    {
        question: "When are SSL certificate expiration alerts triggered?",
        answer: "SSL monitoring checks certificate validity continuously. Automated warning notifications are dispatched at 30 days, 14 days, 7 days, and 1 day prior to expiration so your team has ample time for renewal."
    },
    {
        question: "How can I upgrade or manage our subscription plan?",
        answer: "Workspace owners can manage plans, adjust domain quotas, switch between billing cycles, and review invoices under the Billing section in the sidebar."
    }
];

export default function SupportPage({ currentUser }: SupportPageProps) {
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

    // Quick message form state
    const [category, setCategory] = useState("Technical Support");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCopyEmail = async () => {
        try {
            await navigator.clipboard.writeText(SUPPORT_EMAIL);
            setCopiedEmail(true);
            toast.success(`Copied ${SUPPORT_EMAIL} to clipboard!`);
            setTimeout(() => setCopiedEmail(false), 2500);
        } catch {
            toast.error("Failed to copy email. Please copy manually.");
        }
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) {
            toast.error("Please fill in both the subject and message.");
            return;
        }

        setIsSubmitting(true);

        const emailSubject = encodeURIComponent(`[${category}] ${subject.trim()}`);
        const userDetails = currentUser ? `\n\n---\nSent from Boomerr by: ${currentUser.name} (${currentUser.email})` : '';
        const emailBody = encodeURIComponent(`${message.trim()}${userDetails}`);
        const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${emailSubject}&body=${emailBody}`;

        // Open mailto link
        window.location.href = mailtoUrl;

        toast.success("Draft opened in your email client!");
        setIsSubmitting(false);
    };

    const toggleFaq = (index: number) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

    return (
        <div className="px-2 pb-12 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6 max-w-7xl mx-auto space-y-6 sm:space-y-8">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/60">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3 text-slate-50">
                        <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2 sm:p-2.5 shadow-lg shadow-blue-500/20 flex-shrink-0">
                            <LifeBuoy size={22} className="sm:w-6 sm:h-6 text-white" />
                        </div>
                        <span className="truncate">Support & Community</span>
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-slate-300">
                        Have a question, feedback, or need assistance? We're here to help you get the most out of Boomerr.
                    </p>
                </div>

                {/* System status pill */}
                <div className="flex items-center gap-2.5 self-start sm:self-auto bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl text-xs sm:text-sm">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-slate-300 font-medium">All Systems Operational</span>
                    <Link
                        to="/status"
                        className="text-sky-400 hover:text-sky-300 transition-colors ml-1 font-semibold flex items-center gap-0.5"
                    >
                        Status <ArrowRight size={13} />
                    </Link>
                </div>
            </div>

            {/* Top Cards: Contact Email & Discord Community */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* 1. Email Support Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between hover:border-slate-700/80 transition-all duration-300 group">
                    <div>
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                                <Mail size={22} />
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Clock size={12} /> Response in ~24 hrs
                            </span>
                        </div>

                        <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
                            Email Support
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed">
                            For any concern contact to : <span className="font-semibold text-slate-100">{SUPPORT_EMAIL}</span>. Our technical support and engineering team is available 24/7 to resolve queries.
                        </p>

                        {/* Email address copy banner */}
                        <div className="rounded-xl bg-slate-900/90 border border-slate-800/90 p-3 sm:p-4 mb-5 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex items-center gap-2.5">
                                <Mail size={16} className="text-sky-400 flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-mono font-semibold text-slate-100 truncate select-all">
                                    {SUPPORT_EMAIL}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyEmail}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors flex-shrink-0"
                                title="Copy email address"
                            >
                                {copiedEmail ? (
                                    <>
                                        <Check size={14} className="text-emerald-400" />
                                        <span className="text-emerald-400">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} />
                                        <span>Copy</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Feature bullets */}
                        <div className="space-y-2 mb-6">
                            <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-300">
                                <ShieldCheck size={16} className="text-sky-400 mt-0.5 flex-shrink-0" />
                                <span>Dedicated technical guidance for domain alerts and webhooks</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-300">
                                <ShieldCheck size={16} className="text-sky-400 mt-0.5 flex-shrink-0" />
                                <span>Fast resolution for billing, invoices, and quota inquiries</span>
                            </div>
                            <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-300">
                                <ShieldCheck size={16} className="text-sky-400 mt-0.5 flex-shrink-0" />
                                <span>Priority incident escalation for critical enterprise outages</span>
                            </div>
                        </div>
                    </div>

                    <a
                        href={`mailto:${SUPPORT_EMAIL}?subject=Boomerr%20Support%20Request`}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 hover:!text-slate-950 font-semibold px-4 py-2.5 text-xs sm:text-sm transition-all shadow-lg shadow-sky-500/20"
                    >
                        <Mail size={16} />
                        <span>Send Email to Support</span>
                    </a>
                </div>

                {/* 2. Discord Community Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-sm flex flex-col justify-between hover:border-slate-700/80 transition-all duration-300 group">
                    <div>
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="h-11 w-11 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/25 flex items-center justify-center text-[#5865F2] group-hover:scale-105 transition-transform">
                                <DiscordIcon className="w-6 h-6" />
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#5865F2]/10 text-[#7983f5] border border-[#5865F2]/25">
                                <Sparkles size={12} /> Live Community
                            </span>
                        </div>

                        <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
                            Discord Community
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed">
                            Join our Discord community and chat with us for your query! Connect directly with the Boomerr engineering team, share suggestions, and get fast answers.
                        </p>

                        {/* Community highlights box */}
                        <div className="rounded-xl bg-slate-900/90 border border-slate-800/90 p-3 sm:p-4 mb-5">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                                Why Join Our Discord?
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-200">
                                    <MessageSquare size={15} className="text-[#7983f5] flex-shrink-0" />
                                    <span>Chat with us live for your query & troubleshooting</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-200">
                                    <Activity size={15} className="text-[#7983f5] flex-shrink-0" />
                                    <span>Real-time release updates, patches & early feature previews</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-200">
                                    <ShieldCheck size={15} className="text-[#7983f5] flex-shrink-0" />
                                    <span>Network with DevOps engineers & site reliability professionals</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-slate-300 mb-6 italic">
                            Have quick questions or ideas? Our community channels are always active.
                        </p>
                    </div>

                    <a
                        href={DISCORD_INVITE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl text-white bg-[#5865F2] hover:bg-[#4752c4] hover:!text-white font-semibold px-4 py-2.5 text-xs sm:text-sm transition-all shadow-lg shadow-[#5865F2]/20"
                    >
                        <DiscordIcon className="w-5 h-5" />
                        <span>Join Discord Community & Chat With Us</span>
                        <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            {/* Quick Contact / Message Box Section */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-6 md:p-8 shadow-xl backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                            <Send size={18} className="text-sky-400" />
                            <span>Send Us a Quick Query</span>
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 mt-1">
                            Fill out the form below to quickly formulate and send your request directly to <span className="text-slate-100 font-medium">{SUPPORT_EMAIL}</span>.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSendMessage} className="space-y-4 sm:space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-slate-200 mb-1.5">
                                Query Category <span className="text-red-400">*</span>
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 focus:border-sky-500 focus:outline-none transition-colors"
                            >
                                <option value="Technical Support">Technical Support / Monitoring Issue</option>
                                <option value="Incident / False Alarm">Incident / Alert Delivery Question</option>
                                <option value="Integrations & Webhooks">Integrations (Discord, Slack, SMS, Telegram)</option>
                                <option value="Billing & Invoicing">Billing, Plans & Invoices</option>
                                <option value="Feature Request">Feature Request & Feedback</option>
                                <option value="General Query">General Query</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-slate-200 mb-1.5">
                                Subject <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Brief summary of your question or issue"
                                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none transition-colors"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-200 mb-1.5">
                            Detailed Message / Description <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            rows={4}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Please provide details, error messages, domain names, or questions you have..."
                            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none transition-colors resize-y"
                            required
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <span className="text-xs text-slate-400 order-2 sm:order-1">
                            Sending will open your email client pre-filled to <span className="text-slate-200 font-mono">{SUPPORT_EMAIL}</span>.
                        </span>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-5 py-2.5 text-xs sm:text-sm transition-all shadow-lg shadow-sky-500/20 disabled:opacity-60 order-1 sm:order-2"
                        >
                            <Send size={15} />
                            <span>Send Query via Email</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* FAQs Accordion */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-6 md:p-8 shadow-xl backdrop-blur-sm">
                <div className="mb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                        <LifeBuoy size={18} className="text-sky-400" />
                        <span>Frequently Asked Questions</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1">
                        Find immediate answers to common questions about monitoring, multi-region checks, and integrations.
                    </p>
                </div>

                <div className="divide-y divide-slate-800/80">
                    {FAQS.map((faq, index) => {
                        const isOpen = openFaqIndex === index;
                        return (
                            <div key={index} className="py-3.5 first:pt-0 last:pb-0">
                                <button
                                    type="button"
                                    onClick={() => toggleFaq(index)}
                                    className="w-full flex items-center justify-between gap-4 text-left font-medium text-xs sm:text-sm text-slate-200 hover:text-white transition-colors"
                                >
                                    <span>{faq.question}</span>
                                    <div className="text-slate-400 flex-shrink-0">
                                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </button>
                                {isOpen && (
                                    <div className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed pl-1 animate-fade-in">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Helpful quick links grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <Link
                    to="/status"
                    className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition-all flex flex-col justify-between group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Activity size={15} className="text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                            <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Live System Status</span>
                        </div>
                        <ArrowRight size={14} className="text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                    <p className="text-xs text-slate-400">
                        Check real-time health and uptime of all Boomerr monitoring regions.
                    </p>
                </Link>

                <Link
                    to="/settings"
                    className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition-all flex flex-col justify-between group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Settings size={15} className="text-sky-400 group-hover:rotate-45 transition-transform duration-300 flex-shrink-0" />
                            <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Workspace Settings</span>
                        </div>
                        <ArrowRight size={14} className="text-slate-400 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                    <p className="text-xs text-slate-400">
                        Configure alerting preferences, manage team members, and integrations.
                    </p>
                </Link>

                <Link
                    to="/logs"
                    className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900 hover:border-slate-700 transition-all flex flex-col justify-between group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <ScrollText size={15} className="text-indigo-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                            <span className="text-xs font-semibold text-slate-300 group-hover:text-white">System & Webhook Logs</span>
                        </div>
                        <ArrowRight size={14} className="text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                    <p className="text-xs text-slate-400">
                        Inspect delivery statuses and detailed payloads for all triggered alerts.
                    </p>
                </Link>
            </div>
        </div>
    );
}
