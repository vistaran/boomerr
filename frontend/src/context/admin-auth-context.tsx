import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  adminToken: string | null;
  setAdminAuth: (admin: AdminUser | null, token: string | null) => void;
  logoutAdmin: () => void;
  isLoading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const getAdminBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl && !envUrl.includes('localhost:8000') && !import.meta.env.PROD) {
    let base = String(envUrl).trim().replace(/\/+$/, '');
    if (!base.endsWith('/api')) {
      base = `${base}/api`;
    }
    return base;
  }
  return typeof window !== 'undefined' ? `${window.location.origin}/api` : "/api";
};

export const adminApi = axios.create({
  baseURL: getAdminBaseUrl(),
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

adminApi.interceptors.request.use((config) => {
  if (config.url?.startsWith('/api/admin')) {
    config.url = config.url.replace(/^\/api\/admin/, '/admin');
  }
  const token = localStorage.getItem("admin_token");
  if (token && !config.headers["Authorization"]) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

export const AdminAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const storedAdmin = localStorage.getItem("admin_user");

    if (token && storedAdmin) {
      setAdminToken(token);
      try {
        setAdmin(JSON.parse(storedAdmin));
        adminApi.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      } catch (e) {
        console.error("Failed to parse admin user", e);
      }
    }
    setIsLoading(false);
  }, []);

  const setAdminAuth = (newAdmin: AdminUser | null, token: string | null) => {
    setAdmin(newAdmin);
    setAdminToken(token);

    if (newAdmin && token) {
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_user", JSON.stringify(newAdmin));
      adminApi.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      delete adminApi.defaults.headers.common["Authorization"];
    }
  };

  const logoutAdmin = () => {
    setAdminAuth(null, null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, adminToken, setAdminAuth, logoutAdmin, isLoading }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};
