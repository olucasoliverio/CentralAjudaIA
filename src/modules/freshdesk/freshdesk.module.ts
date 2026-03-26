import { Module } from '@nestjs/common';
import { FreshdeskService } from './freshdesk.service';

@Module({
  providers: [FreshdeskService],
  exports: [FreshdeskService],
})
export class FreshdeskModule {}
