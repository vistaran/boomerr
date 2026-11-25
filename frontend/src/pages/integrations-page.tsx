import { Webhook } from "lucide-react";

export function IntegrationsPage() {

	
	return (
		<div className="space-y-6">
			<div className="mb-2">
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3 text-slate-50">
					<div className="rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 p-2.5 shadow-lg shadow-sky-500/20">
						<Webhook size={24} className="text-white" />
					</div>
					Integrations
				</h1>
				<p className="mt-3 text-sm text-slate-300">Connect your workspace to external platforms.</p>
			</div>
		</div>
	);
}
