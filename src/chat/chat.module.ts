import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ProductsModule } from '../products/products.module';
import { CurrencyModule } from '../currency/currency.module';

@Module({
  imports: [ProductsModule, CurrencyModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
