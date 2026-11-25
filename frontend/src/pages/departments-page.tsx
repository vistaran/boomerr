/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import DepartmentMembers from "../components/departments/department-members";
import DepartmentSidebar from "../components/departments/department-sidebar";
import { Users } from "lucide-react";
import { useAuth } from "../context/auth-context";
import type { User } from "../types/user";

type DepartmentsPageProps = {
    currentUser: User;
};

export default function DepartmentsPage({ currentUser }: DepartmentsPageProps) {
    const { user } = useAuth();
    const workspaceId = user?.workspace_id ?? null;
    const [selection, setSelection] = useState<{ workspaceId: number | null; departmentId: string | null }>({
        workspaceId,
        departmentId: null,
    });
    const canManage = ["owner", "admin"].includes(currentUser.role ?? "");
    useEffect(() => {
        setSelection({ workspaceId, departmentId: null });
    }, [workspaceId]);

    const handleDepartmentSelect = (departmentId: string | null) => {
        if (!workspaceId) {
            return;
        }
        setSelection({ workspaceId, departmentId });
    };

    const activeDept = selection.workspaceId === workspaceId ? selection.departmentId : null;

    return (
        <section className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
            <div className="mb-4 flex items-center gap-2 sm:gap-3">
                <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 p-2 sm:p-2.5 shadow-lg shadow-pink-500/20 flex-shrink-0">
                    <Users size={20} className="sm:w-[22px] sm:h-[22px]" />
                </div>
                <h1 className="text-lg sm:text-2xl font-semibold tracking-tight truncate">
                    Manage Departments
                </h1>
            </div>

            <div className="flex flex-col md:flex-row min-h-[calc(100vh-240px)] rounded-lg sm:rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur overflow-hidden gap-0">
                {/* Sidebar */}
                <aside className="w-full md:w-72 lg:w-80 bg-slate-950/80 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col flex-shrink-0 max-h-72 md:max-h-none overflow-y-auto md:overflow-y-auto">
                    <DepartmentSidebar
                        workspaceId={workspaceId}
                        selectedDepartmentId={activeDept}
                        onSelect={handleDepartmentSelect}
                        canManage={canManage}
                    />
                </aside>

                {/* Main */}
                <main className="flex-1 flex flex-col bg-gradient-to-br from-slate-900/80 to-slate-950/90 min-w-0">
                    {activeDept && workspaceId ? (
                        <section className="w-full flex-1 flex flex-col">
                            <DepartmentMembers departmentId={activeDept} workspaceId={workspaceId} />
                        </section>
                    ) : (
                        <div className="flex flex-1 items-center justify-center text-slate-400 text-xs sm:text-sm md:text-lg px-4">
                            {workspaceId ? "Select a department to view details." : "Switch to a workspace to manage departments."}
                        </div>
                    )}
                </main>
            </div>
        </section>
    );
}
