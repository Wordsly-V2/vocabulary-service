import { Module } from '@nestjs/common';
import { CourseLessonsController } from './course-lessons.controller';
import { CourseLessonsService } from './course-lessons.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [CourseLessonsController],
    providers: [CourseLessonsService],
    exports: [CourseLessonsService],
})
export class CourseLessonsModule {}
