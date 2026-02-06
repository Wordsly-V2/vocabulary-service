import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { CoursesModule } from './courses/courses.module';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { CourseLessonWordsModule } from './course-lesson-words/course-lesson-words.module';
import { DictionaryModule } from './dictionary/dictionary.module';
import { CourseLessonsModule } from './course-lessons/course-lessons.module';
import { WordsModule } from './words/words.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        CoursesModule,
        PrismaModule,
        CourseLessonWordsModule,
        DictionaryModule,
        CourseLessonsModule,
        WordsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
