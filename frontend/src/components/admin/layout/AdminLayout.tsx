import React from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./Sidebar";
import { AdminHeader } from "./Header";
import { useAdminTheme } from "../../../context/admin-theme-context";

export const AdminLayout = () => {
  const { theme } = useAdminTheme();

  return (
    <div 
      className={`admin-root flex h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-slate-50 overflow-hidden font-sans ${theme === 'light' ? 'admin-theme-light' : 'admin-theme-dark'}`}
      data-admin-theme={theme}
    >
      <AdminSidebar />
      <div className="flex-1 flex flex-col ml-64 overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-[#050505]">
          <div className="w-full h-full flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
