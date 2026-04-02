import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '@/types';
import { ToolPanel } from './ToolPanel';

interface MessageBubbleProps {
  message: ChatMessage;
  streaming?: boolean;
}

export function MessageBubble({ message, streaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          max-w-[80%] rounded-lg p-4
          ${isUser ? 'bg-blue-600' : 'bg-gray-800'}
          ${streaming ? 'animate-pulse' : ''}
        `}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>

            {message.tool_calls && message.tool_calls.length > 0 && (
              <div className="mt-4 space-y-2">
                {message.tool_calls.map((toolCall) => (
                  <ToolPanel key={toolCall.id} toolCall={toolCall} />
                ))}
              </div>
            )}
          </>
        )}

        {!streaming && (
          <div className="mt-2 text-xs text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
