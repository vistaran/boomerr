import { Settings } from "lucide-react";
import IntegrationSettings from "../components/settings/integration-settings";
import UserSettings from "../components/settings/user-settings";
import EmailPreferences from "../components/settings/email-preferences";
import WorkspaceSettings from "../components/settings/workspace-settings";
import DangerZoneSettings from "../components/settings/danger-zone-settings";
import type { User } from "../types/user";

type SettingsPageProps = {
    workspaceName: string;
    currentUser: User;
};


function SettingsPage({ workspaceName, currentUser }: SettingsPageProps) {
    const canManage = ["owner", "admin"].includes(currentUser.role ?? "");
    return (
        <div className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6 min-h-screen">
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2 flex-wrap">
                    <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-500 to-zinc-500 p-2 sm:p-2.5 shadow-lg shadow-slate-500/20 flex-shrink-0">
                        <Settings size={20} className="sm:w-[22px] sm:h-[22px]" />
                    </div>
                    <span className="min-w-0 flex-1">Settings for {workspaceName}</span>
                </h1>
                {!canManage && (
                    <p className="mt-2 text-xs sm:text-sm text-slate-400">
                        You have read-only access. Contact an admin to manage domains.
                    </p>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                <WorkspaceSettings workspaceName={workspaceName} canManage={canManage} />
                <UserSettings />
                <div className="col-span-1 sm:col-span-2">
                    <EmailPreferences />
                </div>
                <div className="col-span-1 sm:col-span-2">
                    <IntegrationSettings canManage={canManage} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                    <DangerZoneSettings />
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;
