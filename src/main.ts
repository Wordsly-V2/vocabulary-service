import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Transport } from '@nestjs/microservices';
import { buildCorsOptions, parseCorsOrigins } from '@/config/cors';
import helmet from 'helmet';
import { requestIdMiddleware } from '@/common/request-id.middleware';
import { RequestContextLogger } from '@/common/request-context-logger';

const bootLogger = new Logger('Bootstrap');

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useLogger(app.get(RequestContextLogger));

    // First, so every later middleware, guard and handler runs inside
    // the store and logs the same id the caller was given back.
    app.use(requestIdMiddleware);

    // Baseline security headers. CSP is off because this service serves the
    // Swagger UI at /api, whose inline bootstrap script the default policy
    // blocks — leaving the docs page blank. Every response here is JSON or that
    // docs page, so there is no HTML injection surface for CSP to protect.
    app.use(helmet({ contentSecurityPolicy: false }));

    const configService = app.get(ConfigService);
    const corsEnabledOrigins = configService.get<string>('corsEnabledOrigins');

    app.enableCors(buildCorsOptions(corsEnabledOrigins));

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            transformOptions: {
                enableImplicitConversion: true,
            },
        }),
    );

    // Swagger configuration
    const config = new DocumentBuilder()
        .setTitle('Vocabulary Service API')
        .setDescription('API documentation for the Vocabulary Service')
        .setVersion('1.0')
        .addTag('health', 'Health check endpoints')
        .addTag('courses', 'Course management endpoints')
        .addTag('lessons', 'Lesson management endpoints')
        .addTag('words', 'Word management endpoints')
        .addTag('dictionary', 'Dictionary lookup endpoints')
        .addTag('words', 'Word scope endpoints for learning-service')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    const appPort = configService.get<number>('port');

    const brokers = configService.get<string>('kafka.brokers') ?? '';
    const ca = configService.get<string>('kafka.ca') ?? '';
    const cert = configService.get<string>('kafka.cert') ?? '';
    const key = configService.get<string>('kafka.key') ?? '';

    const brokerList = brokers.split(',').filter(Boolean);

    // TLS only when there is material to do it with. A managed broker supplies
    // CA/cert/key and is verified exactly as before; a plaintext broker (the one
    // in docker-compose, for local dev) supplies none, and asking for TLS anyway
    // just failed the handshake and took the whole process down with an
    // unhandled rejection.
    const kafkaSsl =
        ca || cert || key ? { rejectUnauthorized: true, ca, cert, key } : false;

    // Kafka is optional in dev, and this is what makes that true: with no
    // brokers configured the microservice is never connected, so the service
    // still serves HTTP. Connecting unconditionally meant an empty or
    // unreachable KAFKA_BROKERS crashed the process on an unhandled rejection
    // before `listen()` — the HTTP API was collateral damage from a dependency
    // it does not need in order to answer a request. learning-service has
    // always guarded this; vocabulary-service had not.
    if (brokerList.length > 0) {
        app.connectMicroservice({
            transport: Transport.KAFKA,
            options: {
                clientId: 'vocabulary-service-client',
                client: {
                    brokers: brokerList,
                    ssl: kafkaSsl,
                },
                consumer: {
                    groupId: 'vocabulary-service-consumer',
                },
                run: {
                    autoCommit: false,
                },
            },
        });
    }

    await app.startAllMicroservices();
    await app.listen(appPort as number);
    bootLogger.log(`Vocabulary Service HTTP is running on port ${appPort}`);
    bootLogger.log(
        `CORS enabled origins: ${parseCorsOrigins(corsEnabledOrigins).join(', ') || 'none'}`,
    );
    bootLogger.log(
        `Swagger documentation available at http://localhost:${appPort}/api`,
    );
}

void bootstrap();
