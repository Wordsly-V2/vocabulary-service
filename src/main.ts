import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Transport } from '@nestjs/microservices';
import { buildCorsOptions, parseCorsOrigins } from '@/config/cors';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);
    const corsEnabledOrigins = configService.get<string>('corsEnabledOrigins');

    const corsOptions = buildCorsOptions(corsEnabledOrigins);
    if (corsOptions) {
        app.enableCors(corsOptions);
    }

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
    console.log(`Vocabulary Service HTTP is running on port ${appPort}`);
    console.log(
        `CORS enabled origins: ${parseCorsOrigins(corsEnabledOrigins).join(', ') || 'none'}`,
    );
    console.log(
        `Swagger documentation available at http://localhost:${appPort}/api`,
    );
}

void bootstrap();
