import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useInvitationDetails, useAcceptInvitation } from "../hooks";
import HCaptcha from "../components/auth/hcaptcha-wrapper";
import logo from "../assets/logo-5.png";
import { useAuth } from "../context/auth-context";
import { useRuntimeConfig } from "../hooks/use-runtime-config";

// Extract token from URL or search params outside the component
function extractInviteToken(searchParams: URLSearchParams): string | null {
    let inviteToken = searchParams.get("token");
    if (!inviteToken) {
        const match = window.location.pathname.match(/\/accept-invitation\/([^/]+)/);
        inviteToken = match ? match[1] : null;
    }
    return inviteToken;
}

export function AcceptInvitationPage() {
    const { hcaptchaSiteKey } = useRuntimeConfig();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { persistAuth } = useAuth();
    const initialToken = extractInviteToken(searchParams);
    const [token] = useState<string | null>(initialToken);
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const captchaRef = useRef<unknown>(null);

    // React Query hooks
    const {
        data: invitationDetails,
        isLoading: isLoadingInvitation,
        isError: isInvitationError
    } = useInvitationDetails(token ?? "");

    const acceptInvitationMutation = useAcceptInvitation();

    const email = invitationDetails?.email ?? "";

    // Show error toast when invitation lookup fails
    useEffect(() => {
        if (!token) {
            toast.error("Invalid invitation link.");
        } else if (isInvitationError) {
            toast.error("This invitation link is invalid or has expired.");
        }
    }, [token, isInvitationError]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            toast.error("Invalid invitation link.");
            return;
        }

        // Validate all fields
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = "Name is required";
        if (!password.trim()) newErrors.password = "Password is required";
        else if (password.length < 8) newErrors.password = "Password must be at least 8 characters long";

        if (!passwordConfirmation.trim()) newErrors.passwordConfirmation = "Password confirmation is required";
        else if (password !== passwordConfirmation) newErrors.passwordConfirmation = "Passwords do not match";

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) return;

        if (hcaptchaSiteKey && !captchaToken) {
            toast.error("Please complete the captcha verification.");
            return;
        }

        try {
            const toastId = toast.loading("Accepting invitation...");
            const res = await acceptInvitationMutation.mutateAsync({
                token,
                payload: {
                    name: name.trim(),
                    password: password.trim(),
                    password_confirmation: passwordConfirmation.trim(),
                },
            });
            if (res?.token && res?.user) {
                persistAuth(res.token, res.user, res.workspaces ?? []);
            }
            toast.dismiss(toastId);

            if (res?.user && (res?.user?.onboarding_settings?.onboarding_completed === false || res?.user?.onboarding_settings === undefined || res?.user?.onboarding_settings == null)) {
                navigate("/onboarding/plan", { replace: true });
            } else {
                navigate("/overview", { replace: true });
            }
        } catch {
            // Error handling is done in the mutation hook
        }
    };

    // Determine status for UI rendering
    const status = !token || isInvitationError
        ? "error"
        : isLoadingInvitation
            ? "loading"
            : "ready";

    return (
        <div className="flex flex-col items-center w-full min-h-screen justify-center bg-gradient-to-br from-sky-900 via-slate-900 to-indigo-900 py-10 px-4">
            <img src={logo} alt="Logo" className="mb-4 h-16 w-16 object-contain" />
            {/* <div className="mb-2 flex justify-center">
                <span className="rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-1 text-sm font-bold uppercase tracking-[0.18em] text-white shadow">MVP</span>
            </div> */}
            <div className="mb-4 text-center">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-50 drop-shadow">Boomerr</h1>
                <p className="mt-2 text-base text-slate-200">Welcome! Accept your invitation to join the team.</p>
            </div>

            {status === "loading" && (
                <div className="w-full max-w-md rounded-3xl border border-sky-700/50 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-8 shadow-2xl backdrop-blur">
                    <p className="text-center text-slate-300">Loading invitation...</p>
                </div>
            )}

            {status === "error" && (
                <div className="w-full max-w-md rounded-3xl border border-red-700/50 bg-gradient-to-br from-slate-900 via-slate-800 to-red-900 p-8 shadow-2xl backdrop-blur">
                    <p className="text-center text-slate-300">This invitation link is invalid or has expired.</p>
                </div>
            )}

            {status === "ready" && (
                <div className="w-full max-w-md rounded-3xl border border-sky-700/50 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-8 shadow-2xl backdrop-blur transition-transform">
                    <form onSubmit={onSubmit} className="space-y-4" noValidate>
                        <h2 className="text-2xl font-bold text-center text-slate-50">Accept Invitation</h2>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-300 cursor-not-allowed opacity-75"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-300">Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={name}
                                autoComplete="off"
                                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: '' }); }}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-300">Password <span className="text-red-500">*</span></label>
                            <input
                                type="password"
                                autoComplete="off"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: '' }); }}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            />
                            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-300">Confirm Password <span className="text-red-500">*</span></label>
                            <input
                                type="password"
                                value={passwordConfirmation}
                                onChange={(e) => { setPasswordConfirmation(e.target.value); if (errors.passwordConfirmation) setErrors({ ...errors, passwordConfirmation: '' }); }}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            />
                            {errors.passwordConfirmation && <p className="text-red-500 text-xs mt-1">{errors.passwordConfirmation}</p>}
                        </div>

                        {hcaptchaSiteKey && (
                            <div className="w-full flex justify-center mt-6 mb-2">
                                <div className="w-full max-w-xs flex justify-center">
                                    <HCaptcha
                                        sitekey={hcaptchaSiteKey}
                                        onVerify={(token: string) => setCaptchaToken(token)}
                                        onExpire={() => setCaptchaToken(null)}
                                        ref={captchaRef}
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={(Boolean(hcaptchaSiteKey) && !captchaToken) || acceptInvitationMutation.isPending}
                            className="mt-5 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {acceptInvitationMutation.isPending ? "Accepting..." : "Accept Invitation"}
                        </button>
                    </form>
                </div>
            )}

        </div>
    );
}