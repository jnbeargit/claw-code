import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ChatMessage } from '@/types';

export function useChat(workspaceId: string | null, sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentStream, setCurrentStream] = useState('');

  useEffect(() => {
    if (!workspaceId) return;

    // Load chat history
    const loadHistory = async () => {
      try {
        const history = await invoke<ChatMessage[]>('chat_get_history', {
          sessionId,
        });
        setMessages(history);
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    loadHistory();

    // Listen to streaming events
    const unlistenDelta = listen<string>(
      `chat-stream-delta:${sessionId}`,
      (event) => {
        setStreaming(true);
        setCurrentStream((prev) => prev + event.payload);
      }
    );

    const unlistenComplete = listen(`chat-complete:${sessionId}`, () => {
      setStreaming(false);
      setCurrentStream('');
      loadHistory(); // Reload to get full message
    });

    const unlistenError = listen<string>(`chat-error:${sessionId}`, (event) => {
      console.error('Chat error:', event.payload);
      setStreaming(false);
    });

    return () => {
      unlistenDelta.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [workspaceId, sessionId]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!workspaceId) return;

      setCurrentStream('');
      setStreaming(true);

      try {
        await invoke('chat_send_message', {
          workspaceId,
          sessionId,
          message,
        });
      } catch (err) {
        console.error('Failed to send message:', err);
        setStreaming(false);
      }
    },
    [workspaceId, sessionId]
  );

  const clearHistory = useCallback(async () => {
    try {
      await invoke('chat_clear_history', { sessionId });
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }, [sessionId]);

  return {
    messages,
    streaming,
    currentStream,
    sendMessage,
    clearHistory,
  };
}
