import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, IsEnum, validateSync, IsOptional } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  // Server
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  HOST: string;

  // Database
  @IsString()
  DB_HOST: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  DB_NAME: string;

  @IsString()
  DB_USER: string;

  @IsString()
  DB_PASSWORD: string;

  // JWT Auth
  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string;

  // Telegram
  @IsString()
  TELEGRAM_BOT_TOKEN: string;

  @IsString()
  TELEGRAM_BOT_NAME: string;

  // Commission
  @IsNumber()
  COMMISSION_RATE: number;

  // Premium & Premium Large Prices
  @IsNumber()
  PREMIUM_FIRST_HOUR: number;

  @IsNumber()
  PREMIUM_MINUTE_RATE: number;

  @IsNumber()
  PREMIUM_AIRPORT_SVO: number;

  @IsNumber()
  PREMIUM_AIRPORT_DME: number;

  @IsNumber()
  PREMIUM_AIRPORT_VKO: number;

  // Elite Prices
  @IsNumber()
  ELITE_FIRST_HOUR: number;

  @IsNumber()
  ELITE_MINUTE_RATE: number;

  @IsNumber()
  ELITE_AIRPORT_SVO: number;

  @IsNumber()
  ELITE_AIRPORT_DME: number;

  @IsNumber()
  ELITE_AIRPORT_VKO: number;

  // Hourly discounts
  @IsNumber()
  DISCOUNT_2_HOURS: number;

  @IsNumber()
  DISCOUNT_4_HOURS: number;

  @IsNumber()
  DISCOUNT_6_HOURS: number;

  @IsNumber()
  DISCOUNT_8_HOURS: number;

  @IsNumber()
  DISCOUNT_10_HOURS: number;

  @IsNumber()
  DISCOUNT_12_HOURS: number;

  // Security
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_WINDOW?: number;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX_REQUESTS?: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(
    EnvironmentVariables,
    {
      // Server
      NODE_ENV: process.env.NODE_ENV,
      PORT: parseInt(process.env.PORT, 10),
      HOST: process.env.HOST,

      // Database
      DB_HOST: process.env.DB_HOST,
      DB_PORT: parseInt(process.env.DB_PORT, 10),
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,

      // JWT
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,

      // Telegram
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_BOT_NAME: process.env.TELEGRAM_BOT_NAME,

      // Commission
      COMMISSION_RATE: parseFloat(process.env.COMMISSION_RATE),

      // Premium & Premium Large Prices
      PREMIUM_FIRST_HOUR: parseInt(process.env.PREMIUM_FIRST_HOUR, 10),
      PREMIUM_MINUTE_RATE: parseInt(process.env.PREMIUM_MINUTE_RATE, 10),
      PREMIUM_AIRPORT_SVO: parseInt(process.env.PREMIUM_AIRPORT_SVO, 10),
      PREMIUM_AIRPORT_DME: parseInt(process.env.PREMIUM_AIRPORT_DME, 10),
      PREMIUM_AIRPORT_VKO: parseInt(process.env.PREMIUM_AIRPORT_VKO, 10),

      // Elite Prices
      ELITE_FIRST_HOUR: parseInt(process.env.ELITE_FIRST_HOUR, 10),
      ELITE_MINUTE_RATE: parseInt(process.env.ELITE_MINUTE_RATE, 10),
      ELITE_AIRPORT_SVO: parseInt(process.env.ELITE_AIRPORT_SVO, 10),
      ELITE_AIRPORT_DME: parseInt(process.env.ELITE_AIRPORT_DME, 10),
      ELITE_AIRPORT_VKO: parseInt(process.env.ELITE_AIRPORT_VKO, 10),

      // Hourly discounts
      DISCOUNT_2_HOURS: parseInt(process.env.DISCOUNT_2_HOURS, 10),
      DISCOUNT_4_HOURS: parseInt(process.env.DISCOUNT_4_HOURS, 10),
      DISCOUNT_6_HOURS: parseInt(process.env.DISCOUNT_6_HOURS, 10),
      DISCOUNT_8_HOURS: parseInt(process.env.DISCOUNT_8_HOURS, 10),
      DISCOUNT_10_HOURS: parseInt(process.env.DISCOUNT_10_HOURS, 10),
      DISCOUNT_12_HOURS: parseInt(process.env.DISCOUNT_12_HOURS, 10),

      // Security
      CORS_ORIGINS: process.env.CORS_ORIGINS,
      RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW, 10),
      RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10),
    },
    { enableImplicitConversion: true },
  );

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Configuration validation error: ${errors.map(error => 
      Object.values(error.constraints).join(', ')
    ).join('; ')}`);
  }
  return validatedConfig;
}