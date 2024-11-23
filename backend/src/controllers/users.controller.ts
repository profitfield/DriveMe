import { Controller, Post, Body, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { User } from '../entities/user.entity';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  async createUser(
    @Body('telegramId') telegramId: string,
    @Body('username') username?: string,
    @Body('firstName') firstName?: string,
    @Body('lastName') lastName?: string,
  ) {
    return this.usersService.create({
      telegramId,
      username,
      firstName,
      lastName
    });
  }

  @Get(':telegramId')
  @ApiOperation({ summary: 'Find user by Telegram ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findByTelegramId(@Param('telegramId') telegramId: string) {
    const user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Find user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}