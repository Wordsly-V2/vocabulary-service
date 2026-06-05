import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { WordScopeController } from './word-scope.controller';
import { WordScopeService } from './word-scope.service';

@Module({
    imports: [PrismaModule],
    controllers: [WordScopeController],
    providers: [WordScopeService],
    exports: [WordScopeService],
})
export class WordScopeModule {}
