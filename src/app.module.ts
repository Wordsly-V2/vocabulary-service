import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from './cache/cache.module';
import configuration from './config/configuration';
import { CourseLessonWordsModule } from './course-lesson-words/course-lesson-words.module';
import { CourseLessonsModule } from './course-lessons/course-lessons.module';
import { CoursesModule } from './courses/courses.module';
import { DictionaryModule } from './dictionary/dictionary.module';
import { HttpClientsModule } from './http-clients/http-clients.module';
import { PrismaModule } from './prisma/prisma.module';
import { WordScopeModule } from './word-scope/word-scope.module';
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        CacheModule,
        CoursesModule,
        PrismaModule,
        CourseLessonWordsModule,
        DictionaryModule,
        CourseLessonsModule,
        WordScopeModule,
        HttpClientsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
