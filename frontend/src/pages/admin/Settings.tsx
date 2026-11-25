import React, { useState, useEffect } from "react";
import { Save, Shield, Bell, MessageCircle, MessageSquare, Hash, Mail, Phone, Webhook, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { ToggleSwitch } from "../../components/common/toggle";
import { adminApi } from "../../context/admin-auth-context";

export const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [activeAlertChannel, setActiveAlertChannel] = useState<string | null>(null);
  const [masterNotification, setMasterNotification] = useState(true);
  const [channels, setChannels] = useState<Record<string, boolean>>({
    Discord: false,
    Slack: true,
    Email: true,
    system_errors: true,
    subscriptions: true,
    security_events: true,
    growth_events: true
  });

  const [platformName, setPlatformName] = useState(() => localStorage.getItem("admin_platform_name") || "Boomerr");
  const [supportEmail, setSupportEmail] = useState(() => localStorage.getItem("admin_support_email") || "support@example.com");
  const [maintenanceMode, setMaintenanceMode] = useState(() => localStorage.getItem("admin_maintenance_mode") === "true");

  const [slackUrl, setSlackUrl] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.get('/admin/me')
      .then(res => {
        const data = res.data;
        setSlackUrl(data.slack_webhook_url || "");
        setDiscordUrl(data.discord_webhook_url || "");
        if (data.notification_preferences) {
          setChannels(prev => ({ ...prev, ...data.notification_preferences }));
        }
      })
      .catch(() => {
        // Silently handle initial load failure if unauthenticated
      });
  }, []);

  useEffect(() => {
    setUrlError(null);
  }, [activeAlertChannel]);

  const handleSave = async () => {
    setIsSaving(true);
    setUrlError(null);
    try {
      localStorage.setItem("admin_platform_name", platformName);
      localStorage.setItem("admin_support_email", supportEmail);
      localStorage.setItem("admin_maintenance_mode", String(maintenanceMode));

      await adminApi.put('/admin/me/settings', {
        slack_webhook_url: slackUrl || null,
        discord_webhook_url: discordUrl || null,
        notification_preferences: channels
      });
      toast.success("Settings saved successfully!");
    } catch (e: any) {
      if (e.response?.status === 422 && e.response?.data?.errors) {
        const firstErr = Object.values(e.response.data.errors)[0] as string[];
        if (firstErr) {
          setUrlError(firstErr[0]);
          toast.error("Validation failed");
          return;
        }
      }
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    const urlToTest = activeAlertChannel === 'Slack' ? slackUrl : discordUrl;
    setUrlError(null);
    if (!activeAlertChannel || !urlToTest) {
      setUrlError("Please enter a webhook URL first");
      return;
    }

    try {
      await adminApi.post('/admin/me/test-notification', {
        channel: activeAlertChannel,
        webhook_url: urlToTest
      });
      toast.success(`Test notification sent to ${activeAlertChannel}!`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error sending test notification");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${activeTab === 'general' ? 'bg-blue-50 dark:bg-slate-900/50 text-blue-600 dark:text-blue-500 border border-blue-200 dark:border-blue-500/30 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'}`}
          >
            <Shield className="w-5 h-5" />
            General
          </button>
          <button
            onClick={() => { setActiveTab('notifications'); setActiveAlertChannel(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left ${activeTab === 'notifications' ? 'bg-blue-50 dark:bg-slate-900/50 text-blue-600 dark:text-blue-500 border border-blue-200 dark:border-blue-500/30 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'}`}
          >
            <Bell className="w-5 h-5" />
            Notifications
          </button>
        </div>

        <div className="md:col-span-2">
          {activeTab === 'general' && (
            <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800/60">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">General Settings</h2>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Platform Name</label>
                  <input
                    type="text"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Support Email</label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#050505] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Maintenance Mode</label>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={maintenanceMode}
                      onClick={() => setMaintenanceMode(!maintenanceMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        maintenanceMode ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          maintenanceMode ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span 
                      onClick={() => setMaintenanceMode(!maintenanceMode)} 
                      className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-300 transition-colors"
                    >
                      Disable access for non-admin users {maintenanceMode ? (
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold ml-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">ON</span>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400 text-xs font-semibold ml-1.5 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-md">OFF</span>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-400 mt-2">
                    Click <strong className="text-blue-400">Save Changes</strong> to apply.
                  </p>
                </div>
              </div>
            </div>
          )}



          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {!activeAlertChannel ? (
                <>
                  <div className="flex items-center justify-between pb-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Notifications</h2>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>

                  <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Master Notification Toggle</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Enable or disable all notifications globally across the platform.</p>
                      </div>
                      <ToggleSwitch
                        checked={masterNotification}
                        onChange={(val) => setMasterNotification(val)}
                      />
                    </div>
                  </div>

                  <div className={`bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 transition-opacity duration-300 ${masterNotification ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-4">Notification Channels</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {/* Standard Channels */}
                      {Object.entries(channels).map(([channel, isEnabled]) => {
                        if (channel === 'Call' || channel === 'system_errors' || channel === 'subscriptions' || channel === 'security_events' || channel === 'growth_events') return null;

                        const Icon =
                          channel === 'Discord' ? MessageSquare :
                            channel === 'Slack' ? Hash :
                              channel === 'WhatsApp' ? MessageCircle :
                                channel === 'SMS' ? MessageSquare :
                                  channel === 'Email' ? Mail :
                                    channel === 'Webhooks' ? Webhook : Bell;

                        return (
                          <div
                            key={channel}
                            onClick={() => setActiveAlertChannel(channel)}
                            className="cursor-pointer relative rounded-xl border p-4 transition-all border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/70 group"
                          >
                            <div className="flex items-center justify-between gap-2 md:gap-3 overflow-hidden">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="text-slate-600 dark:text-slate-300 flex-shrink-0 group-hover:text-blue-400 transition-colors">
                                  <Icon size={20} className={isEnabled ? "text-blue-400" : "text-slate-600 dark:text-slate-400"} />
                                </div>
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{channel}</span>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                <ToggleSwitch
                                  checked={isEnabled}
                                  onChange={() => setChannels(prev => ({ ...prev, [channel]: !isEnabled }))}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm min-h-[400px]">
                  <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-800/60">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveAlertChannel(null)}
                        className="text-slate-600 dark:text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors text-sm flex items-center gap-1"
                      >
                        &laquo; Back to Channels
                      </button>
                      <span className="text-slate-600">/</span>
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{activeAlertChannel}</h2>
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>

                  <div className="space-y-6 max-w-2xl">
                    {(activeAlertChannel === 'Slack' || activeAlertChannel === 'Discord' || activeAlertChannel === 'Email') ? (
                      <>
                        {activeAlertChannel !== 'Email' ? (
                          <div>
                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{activeAlertChannel} Webhook URL</label>
                            <input
                              type="url"
                              value={activeAlertChannel === 'Slack' ? slackUrl : discordUrl}
                              onChange={(e) => {
                                setUrlError(null);
                                activeAlertChannel === 'Slack' ? setSlackUrl(e.target.value) : setDiscordUrl(e.target.value);
                              }}
                              placeholder={`https://${activeAlertChannel === 'Slack' ? 'hooks.slack.com/services' : 'discord.com/api/webhooks'}/...`}
                              className={`w-full bg-slate-50 dark:bg-[#050505] border ${urlError ? 'border-red-500/50 focus:border-red-500' : 'border-slate-200 dark:border-slate-800 focus:border-blue-500'} rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none transition-colors`}
                            />
                            {urlError && (
                              <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-red-400" />
                                {urlError}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                            <Mail className="w-5 h-5 text-blue-400 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-medium text-blue-100">Email Delivery</h4>
                              <p className="text-sm text-blue-300 mt-1">
                                Email notifications will be sent directly to your registered administrator email address.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800/60 mt-6">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Notification Events</h3>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/30">
                              <span className="text-sm text-slate-700 dark:text-slate-300">System Errors & Alerts</span>
                              <ToggleSwitch checked={channels.system_errors ?? true} onChange={(val) => setChannels(prev => ({ ...prev, system_errors: val }))} />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/30">
                              <span className="text-sm text-slate-700 dark:text-slate-300">Subscription Upgrades & Failures</span>
                              <ToggleSwitch checked={channels.subscriptions ?? true} onChange={(val) => setChannels(prev => ({ ...prev, subscriptions: val }))} />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/30">
                              <span className="text-sm text-slate-700 dark:text-slate-300">Security & Account Events</span>
                              <ToggleSwitch checked={channels.security_events ?? true} onChange={(val) => setChannels(prev => ({ ...prev, security_events: val }))} />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/30">
                              <span className="text-sm text-slate-700 dark:text-slate-300">Growth & Revenue Events</span>
                              <ToggleSwitch checked={channels.growth_events ?? true} onChange={(val) => setChannels(prev => ({ ...prev, growth_events: val }))} />
                            </div>
                          </div>
                        </div>

                        {activeAlertChannel !== 'Email' && (
                          <div className="pt-6">
                            <button onClick={handleTestNotification} className="px-6 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-xl text-sm font-medium transition-colors">
                              Send Test Notification
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-slate-600 dark:text-slate-400 dark:text-slate-400">Configuration for {activeAlertChannel} coming soon.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
