export interface WebSocketMessage {
    channel: string;
    event: string;
    data: any;
    timestamp: number;
  }
  
  export interface WebSocketClient {
    id: string;
    userId: string;
    userType: 'client' | 'driver' | 'admin';
    connectedAt: Date;
    lastActivity: Date;
  }
  
  export interface WebSocketRoom {
    id: string;
    type: 'chat' | 'order' | 'location';
    participants: string[];
    createdAt: Date;
  }
  
  export enum WebSocketEvent {
    // Чат
    CHAT_MESSAGE = 'chat_message',
    CHAT_TYPING = 'chat_typing',
    
    // Заказы
    ORDER_STATUS = 'order_status',
    ORDER_LOCATION = 'order_location',
    
    // Система
    CONNECTION = 'connection',
    DISCONNECT = 'disconnect',
    ERROR = 'error'
  }