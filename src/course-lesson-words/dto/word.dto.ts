import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateWordDto {
    @IsString()
    @IsNotEmpty()
    word: string;

    @IsString()
    @IsNotEmpty()
    meaning: string;

    @IsOptional()
    @IsString()
    pronunciation?: string;

    @IsOptional()
    @IsString()
    partOfSpeech?: string;

    @IsOptional()
    @IsString()
    audioUrl?: string;
}

export class UpdateWordDto {
    @IsOptional()
    @IsString()
    word?: string;

    @IsOptional()
    @IsString()
    meaning?: string;

    @IsOptional()
    @IsString()
    pronunciation?: string;

    @IsOptional()
    @IsString()
    partOfSpeech?: string;

    @IsOptional()
    @IsString()
    audioUrl?: string;
}

export class BulkCreateWordsDto {
    @IsArray()
    words: CreateWordDto[];
}

export class MoveWordDto {
    @IsString()
    @IsNotEmpty()
    targetLessonId: string;
}

export class BulkMoveWordsDto {
    @IsArray()
    @IsNotEmpty()
    wordIds: string[];

    @IsString()
    @IsNotEmpty()
    targetLessonId: string;
}

export class BulkDeleteWordsDto {
    @IsArray()
    @IsNotEmpty()
    wordIds: string[];
}
