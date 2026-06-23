import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface ConversionResult {
  originalAmount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  exchangeRate: number;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Convert currency from one symbol to another using Open Exchange Rates.
   * Calculations are relative to USD as base.
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<ConversionResult> {
    const appId = this.configService.get<string>('OPEN_EXCHANGE_RATES_APP_ID');
    if (!appId) {
      this.logger.error('OPEN_EXCHANGE_RATES_APP_ID is not configured');
      throw new HttpException(
        'Currency conversion service is misconfigured. Missing App ID.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    this.logger.log(`Converting ${amount} ${from} to ${to}`);

    try {
      const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}`;
      const response = await firstValueFrom(this.httpService.get(url));

      const rates = response.data?.rates;
      if (!rates) {
        throw new Error('Failed to retrieve rates from Open Exchange Rates API.');
      }

      const rateFrom = rates[from];
      const rateTo = rates[to];

      if (rateFrom === undefined) {
        throw new HttpException(
          `Invalid or unsupported source currency: ${from}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (rateTo === undefined) {
        throw new HttpException(
          `Invalid or unsupported target currency: ${to}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Convert through base currency USD
      const exchangeRate = rateTo / rateFrom;
      const convertedAmount = amount * exchangeRate;

      return {
        originalAmount: amount,
        fromCurrency: from,
        toCurrency: to,
        convertedAmount: parseFloat(convertedAmount.toFixed(4)),
        exchangeRate: parseFloat(exchangeRate.toFixed(6)),
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error converting currency: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to convert currency: ${error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
