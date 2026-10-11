import { Global, Module } from '@nestjs/common';
import { AdminDictionarySyncModule } from '@/admin-dictionary-sync/admin-dictionary-sync.module';
import { MessagingModule } from '@/messaging/messaging.module';
import { DictionaryConsumer } from './dictionary.consumer';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';

@Global()
@Module({
    imports: [MessagingModule, AdminDictionarySyncModule],
    providers: [DictionaryService],
    exports: [DictionaryService],
    controllers: [DictionaryController, DictionaryConsumer],
})
export class DictionaryModule {}
