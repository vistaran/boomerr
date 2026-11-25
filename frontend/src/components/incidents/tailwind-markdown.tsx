import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
// Register only the languages you actually need (add more here as needed)
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('shell', bash)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('js', javascript)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('ts', typescript)
SyntaxHighlighter.registerLanguage('python', python)
SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('html', markup)
SyntaxHighlighter.registerLanguage('xml', markup)
SyntaxHighlighter.registerLanguage('sql', sql)

interface TailwindMarkdownProps {
  content: string;
}

const generateUniqueId = () => {
  return Math.random().toString(36).substr(2, 9);
};

const TailwindMarkdown: React.FC<TailwindMarkdownProps> = ({ content }) => {
  return (
    <div className="prose text-left">
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => <h1 className="h1 font-cabinet-grotesk
                bg-gradient-to-r from-orange-500 to-amber-600
                dark:from-rose-300 dark:to-orange-300
                bg-clip-text text-transparent mb-3">{children}</h1>,
          h2: ({ children }) => <h2 id={generateUniqueId()} className="text-xl font-cabinet-grotesk mb-3 text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold !my-1 text-white">{children}</h3>,
          h4: ({ children }) => <h4 className="text-md text-white font-semibold mb-2">{children}</h4>,
          h5: ({ children }) => <h5 className="text-base text-white font-semibold mb-2">{children}</h5>,
          h6: ({ children }) => <h6 className="text-base text-white font-semibold mb-2">{children}</h6>,
          p: ({ children }) => <p className="text-gray-300 text-sm !m-0">{children}</p>,
          li: ({ children }) => <li className="text-gray-300 text-sm">{children}</li>,
          strong: ({ children }) => <strong className="text-white">{children}</strong>,
          a: ({ href, children, ...props }) => {
            const isExternal = typeof href === 'string' && /^https?:\/\//i.test(href);
            return (
              <a
                href={href}
                {...props}
                target={isExternal ? "_blank" : props.target}
                rel={isExternal ? "noopener noreferrer" : props.rel}
                className={
                  "text-blue-600 hover:text-blue-700 dark:text-blue-400 " +
                  (props.className ?? "")
                }
              >
                {children}
              </a>
            );
          },
          img: ({ alt, ...props }) => {
            const match = /^(\d+)px$/.exec(alt || "");
            const width = match ? match[1] : null;
            return (
              <img
                {...props}
                style={width ? { width: `${width}px` } : {}}
                className="my-2"
              />
            );
          },
          code(props) {
            const { children, className, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            return match ? (
              <SyntaxHighlighter
                {...rest}
                PreTag="div"
                children={String(children).replace(/\n$/, '')}
                language={match[1]}
                style={oneDark}
              />
            ) : (
              <code {...rest} className={className + " dark:text-white"}>
                {children}
              </code>
            );
          },
          // Explicitly handle html to prevent XSS - return null to discard any HTML
          html: () => null,
          // Add Tailwind CSS classes for other Markdown elements as needed
        }
        }>
        {content}
      </ReactMarkdown>
    </div >
  );
};

export default TailwindMarkdown;
