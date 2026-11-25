import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Globe, Shield, Activity, ChevronRight, ChevronDown, Loader2, Server, GitBranch, Rocket, Monitor, Plus, ChevronLeft } from "lucide-react";
import { OnboardingProgress } from "./OnboardingProgress";
import { OnboardingHeader } from "./components/OnboardingComponents";
import { createDomain } from "../../services/api-service";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { useOnboardingData, getEnvironmentOptions, getMonitoringFeatures } from "../../hooks/useOnboardingData";

// Icon mapping
const envIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  GitBranch,
  Server,
};

const featureIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  Shield,
  Check,
};

export function AddDomainPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [environment, setEnvironment] = useState("Production");
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: onboardingData, loading } = useOnboardingData();
  const envOptions = getEnvironmentOptions(onboardingData);
  const monitoringFeatures = getMonitoringFeatures(onboardingData);

  // Set default environment from dynamic data
  useEffect(() => {
    if (envOptions.length > 0 && !environment) {
      setEnvironment(envOptions[0].value);
    }
  }, [envOptions, environment]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      setIsLoading(true);
      // Construct a valid URL if the user just entered "example.com"
      let parsedUrl = url.trim();
      if (!/^https?:\/\//i.test(parsedUrl)) {
        parsedUrl = `https://${parsedUrl}`;
      }

      const parsedObj = new URL(parsedUrl);
      const name = parsedObj.hostname.replace(/^www\./, "");

      await createDomain({
        name,
        url: parsedUrl,
        environment,
      });

      toast.success("Domain added successfully!");
      navigate("/onboarding/setup-complete");
    } catch (err: any) {
      toast.error(err.message || "Failed to add domain.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/onboarding/setup-complete");
  };

  if (loading) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center">
      <OnboardingProgress currentStep={4} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="max-w-2xl w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative"
      >
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate("/onboarding/hear-about")}
          className="absolute top-8 left-8 flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <OnboardingHeader
          title={
            <div className="flex items-center gap-2.5">
              <span>Add your first website</span>
              <div className="relative flex-shrink-0 p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.1)] flex items-center justify-center">
                <Monitor className="w-5 h-5 text-blue-400" strokeWidth={2} />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center border border-slate-900">
                  <Plus className="w-2 h-2 text-white" strokeWidth={4} />
                </div>
              </div>
            </div>
          }
          subtitle="Enter the domain you want Boomerr to monitor. We'll automatically start uptime and security monitoring."
          isCentered={true}
        />

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-5">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-slate-300 mb-2">
                Domain URL
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Globe className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                  type="text"
                  id="url"
                  placeholder="example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="dark-input block w-full pl-11 pr-4 py-4 border border-slate-700 rounded-2xl bg-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-base text-lg font-medium !text-slate-100"
                  required
                />
              </div>
            </div>

            <div ref={dropdownRef} className="relative">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Environment <span className="text-slate-500 font-normal">(optional)</span>
              </label>

              {/* Trigger button */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`w-full flex items-center gap-3 px-4 py-4 border rounded-2xl bg-slate-800 text-slate-100 transition-all text-base font-medium shadow-inner focus:outline-none ${isDropdownOpen
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-slate-700 hover:border-slate-600"
                  }`}
              >
                {(() => {
                  const opt = envOptions.find((o) => o.value === environment) || envOptions[0];
                  if (!opt) return null;
                  const Icon = envIconMap[opt.icon] || Rocket;
                  return (
                    <>
                      <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${opt.bg} border ${opt.border} flex-shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${opt.color}`} />
                      </span>
                      <span className="flex-1 text-left">{opt.label}</span>
                      <span className="text-xs text-slate-500 mr-2 hidden sm:inline">{opt.desc}</span>
                    </>
                  );
                })()}
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              {/* Dropdown panel */}
              {isDropdownOpen && (
                <div className="absolute z-50 mt-2 w-full bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
                  {envOptions.map((opt, idx) => {
                    const Icon = envIconMap[opt.icon] || Rocket;
                    const isSelected = environment === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setEnvironment(opt.value); setIsDropdownOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 ${idx !== envOptions.length - 1 ? "border-b border-slate-800" : ""
                          } ${isSelected
                            ? "bg-blue-600/15"
                            : "hover:bg-slate-800/70"
                          }`}
                      >
                        <span className={`flex items-center justify-center w-8 h-8 rounded-xl ${opt.bg} border ${opt.border} flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${opt.color}`} />
                        </span>
                        <span className="flex flex-col">
                          <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-slate-200"}`}>
                            {opt.label}
                          </span>
                          <span className="text-xs text-slate-500">{opt.desc}</span>
                        </span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-400 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-[0.2em] ml-1">
              Automated Monitoring Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {monitoringFeatures.map((check, idx) => {
                const Icon = featureIconMap[check.icon] || Activity;
                return (
                  <motion.div
                    key={check.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + idx * 0.1 }}
                    className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-2xl hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:border-blue-500/40 transition-colors">
                      <Icon className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">{check.label}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="flex-1 flex items-center justify-center gap-3 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Start Monitoring
                  <ChevronRight className="h-5 w-5" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-8 py-4 text-slate-400 font-medium hover:text-white transition-colors rounded-full hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-600"
            >
              Skip for now
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
