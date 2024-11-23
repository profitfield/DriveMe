export interface TelegramLoginData {
    id: number;            // Telegram user id
    first_name?: string;   // User's first name
    last_name?: string;    // User's last name
    username?: string;     // User's username
    photo_url?: string;    // URL of user's profile photo
    auth_date: number;     // Authentication date (unix timestamp)
    hash: string;         // Hash to verify data integrity
  }
  
  export interface TelegramAuthResponse {
    token: string;        // JWT token for future requests
    user: {
      id: string;
      telegramId: string;
      firstName?: string;
      lastName?: string;
      username?: string;
      role: 'client' | 'driver';
    };
  }