import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/jwt/auth.module';
import { AccessGuard } from './auth/jwt/access.guard';
import { UserScopeGuard } from './auth/jwt/user-scope.guard';
import { RolesGuard } from './auth/jwt/roles.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from './cache/cache.module';
import configuration from './config/configuration';
import { validateEnv } from './config/validate-env';
import { CourseLessonWordsModule } from './course-lesson-words/course-lesson-words.module';
import { CourseLessonsModule } from './course-lessons/course-lessons.module';
import { CoursesModule } from './courses/courses.module';
import { DictionaryModule } from './dictionary/dictionary.module';
import { HttpClientsModule } from './http-clients/http-clients.module';
import { MessagingModule } from './messaging/messaging.module';
import { PrismaModule } from './prisma/prisma.module';
import { WordScopeModule } from './word-scope/word-scope.module';
import { HealthModule } from './health/health.module';
import { UserDataModule } from './user-data/user-data.module';
import { AdminVocabularyModule } from './admin-vocabulary/admin-vocabulary.module';
import { AdminDictionarySyncModule } from './admin-dictionary-sync/admin-dictionary-sync.module';
import { OfficialCoursesModule } from './official-courses/official-courses.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestContextLogger } from './common/request-context-logger';
import { THROTTLERS } from './common/throttler/throttlers';
@Module({
    imports: [
        HealthModule,
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            validate: validateEnv,
        }),
        // Limits for the dictionary endpoints, which reach external sites
        // (Langeek/Cambridge) on the caller's behalf and are the one place here
        // where a single user can generate heavy outbound traffic. Applied per
        // controller, not globally — see UserThrottlerGuard for the keying.
        ThrottlerModule.forRoot(THROTTLERS),
        AuthModule,
        CacheModule,
        // Before CoursesModule: its `GET /courses/:courseId` would otherwise
        // claim `/courses/official` (and answer 400, not a UUID).
        OfficialCoursesModule,
        CoursesModule,
        PrismaModule,
        CourseLessonWordsModule,
        MessagingModule,
        DictionaryModule,
        UserDataModule,
        AdminVocabularyModule,
        AdminDictionarySyncModule,
        CourseLessonsModule,
        WordScopeModule,
        HttpClientsModule,
    ],
    controllers: [AppController],
    providers: [
        RequestContextLogger,
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        AppService,
        // Registering globally makes the service deny-by-default, so a
        // controller that forgets a decorator fails closed rather than being
        // reachable by anyone who can route to it. AccessGuard establishes who
        // the caller is; UserScopeGuard makes sure the request did not try to
        // name someone else.
        { provide: APP_GUARD, useClass: AccessGuard },
        // Must stay right after AccessGuard: it reads the roles AccessGuard
        // attached from the verified token.
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: UserScopeGuard },
    ],
})
export class AppModule {}
