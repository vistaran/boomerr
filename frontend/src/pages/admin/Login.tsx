import React, { useState, useRef } from "react";
import { adminApi, useAdminAuth } from "../../context/admin-auth-context";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { AuthLayout } from "../../components/auth/auth-layout";
import HCaptcha from "../../components/auth/hcaptcha-wrapper";
import { useRuntimeConfig } from "../../hooks/use-runtime-config";

export const AdminLogin = () => {
  const { hcaptchaSiteKey } = useRuntimeConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<any>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string; captcha?: string }>({});

  const { setAdminAuth } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string; captcha?: string } = {};

    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    }

    if (hcaptchaSiteKey && !captchaToken) {
      newErrors.captcha = "Please complete the captcha verification";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.captcha) {
        toast.error("Please verify you are human by completing the captcha.");
      }
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const payload: Record<string, any> = { email, password };
      if (hcaptchaSiteKey && captchaToken) {
        payload.captcha_token = captchaToken;
      }
      const response = await adminApi.post("/admin/login", payload);
      if (response.data && response.data.token && response.data.admin) {
        setAdminAuth(response.data.admin, response.data.token);
        toast.success("Admin logged in successfully");
        navigate("/admin/dashboard");
      }
    } catch (err: any) {
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
      const msg = err.response?.data?.message || "Invalid login credentials";
      if (msg.toLowerCase().includes("email") || msg.toLowerCase().includes("user")) {
        setErrors({ email: msg });
      } else if (msg.toLowerCase().includes("captcha")) {
        setErrors({ captcha: msg });
      } else if (msg.toLowerCase().includes("password")) {
        setErrors({ password: msg });
      } else {
        setErrors({ password: msg });
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Boomerr Admin"
      subtitle="Sign in to access the control panel"
    >
      <form onSubmit={handleLogin} noValidate className="space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-xs font-bold tracking-[0.1em] text-slate-200">Email Address</label>
          </div>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            className={`w-full rounded-lg border bg-white/[0.02] px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition-all ${errors.email
              ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-500 ring-1 ring-rose-500/30"
              : "border-white/25 focus:border-blue-500"
              }`}
          />
          {errors.email && (
            <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-rose-400" />
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-xs font-bold tracking-[0.1em] text-slate-200">Password</label>
          </div>
          <div className="relative group/pass">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              className={`w-full rounded-lg border bg-white/[0.02] px-4 py-2 text-sm text-white placeholder:text-slate-500 outline-none transition-all pr-10 ${errors.password
                ? "border-rose-500/80 bg-rose-500/[0.03] focus:border-rose-500 ring-1 ring-rose-500/30"
                : "border-white/25 focus:border-blue-500"
                }`}
            />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setShowPassword(prev => !prev); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none z-10"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-rose-400" />
              {errors.password}
            </p>
          )}
        </div>

        {hcaptchaSiteKey && (
          <div className="flex flex-col items-center justify-center pt-2">
            <div className="min-h-[78px] flex items-center justify-center">
              <HCaptcha
                ref={captchaRef}
                sitekey={hcaptchaSiteKey}
                onVerify={(token: string) => {
                  setCaptchaToken(token);
                  if (errors.captcha) {
                    setErrors((prev) => ({ ...prev, captcha: undefined }));
                  }
                }}
                onExpire={() => setCaptchaToken(null)}
                theme="dark"
              />
            </div>
            {errors.captcha && (
              <p className="text-xs text-rose-400 mt-2 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-rose-400" />
                {errors.captcha}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group relative w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-bold text-white hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-6 shadow shadow-blue-500/20 outline-none focus:outline-none"
        >
          <span className="relative">
            {loading ? "Authenticating..." : "Continue"}
          </span>
          {!loading && (
            <svg className="w-2 h-2 fill-white group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
        </button>
      </form>
    </AuthLayout>
  );
};

export default AdminLogin;
