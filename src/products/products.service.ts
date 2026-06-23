import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { Product } from './interfaces/product.interface';

@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);
  private products: Product[] = [];

  onModuleInit() {
    this.loadProducts();
  }

  private loadProducts() {
    const csvFileName = 'FullStackTestproducts_list.csv';
    const filePath = path.join(process.cwd(), csvFileName);

    if (!fs.existsSync(filePath)) {
      this.logger.error(`Product list CSV not found at: ${filePath}`);
      return;
    }

    try {
      let fileContent = fs.readFileSync(filePath, 'utf-8');
      // Escape internal double quotes representing inches (e.g., 8", 4", 86", 75")
      // Only match if followed by a space and a letter to avoid matching closing quotes (followed by comma or newline)
      fileContent = fileContent.replace(/(\d)"(\s*[a-zA-Z])/g, '$1""$2');

      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });

      this.products = records.map((record: any) => ({
        displayTitle: record.displayTitle || '',
        embeddingText: record.embeddingText || '',
        url: record.url || '',
        imageUrl: record.imageUrl || '',
        productType: record.productType || '',
        discount: record.discount ? parseInt(record.discount, 10) : 0,
        price: record.price || '',
        variants: record.variants || '',
        createDate: record.createDate || '',
      }));

      this.logger.log(`Successfully loaded ${this.products.length} products from CSV.`);
    } catch (error: any) {
      this.logger.error('Failed to parse product list CSV', error.stack);
    }
  }

  /**
   * Search products by calculating a relevance score based on query tokens.
   * Matches tokens in displayTitle, embeddingText, and productType with different weights.
   * Returns the top 2 products with a score > 0.
   */
  searchProducts(query: string): Product[] {
    if (!query || typeof query !== 'string') {
      return [];
    }

    // Tokenize the query
    const tokens = query
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter((token) => token.length > 1);

    if (tokens.length === 0) {
      return [];
    }

    const scoredProducts = this.products.map((product) => {
      let score = 0;
      const titleLower = (product.displayTitle || '').toLowerCase();
      const embeddingLower = (product.embeddingText || '').toLowerCase();
      const typeLower = (product.productType || '').toLowerCase();

      tokens.forEach((token) => {
        // Title match has highest weight
        if (titleLower.includes(token)) {
          score += 3;
        }
        // Product type has medium weight
        if (typeLower.includes(token)) {
          score += 2;
        }
        // Embedding text (contextual info) has base weight
        if (embeddingLower.includes(token)) {
          score += 1;
        }
      });

      return { product, score };
    });

    // Filter out products with 0 score, sort descending by score
    const filtered = scoredProducts
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    // Return the top 2 results
    const results = filtered.slice(0, 2).map((item) => item.product);

    this.logger.log(`Search query "${query}" matched ${filtered.length} products. Returning top ${results.length}.`);
    return results;
  }
}
