import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class GetPronunciationParamDto {
    @ApiProperty({
        description: 'Word to get pronunciation for',
        example: 'hello',
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[a-zA-Z\s'-]+$/, {
        message:
            'Word must contain only letters, spaces, hyphens, and apostrophes',
    })
    word: string;
}
