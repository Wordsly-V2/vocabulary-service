import { Global, Module } from '@nestjs/common';
import { DictionaryConsumer } from './dictionary.consumer';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';

@Global()
@Module({
    providers: [DictionaryService],
    exports: [DictionaryService],
    controllers: [DictionaryController, DictionaryConsumer],
})
export class DictionaryModule {}
