import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: 'The user enquiry message',
    example: 'I am looking for a phone',
  })
  message: string;
}
