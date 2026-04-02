import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatMessage, ToolCallInfo } from '@/types';

export function useChat(workspaceId: string | null, sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState('');
  const [currentThinking, setCurrentThinking] = useState('');
  const [activeTools, setActiveTools] = useState<ToolCallInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    const setupListeners = async () => {
      for (const fn of unlistenRefs.current) fn();
      unlistenRefs.current = [];

      const u1 = await listen<string>(
        `chat-stream-delta:${sessionId}`,
        (event) => {
          setStreaming(true);
          setCurrentThinking(''); // Stop showing thinking when text starts
          setCurrentStream((prev) => prev + event.payload);
        }
      );

      const u2 = await listen<string>(
        `chat-thinking-delta:${sessionId}`,
        (event) => {
          setStreaming(true);
          setCurrentThinking((prev) => prev + event.payload);
        }
      );

      const u3 = await listen<string>(
        `chat-complete:${sessionId}`,
        (event) => {
          setStreaming(false);
          const fullText = event.payload || '';
          if (fullText) {
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: fullText,
                timestamp: Math.floor(Date.now() / 1000),
                tool_calls: undefined,
              },
            ]);
          }
          setCurrentStream('');
          setCurrentThinking('');
          setActiveTools([]);
        }
      );

      const u4 = await listen<string>(
        `chat-error:${sessionId}`,
        (event) => {
          console.error('[useChat] error:', event.payload);
          setError(event.payload);
          setStreaming(false);
          setCurrentStream('');
          setCurrentThinking('');
        }
      );

      const u5 = await listen<any>(
        `chat-tool-use:${sessionId}`,
        (event) => {
          const tool = event.payload as ToolCallInfo;
          setActiveTools((prev) => [...prev, { ...tool, status: 'pending' }]);
          setCurrentStream(''); // Clear text stream while tool runs
          setCurrentThinking('');
        }
      );

      const u6 = await listen<any>(
        `chat-tool-result:${sessionId}`,
        (event) => {
          const result = event.payload;
          setActiveTools((prev) =>
            prev.map((t) =>
              t.name === result.name
                ? {
                    ...t,
                    output: result.result || result.error,
                    status: result.status || (result.error ? 'error' : 'success'),
                  }
                : t
            )
          );
        }
      );

      unlistenRefs.current = [u1, u2, u3, u4, u5, u6];
    };

    setupListeners();
    return () => {
      for (const fn of unlistenRefs.current) fn();
      unlistenRefs.current = [];
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!workspaceId) return;

      setError(null);
      setCurrentStream('');
      setCurrentThinking('');
      setActiveTools([]);
      setStreaming(true);

      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: message,
          timestamp: Math.floor(Date.now() / 1000),
        },
      ]);

      try {
        await invoke('chat_send_message', { workspaceId, sessionId, message });
        setStreaming(false);
      } catch (err) {
        console.error('[useChat] send failed:', err);
        setError(err as string);
        setStreaming(false);
        setCurrentStream('');
        setCurrentThinking('');
      }
    },
    [workspaceId, sessionId]
  );

  const clearHistory = useCallback(async () => {
    try {
      await invoke('chat_clear_history', { sessionId });
      setMessages([]);
      setCurrentStream('');
      setCurrentThinking('');
      setActiveTools([]);
    } catch (err) {
      console.error('[useChat] clear failed:', err);
    }
  }, [sessionId]);

  return {
    messages,
    streaming,
    currentStream,
    currentThinking,
    activeTools,
    error,
    sendMessage,
    clearHistory,
  };
}
