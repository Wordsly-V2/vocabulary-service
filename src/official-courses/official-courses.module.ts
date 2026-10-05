import { MessagingModule } from '@/messaging/messaging.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { AdminOfficialCoursesController } from './admin-official-courses.controller';
import { OfficialCoursesController } from './official-courses.controller';
import { OfficialCoursesService } from './official-courses.service';

/**
 * Official courses: authored by admins (`/admin/vocabulary/courses`), browsed
 * and copied by learners (`/courses/official`).
 */
@Module({
    imports: [PrismaModule, MessagingModule],
    controllers: [OfficialCoursesController, AdminOfficialCoursesController],
    providers: [OfficialCoursesService],
})
export class OfficialCoursesModule {}
