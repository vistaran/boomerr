import React, { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import HCaptcha from "./hcaptcha-wrapper";
import { apiFetch } from "../../services/api-service";
import { useRuntimeConfig } from "../../hooks/use-runtime-config";

import { AuthLayout } from "./auth-layout";

const ForgotPassword = () => {
    const navigate = useNavigate();
    const captchaRef = useRef<any>(null);
    const { hcaptchaSiteKey } = useRuntimeConfig();

    const [email, setEmail] = useState("");
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};
        if (!email.trim()) newErrors.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Invalid email format";

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            return;
        }

        try {
            setLoading(true);
            setApiError(null);

            await apiFetch("/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    captcha: captchaToken,
                }),
            });

            toast.success("Password reset link sent to your email");
            navigate("/login");
        } catch (err: unknown) {
            console.error(err);
            if (err && typeof err === 'object' && 'message' in err) {
                const error = err as Error & { status?: number };
                setApiError(error.message || "Failed to send reset link");
            } else {
                setApiError("Failed to send reset link");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Reset Password"
            subtitle="We'll send a recovery link to your inbox"
        >
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-xs font-bold uppercase tracking-[0.1em] text-white">Email Address</label>
                    </div>
                    <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: '' }); }}
                        className={`w-full rounded-lg border bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-colors ${errors.email ? 'border-red-500/40' : 'border-white/5'}`}
                    />
                    {errors.email && <p className="text-red-400 text-xs font-medium mt-1 ml-1">{errors.email}</p>}
                </div>

                {hcaptchaSiteKey && (
                    <div className="flex justify-center py-4">
                        <HCaptcha
                            sitekey={hcaptchaSiteKey}
                            onVerify={(token: string) => setCaptchaToken(token)}
                            onExpire={() => setCaptchaToken(null)}
                            ref={captchaRef}
                            theme="dark"
                        />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-bold text-white hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/20 outline-none focus:outline-none"
                >
                    <span className="relative">
                        {loading ? "Sending link..." : "Send reset link"}
                    </span>
                    {!loading && (
                        <svg className="w-2 h-2 fill-white group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24">
                            <path d="M5 3l14 9-14 9V3z" />
                        </svg>
                    )}
                </button>
            </form>

            {apiError && (
                <div className="mt-8 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-fade-in">
                    <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">✕</span>
                    </div>
                    <p className="text-xs font-medium text-red-400 leading-relaxed">{apiError}</p>
                </div>
            )}

            <div className="mt-10 text-center">
                <button
                    onClick={() => navigate("/login")}
                    className="text-blue-500/90 font-semibold hover:text-blue-400 hover:underline underline-offset-4 transition-all text-sm outline-none focus:outline-none"
                >
                    Back to login
                </button>
            </div>
        </AuthLayout>
    );
};

export default ForgotPassword;

