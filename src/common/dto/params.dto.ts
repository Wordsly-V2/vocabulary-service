import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class UserLoginIdParamDto {
    @ApiProperty({
        description: 'User login ID',
        example: 'user123',
    })
    @IsString()
    @IsNotEmpty()
    userLoginId: string;
}

export class CourseIdParamDto {
    @ApiProperty({
        description: 'Course ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    @IsUUID()
    courseId: string;
}

export class LessonIdParamDto {
    @ApiProperty({
        description: 'Lesson ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    @IsUUID()
    lessonId: string;
}

export class WordIdParamDto {
    @ApiProperty({
        description: 'Word ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    @IsUUID()
    wordId: string;
}

export class CourseAndUserParamsDto extends UserLoginIdParamDto {
    @ApiProperty({
        description: 'Course ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    @IsUUID()
    courseId: string;
}

export class LessonParamsDto extends CourseAndUserParamsDto {
    @ApiProperty({
        description: 'Lesson ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    @IsUUID()
    lessonId: string;
}

export class WordParamsDto extends LessonParamsDto {
    @ApiProperty({
        description: 'Word ID',
        example: '01936c1e-1234-7890-abcd-ef1234567890',
    })
    @IsUUID()
    wordId: string;
}
