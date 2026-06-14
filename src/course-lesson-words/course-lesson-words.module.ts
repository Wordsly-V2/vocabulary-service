import { Module } from '@nestjs/common';
import { CourseLessonWordsController } from './course-lesson-words.controller';
import { CourseLessonWordsService } from './course-lesson-words.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { DictionaryModule } from '@/dictionary/dictionary.module';
import { MessagingModule } from '@/messaging/messaging.module';

@Module({
    imports: [PrismaModule, DictionaryModule, MessagingModule],
    controllers: [CourseLessonWordsController],
    providers: [CourseLessonWordsService],
    exports: [CourseLessonWordsService],
})
export class CourseLessonWordsModule {}
