import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import { apiFetch } from "../../services/api-service";
import type { WorkspaceSummary } from "../../services/api-service";
import type { User } from "../../types/user";
import toast from "react-hot-toast";
import { getAuthRedirectPath } from "../../lib/onboarding-redirect";
import { setUserId, trackEvent } from "../../lib/analytics";

/**
 * /auth/callback
 *
 * This page handles the redirect from GitHub OAuth.
 * The backend redirects here with ?token=xxx (success) or ?error=xxx (failure).
 */
export default function GitHubCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { persistAuth } = useAuth();
    const [status, setStatus] = useState<"loading" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const token = searchParams.get("token");
        const error = searchParams.get("error");

        if (error) {
            setErrorMsg(decodeURIComponent(error));
            setStatus("error");
            return;
        }

        if (!token) {
            setErrorMsg("No authentication token received. Please try again.");
            setStatus("error");
            return;
        }

        // Fetch user profile using the received token, then persist auth
        (async () => {
            try {
                // Use the token directly in a one-off fetch to /user
                const res = await fetch(
                    `${import.meta.env.VITE_API_BASE_URL}/user`,
                    {
                        headers: {
                            Accept: "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (!res.ok) {
                    throw new Error("Failed to fetch user profile.");
                }

                const user = (await res.json()) as User;

                // Fetch workspaces
                const wsRes = await apiFetch<{ data: WorkspaceSummary[] }>(
                    "/workspaces",
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const workspaces = wsRes.data ?? [];

                persistAuth(token, user, workspaces);

                // Analytics
                if (user?.ulid) setUserId(user.ulid);
                trackEvent("login_success", { method: "github" });

                // Determine redirect
                const redirectTo = await getAuthRedirectPath(token, user);
                if (!redirectTo.startsWith("/onboarding")) {
                    localStorage.removeItem("redirectPath");
                }

                navigate(redirectTo, { replace: true });
            } catch (err) {
                console.error("GitHub callback error:", err);
                setErrorMsg((err as Error).message || "GitHub login failed.");
                setStatus("error");
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (status === "error") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
                <div className="max-w-md w-full rounded-2xl border border-red-800/40 bg-slate-900 p-8 text-center shadow-2xl">
                    <div className="mb-4 flex justify-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-900/30 text-red-400">
                            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-50 mb-2">GitHub Login Failed</h2>
                    <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
                    <button
                        onClick={() => {
                            toast.dismiss();
                            navigate("/login", { replace: true });
                        }}
                        className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="h-14 w-14 rounded-full border-4 border-slate-700 border-t-sky-500 animate-spin" />
                    {/* GitHub icon in center */}
                    <svg
                        className="absolute inset-0 m-auto h-6 w-6 text-slate-400"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                </div>
                <div className="text-center">
                    <p className="text-slate-200 font-semibold text-base">Signing you in with GitHub…</p>
                    <p className="text-slate-500 text-sm mt-1">Please wait a moment</p>
                </div>
            </div>
        </div>
    );
}
