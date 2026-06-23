import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ProductsService } from '../products/products.service';
import { CurrencyService } from '../currency/currency.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly productsService: ProductsService,
    private readonly currencyService: CurrencyService,
  ) {}

  /**
   * Main orchestration pipeline for Chat completions and OpenAI Function Calling.
   */
  async processMessage(userMessage: string): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new HttpException(
        'Chat service is misconfigured. Missing OpenAI API Key.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!this.openai) {
      this.openai = new OpenAI({ apiKey });
    }

    try {
      this.logger.log(`Starting Chat Completion workflow for user message: "${userMessage}"`);

      const systemMessage = `You are Wizybot Customer Support and Sales Agent. You are helpful, polite, and answer in natural language.
You have access to 2 tools to answer user inquiries:
1. searchProducts(query) to find products related to user query from the database catalog. It returns the top 2 matching products.
2. convertCurrencies(amount, fromCurrency, toCurrency) to convert amounts between currencies using real-time exchange rates.

When searching for products, use relevant keywords from the customer's enquiry.
When converting currencies, convert the values accurately.
Always provide the response back in the user's input language. If they ask in English, answer in English. If they ask in Spanish, answer in Spanish.
Ensure to present product search results nicely, including their displayTitle, price, URL, and imageUrl if available.

CRITICAL: If answering the user's query requires executing multiple tools or a sequence of tools (e.g. first searching for a product to find its price, then converting that price to another currency), you MUST execute all those tool calls sequentially. Do NOT output any conversational text, filler messages, or explanations (like "Now, I will convert the price...") until you have finished executing ALL necessary tool calls and received their results. Generate ONLY tool calls until the process is complete, and then output your final conversational response combining all details.`;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ];

      const tools: OpenAI.Chat.ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: 'searchProducts',
            description: 'Search for products in the catalog that match the customer\'s enquiry. Returns the top 2 most relevant products with their pricing. Note that some prices might be range strings (e.g., "350.0 - 365.0 USD").',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query based on the customer\'s enquiry (e.g. "phone", "present for my dad", "watch")'
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'convertCurrencies',
            description: 'Convert a price or amount from one currency to another using the latest exchange rates. Currency codes must be in ISO 4217 format (e.g. USD, EUR, CAD, COP). If a product price is a range (e.g., 350.0 - 365.0), you must make separate tool calls for each boundary number.',
            parameters: {
              type: 'object',
              properties: {
                amount: {
                  type: 'number',
                  description: 'The numeric amount/price to convert (e.g., 350 or 365)'
                },
                fromCurrency: {
                  type: 'string',
                  description: 'The ISO 4217 code of the original currency (e.g., USD, EUR)'
                },
                toCurrency: {
                  type: 'string',
                  description: 'The ISO 4217 code of the target currency (e.g., EUR, CAD, COP)'
                }
              },
              required: ['amount', 'fromCurrency', 'toCurrency']
            }
          }
        }
      ];

      // Step 1: First call to OpenAI to determine if tool calling is needed
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto'
      });

      let responseMessage = response.choices[0].message;
      let runCount = 0;
      const maxRuns = 5;

      while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0 && runCount < maxRuns) {
        runCount++;
        messages.push(responseMessage);

        const toolCalls = responseMessage.tool_calls;
        
        for (const toolCall of toolCalls) {
          const toolCallAny = toolCall as any;
          const functionName = toolCallAny.function?.name;
          const functionArgs = toolCallAny.function?.arguments
            ? JSON.parse(toolCallAny.function.arguments)
            : {};

          this.logger.log(`[Run ${runCount}] LLM decided to call tool: ${functionName} with args: ${JSON.stringify(functionArgs)}`);

          let functionResult: string;

          if (functionName === 'searchProducts') {
            const products = this.productsService.searchProducts(functionArgs.query);
            functionResult = JSON.stringify(products);
          } else if (functionName === 'convertCurrencies') {
            const conversion = await this.currencyService.convertCurrency(
              functionArgs.amount,
              functionArgs.fromCurrency,
              functionArgs.toCurrency
            );
            functionResult = JSON.stringify(conversion);
          } else {
            functionResult = JSON.stringify({ error: `Tool ${functionName} not found.` });
          }

          this.logger.log(`Tool result: ${functionResult}`);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: functionResult
          });
        }

        // Get the next response from OpenAI (which could be another tool call or the final response)
        const nextResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          tools,
          tool_choice: 'auto'
        });
        responseMessage = nextResponse.choices[0].message;
        this.logger.log(`Received OpenAI response content: "${responseMessage.content}" with ${responseMessage.tool_calls?.length || 0} tool calls.`);
      }

      this.logger.log(`Finished completions flow after ${runCount} tool execution runs. Final content: "${responseMessage.content}"`);
      return responseMessage.content || 'I am not sure how to assist you.';
    } catch (error: any) {
      this.logger.error(`Error in Chat Completions flow: ${error.message}`, error.stack);
      throw new HttpException(
        `Failed to get response from AI assistant: ${error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
