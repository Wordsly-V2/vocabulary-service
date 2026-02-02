import {
  IsString,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCourse {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}

export class CreateManyCourses {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCourse)
  courses: CreateCourse[];
}
