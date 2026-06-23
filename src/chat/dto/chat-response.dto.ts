import { ApiProperty } from '@nestjs/swagger';

export class ChatResponseDto {
  @ApiProperty({
    description: 'The chatbot final response',
    example: 'Here are some phones I found for you...',
  })
  response: string;
}
