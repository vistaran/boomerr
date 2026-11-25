import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { fetchCurrentUser, getWorkspaces } from '../../services/api-service';
import CommonLoader from '../common/common-loader';
import toast from 'react-hot-toast';

export const ShopifyOnboarding: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { persistAuth, isAuthenticated } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const searchParams = new URLSearchParams(location.search);
  const shop = searchParams.get('shop');
  const token = searchParams.get('token');

  useEffect(() => {
    const performAutoLogin = async () => {
        // If we have a shop but no token, and not already authenticated,
        // we need to go to the backend to get a login token.
        if (shop && !token && !isAuthenticated && !isLoggingIn) {
            console.log("Shopify detected but no token. Redirecting to auth...");
            // We redirect to the backend auth route
            window.location.href = `/shopify/auth?shop=${shop}`;
            return;
        }

        if (!token || isLoggingIn || isAuthenticated) return;
        
        try {
            setIsLoggingIn(true);
            // 1. CLEAR OLD MEMORY (Very Important!)
            localStorage.removeItem("dm_token");
            localStorage.removeItem("dm_user");
            localStorage.removeItem("dm_workspaces");
            
            // 2. Temporarily set token so getWorkspaces can use it
            localStorage.setItem("dm_token", token);

            // 3. Fetch fresh data from the server
            const user = await fetchCurrentUser(token);
            const workspaces = await getWorkspaces();
            
            // 4. Save the fresh data
            persistAuth(token, user, workspaces);

            // 5. Success!
            
            toast.success("Successfully logged in via Shopify!");
            
            // 6. Redirect to standalone dashboard (Stealth Breakout!)
            triggerBreakout('/overview');
        } catch (error) {
            console.error("Shopify auto-login failed:", error);
            toast.error("Failed to sync Shopify account. Please log in manually.");
            setIsLoggingIn(false);
        }
    };

    performAutoLogin();
  }, [token, persistAuth, navigate]);

  const triggerBreakout = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_top';
    document.body.appendChild(link);
    link.click();
    // Fallback
    setTimeout(() => { window.top.location.href = url; }, 500);
  };

  const handleOpenDashboard = () => {
    triggerBreakout('/overview');
  };

  if (isLoggingIn) {
    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="text-center">
                <CommonLoader />
                <p className="text-slate-400 mt-4">Syncing your Shopify store...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/50 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full blur opacity-25"></div>
            <div className="relative bg-slate-900 p-4 rounded-full border border-slate-700">
                <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Boomerr AI</span>
        </h1>
        
        <p className="text-slate-400 mb-8">
            {shop ? `Successfully connected with ${shop}` : 'Your Shopify store is now connected.'} 
            Monitor your domains and stay ahead of every threat.
        </p>

        <div className="space-y-4">
            <button
                onClick={handleOpenDashboard}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95"
            >
                {isAuthenticated ? 'Go to Dashboard' : 'Open Dashboard'}
            </button>
            
            <p className="text-xs text-slate-500">
                You will be redirected to your domain monitoring overview.
            </p>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800/50">
            <div className="flex items-center justify-center space-x-2 text-slate-400 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span>Shopify Integration Active</span>
            </div>
        </div>
      </div>
    </div>
  );
};
