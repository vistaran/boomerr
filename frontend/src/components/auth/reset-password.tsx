import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { apiFetch } from "../../services/api-service";
import { PasswordValidator } from "./password-validator";

import { AuthLayout } from "./auth-layout";

const ResetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const token = searchParams.get("token") || window.location.pathname.split("/").pop();
    const email = searchParams.get("email");

    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};

        if (!password) {
            newErrors.password = "Password is required";
        } else {
            if (password.length > 12) newErrors.password = "Password must not exceed 12 characters";
            else if (!/[A-Z]/.test(password)) newErrors.password = "Must include a capital letter";
            else if (!/[a-z]/.test(password)) newErrors.password = "Must include a small letter";
            else if (!/[0-9]/.test(password)) newErrors.password = "Must include a number";
            else if (!/[^A-Za-z0-9]/.test(password)) newErrors.password = "Must include a special character";
        }

        if (!passwordConfirmation) {
            newErrors.passwordConfirmation = "Confirm Password is required";
        } else if (password !== passwordConfirmation) {
            newErrors.passwordConfirmation = "Passwords do not match";
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            return;
        }

        if (!token || !email) {
            toast.error("Invalid or expired reset link");
            return;
        }

        try {
            setLoading(true);

            await apiFetch("/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    token,
                    password,
                    password_confirmation: passwordConfirmation,
                }),
            });

            toast.success("Password reset successfully");
            navigate("/login");
        } catch (err) {
            console.error(err);
            toast.error("Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Set Password"
            subtitle="Enter your new secure password below"
        >
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 ml-1">New Password</label>
                    <div className="relative group/pass">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter new password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: '' }); }}
                            className={`w-full rounded-lg border bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-colors pr-10 ${errors.password ? 'border-red-500/40' : 'border-white/5'}`}
                        />
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setShowPassword(prev => !prev); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none z-10"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errors.password && <p className="text-red-400 text-[10px] font-medium mt-1 ml-1">{errors.password}</p>}
                    {password && <PasswordValidator password={password} />}
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 ml-1">Confirm Password</label>
                    <div className="relative group/pass">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm new password"
                            value={passwordConfirmation}
                            onChange={(e) => {
                                setPasswordConfirmation(e.target.value);
                                if (errors.passwordConfirmation) setErrors({ ...errors, passwordConfirmation: '' });
                            }}
                            className={`w-full rounded-lg border bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-slate-700 outline-none transition-colors pr-10 ${errors.passwordConfirmation ? 'border-red-500/40' : 'border-white/5'}`}
                        />
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setShowConfirmPassword(prev => !prev); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none z-10"
                        >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    {errors.passwordConfirmation && <p className="text-red-400 text-[10px] font-medium mt-1 ml-1">{errors.passwordConfirmation}</p>}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-bold text-white hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/20 outline-none focus:outline-none"
                >
                    <span className="relative">
                        {loading ? "Resetting..." : "Reset password"}
                    </span>
                    {!loading && (
                        <svg className="w-2 h-2 fill-white group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24">
                            <path d="M5 3l14 9-14 9V3z" />
                        </svg>
                    )}
                </button>
            </form>

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

export default ResetPassword;
