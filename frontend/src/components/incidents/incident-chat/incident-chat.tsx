import { useEffect, useRef, useState } from "react";
import { ChatTitle } from "./chat-title";
import type { Incident } from "../../../types/incidents";
import { useIncidentAIChat, useIncidentAIChatHistory } from "../../../hooks/use-incidents";
import { ChatMessages } from "./chat-messages";
import { ChatSubmitForm } from "./chat-submit-form";

export function IncidentChat({ incident, incidentId }: { incident: Incident, incidentId: string }) {
    const [chatHistory, setChatHistory] = useState<
        { role: 'user' | 'ai'; message: string; created_at?: string }[]
    >([]);
    const [chatInput, setChatInput] = useState('');
    const [streamingReply, setStreamingReply] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [showAgentTyping, setShowAgentTyping] = useState(false);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const chatHistoryQuery = useIncidentAIChatHistory(incidentId);
    const aiChatMutation = useIncidentAIChat(incidentId, userTimezone);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when chat history updates
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, aiChatMutation.status]);

    // Initialize chat history from server (includes initial AI analysis if present)
    useEffect(() => {
        if (chatHistoryQuery.data?.messages) {
            setChatHistory(chatHistoryQuery.data.messages.map(m => ({ role: m.role, message: m.message, created_at: m.created_at })));
        }
    }, [chatHistoryQuery.data]);


    // Auto-trigger initial AI analysis if not present
    useEffect(() => {
        if (incident && !incident.ai_summary && incident.status === 'ongoing' && chatHistory.length === 0) {
            // The backend now auto-generates on first show() call, so just refetch chat
            const timer = setTimeout(() => {
                chatHistoryQuery.refetch();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [incident, chatHistory.length, chatHistoryQuery]);

    const handleSendChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;

        const userMessage = chatInput.trim();
        setChatInput(''); // Clear input immediately
        setStreamingReply('');
        setChatHistory((h) => [...h, { role: 'user', message: userMessage }]);

        try {
            // Prefer streaming if available
            const { chatWithIncidentAIStream } = await import('../../../services/incident-service');
            setIsStreaming(true);
            setShowAgentTyping(true);
            const full = await chatWithIncidentAIStream(incidentId, userMessage, (delta) => {
                setStreamingReply((prev) => prev + delta);
            }, userTimezone);
            setChatHistory((h) => [...h, { role: 'ai', message: full, created_at: new Date().toISOString() }]);
            setStreamingReply('');
            setIsStreaming(false);
            setShowAgentTyping(false);
            chatHistoryQuery.refetch();
        } catch {
            setIsStreaming(false);
            setShowAgentTyping(false);
            // Fallback to non-streaming
            try {
                const res = await aiChatMutation.mutateAsync(userMessage);
                setChatHistory((h) => [
                    ...h,
                    { role: 'ai', message: (res as { reply: string }).reply, created_at: new Date().toISOString() },
                ]);
                chatHistoryQuery.refetch();
            } catch {
                setChatHistory((h) => [
                    ...h,
                    { role: 'ai', message: 'Sorry, I encountered an error. Please try again.' },
                ]);
            }
        }
    };


    return (
        <div className="flex flex-col rounded-lg border border-slate-700/40 bg-slate-900/95 backdrop-blur-xl overflow-hidden shadow-2xl h-[73.5vh]">
            <ChatTitle chatLenth={chatHistory.length} />

            {/* Messages - Flexible with scrolling */}
            <ChatMessages
                chatHistory={chatHistory}
                isStreaming={isStreaming}
                streamingReply={streamingReply}
                aiChatMutation={aiChatMutation}
                showAgentTyping={showAgentTyping}
                chatEndRef={chatEndRef}
            />

            {/* Input - Fixed at bottom */}
            <div className="flex-shrink-0">
                <ChatSubmitForm
                    handleSendChat={handleSendChat}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    aiChatMutation={aiChatMutation}
                    isStreaming={isStreaming}
                />
            </div>
        </div>
    );
}