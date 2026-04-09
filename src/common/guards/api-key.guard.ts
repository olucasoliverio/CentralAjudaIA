import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    
    const expectedKey = process.env.BACKEND_API_KEY;

    if (!expectedKey) {
      this.logger.error('CRITICAL: BACKEND_API_KEY is not set in environment variables.');
      throw new UnauthorizedException('Server configuration error');
    }

    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing API Key');
    }

    return true;
  }
}
