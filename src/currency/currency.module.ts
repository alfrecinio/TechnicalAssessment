import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CurrencyService } from './currency.service';

@Module({
  imports: [HttpModule],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
