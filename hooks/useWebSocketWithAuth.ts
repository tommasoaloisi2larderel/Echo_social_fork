import { API_BASE_URL } from '@/config/api';
import { storage } from '@/utils/storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export const useWebSocketWithAuth = (endpoint: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    const token = await storage.getItemAsync('accessToken');
    
    if (!token) {
      console.warn('⚠️ Websocket: No token found');
      return;
    }

    const wsBase = API_BASE_URL.replace('http', 'ws');
    const fullUrl = `${wsBase}${endpoint}?token=${token}`;

    if (socketRef.current) {
      socketRef.current.close();
    }

    const ws = new WebSocket(fullUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log(`✅ WS Connected: ${endpoint}`);
      setIsConnected(true);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch (e) {
        console.error('WS Parse Error:', e);
      }
    };

    ws.onerror = (e) => {
      // On log l'erreur mais on ne bloque pas l'app
      console.log(`ℹ️ WS Error (${endpoint}) - connexion instable ou fermée`);
    };

    ws.onclose = () => {
      console.log(`🔌 WS Disconnected: ${endpoint}`);
      setIsConnected(false);
    };
  }, [endpoint]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.warn('⚠️ WS not ready to send message');
    }
  }, []);

  // ✅ MODIFICATION ICI : On retourne 'socket: socketRef.current'
  return { isConnected, lastMessage, sendMessage, connect, socket: socketRef.current };
};