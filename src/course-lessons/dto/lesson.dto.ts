import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLessonDto {
    @ApiProperty({
        description: 'Name of the lesson',
        example: 'Basic Greetings',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({
        description: 'URL of the lesson cover image',
        example: 'https://example.com/images/lesson-cover.jpg',
    })
    @IsOptional()
    @IsString()
    coverImageUrl?: string;

    @ApiPropertyOptional({
        description: 'Maximum number of words in the lesson',
        example: 50,
    })
    @IsOptional()
    @IsNumber()
    maxWords?: number;

    @ApiPropertyOptional({
        description: 'Order index for sorting lessons',
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    orderIndex?: number;
}

export class UpdateLessonDto {
    @ApiPropertyOptional({
        description: 'Name of the lesson',
        example: 'Basic Greetings',
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({
        description: 'URL of the lesson cover image',
        example: 'https://example.com/images/lesson-cover.jpg',
    })
    @IsOptional()
    @IsString()
    coverImageUrl?: string;

    @ApiPropertyOptional({
        description: 'Maximum number of words in the lesson',
        example: 50,
    })
    @IsOptional()
    @IsNumber()
    maxWords?: number;

    @ApiPropertyOptional({
        description: 'Order index for sorting lessons',
        example: 1,
    })
    @IsOptional()
    @IsNumber()
    orderIndex?: number;
}
