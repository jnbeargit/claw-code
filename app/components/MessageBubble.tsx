import { ToolPanel } from './ToolPanel';
import type { ChatMessage } from '@/types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="message-user">
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="message-assistant">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="w-6 h-6 rounded-full bg-accent-blue flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          AI
        </div>
        
        {/* Content */}
        <div className="flex-1 space-y-4">
          {/* Main message */}
          {message.content && (
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-text-primary">
              {message.content}
            </div>
          )}
          
          {/* Tool calls */}
          {message.tool_calls && message.tool_calls.length > 0 && (
            <div className="space-y-3">
              {message.tool_calls.map((toolCall) => (
                <ToolPanel key={toolCall.id} toolCall={toolCall} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
