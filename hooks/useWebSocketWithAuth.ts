import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface UseWebSocketOptions {
  /**
   * WebSocket URL
   */
  url: string;

  /**
   * Called when the WebSocket connection opens
   */
  onOpen?: () => void;

  /**
   * Called when a message is received
   */
  onMessage?: (event: MessageEvent) => void;

  /**
   * Called when an error occurs
   */
  onError?: (error: Event) => void;

  /**
   * Called when the connection closes
   */
  onClose?: () => void;

  /**
   * Whether to automatically connect
   * @default true
   */
  autoConnect?: boolean;

  /**
   * Reconnect delay in milliseconds
   * @default 3000
   */
  reconnectDelay?: number;

  /**
   * Maximum number of reconnection attempts
   * @default 5
   */
  maxReconnectAttempts?: number;
}

/**
 * 🆕 Hook for managing WebSocket connections with JWT token management
 *
 * Features:
 * - Ensures token is valid before connecting
 * - Automatically reconnects when token is refreshed
 * - Handles disconnections with exponential backoff
 * - Provides send method and connection status
 *
 * @example
 * ```tsx
 * const { websocket, send, isConnected, connect, disconnect } = useWebSocketWithAuth({
 *   url: 'wss://example.com/ws/chat/',
 *   onMessage: (event) => {
 *     const data = JSON.parse(event.data);
 *     console.log('Message received:', data);
 *   },
 *   onOpen: () => console.log('Connected!'),
 * });
 *
 * // Send a message
 * send(JSON.stringify({ type: 'chat_message', message: 'Hello!' }));
 * ```
 */
export function useWebSocketWithAuth(options: UseWebSocketOptions) {
  const {
    url,
    onOpen,
    onMessage,
    onError,
    onClose,
    autoConnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const { ensureValidToken, onTokenRefresh, isTokenExpiringSoon } = useAuth();

  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs to keep track of latest values without causing re-renders
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyClosedRef = useRef(false);

  /**
   * Connect to WebSocket with a valid token
   */
  const connect = useCallback(async () => {
    try {
      // Close existing connection if any
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }

      console.log('🔐 Ensuring valid token before WebSocket connection...');

      // Ensure we have a valid token
      const validToken = await ensureValidToken();

      if (!validToken) {
        console.error('❌ Cannot connect to WebSocket: no valid token');
        return;
      }

      console.log('✅ Token validated, connecting to WebSocket...');

      // Create WebSocket connection with token in subprotocols
      const ws = new WebSocket(url, ['access_token', validToken]);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        isManuallyClosedRef.current = false;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        onMessage?.(event);
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        onError?.(error);
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        websocketRef.current = null;
        setWebsocket(null);
        onClose?.();

        // Attempt to reconnect if not manually closed
        if (!isManuallyClosedRef.current) {
          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = reconnectDelay * Math.pow(2, reconnectAttempts); // Exponential backoff
            console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})...`);

            reconnectTimerRef.current = setTimeout(() => {
              setReconnectAttempts(prev => prev + 1);
              connect();
            }, delay);
          } else {
            console.error(`❌ Max reconnection attempts (${maxReconnectAttempts}) reached`);
          }
        }
      };

      websocketRef.current = ws;
      setWebsocket(ws);

    } catch (error) {
      console.error('❌ Failed to connect to WebSocket:', error);
    }
  }, [url, ensureValidToken, onOpen, onMessage, onError, onClose, reconnectDelay, maxReconnectAttempts, reconnectAttempts]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    console.log('🔌 Manually disconnecting WebSocket...');
    isManuallyClosedRef.current = true;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
      setWebsocket(null);
      setIsConnected(false);
    }
  }, []);

  /**
   * Send a message through the WebSocket
   */
  const send = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(data);
    } else {
      console.warn('⚠️ Cannot send message: WebSocket is not connected');
    }
  }, []);

  /**
   * Subscribe to token refresh events and reconnect when token changes
   */
  useEffect(() => {
    const unsubscribe = onTokenRefresh((newAccessToken) => {
      console.log('🔄 Token refreshed, reconnecting WebSocket with new token...');

      // Reconnect with new token
      if (websocketRef.current && isConnected) {
        // Don't increment reconnect attempts for token refresh
        setReconnectAttempts(0);
        connect();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onTokenRefresh, connect, isConnected]);

  /**
   * Auto-connect on mount if enabled
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect]); // Only run on mount/unmount

  /**
   * Periodic token check to proactively refresh before expiry
   * This prevents WebSocket disconnections due to token expiry
   */
  useEffect(() => {
    if (!isConnected) return;

    const intervalId = setInterval(async () => {
      if (isTokenExpiringSoon(10)) { // Check if expiring in next 10 minutes
        console.log('⚠️ Token expiring soon, ensuring validity...');
        await ensureValidToken();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      clearInterval(intervalId);
    };
  }, [isConnected, isTokenExpiringSoon, ensureValidToken]);

  return {
    /**
     * The WebSocket instance
     */
    websocket,

    /**
     * Whether the WebSocket is currently connected
     */
    isConnected,

    /**
     * Send a message through the WebSocket
     */
    send,

    /**
     * Manually connect to the WebSocket
     */
    connect,

    /**
     * Manually disconnect from the WebSocket
     */
    disconnect,

    /**
     * Current number of reconnection attempts
     */
    reconnectAttempts,
  };
}
