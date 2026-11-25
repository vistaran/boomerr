import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

type Task = {
  id: string;
  label: string;
  isCompleted: boolean;
  href?: string;
};

export function GettingStartedCard({
  hasDomain,
  hasAlerts,
  hasIntegrations,
}: {
  hasDomain: boolean;
  hasAlerts: boolean;
  hasIntegrations: boolean;
}) {
  const [isDismissed, setIsDismissed] = useState(false);

  const tasks: Task[] = [
    { id: "domain", label: "Add your first domain", isCompleted: hasDomain, href: "#" },
    { id: "alerts", label: "Setup alerts", isCompleted: hasAlerts, href: "/notifications" },
    { id: "integrations", label: "Connect integrations", isCompleted: hasIntegrations, href: "/integrations" },
    { id: "ad_protection", label: "Enable ad protection", isCompleted: false, href: "/integrations" },
  ];

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const progress = (completedCount / tasks.length) * 100;
  
  if (isDismissed || completedCount === tasks.length) return null;

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Getting Started Guide</h2>
              <p className="text-sm text-slate-400">Complete these steps to get the most out of Boomerr.</p>
            </div>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-slate-500 hover:text-slate-300 transition-colors text-sm font-medium"
            >
              Dismiss
            </button>
          </div>

          <div className="mb-6 bg-slate-800/50 rounded-full h-2.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center p-4 rounded-xl border transition-colors ${
                  task.isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600"
                }`}
              >
                <div className="mr-4">
                  {task.isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-600" />
                  )}
                </div>
                <div className="flex-1">
                  <span className={`font-medium block ${task.isCompleted ? "text-slate-400 line-through" : "text-white"}`}>
                    {task.label}
                  </span>
                </div>
                {!task.isCompleted && task.href && (
                  <Link
                    to={task.href}
                    onClick={(e) => {
                      if (task.href === "#") {
                        e.preventDefault();
                        window.dispatchEvent(new Event("dm-open-add-domain"));
                      }
                    }}
                    className="text-blue-400 p-2 hover:bg-blue-500/10 rounded-lg transition-colors"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
