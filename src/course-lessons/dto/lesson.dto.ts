import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateLessonDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    coverImageUrl?: string;

    @IsOptional()
    @IsNumber()
    maxWords?: number;

    @IsOptional()
    @IsNumber()
    orderIndex?: number;
}

export class UpdateLessonDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    coverImageUrl?: string;

    @IsOptional()
    @IsNumber()
    maxWords?: number;

    @IsOptional()
    @IsNumber()
    orderIndex?: number;
}
