import type { FormEvent } from "react";
import React, { useRef, useState, useEffect } from "react";
import { Eye, EyeOff, Mail, Lock, User as UserIcon, AlertCircle, Pencil } from "lucide-react";
import { useGoogleLogin } from "@react-oauth/google";
import toast from "react-hot-toast";
import { apiFetch, sendLoginOtp, verifyLoginOtp, type WorkspaceSummary } from "../../services/api-service";
import { useNavigate, useLocation, Link } from "react-router-dom";
import type { User } from "../../types/user";
import { getAuthRedirectPath } from "../../lib/onboarding-redirect";
import { trackEvent } from "../../lib/analytics";
import { AuthLayout } from "./auth-layout";
import CommonLoader from "../common/common-loader";
import HCaptcha from "./hcaptcha-wrapper";
import { useRuntimeConfig } from "../../hooks/use-runtime-config";

export type AuthMode = "login" | "register";

export type AuthFormState = {
    name: string;
    email: string;
    password: string;
    passwordConfirmation: string;
};

type AuthCardProps = {
    onModeChange?: (mode: AuthMode) => void;
    form: AuthFormState;
    setForm: (updater: (prev: AuthFormState) => AuthFormState) => void;
    loading: boolean;
    onSubmit: (e: FormEvent) => void;
    onCaptchaVerify?: (token: string | null) => void;
    persistAuth: (token: string, user: User, workspaces: WorkspaceSummary[]) => void;
};

function GoogleAuthButton({
    disabled,
    onStart,
    onSuccess,
    onError,
}: {
    disabled: boolean;
    onStart: () => void;
    onSuccess: (res: any) => void;
    onError: () => void;
}) {
    const loginWithGoogle = useGoogleLogin({
        onSuccess: (tokenResponse) => onSuccess({ credential: tokenResponse.access_token }),
        onError: () => onError(),
        onNonOAuthError: () => onError(),
    });

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => {
                if (disabled) return;
                onStart();
                loginWithGoogle();
            }}
            className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all outline-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed group/google"
            title="Sign in with Google"
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
        </button>
    );
}

export function AuthCard({
    onModeChange,
    form,
    setForm,
    loading,
    onSubmit,
    onCaptchaVerify,
    persistAuth
}: AuthCardProps) {
    const { hcaptchaSiteKey } = useRuntimeConfig();
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const _initialMode = (() => {
        try {
            const p = new URLSearchParams(location.search || window.location.search);
            const v = p.get('auth');
            if (v === 'register' || v === 'signup') return 'register';
        } catch (e) {
            console.log(e);
        }
        return 'login';
    })();

    const [mode, setMode] = useState<AuthMode>(_initialMode);
    const [socialLoading, setSocialLoading] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");

    // 6-digit OTP state like the society manager (The Clover App)
    const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
    const [otpSent, setOtpSent] = useState(false);
    const [otpLoading, setOtpLoading] = useState(false);
    const [resendCountdown, setResendCountdown] = useState(0);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        let timer: any;
        if (resendCountdown > 0) {
            timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resendCountdown]);

    useEffect(() => {
        if (onModeChange) onModeChange(_initialMode);
    }, []);

    const handleModeChange = (m: AuthMode) => {
        setMode(m);
        setErrors({});
        setLoginMethod("password");
        setOtpSent(false);
        setOtpDigits(["", "", "", "", "", ""]);
        if (onModeChange) onModeChange(m);
    };

    const handleSendOtp = async () => {
        if (!form.email.trim()) {
            setErrors({ email: "Email is required" });
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            setErrors({ email: "Invalid email format" });
            return;
        }
        setOtpLoading(true);
        try {
            const res = await sendLoginOtp(form.email.trim());
            toast.success(res.message || "Verification code sent to your email!");
            setOtpSent(true);
            setResendCountdown(60);
            setErrors({});
            // Focus first digit box after render
            setTimeout(() => {
                otpRefs.current[0]?.focus();
            }, 100);
        } catch (err: any) {
            toast.error(err.message || "Failed to send verification code");
        } finally {
            setOtpLoading(false);
        }
    };

    const handleOtpChange = (index: number, val: string) => {
        const clean = val.replace(/\D/g, "").slice(-1);
        const next = [...otpDigits];
        next[index] = clean;
        setOtpDigits(next);
        if (errors.otp) setErrors(prev => ({ ...prev, otp: "" }));

        if (clean && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!pasted) return;
        const next = [...otpDigits];
        for (let i = 0; i < 6; i++) {
            next[i] = pasted[i] || "";
        }
        setOtpDigits(next);
        const nextIndex = Math.min(pasted.length, 5);
        otpRefs.current[nextIndex]?.focus();
    };

    const handleVerifyOtp = async () => {
        const code = otpDigits.join("");
        if (code.length !== 6) {
            setErrors({ otp: "Please enter the complete 6-digit code" });
            return;
        }
        setOtpLoading(true);
        try {
            const data = await verifyLoginOtp(form.email.trim(), code);
            persistAuth(data.token, data.user, data.workspaces ?? []);
            trackEvent("login_success", { method: "email_otp" });
            const redirectTo = await getAuthRedirectPath(data.token, data.user);
            navigate(redirectTo, { replace: true });
        } catch (err: any) {
            toast.error(err.message || "Invalid or expired verification code");
        } finally {
            setOtpLoading(false);
        }
    };

    const handleLocalSubmit = (e: FormEvent) => {
        e.preventDefault();
        const newErrors: Record<string, string> = {};

        if (mode === "register") {
            if (!form.name.trim()) newErrors.name = "Full name is required";
            else if (!/^[A-Za-z\s]+$/.test(form.name)) newErrors.name = "Only letters allowed";
        }

        if (!form.email.trim()) newErrors.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Invalid email format";

        if (mode === "login" && loginMethod === "otp") {
            if (!otpSent) {
                handleSendOtp();
                return;
            }
            const code = otpDigits.join("");
            if (code.length !== 6) {
                newErrors.otp = "Please enter the complete 6-digit code";
            }
        } else {
            if (!form.password) newErrors.password = "Password is required";
        }

        if (mode === "register") {
            if (!form.passwordConfirmation) newErrors.passwordConfirmation = "Confirm password required";
            else if (form.password !== form.passwordConfirmation) newErrors.passwordConfirmation = "Passwords do not match";
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length === 0) {
            if (mode === "login" && loginMethod === "otp") {
                handleVerifyOtp();
            } else {
                onSubmit(e);
            }
        }
    };

    const handleGoogleLoginSuccess = async (credentialResponse: any) => {
        setSocialLoading("Authenticating with Google...");
        try {
            const data = await apiFetch<{ token: string; user: User; workspaces: WorkspaceSummary[] }>("/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: credentialResponse.credential }),
            });
            persistAuth(data.token, data.user, data.workspaces ?? []);
            const redirectTo = await getAuthRedirectPath(data.token, data.user);
            navigate(redirectTo, { replace: true });
        } catch (err) {
            toast.error("Google login failed");
            setSocialLoading(null);
        }
    };

    const handleGitHubLogin = () => {
        if (socialLoading || loading) return;
        setSocialLoading("Redirecting to GitHub...");
        const backendUrl = (import.meta.env.VITE_SERVER_URL as string) ?? window.location.origin;
        window.location.href = `${backendUrl}/auth/github/redirect`;
    };

    const handleShopifyPopupLogin = () => {
        if (socialLoading || loading) return;
        setSocialLoading("Connecting with Shopify...");
        localStorage.removeItem('dm_token');

        const backendUrl = (import.meta.env.VITE_SERVER_URL as string) ?? window.location.origin;
        const authUrl = `${backendUrl}/shopify/auth`;

        const width = 600;
        const height = 800;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            authUrl,
            'shopify-login',
            `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
        );

        const handleAuthSuccess = (targetUrl?: string) => {
            const url = targetUrl || '/overview';
            if (window.location.pathname.includes('/overview')) return;
            localStorage.setItem('dm_auth_close_signal', Date.now().toString());

            if (popup && !popup.closed) {
                try { popup.close(); } catch (e) { }
            }

            const newTab = window.open(url, '_blank');
            if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
                window.location.href = url;
            } else {
                window.location.href = url;
            }
        };

        const channel = new BroadcastChannel('auth_channel');
        channel.onmessage = (event) => {
            if (event.data.type === 'AUTH_SUCCESS') {
                channel.close();
                handleAuthSuccess(event.data.targetPath);
            }
        };

        const checkPopup = setInterval(() => {
            const token = localStorage.getItem('dm_token');
            if (token) {
                clearInterval(checkPopup);
                channel.close();
                handleAuthSuccess();
            }

            if (!popup || popup.closed) {
                clearInterval(checkPopup);
                channel.close();
                const finalToken = localStorage.getItem('dm_token');
                if (finalToken) {
                    handleAuthSuccess();
                } else {
                    setSocialLoading(null);
                }
            }
        }, 1000);
    };

    const titleText = mode === "login"
        ? (loginMethod === "otp" && otpSent ? "Check your email" : "Login to Boomerr")
        : "Sign up for Boomerr";

    const subtitleText = mode === "login"
        ? (loginMethod === "otp" && otpSent
            ? "to continue to Boomerr"
            : "Monitor your domains. Stay ahead of every \nexpiry & threat.")
        : "Start monitoring your domains in minutes";

    const customHeader = mode === "login" && loginMethod === "otp" && otpSent ? (
        <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                Check your email
            </h1>
            <p className="text-slate-400 text-sm font-normal mb-1">
                to continue to Boomerr
            </p>
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-200 mt-0.5">
                <span>{form.email}</span>
                <button
                    type="button"
                    onClick={() => {
                        setOtpSent(false);
                        setOtpDigits(["", "", "", "", "", ""]);
                    }}
                    className="p-1 text-slate-400 hover:text-white transition-colors rounded-md hover:bg-white/5"
                    title="Change email"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    ) : undefined;

    return (
        <AuthLayout title={titleText} subtitle={subtitleText} customHeader={customHeader}>
            {socialLoading && (
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                    <CommonLoader className="w-12 h-12 text-sky-400" />
                    <p className="text-white font-medium text-base mt-4 tracking-wide animate-pulse">
                        {socialLoading}
                    </p>
                </div>
            )}

            <div>
                {/* Social Login Options (Shown on password login or register, matching The Clover App flow) */}
                {!(mode === "login" && loginMethod === "otp" && otpSent) && (
                    <>
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {/* GitHub */}
                            <button
                                type="button"
                                disabled={!!socialLoading || loading}
                                onClick={handleGitHubLogin}
                                className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all outline-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed group/git"
                                title="Sign in with GitHub"
                            >
                                <svg className="w-5 h-5 text-slate-400 group-hover/git:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                </svg>
                            </button>

                            {/* Google */}
                            {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                                <GoogleAuthButton
                                    disabled={!!socialLoading || loading}
                                    onStart={() => setSocialLoading("Authenticating with Google...")}
                                    onSuccess={handleGoogleLoginSuccess}
                                    onError={() => {
                                        setSocialLoading(null);
                                        toast.error("Google login failed");
                                    }}
                                />
                            ) : (
                                <button
                                    type="button"
                                    disabled={!!socialLoading || loading}
                                    onClick={() => toast.error("Google sign-in is not configured on this instance.")}
                                    className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all outline-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed group/google"
                                    title="Google sign-in not configured"
                                >
                                    <svg className="w-5 h-5 opacity-40" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                </button>
                            )}

                            {/* Shopify */}
                            <button
                                type="button"
                                disabled={!!socialLoading || loading}
                                onClick={handleShopifyPopupLogin}
                                className="flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/20 transition-all outline-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed group/shopify"
                                title="Sign in with Shopify"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 25 28" fill="none">
                                    <path fill="#95BF47" fillRule="evenodd" d="M17.836 27.059l-.062-23.736c-.16-.16-.472-.112-.594-.076l-.813.252a5.675 5.675 0 00-.39-.957c-.576-1.1-1.42-1.682-2.44-1.683h-.003c-.068 0-.136.006-.204.012h-.008a2.234 2.234 0 00-.092-.105C12.786.29 12.216.059 11.533.079c-1.318.038-2.63.99-3.693 2.679-.75 1.19-1.318 2.683-1.48 3.84L3.767 7.4c-.764.24-.788.263-.888.982C2.803 8.928.806 24.377.806 24.377l16.743 2.895.287-.213zM12.35 1.163a1.347 1.347 0 00-.792-.208c-2.033.06-3.807 3.235-4.26 5.352l1.949-.604.347-.107c.255-1.344.896-2.738 1.733-3.636a3.821 3.821 0 011.023-.797zm-1.793 4.135l2.796-.866c.009-.728-.07-1.805-.435-2.565-.388.16-.715.44-.95.691-.628.675-1.14 1.705-1.41 2.74zM14.23 4.16l1.299-.403c-.208-.674-.7-1.805-1.7-1.994.311.802.391 1.73.4 2.397z" clipRule="evenodd" />
                                    <path fill="#5E8E3E" d="M21.587 5.088c-.099-.008-2.035-.037-2.035-.037s-1.619-1.573-1.778-1.733a.399.399 0 00-.225-.103v24.053l7.256-1.804S21.844 5.447 21.825 5.31a.263.263 0 00-.238-.222z" />
                                    <path fill="#fff" d="M13.528 8.824l-.843 3.153s-.94-.429-2.054-.358c-1.635.103-1.652 1.134-1.636 1.392.09 1.41 3.799 1.718 4.008 5.021.163 2.599-1.379 4.376-3.601 4.516-2.667.169-4.135-1.405-4.135-1.405l.565-2.404s1.478 1.115 2.66 1.04c.773-.048 1.05-.677 1.021-1.121-.116-1.84-3.137-1.731-3.328-4.754-.16-2.544 1.51-5.12 5.196-5.353 1.42-.09 2.147.273 2.147.273" />
                                </svg>
                            </button>
                        </div>

                        <div className="relative mb-6 flex items-center justify-center">
                            <div className="h-[1px] w-full bg-white/10"></div>
                            <span className="px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                                OR
                            </span>
                            <div className="h-[1px] w-full bg-white/10"></div>
                        </div>
                    </>
                )}

                <form onSubmit={handleLocalSubmit} className="space-y-4">
                    {/* Full Name (Sign Up only) */}
                    {mode === "register" && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Full Name <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="John Doe"
                                    value={form.name}
                                    onChange={(e) => {
                                        setForm(f => ({ ...f, name: e.target.value }));
                                        if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                                    }}
                                    className={`w-full rounded-xl border bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-blue-500 focus:bg-white/[0.05] focus:ring-2 focus:ring-blue-500/20 ${errors.name ? 'border-red-500/60' : 'border-white/10'}`}
                                />
                            </div>
                            {errors.name && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.name}</p>}
                        </div>
                    )}

                    {/* Email Field (Always visible except when OTP is already sent in OTP mode) */}
                    {!(mode === "login" && loginMethod === "otp" && otpSent) && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Email Address <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={form.email}
                                    onChange={(e) => {
                                        setForm(f => ({ ...f, email: e.target.value }));
                                        if (errors.email) setErrors(prev => ({ ...prev, email: "" }));
                                    }}
                                    className={`w-full rounded-xl border bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-blue-500 focus:bg-white/[0.05] focus:ring-2 focus:ring-blue-500/20 ${errors.email ? 'border-red-500/60' : 'border-white/10'}`}
                                />
                            </div>
                            {errors.email && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.email}</p>}
                        </div>
                    )}

                    {/* OTP 6-Digit Box UI (Clean Clerk-inspired minimal design) */}
                    {mode === "login" && loginMethod === "otp" && otpSent && (
                        <div className="animate-fade-in">
                            {/* 6 Individual Digit Boxes */}
                            <div className="flex gap-2 sm:gap-2.5 justify-center mb-3">
                                {otpDigits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => { otpRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        onPaste={handleOtpPaste}
                                        className={`w-11 h-12 sm:w-12 sm:h-13 text-center text-lg font-semibold rounded-xl border transition-all outline-none ${
                                            digit
                                                ? "border-blue-500 bg-blue-500/10 text-white shadow-sm shadow-blue-500/20"
                                                : "border-white/10 bg-white/[0.02] text-white focus:border-blue-500 focus:bg-white/[0.05] focus:ring-1 focus:ring-blue-500/30"
                                        }`}
                                    />
                                ))}
                            </div>

                            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-2">
                                <span>Didn't receive a code?</span>
                                <button
                                    type="button"
                                    disabled={otpLoading || resendCountdown > 0}
                                    onClick={handleSendOtp}
                                    className="font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                                >
                                    {resendCountdown > 0 ? `Resend (${resendCountdown}s)` : "Resend"}
                                </button>
                            </div>
                            {errors.otp && <p className="text-xs text-red-400 mt-2 flex items-center gap-1 justify-center"><AlertCircle className="w-3.5 h-3.5" />{errors.otp}</p>}
                        </div>
                    )}

                    {/* Password Field (When on password mode or register) */}
                    {(mode === "register" || (mode === "login" && loginMethod === "password")) && (
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-xs font-semibold text-slate-300">
                                    Password <span className="text-red-400">*</span>
                                </label>
                                {mode === "login" && (
                                    <Link
                                        to="/forgot-password"
                                        className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={(e) => {
                                        setForm(f => ({ ...f, password: e.target.value }));
                                        if (errors.password) setErrors(prev => ({ ...prev, password: "" }));
                                    }}
                                    className={`w-full rounded-xl border bg-white/[0.03] pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-blue-500 focus:bg-white/[0.05] focus:ring-2 focus:ring-blue-500/20 ${errors.password ? 'border-red-500/60' : 'border-white/10'}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {errors.password && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.password}</p>}

                            {/* Password Strength Meter for Registration (Matching Clover App) */}
                            {mode === "register" && form.password && (
                                <div className="space-y-1.5 mt-2">
                                    <div className="flex gap-1.5">
                                        {[
                                            { met: form.password.length >= 1, color: "bg-red-500" },
                                            { met: form.password.length >= 6, color: "bg-amber-500" },
                                            { met: form.password.length >= 8 && /[A-Z]/.test(form.password) && /\d/.test(form.password), color: "bg-emerald-500" },
                                        ].map((s, i) => (
                                            <div
                                                key={i}
                                                className={`flex-1 h-1 rounded-full transition-all duration-300 ${s.met ? s.color : "bg-white/10"}`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                        Use 8+ characters with uppercase and numbers for strong security
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Confirm Password (Registration only) */}
                    {mode === "register" && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Confirm Password <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={form.passwordConfirmation}
                                    onChange={(e) => {
                                        setForm(f => ({ ...f, passwordConfirmation: e.target.value }));
                                        if (errors.passwordConfirmation) setErrors(prev => ({ ...prev, passwordConfirmation: "" }));
                                    }}
                                    className={`w-full rounded-xl border bg-white/[0.03] pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all focus:border-blue-500 focus:bg-white/[0.05] focus:ring-2 focus:ring-blue-500/20 ${errors.passwordConfirmation ? 'border-red-500/60' : 'border-white/10'}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {errors.passwordConfirmation && <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.passwordConfirmation}</p>}
                        </div>
                    )}

                    {hcaptchaSiteKey && (
                        <div className="flex justify-center py-2">
                            <HCaptcha
                                sitekey={hcaptchaSiteKey}
                                onVerify={(token: string) => {
                                    setCaptchaToken(token);
                                    if (onCaptchaVerify) onCaptchaVerify(token);
                                }}
                                onExpire={() => {
                                    setCaptchaToken(null);
                                    if (onCaptchaVerify) onCaptchaVerify(null);
                                }}
                                theme="dark"
                            />
                        </div>
                    )}

                    {/* Primary Action Button */}
                    {mode === "login" && loginMethod === "otp" && !otpSent ? (
                        <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={otpLoading || !form.email.trim()}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white hover:from-blue-500 hover:to-blue-400 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                        >
                            {otpLoading ? "Sending Code..." : "Send OTP"}
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={loading || otpLoading || (mode === "login" && loginMethod === "otp" && otpDigits.join("").length !== 6)}
                            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-bold text-white hover:from-blue-500 hover:to-blue-400 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                        >
                            {(loading || otpLoading)
                                ? "Please wait..."
                                : mode === "login"
                                ? (loginMethod === "otp" ? "Continue ▸" : "Sign In")
                                : "Create Account"}
                        </button>
                    )}

                    {/* Switch Login Method / Use Another Method */}
                    {mode === "login" && (
                        <div className="pt-3 pb-1 flex justify-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setLoginMethod(m => (m === "password" ? "otp" : "password"));
                                    setOtpSent(false);
                                    setOtpDigits(["", "", "", "", "", ""]);
                                    setErrors({});
                                }}
                                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-white/5 active:scale-[0.98]"
                            >
                                {loginMethod === "password" ? (
                                    <>
                                        <Mail className="w-4 h-4 text-blue-400" />
                                        <span>Sign in with OTP</span>
                                    </>
                                ) : otpSent ? (
                                    <span>Use another method</span>
                                ) : (
                                    <>
                                        <Lock className="w-4 h-4 text-blue-400" />
                                        <span>Sign in with Password</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </form>

                {/* Footer Switcher */}
                {!(mode === "login" && loginMethod === "otp" && otpSent) && (
                    <div className="mt-8 text-center">
                        <p className="text-sm text-slate-400 font-medium">
                            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                            <button
                                type="button"
                                onClick={() => handleModeChange(mode === "login" ? "register" : "login")}
                                className="text-blue-400 font-semibold hover:text-blue-300 hover:underline underline-offset-4 transition-all outline-none"
                            >
                                {mode === "login" ? "Sign up" : "Log in"}
                            </button>
                        </p>
                    </div>
                )}
            </div>
        </AuthLayout>
    );
}
