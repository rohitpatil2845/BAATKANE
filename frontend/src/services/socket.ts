import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io(WS_URL, {
      auth: { token },
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  joinChat(chatId: string) {
    this.emit('join_chat', { chatId });
  }

  sendMessage(data: {
    chatId: string;
    content: string;
    type?: string;
    replyTo?: string;
  }) {
    this.emit('send_message', data);
  }

  typing(chatId: string, isTyping: boolean) {
    this.emit('typing', { chatId, isTyping });
  }

  markRead(messageId: string, chatId: string) {
    this.emit('mark_read', { messageId, chatId });
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export default new SocketService();
