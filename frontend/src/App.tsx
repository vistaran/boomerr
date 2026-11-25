// RequireAuth wrapper for protected routes
import { HeaderNav } from "./components/layout/header-nav";
import {
  AuthCard,
  type AuthFormState,
  type AuthMode,
} from "./components/auth/auth-card";
import { SidebarNav } from "./components/layout/sidebar-nav";

import { lazy, Suspense } from "react";
// Pages
// import DashboardPage from "./pages/dashboard-page";
// import { OverviewPage } from "./pages/overview-page";
// // import { TeamsPage } from "./pages/teams-page";
// import { DashboardTour } from "./components/common/dashboard-tour";
// import { AcceptInvitationPage } from "./pages/accept-invitation-page";
// import { OnboardingLayout } from "./pages/onboarding/OnboardingLayout";
// import { UsagePlanPage } from "./pages/onboarding/UsagePlan";
// import { CompanySizePage } from "./pages/onboarding/CompanySize";
// import { HearAboutUsPage } from "./pages/onboarding/HearAboutUs";
// import { WelcomePage } from "./pages/onboarding/Welcome";
// import { AddDomainPage } from "./pages/onboarding/AddDomain";
// import { SetupCompletePage } from "./pages/onboarding/SetupComplete";
// import ForgotPassword from "./components/auth/forgot-pass";
// import ResetPassword from "./components/auth/reset-password";
// import VerifyEmail from "./components/auth/verify-email";
// import CheckEmail from "./components/auth/check-mail";
// import GitHubCallbackPage from "./components/auth/github-callback";


// import { AuthProvider, useAuth } from "./context/auth-context";
// import { ShopifyOnboarding } from "./components/auth/shopify-onboarding";

// import { AdminAuthProvider, useAdminAuth } from "./context/admin-auth-context";
// import AdminLogin from "./pages/admin/Login";
// import { AdminLayout } from "./components/admin/layout/AdminLayout";
import { AdminThemeProvider } from "./context/admin-theme-context";
// import AdminDashboard from "./pages/admin/Dashboard";
// import AdminUsers from "./pages/admin/Users";
// import AdminLogs from "./pages/admin/Logs";
// import AdminSettings from "./pages/admin/Settings";
// import AdminBilling from "./pages/admin/Billing";
// import AdminAdmins from "./pages/admin/Admins";
// import AdminDetail from "./pages/admin/AdminDetail";
import AdminEmailTemplates from "./pages/admin/email/EmailTemplates";
import AdminCreateEmailTemplate from "./pages/admin/email/CreateEmailTemplate";
import AdminEditEmailTemplate from "./pages/admin/email/EditEmailTemplate";
import AdminEmailSequence from "./pages/admin/email/EmailSequence";
// import DepartmentsPage from "./pages/departments-page";
// import NotificationsPage from "./pages/notifications-page";
// import SettingsPage from "./pages/settings-page";
// import type { User } from "./types/user";
// import { BuildUpdateWatcher } from "./components/common/build-update-watcher";
// import Logs from "./pages/logs";
// import FacebookAdsList from './pages/facebook-ads-lists';
// import FacebookAccounts from './components/settings/facebook-accounts';
// import GoogleAccounts from './components/settings/google-accounts';
// import SslMonitoring from './pages/ssl-monitoring';
// import CommonLoader from './components/common/common-loader';
// import BillingPage from './pages/billing-page';
// import SmsConfigurationsPage from './pages/sms-configurations-page';
// import IncidentListPage from './pages/incidents-page';
// import IncidentDetailsPage from './pages/incident-details-page';
// import StatusPagesList from './pages/status-pages-page';
// import PublicStatusPageView from './pages/public-status-page';
// import BoomerrStatusPage from './pages/BoomerrStatusPage';
// import NodeHealth from './pages/admin/NodeHealth';
// import BoomerrIncidents from './pages/admin/BoomerrIncidents';
import { useState, useCallback, type FormEvent, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/auth-context";
import { AdminAuthProvider, useAdminAuth } from "./context/admin-auth-context";
import type { User } from "./types/user";
import { BuildUpdateWatcher } from "./components/common/build-update-watcher";
import CommonLoader from "./components/common/common-loader";

// Pages - Lazy loaded
const DashboardPage = lazy(() => import("./pages/dashboard-page"));
const OverviewPage = lazy(() => import("./pages/overview-page").then(m => ({ default: m.OverviewPage })));
const DashboardTour = lazy(() => import("./components/common/dashboard-tour").then(m => ({ default: m.DashboardTour })));
const AcceptInvitationPage = lazy(() => import("./pages/accept-invitation-page").then(m => ({ default: m.AcceptInvitationPage })));
const OnboardingLayout = lazy(() => import("./pages/onboarding/OnboardingLayout").then(m => ({ default: m.OnboardingLayout })));
const UsagePlanPage = lazy(() => import("./pages/onboarding/UsagePlan").then(m => ({ default: m.UsagePlanPage })));
const CompanySizePage = lazy(() => import("./pages/onboarding/CompanySize").then(m => ({ default: m.CompanySizePage })));
const HearAboutUsPage = lazy(() => import("./pages/onboarding/HearAboutUs").then(m => ({ default: m.HearAboutUsPage })));
const WelcomePage = lazy(() => import("./pages/onboarding/Welcome").then(m => ({ default: m.WelcomePage })));
const AddDomainPage = lazy(() => import("./pages/onboarding/AddDomain").then(m => ({ default: m.AddDomainPage })));
const SetupCompletePage = lazy(() => import("./pages/onboarding/SetupComplete").then(m => ({ default: m.SetupCompletePage })));
const ForgotPassword = lazy(() => import("./components/auth/forgot-pass"));
const ResetPassword = lazy(() => import("./components/auth/reset-password"));
const VerifyEmail = lazy(() => import("./components/auth/verify-email"));
const CheckEmail = lazy(() => import("./components/auth/check-mail"));
const GitHubCallbackPage = lazy(() => import("./components/auth/github-callback"));
const ShopifyOnboarding = lazy(() => import("./components/auth/shopify-onboarding").then(m => ({ default: m.ShopifyOnboarding })));

// Admin Pages - Lazy loaded
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminLayout = lazy(() => import("./components/admin/layout/AdminLayout").then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminLogs = lazy(() => import("./pages/admin/Logs"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminFeatures = lazy(() => import("./pages/admin/Features"));
const AdminBilling = lazy(() => import("./pages/admin/Billing"));
const AdminAdmins = lazy(() => import("./pages/admin/Admins"));
const AdminDetail = lazy(() => import("./pages/admin/AdminDetail"));
const NodeHealth = lazy(() => import("./pages/admin/NodeHealth"));
const BoomerrIncidents = lazy(() => import("./pages/admin/BoomerrIncidents"));

// Public & Status Pages - Lazy loaded
const BoomerrStatusPage = lazy(() => import("./pages/BoomerrStatusPage"));
const PublicStatusPageView = lazy(() => import("./pages/public-status-page"));

// Protected User Pages - Lazy loaded
const DepartmentsPage = lazy(() => import("./pages/departments-page"));
const NotificationsPage = lazy(() => import("./pages/notifications-page"));
const SettingsPage = lazy(() => import("./pages/settings-page"));
const Logs = lazy(() => import("./pages/logs"));
const FacebookAdsList = lazy(() => import("./pages/facebook-ads-lists"));
const FacebookAccounts = lazy(() => import("./components/settings/facebook-accounts"));
const GoogleAccounts = lazy(() => import("./components/settings/google-accounts"));
const SslMonitoring = lazy(() => import("./pages/ssl-monitoring"));
const BillingPage = lazy(() => import("./pages/billing-page"));
const SmsConfigurationsPage = lazy(() => import("./pages/sms-configurations-page"));
const IncidentListPage = lazy(() => import("./pages/incidents-page"));
const IncidentDetailsPage = lazy(() => import("./pages/incident-details-page"));
const StatusPagesList = lazy(() => import("./pages/status-pages-page"));
const ToolsPage = lazy(() => import("./pages/tools-page"));

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <CommonLoader className="h-8 w-8 text-blue-500" />
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex h-full min-h-[50vh] w-full items-center justify-center p-8">
      <CommonLoader className="h-8 w-8 text-blue-500" />
    </div>
  );
}
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { login, logout as logoutApi, register, switchWorkspace as switchWorkspaceApi, createWorkspace as createWorkspaceApi } from "./services/api-service";
import type { WorkspaceSummary } from "./services/api-service";
import { getAuthRedirectPath } from "./lib/onboarding-redirect";
import { useReverb } from "./hooks";
import { disconnectReverb } from "./realtime";
import { setUserId, trackEvent, trackPageView } from "./lib/analytics";

function DashboardSkeleton() {
  return (
    <div style={{
      backgroundColor: '#020617',
      color: '#e5e7eb',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ height: '64px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#1e293b' }}></div>
          <div style={{ width: '100px', height: '16px', borderRadius: '4px', backgroundColor: '#1e293b' }}></div>
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ width: '280px', borderRight: '1px solid #1e293b', padding: '20px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ height: '40px', borderRadius: '8px', backgroundColor: '#0f172a', marginBottom: '16px' }}></div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '40px', textAlign: 'center' }}>
          <h2 style={{ color: '#10b981', marginBottom: '20px' }}>Loading Dashboard...</h2>
          <div style={{ maxWidth: '600px', margin: '0 auto', height: '200px', borderRadius: '16px', backgroundColor: '#0f172a' }}></div>
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    // Only set redirectPath for protected routes (preserve any search/query)
    if (location.pathname !== "/login") {
      localStorage.setItem("redirectPath", location.pathname + (location.search || ""));
    }
    return <Navigate to={`/login${location.search || ""}`} replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BuildUpdateWatcher />
        <Toaster
          position="top-center"
          containerStyle={{ zIndex: 2147483647 }}
          toastOptions={{
            duration: 5000,
            style: {
              background: "#020617",
              color: "#e5e7eb",
              border: "1px solid #1e293b",
              fontSize: "13px",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#020617",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#020617",
              },
            },
          }}
        />
        <AdminAuthProvider>
          <AppRoutes />
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LoginRouteComponent({
  onModeChange,
  form,
  setForm,
  loading,
  onSubmit,
  onCaptchaVerify,
  persistAuth,
}: {
  onModeChange: (mode: AuthMode) => void;
  form: AuthFormState;
  setForm: (updater: (prev: AuthFormState) => AuthFormState) => void;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
  onCaptchaVerify: (token: string | null) => void;
  persistAuth: (token: string, user: User, workspaces: WorkspaceSummary[]) => void;
}) {
  const { user: loggedInUser, token: authToken } = useAuth();
  const [resolving, setResolving] = useState<boolean>(false);
  const navigate = useNavigate();

  const [iframeTrapped, setIframeTrapped] = useState(false);
  const [iframeShop, setIframeShop] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    if (loggedInUser) {
      setResolving(true);
      (async () => {
        try {
          const redirectTo = await getAuthRedirectPath(authToken, loggedInUser as User);
          if (!redirectTo.startsWith("/onboarding")) {
            localStorage.removeItem("redirectPath");
          }
          if (mounted) navigate(redirectTo, { replace: true });
        } catch (err) {
          console.error("Error resolving auth redirect for /login:", err);
          if (mounted) navigate("/dashboard", { replace: true });
        }
      })();
    }
    return () => {
      mounted = false;
    };
  }, [loggedInUser, authToken, navigate]);

  useEffect(() => {
    // Breakout logic moved to AppRoutes for global consistency
  }, []);

  const params = new URLSearchParams(window.location.search);
  const hasTokenInUrl = params.get('token');

  // If we are in a popup OR we just got a token, return null here 
  // because AppRoutes handles the "Closing" UI for popups globally
  if ((window.opener && window.opener !== window) || hasTokenInUrl) {
    return null;
  }

  if (iframeTrapped) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[25%] -left-[25%] w-[70%] h-[70%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute -bottom-[25%] -right-[25%] w-[70%] h-[70%] bg-blue-900/10 rounded-full blur-[120px] animate-pulse"></div>
        </div>

        <div className="w-full max-w-md bg-white/[0.03] border border-white/5 backdrop-blur-xl p-12 rounded-[2.5rem] text-center relative z-10 shadow-2xl">
          <div className="mb-8 flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">Connected!</h1>
          <p className="text-slate-400 text-sm mb-10 leading-relaxed font-medium tracking-wide">
            Securely opening your dashboard...<br />
            Please click below to continue.
          </p>

          <button
            onClick={() => {
              const backendUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
              window.top!.location.href = `${backendUrl}/shopify` + (iframeShop ? `?shop=${iframeShop}` : '');
            }}
            className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-slate-200 active:scale-[0.98] transition-all uppercase tracking-widest text-xs shadow-xl shadow-white/5"
          >
            Open Dashboard
          </button>

          <div className="mt-8 flex items-center justify-center gap-2 opacity-50">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthLayout>
      <AuthCard
        onModeChange={onModeChange}
        form={form}
        setForm={setForm}
        loading={loading}
        onSubmit={onSubmit}
        onCaptchaVerify={onCaptchaVerify}
        persistAuth={persistAuth}
      />
    </AuthLayout>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  // Track page views on route change
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  // Dynamic Website Tab Title
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/admin')) {
      document.title = 'Boomerr Admin';
    } else if (path.startsWith('/dashboard')) {
      document.title = 'Boomerr - Dashboard';
    } else if (path.startsWith('/overview')) {
      document.title = 'Boomerr - Domains';
    } else if (path.startsWith('/ssl-monitoring')) {
      document.title = 'Boomerr - SSL Monitoring';
    } else if (path.startsWith('/incidents')) {
      document.title = 'Boomerr - Incidents';
    } else if (path.startsWith('/status-pages')) {
      document.title = 'Boomerr - Status Pages';
    } else if (path.startsWith('/departments')) {
      document.title = 'Boomerr - Departments';
    } else if (path.startsWith('/logs')) {
      document.title = 'Boomerr - Logs';
    } else if (path.startsWith('/billing')) {
      document.title = 'Boomerr - Billing';
    } else if (path.startsWith('/settings') || path.startsWith('/email-preferences')) {
      document.title = 'Boomerr - Settings';
    } else if (path.startsWith('/notifications')) {
      document.title = 'Boomerr - Notifications';
    } else if (path.startsWith('/status')) {
      if (!document.title.includes('Status')) {
        document.title = 'Boomerr System Status';
      }
    } else if (path.startsWith('/login')) {
      document.title = 'Boomerr - Login';
    } else if (path.startsWith('/forgot-password')) {
      document.title = 'Boomerr - Forgot Password';
    } else if (path.startsWith('/verify-email')) {
      document.title = 'Boomerr - Verify Email';
    } else if (path.startsWith('/check-mail')) {
      document.title = 'Boomerr - Check Mail';
    } else if (path.startsWith('/password-reset')) {
      document.title = 'Boomerr - Reset Password';
    } else if (path.startsWith('/onboarding') || path.startsWith('/shopify-onboarding')) {
      document.title = 'Boomerr - Onboarding';
    } else {
      document.title = 'Boomerr';
    }
  }, [location.pathname]);
  const { user, workspaces, token, persistAuth, logout, isAuthLoading, isAuthenticated } = useAuth();

  // --- SHOPIFY AUTH & SIGNALING HANDLER ---
  useEffect(() => {
    // Ignore non-Shopify tokens (e.g., from verify-email or reset-password)
    if (location.pathname === '/verify-email' || location.pathname === '/reset-password') {
      return;
    }

    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const shop = params.get('shop');
    const domainUlid = params.get('domain_ulid');
    const targetPath = domainUlid ? `/overview/${domainUlid}/details` : '/overview';

    // 1. Detect if we are in an auth popup
    // We use window.name and window.opener checks
    const isPopup = (window.opener && window.opener !== window) ||
      (window.name === 'shopify-login');

    if (token) {
      console.log("Token detected. isPopup:", isPopup);

      // 1. Prepare session data for hydration
      const shopUser = {
        id: 0,
        ulid: 'shopify-user',
        name: shop?.split('.')[0] || 'Shopify User',
        email: shop || 'shopify-user',
      };
      const workspacesData = [] as any[];

      // 2. ALWAYS persist full session data for the main tab to hear
      localStorage.setItem('dm_token', token);
      localStorage.setItem('dm_user', JSON.stringify(shopUser));
      localStorage.setItem('dm_workspaces', JSON.stringify(workspacesData));

      // 3. If we are in a popup, signal success and close
      if (isPopup) {
        console.log("Auth success in popup. Signaling and closing...");

        // Signal via BroadcastChannel
        try {
          const channel = new BroadcastChannel('auth_channel');
          channel.postMessage({
            type: 'AUTH_SUCCESS',
            token,
            targetPath,
            user: shopUser,
            workspaces: workspacesData
          });
          setTimeout(() => channel.close(), 2000);
        } catch (e) { }

        // Signal via direct opener
        if (window.opener) {
          try { window.opener.location.href = targetPath; } catch (e) { }
        }

        // Force closure
        window.history.replaceState({}, '', window.location.pathname);
        window.close();
        // Multiple attempts to close in case of browser restrictions
        setTimeout(() => { if (!window.closed) window.close(); }, 200);
        setTimeout(() => { if (!window.closed) window.close(); }, 1000);
      }
      // If we are in the main window (not a popup), perform the login
      else if (shop && !isAuthenticated) {
        console.log("Auth success in main window. Logging in...");
        const shopUser = {
          id: 0,
          ulid: 'shopify-user',
          name: shop.split('.')[0],
          email: shop,
        };
        persistAuth(token, shopUser as any, []);

        // If we are trapped in an iframe, break out to the dashboard
        if (window.top !== window.self) {
          window.top.location.href = targetPath;
        } else {
          navigate(targetPath, { replace: true });
        }
      }
    }
  }, [location.search, isAuthenticated, persistAuth, navigate]);

  // Set user ID once user is loaded
  useEffect(() => {
    if (user?.ulid) {
      setUserId(user.ulid);
    }
  }, [user]);

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState<AuthFormState>({
    name: "",
    email: "",
    password: "",
    passwordConfirmation: "",
  });

  // --- POPUP ISOLATION GUARD ---
  // If we are in the auth popup, we NEVER allow any app routes to render.
  // We only show the "Closing" UI.
  const hasTokenInQuery = !!new URLSearchParams(location.search).get('token');
  const isPopupView = Boolean(
    ((window.opener && window.opener !== window) || window.name === 'shopify-login') &&
    hasTokenInQuery &&
    location.pathname !== '/verify-email' &&
    location.pathname !== '/reset-password'
  );

  if (isPopupView) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
        <div>
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-white font-black uppercase tracking-widest text-[10px]">Processing</h2>
          <p className="text-slate-500 text-[9px] mt-2">Opening dashboard in main tab...</p>
          <button onClick={() => window.close()} className="mt-4 text-blue-500 text-[9px] font-bold uppercase tracking-tighter hover:text-white transition-colors">Close This Window</button>
        </div>
      </div>
    );
  }

  if (isAuthLoading) {
    return <DashboardSkeleton />;
  }


  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        const data = await login(
          authForm.email,
          authForm.password,
          captchaToken || ""
        );
        persistAuth(data.token, data.user, data.workspaces ?? []);

        // Track login success and set user ID
        setUserId(data.user.ulid);
        trackEvent("login_success", {
          method: "standard",
        });

        // Use redirect path from localStorage if available
        // const redirectTo = localStorage.getItem("redirectPath") || "/overview";
        const redirectTo = await getAuthRedirectPath(data.token, data.user);
        // If redirectTo is onboarding, keep the stored redirectPath so SetupComplete can use it later.
        if (!redirectTo.startsWith("/onboarding")) {
          localStorage.removeItem("redirectPath");
        }
        navigate(redirectTo, { replace: true });
      } else {
        if (authForm.password !== authForm.passwordConfirmation) {
          throw new Error("Passwords do not match");
        }
        await register(
          authForm.name,
          authForm.email,
          authForm.password,
          authForm.passwordConfirmation,
          captchaToken || ""
        );

        // Track sign up success
        trackEvent("signup_success", {
          method: "standard"
        });

        navigate("/check-mail", { replace: true });
      }
    } catch (err) {
      console.log("Error >> ", err);

      toast.error((err as Error).message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    const params = new URLSearchParams(window.location.search);
    const shop = params.get('shop');

    await logoutApi();
    logout();
    disconnectReverb();
    setUserId("");

    if (shop) {
      // For Shopify users, redirect to the breakout page
      window.location.href = `/?shop=${shop}`;
    } else {
      navigate("/login", { replace: true });
    }
  };

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route
          path="/accept-invitation/:token"
          element={<AcceptInvitationPage />}
        />

        <Route
          path="/login"
          element={
            <LoginRouteComponent
              onModeChange={setAuthMode}
              form={authForm}
              setForm={(updater) => setAuthForm((prev) => updater(prev))}
              loading={authLoading}
              onSubmit={handleAuthSubmit}
              onCaptchaVerify={setCaptchaToken}
              persistAuth={persistAuth}
            />
          }
        />
        <Route
          path="/shopify-onboarding"
          element={<ShopifyOnboarding />}
        />

        <Route
          path="/forgot-password"
          element={
            <AuthLayout>
              <ForgotPassword />
            </AuthLayout>
          }
        />
        <Route
          path="/verify-email"
          element={
            <AuthLayout>
              <VerifyEmail />
            </AuthLayout>
          }
        />
        <Route
          path="/check-mail"
          element={
            <AuthLayout>
              <CheckEmail />
            </AuthLayout>
          }
        />
        <Route
          path="/password-reset/:token"
          element={
            <AuthLayout>
              <ResetPassword />
            </AuthLayout>
          }
        />

        <Route
          path="/auth/callback"
          element={<GitHubCallbackPage />}
        />


        <Route path="/onboarding" element={<RequireAuth>{user ? <OnboardingLayout /> : null}</RequireAuth>}>
          <Route path="plan" element={<UsagePlanPage />} />
          <Route path="company-size" element={<CompanySizePage />} />
          <Route path="hear-about" element={<HearAboutUsPage />} />
          <Route path="welcome" element={<WelcomePage />} />
          <Route path="add-domain" element={<AddDomainPage />} />
          <Route path="setup-complete" element={<SetupCompletePage />} />
          <Route path="" element={<Navigate to="plan" replace />} />
          <Route path="*" element={<Navigate to="plan" replace />} />
        </Route>
        <Route path="/" element={<RootRoute />} />

        <Route path="/status" element={<BoomerrStatusPage />} />
        <Route path="/status/:slug" element={<PublicStatusPageView />} />
        <Route path="/status/p/:slug" element={<PublicStatusPageView />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={
          <AdminRequireAuth>
            <AdminThemeProvider>
              <AdminLayout />
            </AdminThemeProvider>
          </AdminRequireAuth>
        }>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="node-health" element={<NodeHealth />} />
          <Route path="boomerr-incidents" element={<BoomerrIncidents />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="email/templates" element={<AdminEmailTemplates />} />
          <Route path="email/templates/create" element={<AdminCreateEmailTemplate />} />
          <Route path="email/templates/:id/edit" element={<AdminEditEmailTemplate />} />
          <Route path="email/sequence" element={<AdminEmailSequence />} />
          <Route path="admins" element={<AdminAdmins />} />
          <Route path="admins/:id" element={<AdminDetail />} />
          <Route path="billing" element={<AdminBilling />} />
          <Route path="logs" element={<AdminLogs />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="status-page" element={<BoomerrStatusPage />} />
          <Route path="features" element={<AdminFeatures />} />
        </Route>

        <Route
          path="*"
          element={
            <RequireAuth>
              {user && (
                <>
                  <AuthedShell
                    user={{
                      ...user,
                      role:
                        user.role === "owner" ||
                          user.role === "admin" ||
                          user.role === "member"
                          ? user.role
                          : "member",
                    }}
                    workspaces={workspaces}
                    authToken={token}
                    persistAuth={persistAuth}
                    onLogout={handleLogoutClick}
                  />
                  <DashboardTour />
                </>
              )}
            </RequireAuth>
          }
        />
      </Routes>
    </Suspense>
  );
}

function AdminRequireAuth({ children }: { children: React.ReactNode }) {
  const { admin, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><CommonLoader /></div>;
  }

  if (!admin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function RootRoute() {
  const { user } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const shop = searchParams.get('shop');
  const hasToken = searchParams.get('token');

  // If a token is arriving from Shopify, show skeleton while we process it in AppRoutes
  // Skeleton disabled per user request
  // if (hasToken) {
  //   return <DashboardSkeleton />;
  // }

  // Automatic redirect disabled per user request
  // if (user) {
  //   return <Navigate to="/overview" replace />;
  // }

  // If not logged in but coming from Shopify (handshake phase), go to login
  // The login route (and AppRoutes) will handle the token detection and breakout
  if (shop) {
    return <Navigate to={`/login${location.search}`} replace />;
  }

  return <Navigate to={`/login${location.search || ""}`} replace />;
}


function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505] text-slate-50">
      <div className="flex min-h-screen items-center justify-center">
        {children}
      </div>
    </div>
  );
}

type AuthedShellProps = {
  user: User;
  workspaces: WorkspaceSummary[];
  authToken: string | null;
  persistAuth: (token: string, user: User, workspaces: WorkspaceSummary[]) => void;
  onLogout: () => void;
};

function AuthedShell({ user, workspaces, authToken, persistAuth, onLogout }: AuthedShellProps) {
  const queryClient = useQueryClient();
  useReverb({
    token: authToken,
    workspaceId: user.workspace_id,
    userId: user.id,
  });

  const [workspaceSwitchingId, setWorkspaceSwitchingId] = useState<string | null>(null);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // --- SELF-HEALING: Auto-select workspace if none active ---
  useEffect(() => {
    const currentWorkspace = workspaces.find((ws) => ws.is_current);
    if (!currentWorkspace && workspaces.length > 0 && !workspaceSwitchingId) {
      console.log("No active workspace found. Auto-selecting first available...");
      const firstWs = workspaces[0];
      handleWorkspaceSwitch(firstWs.ulid);
    }
  }, [workspaces, workspaceSwitchingId]);

  const resetWorkspaceScopedData = useCallback(async () => {
    await queryClient.cancelQueries({ predicate: () => true });
    queryClient.clear();
  }, [queryClient]);

  const handleWorkspaceSwitch = async (workspaceId: string): Promise<boolean> => {
    if (!authToken || workspaceId === user.workspace_ulid || workspaceSwitchingId === workspaceId) {
      return false;
    }

    try {
      setWorkspaceSwitchingId(workspaceId);
      const response = await switchWorkspaceApi(workspaceId);
      await resetWorkspaceScopedData();
      persistAuth(authToken, response.user, response.workspaces ?? []);
      const switchedName = response.workspaces?.find((ws) => ws.ulid === workspaceId)?.name;
      toast.success(`Switched to ${switchedName ?? "workspace"}`);
      return true;
    } catch (err) {
      console.log("Error >>", err);

      toast.error("Unable to switch workspace");
      return false;
    } finally {
      setWorkspaceSwitchingId(null);
    }
  };

  const handleWorkspaceCreate = async (name: string): Promise<boolean> => {
    const trimmedName = name.trim();
    if (!authToken || !trimmedName) {
      return false;
    }

    try {
      setIsCreatingWorkspace(true);
      const response = await createWorkspaceApi({ name: trimmedName });
      await resetWorkspaceScopedData();
      persistAuth(authToken, response.user, response.workspaces ?? []);

      // Example nested product event tracking
      trackEvent("workspace_created", {
        workspace_id: response.workspace?.id ?? 0,
        workspace_type: "standard"
      });

      toast.success(`Workspace "${response.workspace.name}" created`);
      return true;
    } catch (err) {
      console.log("Error >>", err);

      toast.error("Unable to create workspace");
      return false;
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const currentWorkspace = workspaces.find((ws) => ws.is_current);
  const currentWorkspaceName = currentWorkspace ? currentWorkspace.name : "Workspace";
  return (
    <div className="h-screen flex flex-col bg-slate-950 bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)] text-slate-50 w-full overflow-hidden">
      <HeaderNav
        user={user}
        workspaces={workspaces}
        onWorkspaceSwitch={handleWorkspaceSwitch}
        switchingWorkspaceId={workspaceSwitchingId}
        onWorkspaceCreate={handleWorkspaceCreate}
        isCreatingWorkspace={isCreatingWorkspace}
        onLogout={onLogout}
        onSidebarToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />
      <div className="flex flex-col sm:flex-row w-full flex-1 overflow-hidden relative">
        {/* Mobile overlay for sidebar */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 sm:hidden z-40 top-14 md:top-16"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
        {/* Sidebar - visible on mobile when toggled, always visible on sm+ */}
        <div className={`fixed sm:relative top-14 md:top-0 sm:top-auto left-0 w-72 sm:w-auto h-[calc(100vh-56px)] sm:h-full z-50 transition-transform duration-300 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
          }`}>
          <SidebarNav onSidebarToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        </div>
        <main className="flex-1 min-w-0 h-full w-full overflow-y-auto overflow-x-hidden">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage currentUser={user} />} />
              <Route path="/overview" element={<OverviewPage currentUser={user} />} />
              <Route path="/overview/:domainId" element={<OverviewPage currentUser={user} />} />
              <Route path="/overview/:domainId/:tab" element={<OverviewPage currentUser={user} />} />
              <Route path="/overview/:domainId/integrations/:integrationId" element={<OverviewPage currentUser={user} />} />
              <Route path="/ssl-monitoring" element={<SslMonitoring />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/settings/:accountId/facebook-ads" element={<FacebookAdsList />} />
              <Route path="/settings/facebook-accounts" element={<FacebookAccounts />} />
              <Route path="/settings/google-accounts" element={<GoogleAccounts />} />
              <Route path="/settings/sms-configurations" element={<SmsConfigurationsPage />} />
              <Route path="/incidents" element={<IncidentListPage />} />
              <Route path="/incidents/:id" element={<IncidentDetailsPage currentUser={user} />} />
              <Route path="/status-pages" element={<StatusPagesList />} />
              <Route path="/tools" element={<ToolsPage currentUser={user} />} />
              <Route path="/logs/*" element={<Logs currentUser={user} />} />
              <Route path="/departments" element={<DepartmentsPage currentUser={user} />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage workspaceName={currentWorkspaceName} currentUser={user} />} />
              <Route path="/email-preferences" element={<Navigate to="/settings" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div >
    </div >
  );
}

export default App;
