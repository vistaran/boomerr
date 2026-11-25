/* eslint-disable react-refresh/only-export-components */
import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { getWorkspaces, type WorkspaceSummary } from "../services/api-service";
import { clearOnboardingCache } from "../hooks/useOnboardingData";
import type { User } from "../types/user";

type AuthContextType = {
    user: User | null;
    token: string | null;
    workspaces: WorkspaceSummary[];
    isAuthenticated: boolean;
    isAuthLoading: boolean;
    authReady: boolean;

    persistAuth: (token: string, user: User, workspaces: WorkspaceSummary[]) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [workspacesHydrated, setWorkspacesHydrated] = useState(false);

    // Restore auth on refresh and listen for changes in other tabs
    useEffect(() => {
        const syncAuth = () => {
            const storedToken = localStorage.getItem("dm_token");
            const storedUser = localStorage.getItem("dm_user");
            const storedWorkspaces = localStorage.getItem("dm_workspaces");

            if (storedToken && storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setToken(storedToken);
                    setUser(parsedUser);
                    
                    if (storedWorkspaces) {
                        const parsed = JSON.parse(storedWorkspaces);
                        setWorkspaces(parsed);
                        setWorkspacesHydrated(parsed.length > 0);
                    }
                } catch {
                    localStorage.removeItem("dm_user");
                    setToken(null);
                    setUser(null);
                }
            } else {
                // Handle logout in another tab
                setToken(null);
                setUser(null);
                setWorkspaces([]);
                setWorkspacesHydrated(false);
            }
            setAuthReady(true);
            setIsAuthLoading(false);
        };

        syncAuth();
        window.addEventListener("storage", syncAuth);
        return () => window.removeEventListener("storage", syncAuth);
    }, []);

    const persistAuth = (nextToken: string, nextUser: User, nextWorkspaces: WorkspaceSummary[]) => {
        const previousUserUlid = user?.ulid ?? null;
        if (previousUserUlid !== nextUser.ulid) {
            clearOnboardingCache();
        }

        localStorage.setItem("dm_token", nextToken);
        localStorage.setItem("dm_user", JSON.stringify(nextUser));
        localStorage.setItem("dm_workspaces", JSON.stringify(nextWorkspaces ?? []));
        setToken(nextToken);
        setUser(nextUser);
        setWorkspaces(nextWorkspaces ?? []);
        setWorkspacesHydrated((nextWorkspaces?.length ?? 0) > 0);
    };

    const logout = () => {
        clearOnboardingCache();
        localStorage.removeItem("dm_token");
        localStorage.removeItem("dm_user");
        localStorage.removeItem("dm_workspaces");
        setToken(null);
        setUser(null);
        setWorkspaces([]);
        setWorkspacesHydrated(false);
    };

    useEffect(() => {
        if (!token || !user) {
            return;
        }

        if (workspaces.length > 0 || workspacesHydrated) {
            return;
        }

        let isCancelled = false;

        const hydrateWorkspaces = async () => {
            try {
                const remote = await getWorkspaces();
                if (!isCancelled) {
                    setWorkspaces(remote);
                    localStorage.setItem("dm_workspaces", JSON.stringify(remote ?? []));
                }
            } catch (error) {
                console.error("Failed to hydrate workspaces", error);
            } finally {
                if (!isCancelled) {
                    setWorkspacesHydrated(true);
                }
            }
        };

        hydrateWorkspaces();

        return () => {
            isCancelled = true;
        };
    }, [token, user, workspacesHydrated]);

    // --- HYDRATE USER ---
    // If we have a token but user is missing or is a placeholder (from Shopify handshake)
    // fetch the real profile.
    useEffect(() => {
        if (!token) return;
        
        const isPlaceholder = !user || user.ulid === 'shopify-user';
        if (!isPlaceholder) return;

        let isCancelled = false;

        const hydrateUser = async () => {
            try {
                const { fetchCurrentUser } = await import("../services/api-service");
                const fullUser = await fetchCurrentUser(token);
                if (!isCancelled) {
                    setUser(fullUser);
                    localStorage.setItem("dm_user", JSON.stringify(fullUser));
                }
            } catch (error) {
                console.error("Failed to hydrate user", error);
            }
        };

        hydrateUser();
        return () => { isCancelled = true; };
    }, [token, user?.ulid]);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                workspaces,
                isAuthenticated: !!token,
                authReady,
                isAuthLoading,
                persistAuth,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used inside AuthProvider");
    }
    return ctx;
};
