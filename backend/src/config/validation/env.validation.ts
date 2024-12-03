import { plainToClass, Transform } from 'class-transformer';
import { IsString, IsNumber, IsEnum, validateSync, IsOptional, IsEmail, IsUrl } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @Transform(({ value }) => value.toLowerCase())
  NODE_ENV: Environment;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  PORT: number;

  @IsString()
  HOST: string;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  DB_PORT: number;

  @IsString()
  DB_NAME: string;

  @IsString()
  DB_USER: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string;

  @IsEmail()
  @IsOptional()
  ADMIN_EMAIL?: string;

  @IsString()
  @IsOptional()
  ADMIN_PASSWORD?: string;

  @IsString()
  TELEGRAM_BOT_TOKEN: string;

  @IsString()
  TELEGRAM_BOT_NAME: string;

  @IsUrl()
  @IsOptional()
  TELEGRAM_WEBHOOK_URL?: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  COMMISSION_RATE: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  PREMIUM_FIRST_HOUR: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  PREMIUM_MINUTE_RATE: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  PREMIUM_AIRPORT_SVO: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  PREMIUM_AIRPORT_DME: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  PREMIUM_AIRPORT_VKO: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  ELITE_FIRST_HOUR: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  ELITE_MINUTE_RATE: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  ELITE_AIRPORT_SVO: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  ELITE_AIRPORT_DME: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  ELITE_AIRPORT_VKO: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  DISCOUNT_2_HOURS: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  DISCOUNT_4_HOURS: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  DISCOUNT_6_HOURS: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  DISCOUNT_8_HOURS: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  DISCOUNT_10_HOURS: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  DISCOUNT_12_HOURS: number;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  @IsOptional()
  RATE_LIMIT_WINDOW?: number;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  @IsOptional()
  RATE_LIMIT_MAX_REQUESTS?: number;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @Transform(({ value }) => Number(value))
  @IsOptional()
  REDIS_PORT?: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
    excludeExtraneousValues: false,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(error => {
      const constraints = Object.values(error.constraints || {});
      return `${error.property}: ${constraints.join(', ')}`;
    });
    
    throw new Error(
      'Ошибка валидации конфигурации:\n' + errorMessages.join('\n')
    );
  }

  return validatedConfig;
}