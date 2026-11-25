import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiFetch, type WorkspaceSummary } from "../../services/api-service";
import { useAuth } from "../../context/auth-context";
import { getAuthRedirectPath } from "../../lib/onboarding-redirect";

const VerifyEmail = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { persistAuth } = useAuth();

    const email = searchParams.get("email");
    const token = searchParams.get("token");

    const [loading, setLoading] = useState(true);
    const hasVerifiedRef = useRef(false);

    useEffect(() => {
        if (hasVerifiedRef.current) return;
        hasVerifiedRef.current = true;

        if (!email || !token) {
            toast.error("Invalid verification link");
            setLoading(false);
            return;
        }

        const verify = async () => {
            try {
                const data = await apiFetch<{
                    token: string;
                    user: any;
                    workspaces: WorkspaceSummary[];
                }>("/verify-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, token }),
                });
                persistAuth(data.token, data.user, data.workspaces ?? []);
                
                const redirectTo = await getAuthRedirectPath(data.token, data.user);
                if (!redirectTo.startsWith('/onboarding')) {
                    localStorage.removeItem("redirectPath");
                }
                navigate(redirectTo, { replace: true });
                
                toast.success("Email verified successfully");
            } catch (err) {
                console.error(err);
                toast.error("Verification failed or link expired");
                navigate("/login", { replace: true });
            } finally {
                setLoading(false);
            }
        };

        verify();
    }, [email, token, navigate, persistAuth]);

    return (
        <div className="text-center">
            {loading ? (
                <p className="text-slate-300">Verifying your email…</p>
            ) : (
                <p className="text-slate-400">
                    Redirecting…
                </p>
            )}
        </div>
    );
};

export default VerifyEmail;
