import TailwindMarkdown from "../tailwind-markdown";
import Logo from '../../../assets/logo-5.png';
import { ChatReplyStream } from "./chat-reply-stream";


export function ChatMessages({ chatHistory, isStreaming, streamingReply, aiChatMutation, showAgentTyping, chatEndRef }: { chatHistory: { role: 'user' | 'ai'; message: string; created_at?: string }[]; isStreaming: boolean, streamingReply: string, aiChatMutation: any, showAgentTyping: boolean, chatEndRef: React.RefObject<HTMLDivElement> }) {
    return (
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-slate-950/30">
            {chatHistory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center px-4">
                    <div className="space-y-3 animate-fade-in max-w-xs">
                        <div className="text-5xl">🤖</div>
                        <div className="space-y-1.5">
                            <p className="text-sm font-medium text-slate-300">
                                AI Assistant Ready
                            </p>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Ask questions about this incident to get instant insights and solutions
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {chatHistory.map((msg, idx) => {
                        return (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                            >
                                {/* Message Container with Arrow */}
                                <div className={`relative inline-block ${msg.role === 'ai' ? '' : 'max-w-[85%]'} min-w-[100px]`}>
                                    {/* Message Bubble with Tail */}
                                    <div
                                        className={`relative  transition-all duration-200 break-words ${msg.role === 'user'
                                            ? 'bg-gradient-to-br from-sky-500 to-sky-600 text-white px-3 py-2 rounded-tr-sm rounded-lg shadow-sm'
                                            : 'text-slate-100 px-3 py-2 rounded-tl-sm'
                                            }`}
                                        style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}
                                    >
                                        {/* Arrow/Tail */}
                                        <div
                                            className={`absolute top-0 ${msg.role === 'user'
                                                ? 'right-0 translate-x-0'
                                                : 'left-0 -translate-x-0'
                                                }`}
                                        >
                                            {msg.role === 'user' &&
                                                <svg width="12" height="12" viewBox="0 0 12 12" className="text-sky-600 absolute -top-0 -right-0">
                                                    <path d="M 0 0 L 12 0 L 12 12 Z" fill="currentColor" />
                                                </svg>
                                            }
                                        </div>

                                        {/* Message Content */}
                                        <div className="prose prose-invert prose-sm max-w-none" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                                            <TailwindMarkdown content={msg.message} />
                                        </div>
                                    </div>

                                    {/* Timestamp */}
                                    <div className={`flex items-center gap-1 mt-0.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <span className="text-[9px] text-slate-600">
                                            {(() => {
                                                const d = msg.created_at ? new Date(msg.created_at) : new Date();
                                                return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Streaming Message */}
                    {isStreaming && streamingReply && (
                        <div className="flex justify-start animate-fade-in">
                            <div className="relative inline-block max-w-[85%] min-w-[100px]">
                                <div
                                    className="relative rounded-lg bg-slate-800/70 border border-sky-500/50 text-slate-100 px-3 py-2 rounded-tl-sm shadow-sm break-words"
                                    style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                    {/* AI Badge */}
                                    <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-slate-700/30">
                                        <img src={Logo} alt="Agent" className="w-3.5 h-3.5 animate-pulse" />
                                        <span className="text-[10px] text-sky-400 font-semibold">Boomerr Agent</span>
                                        <div className="ml-auto flex items-center gap-0.5">
                                            <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse"></span>
                                            <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </div>

                                    <ChatReplyStream streamingReply={streamingReply} />
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[9px] text-slate-600">
                                        {(() => {
                                            const d = new Date();
                                            return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Typing Indicator */}
                    {(aiChatMutation.status === 'pending' && !isStreaming) || showAgentTyping ? (
                        <div className="flex justify-start animate-fade-in">
                            <div className="relative inline-block">
                                <div className="relative rounded-lg bg-slate-800/70 border border-slate-700/40 px-3 py-2 rounded-tl-sm flex items-center gap-2">
                                    {/* Arrow */}
                                    {/* <svg width="12" height="12" viewBox="0 0 12 12" className="text-slate-800/70 absolute -top-0 -left-0">
                              <path d="M 0 0 L 0 12 L 12 0 Z" fill="currentColor" />
                            </svg> */}
                                    <img src={Logo} alt="AI" className="w-4 h-4" />
                                    <span className="text-slate-200 text-xs font-medium">Boomerr Agent is thinking</span>
                                    <span className="flex gap-1 ml-2">
                                        <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                        <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <div ref={chatEndRef} />
                </>
            )}
        </div>
    )
}