import { Module } from '@nestjs/common';
import { CourseLessonWordsModule } from '@/course-lesson-words/course-lesson-words.module';
import { MessagingModule } from '@/messaging/messaging.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
    imports: [PrismaModule, CourseLessonWordsModule, MessagingModule],
    controllers: [CoursesController],
    providers: [CoursesService],
})
export class CoursesModule {}
