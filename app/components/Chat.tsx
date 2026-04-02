import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from './MessageBubble';
import type { Workspace, McpTool } from '@/types';

interface ChatProps {
  workspace: Workspace | null;
  sessionId: string;
  connected: boolean;
  tools: McpTool[];
  isHome: boolean;
  onStartChat: () => void;
}

export function Chat({ workspace, sessionId, connected, tools, isHome, onStartChat }: ChatProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, streaming, currentStream, sendMessage } = useChat(
    workspace?.id || null,
    sessionId
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStream]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || !workspace || streaming) return;

    const message = input.trim();
    setInput('');
    
    // Switch to chat view if on home
    if (isHome) {
      onStartChat();
    }

    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (isHome) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[800px] space-y-6">
          {/* Hero text */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-serif italic text-text-primary">
              ✨ What would you like to build?
            </h1>
            <p className="text-sm text-text-secondary">
              {connected && workspace 
                ? `Connected to ${workspace.name} via MCP`
                : 'Connect to a workspace to get started'}
            </p>
          </div>

          {/* Input card */}
          <form onSubmit={handleSubmit} className="card p-5 shadow-lg">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              className="w-full bg-transparent border-none outline-none resize-none text-text-primary placeholder:text-text-tertiary text-[15px] leading-relaxed"
              rows={1}
              disabled={!workspace}
            />
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              {/* Left: Connection badge */}
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                {connected ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                    <span>Connected to MCP</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
                    <span>Not connected</span>
                  </>
                )}
              </div>

              {/* Right: Model and send button */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">
                  {workspace?.llm_model || 'No model'}
                </span>
                <button
                  type="submit"
                  disabled={!input.trim() || !workspace || streaming}
                  className="w-8 h-8 rounded-full bg-text-primary text-bg-main flex items-center justify-center transition-opacity disabled:opacity-30"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>

          {/* Tools count */}
          {tools.length > 0 && (
            <p className="text-center text-xs text-text-tertiary">
              {tools.length} tool{tools.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-[720px] mx-auto space-y-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {/* Streaming message */}
          {streaming && currentStream && (
            <div className="message-assistant">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent-blue flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  AI
                </div>
                <div className="flex-1 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {currentStream}
                  <span className="inline-block w-2 h-4 bg-text-primary ml-1 animate-pulse" />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-bg-main">
        <div className="max-w-[800px] mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="card p-4">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              className="w-full bg-transparent border-none outline-none resize-none text-text-primary placeholder:text-text-tertiary text-[15px] leading-relaxed"
              rows={1}
              disabled={!workspace || streaming}
            />
            
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              {/* Left: Connection badge */}
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                {connected ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                    <span>{workspace?.name}</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
                    <span>Not connected</span>
                  </>
                )}
              </div>

              {/* Right: Model and send button */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">
                  {workspace?.llm_model || 'No model'}
                </span>
                <button
                  type="submit"
                  disabled={!input.trim() || !workspace || streaming}
                  className="w-8 h-8 rounded-full bg-text-primary text-bg-main flex items-center justify-center transition-opacity disabled:opacity-30"
                >
                  {streaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
