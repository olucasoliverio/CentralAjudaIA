import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { SyncService } from '../../../modules/queue/sync.service';

@Controller('api/sync-articles')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async sync() {
    this.syncService.syncAllArticles().catch((e) => console.error(e));
    return { message: 'Sync process started in background.' };
  }
}
