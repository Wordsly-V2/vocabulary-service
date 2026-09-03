import { Global, Module } from '@nestjs/common';
import { MessagingModule } from '@/messaging/messaging.module';
import { DictionaryConsumer } from './dictionary.consumer';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';

@Global()
@Module({
    imports: [MessagingModule],
    providers: [DictionaryService],
    exports: [DictionaryService],
    controllers: [DictionaryController, DictionaryConsumer],
})
export class DictionaryModule {}
