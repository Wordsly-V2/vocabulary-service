import { AppModule } from '@/app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
        }),
    );

    const configService = app.get(ConfigService);
    const appPort = configService.get<number>('port');

    await app.listen(appPort as number);
    console.log(`Vocabulary Service HTTP is running on port ${appPort}`);
}

void bootstrap();
