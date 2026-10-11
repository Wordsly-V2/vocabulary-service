import { MessagingModule } from '@/messaging/messaging.module';
import { Module } from '@nestjs/common';
import { AdminDictionarySyncController } from './admin-dictionary-sync.controller';
import { AdminDictionarySyncService } from './admin-dictionary-sync.service';

/** Admin Langeek sync runs under `/admin/vocabulary/sync` (admins only). */
@Module({
    imports: [MessagingModule],
    controllers: [AdminDictionarySyncController],
    providers: [AdminDictionarySyncService],
    exports: [AdminDictionarySyncService],
})
export class AdminDictionarySyncModule {}
