import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
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
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    const configService = app.get(ConfigService);
    const appPort = configService.get<number>('port');

    await app.listen(appPort as number);
    console.log(`Vocabulary Service HTTP is running on port ${appPort}`);
    console.log(
        `Swagger documentation available at http://localhost:${appPort}/api`,
    );
}

void bootstrap();
