import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { TelegramLoginDto, TelegramAuthResponseDto } from '../dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Authenticate user via Telegram' })
  @ApiResponse({ 
    status: 201, 
    description: 'Successfully authenticated',
    type: TelegramAuthResponseDto
  })
  async telegramLogin(
    @Body(ValidationPipe) loginData: TelegramLoginDto
  ): Promise<TelegramAuthResponseDto> {
    return this.authService.validateTelegramLogin(loginData);
  }
}