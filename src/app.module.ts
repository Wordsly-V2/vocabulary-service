import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/jwt/auth.module';
import { AccessGuard } from './auth/jwt/access.guard';
import { UserScopeGuard } from './auth/jwt/user-scope.guard';
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
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestContextLogger } from './common/request-context-logger';
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
        ThrottlerModule.forRoot([
            { name: 'lookup', ttl: 60_000, limit: 60 },
            { name: 'scrape-sync', ttl: 60_000, limit: 5 },
        ]),
        AuthModule,
        CacheModule,
        CoursesModule,
        PrismaModule,
        CourseLessonWordsModule,
        MessagingModule,
        DictionaryModule,
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
        { provide: APP_GUARD, useClass: UserScopeGuard },
    ],
})
export class AppModule {}
