import { CourseLessonWordsModule } from '@/course-lesson-words/course-lesson-words.module';
import { CourseLessonsModule } from '@/course-lessons/course-lessons.module';
import { CoursesModule } from '@/courses/courses.module';
import { Module } from '@nestjs/common';
import { AdminVocabularyController } from './admin-vocabulary.controller';
import { AdminVocabularyService } from './admin-vocabulary.service';

/** Vocabulary administration under `/admin/vocabulary` (admins only). */
@Module({
    imports: [CoursesModule, CourseLessonsModule, CourseLessonWordsModule],
    controllers: [AdminVocabularyController],
    providers: [AdminVocabularyService],
})
export class AdminVocabularyModule {}
