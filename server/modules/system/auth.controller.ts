import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @Post('change-password')
  async changePassword(@Body() body: { oldPassword: string; newPassword: string; username?: string }) {
    return this.authService.changePassword(body.oldPassword, body.newPassword, body.username);
  }
}
