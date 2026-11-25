import type { Transaction } from "./types";

interface TransactionsTabProps {
    transactions: Transaction[];
    txLoading: boolean;
    txPage: number;
    txLastPage: number;
    setTxPage: (updater: (page: number) => number) => void;
    statusBadge: (status: Transaction["status"]) => string;
}

export function TransactionsTab({
    transactions,
    txLoading,
    txPage,
    txLastPage,
    setTxPage,
    statusBadge,
}: TransactionsTabProps) {
    return (
        <div>
            <h2 className="text-lg sm:text-2xl font-semibold text-white mb-4 sm:mb-6">Payment History</h2>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg sm:rounded-xl overflow-hidden">
                {txLoading ? (
                    <div className="p-6 sm:p-12 text-center text-slate-500 text-sm sm:text-base">Loading transactions…</div>
                ) : transactions.length === 0 ? (
                    <div className="p-6 sm:p-12 text-center text-slate-500 text-sm sm:text-base">No transactions found.</div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <table className="w-full text-xs sm:text-sm hidden sm:table">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-400 text-left">
                                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium">Date</th>
                                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium">Plan</th>
                                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium">Payment ID</th>
                                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium">Amount</th>
                                    <th className="px-3 sm:px-6 py-3 sm:py-4 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx) => (
                                    <tr
                                        key={tx.id}
                                        className="border-b border-slate-800/50 hover:bg-slate-800/30 transition"
                                    >
                                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-300">
                                            {(() => {
                                                const date = new Date(tx.paid_at ?? tx.created_at);
                                                return (
                                                    date.toLocaleDateString(undefined, {
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                    }) +
                                                    ", " +
                                                    date.toLocaleTimeString(undefined, {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })
                                                );
                                            })()}
                                        </td>
                                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-300">
                                            {tx.subscription?.plan_price?.plan?.name ?? "-"}{" "}
                                            {tx.subscription?.plan_price?.interval && (
                                                <span className="text-slate-500 capitalize text-xs">
                                                    ({tx.subscription.plan_price.interval})
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 sm:px-6 py-3 sm:py-4 font-mono text-slate-400 text-xs">
                                            {tx.gateway_payment_id ?? "-"}
                                        </td>
                                        <td className="px-3 sm:px-6 py-3 sm:py-4 text-white font-medium">
                                            {tx.formatted_amount}
                                        </td>
                                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                                            <span
                                                className={`px-2 py-0.5 rounded-full border text-xs capitalize ${statusBadge(
                                                    tx.status
                                                )}`}
                                            >
                                                {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile Card View */}
                        <div className="sm:hidden space-y-3 p-3">
                            {transactions.map((tx) => (
                                <div
                                    key={tx.id}
                                    className="border border-slate-700 bg-slate-900/50 rounded-lg p-4 space-y-3"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-xs text-slate-400 mb-1">Date</p>
                                            <p className="text-sm text-slate-300">
                                                {(() => {
                                                    const date = new Date(tx.paid_at ?? tx.created_at);
                                                    return (
                                                        date.toLocaleDateString(undefined, {
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "numeric",
                                                        }) +
                                                        " " +
                                                        date.toLocaleTimeString(undefined, {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })
                                                    );
                                                })()}
                                            </p>
                                        </div>
                                        <span
                                            className={`px-2 py-1 rounded-full border text-xs capitalize font-medium ${statusBadge(
                                                tx.status
                                            )}`}
                                        >
                                            {tx.status}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-xs text-slate-400 mb-1">Plan</p>
                                            <p className="text-sm text-slate-300">
                                                {tx.subscription?.plan_price?.plan?.name ?? "-"}{" "}
                                                {tx.subscription?.plan_price?.interval && (
                                                    <span className="text-slate-500 capitalize text-xs">
                                                        ({tx.subscription.plan_price.interval})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 mb-1">Amount</p>
                                            <p className="text-sm font-medium text-white">
                                                {tx.formatted_amount}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 mb-1">Payment ID</p>
                                        <p className="text-xs font-mono text-slate-400 truncate">
                                            {tx.gateway_payment_id ?? "-"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {txLastPage > 1 && (
                            <div className="px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-t border-slate-800 bg-slate-800/30 text-xs sm:text-sm gap-2">
                                <button
                                    disabled={txPage <= 1}
                                    onClick={() => setTxPage((p) => p - 1)}
                                    className="text-slate-400 hover:text-white disabled:opacity-30 transition px-2 sm:px-0 py-1 rounded hover:bg-slate-700/50"
                                >
                                    ← Previous
                                </button>
                                <span className="text-slate-500 text-xs">
                                    Page {txPage} of {txLastPage}
                                </span>
                                <button
                                    disabled={txPage >= txLastPage}
                                    onClick={() => setTxPage((p) => p + 1)}
                                    className="text-slate-400 hover:text-white disabled:opacity-30 transition px-2 sm:px-0 py-1 rounded hover:bg-slate-700/50"
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
