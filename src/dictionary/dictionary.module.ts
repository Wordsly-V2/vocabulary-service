import { Global, Module } from '@nestjs/common';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';

@Global()
@Module({
    providers: [DictionaryService],
    exports: [DictionaryService],
    controllers: [DictionaryController],
})
export class DictionaryModule {}
