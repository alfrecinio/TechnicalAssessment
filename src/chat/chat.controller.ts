import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an enquiry to the AI Chatbot' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The chatbot final response has been generated.',
    type: ChatResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_GATEWAY,
    description: 'An error occurred while communicating with third-party APIs (OpenAI or Open Exchange Rates).',
  })
  async chat(@Body() chatRequestDto: ChatRequestDto): Promise<ChatResponseDto> {
    const finalResponse = await this.chatService.processMessage(chatRequestDto.message);
    return { response: finalResponse };
  }
}
