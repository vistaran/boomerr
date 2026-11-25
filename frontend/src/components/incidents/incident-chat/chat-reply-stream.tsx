import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

export function ChatReplyStream({ streamingReply }: { streamingReply: string }) {
    return (
        <div className="prose prose-invert prose-sm max-w-none" style={{ maxWidth: '100%', overflow: 'hidden' }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm as any]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                    a: (props) => (
                        <a {...props} className="text-sky-300 hover:text-sky-200 underline underline-offset-2 font-medium break-all" target="_blank" rel="noopener noreferrer" />
                    ),
                    code: ({ inline, children, ...props }: { inline?: boolean; children: React.ReactNode }) => {
                        return inline ? (
                            <code className="bg-slate-950/70 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px] border border-slate-700/30 break-all" {...props}>{children}</code>
                        ) : (
                            <pre className="!bg-slate-950/80 !p-2 !rounded-md overflow-x-auto !my-1.5 border border-slate-700/40 shadow-inner" style={{ maxWidth: '100%' }}>
                                <code className="font-mono !text-[10px] !text-slate-200 block" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} {...props}>{children}</code>
                            </pre>
                        );
                    },
                    p: (props) => <p className="!mb-1.5 last:!mb-0 !text-[12px] !leading-relaxed" style={{ wordWrap: 'break-word' }} {...props} />,
                    ul: (props) => <ul className="!list-disc !ml-3.5 !mb-1.5 !space-y-0.5 !text-[12px] !pl-0" {...props} />,
                    ol: (props) => <ol className="!list-decimal !ml-3.5 !mb-1.5 !space-y-0.5 !text-[12px] !pl-0" {...props} />,
                    li: (props) => <li className="!text-[12px] !leading-relaxed" style={{ wordWrap: 'break-word' }} {...props} />,
                    strong: (props) => <strong className="!font-semibold !text-white" {...props} />,
                    em: (props) => <em className="!italic !text-slate-200" {...props} />,
                    h1: (props) => <h1 className="!text-sm !font-bold !mb-1.5 !mt-2 !text-white !border-b !border-slate-700/30 !pb-1" {...props} />,
                    h2: (props) => <h2 className="!text-[13px] !font-bold !mb-1.5 !mt-2 !text-white" {...props} />,
                    h3: (props) => <h3 className="!text-[12px] !font-semibold !mb-1 !mt-1.5 !text-slate-100" {...props} />,
                    blockquote: (props) => <blockquote className="!border-l-2 !border-sky-500/60 !pl-2.5 !my-1.5 !italic !text-slate-300 !bg-slate-900/30 !py-1 !text-[11px]" {...props} />,
                    table: (props) => <div className="overflow-x-auto !my-1.5 max-w-full"><table className="min-w-full divide-y divide-slate-700/40 !text-[11px]" {...props} /></div>,
                    th: (props) => <th className="!px-2 !py-1 !bg-slate-900/50 !text-left !font-semibold !text-slate-200 !text-[10px]" {...props} />,
                    td: (props) => <td className="!px-2 !py-1 !border-t !border-slate-700/30 !text-slate-300 !text-[10px] break-words" {...props} />,
                    // Explicitly handle html to prevent XSS - return null to discard any HTML
                    html: () => null,
                }}
            >
                {streamingReply}
            </ReactMarkdown>
            <span className="inline-block w-0.5 h-3 bg-sky-400 align-middle ml-0.5 animate-pulse" />
        </div>
    )
}