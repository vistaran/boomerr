export function ChatSubmitForm({ handleSendChat, chatInput, setChatInput, aiChatMutation, isStreaming }: { handleSendChat: (e: React.FormEvent) => void, chatInput: string, setChatInput: React.Dispatch<React.SetStateAction<string>>, aiChatMutation: any, isStreaming: boolean }) {
    return (
        <div className="p-3 border-t border-slate-700/40 bg-slate-900/80 backdrop-blur-sm">
            <form
                onSubmit={handleSendChat}
                className="relative"
            >
                <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about this incident…"
                    disabled={aiChatMutation.status === 'pending' || isStreaming}
                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 pr-12 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
                <button
                    type="submit"
                    disabled={!chatInput.trim() || aiChatMutation.status === 'pending' || isStreaming}
                    className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md transition-all duration-200 ${chatInput.trim() && aiChatMutation.status !== 'pending' && !isStreaming
                        ? 'hover:bg-sky-500 text-white  hover:scale-105'
                        : 'text-slate-600 cursor-not-allowed'
                        }`}
                    aria-label="Send"
                >
                    {(aiChatMutation.status === 'pending' || isStreaming) ? (
                        <span className="h-4 w-4 animate-spin rounded-full" />
                    ) : (
                        <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="currentColor"
                        >
                            <path d="M3.4 20.6 21 12 3.4 3.4l-.4 7.1L17 12 3 13.5z" />
                        </svg>
                    )}
                </button>
            </form>
        </div>
    )
}