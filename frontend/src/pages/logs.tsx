import { ScrollText, Shield, User2Icon } from 'lucide-react'
import React from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import type { User } from '../types/user';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationLogs from './notification-logs';
import AuditLogs from './audit-logs';

type LogsProps = {
    currentUser: User;
};

type TabType = 'audit' | 'notifications';

const Logs = ({ currentUser }: LogsProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();

    const tabParam = searchParams.get('tab')?.toLowerCase();
    const isAudit = tabParam === 'audit' || location.pathname.toLowerCase().endsWith('/audit');
    const activeTab: TabType = isAudit ? 'audit' : 'notifications';

    const handleTabChange = (tabId: TabType) => {
        if (location.pathname !== '/logs') {
            navigate(tabId === 'audit' ? '/logs?tab=audit' : '/logs');
            return;
        }
        const nextParams = new URLSearchParams(searchParams);
        if (tabId === 'audit') {
            nextParams.set('tab', 'audit');
        } else {
            nextParams.delete('tab');
        }
        setSearchParams(nextParams);
    };

    const canManage = ["owner", "admin", "member"].includes(currentUser.role ?? "");

    const tabs = [
        { id: 'notifications', label: 'System Action Logs', icon: Shield },
        { id: 'audit', label: 'Audit Logs', icon: User2Icon },
    ] as const;

    return (
        <div className="px-2 pb-10 pt-2 sm:px-4 sm:pt-4 md:px-6 md:pt-6">
            <div className="mb-4">
                <h1 className="text-lg sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <div className="rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-2 sm:p-2.5 shadow-lg shadow-amber-500/20 flex-shrink-0">
                        <ScrollText size={20} className="sm:w-[22px] sm:h-[22px]" />
                    </div>
                    <span className="truncate">Logs</span>
                </h1>
            </div>

            {canManage ? (
                <div className="rounded-lg sm:rounded-2xl border border-slate-800 bg-slate-900 px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2 mb-4 sm:mb-6 border-b border-slate-800 overflow-x-auto">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={`relative flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium transition-colors !outline-none flex-shrink-0 ${isActive
                                        ? 'text-sky-400'
                                        : 'text-slate-400 hover:text-slate-300'
                                        }`}
                                >
                                    <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    <span className="sm:hidden">{tab.label.split(' ')[0]}</span>

                                    {/* Animated Bottom Border */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="tabIndicator"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 to-indigo-500"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content with Animation */}
                    <AnimatePresence mode="wait">
                        {activeTab === 'notifications' && (
                            <div className="space-y-4">
                                <NotificationLogs />
                            </div>
                        )}

                        {activeTab === 'audit' && (
                            <AuditLogs />
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="rounded-lg sm:rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-8">
                    <p className="text-xs sm:text-sm text-slate-400 text-center">
                        You have read-only access. Contact an admin to view logs.
                    </p>
                </div>
            )}
        </div>
    )
}

export default Logs