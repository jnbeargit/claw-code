import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ChatMessage } from '@/types';

export function useChat(workspaceId: string | null, sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState('');
  const [error, setError] = useState<string | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  // Set up event listeners once and keep them stable
  useEffect(() => {
    if (!sessionId) return;

    const setupListeners = async () => {
      // Clean up old listeners
      for (const fn of unlistenRefs.current) {
        fn();
      }
      unlistenRefs.current = [];

      const u1 = await listen<string>(
        `chat-stream-delta:${sessionId}`,
        (event) => {
          setStreaming(true);
          setCurrentStream((prev) => prev + event.payload);
        }
      );

      const u2 = await listen<string>(
        `chat-complete:${sessionId}`,
        (event) => {
          setStreaming(false);
          // The complete event payload is the full text
          const fullText = event.payload || '';
          if (fullText) {
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: fullText,
                timestamp: Math.floor(Date.now() / 1000),
              },
            ]);
          }
          setCurrentStream('');
        }
      );

      const u3 = await listen<string>(
        `chat-error:${sessionId}`,
        (event) => {
          console.error('[useChat] error event:', event.payload);
          setError(event.payload);
          setStreaming(false);
          setCurrentStream('');
        }
      );

      const u4 = await listen<any>(
        `chat-tool-use:${sessionId}`,
        (event) => {
          console.log('[useChat] tool-use:', event.payload);
          // We could show tool calls in the UI here
        }
      );

      const u5 = await listen<any>(
        `chat-tool-result:${sessionId}`,
        (event) => {
          console.log('[useChat] tool-result:', event.payload);
        }
      );

      unlistenRefs.current = [u1, u2, u3, u4, u5];
    };

    setupListeners();

    return () => {
      for (const fn of unlistenRefs.current) {
        fn();
      }
      unlistenRefs.current = [];
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!workspaceId) return;

      setError(null);
      setCurrentStream('');
      setStreaming(true);

      // Immediately add user message to UI
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
        // This call blocks until the full tool loop is done
        await invoke('chat_send_message', {
          workspaceId,
          sessionId,
          message,
        });
        // If streaming didn't produce a complete event, force stop
        setStreaming(false);
      } catch (err) {
        console.error('[useChat] send failed:', err);
        setError(err as string);
        setStreaming(false);
        setCurrentStream('');
      }
    },
    [workspaceId, sessionId]
  );

  const clearHistory = useCallback(async () => {
    try {
      await invoke('chat_clear_history', { sessionId });
      setMessages([]);
      setCurrentStream('');
    } catch (err) {
      console.error('[useChat] clear failed:', err);
    }
  }, [sessionId]);

  return {
    messages,
    streaming,
    currentStream,
    error,
    sendMessage,
    clearHistory,
  };
}
