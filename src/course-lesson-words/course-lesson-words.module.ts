import { Module } from '@nestjs/common';
import { CourseLessonWordsController } from './course-lesson-words.controller';
import { CourseLessonWordsService } from './course-lesson-words.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { DictionaryModule } from '@/dictionary/dictionary.module';

@Module({
    imports: [PrismaModule, DictionaryModule],
    controllers: [CourseLessonWordsController],
    providers: [CourseLessonWordsService],
    exports: [CourseLessonWordsService],
})
export class CourseLessonWordsModule {}
