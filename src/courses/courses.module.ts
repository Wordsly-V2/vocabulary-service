import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { WordProgressModule } from '@/word-progress/word-progress.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
    imports: [PrismaModule, WordProgressModule],
    controllers: [CoursesController],
    providers: [CoursesService],
})
export class CoursesModule {}
