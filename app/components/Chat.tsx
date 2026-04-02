import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { ToolPanel } from './ToolPanel';
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

  const {
    messages,
    streaming,
    currentStream,
    currentThinking,
    activeTools,
    error,
    sendMessage,
  } = useChat(workspace?.id || null, sessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStream, currentThinking, activeTools]);

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

    if (isHome) {
      onStartChat();
    }

    await new Promise((r) => setTimeout(r, 50));
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Shared input card
  const renderInputCard = (isHomeView: boolean) => (
    <form onSubmit={handleSubmit} className="card p-4 shadow-lg">
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
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          {connected ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
              <span>{isHomeView ? 'Connected to MCP' : workspace?.name}</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
              <span>Not connected</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">{workspace?.llm_model || 'No model'}</span>
          <button
            type="submit"
            disabled={!input.trim() || !workspace || streaming}
            className="w-8 h-8 rounded-full bg-text-primary text-bg-main flex items-center justify-center transition-opacity disabled:opacity-30"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </form>
  );

  if (isHome) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[800px] space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-serif italic text-text-primary">✨ What would you like to build?</h1>
            <p className="text-sm text-text-secondary">
              {connected && workspace
                ? `Connected to ${workspace.name} via MCP`
                : 'Connect to a workspace to get started'}
            </p>
          </div>
          <div className="px-4">{renderInputCard(true)}</div>
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

          {/* Live thinking block */}
          {streaming && currentThinking && (
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-amber-400 text-xs">💭</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-amber-400 font-medium mb-1 flex items-center gap-2">
                  Thinking
                  <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                </div>
                <div className="text-sm text-text-secondary/70 italic leading-relaxed border-l-2 border-amber-500/30 pl-3 max-h-32 overflow-y-auto">
                  {currentThinking}
                </div>
              </div>
            </div>
          )}

          {/* Active tool calls */}
          {activeTools.map((tool, i) => (
            <ToolPanel key={`${tool.name}-${i}`} tool={tool} />
          ))}

          {/* Live streaming text */}
          {streaming && currentStream && (
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-blue flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-1">
                AI
              </div>
              <div className="flex-1 text-[15px] leading-relaxed whitespace-pre-wrap text-text-primary">
                {currentStream}
                <span className="inline-block w-1.5 h-4 bg-accent-blue ml-0.5 animate-pulse rounded-sm" />
              </div>
            </div>
          )}

          {/* Loading indicator when no text yet */}
          {streaming && !currentStream && !currentThinking && activeTools.length === 0 && (
            <div className="flex gap-3 items-center">
              <div className="w-6 h-6 rounded-full bg-accent-blue flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                AI
              </div>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-bg-main">
        <div className="max-w-[800px] mx-auto px-4 py-4">{renderInputCard(false)}</div>
      </div>
    </div>
  );
}
