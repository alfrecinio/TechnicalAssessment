# Wizybot Chatbot API

An API endpoint using **NestJS + TypeScript** that allows communication with an AI chatbot representing Wizybot's Support and Sales Agent. The chatbot leverages the **OpenAI Chat Completion API with Function Calling** to dynamically utilize two tools: product search in a catalog and currency conversion using live exchange rates.

---

## Architecture & Features

1. **AI Chatbot with Sequential Function Calling**:
   - Built using the official `openai` SDK (`gpt-4o-mini`).
   - Implements an **iterative tool resolution loop** (up to 5 runs) to support sequential tool calls in a single user query. For example, when a user asks: *"What is the price of the watch in Euros?"*, the chatbot:
     1. Calls `searchProducts("watch")` to find the watch catalog entries.
     2. Calls `convertCurrencies(amount, from, to)` for each boundary price of the matched watches.
     3. Formulates a final, natural language response with the converted prices.
   - Initialized lazily during the first request to prevent application boot-up crashes in environments lacking active API keys.

2. **Relevance Product Search (`ProductsModule`)**:
   - Loads the catalog from `FullStackTestproducts_list.csv` into memory during module initialization (`onModuleInit`).
   - Implements a **robust pre-processing regex pattern** (`/(\d)"(\s*[a-zA-Z])/g` -> `""`) to resolve unescaped double quotes (e.g. `8"`, `4"`, `86"`, `75"`) representing dimensions inside the catalog, ensuring 100% parsing reliability.
   - Calculates relevance scores for user queries matching terms inside `displayTitle` (3x weight), `productType` (2x weight), and `embeddingText` (1x weight), returning the top 2 matching products.

3. **Live Currency Conversions (`CurrencyModule`)**:
   - Integrates with the **Open Exchange Rates API** using NestJS `HttpModule`.
   - Computes cross-currency rates using USD as the base currency, allowing conversions between any combination of ISO 4217 symbols (e.g., EUR to CAD, GBP to COP).

4. **Self-Documenting API**:
   - Integrates **Swagger UI** under `/api` for immediate interactive testing of the API.
   - Applies global validation middleware (`ValidationPipe`) to validate incoming payloads.

---

## Technical Stack
- **Framework**: NestJS (v11)
- **Language**: TypeScript
- **APIs Integrated**: OpenAI (Chat Completions + Function Calling) & Open Exchange Rates (Rates API)
- **Validation**: `class-validator` & `class-transformer`
- **Documentation**: Swagger (`@nestjs/swagger`)

---

## Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` (packaged manager)

### 2. Configuration
Create a `.env` file in the root directory by copying the template:
```bash
cp .env.example .env
```
Open the `.env` file and configure your API credentials:
```env
OPENAI_API_KEY=your_openai_api_key_here
OPEN_EXCHANGE_RATES_APP_ID=your_open_exchange_rates_app_id_here
```
> **Note**: Your OpenAI account must have a credit balance (minimum $5.00 USD) for API keys to operate successfully.

### 3. Installation
Install project dependencies:
```bash
npm install
```

### 4. Running the App

```bash
# development mode (with watch reload)
npm run start:dev

# production mode
npm run start:prod
```

Once running, you can access:
- **API Server**: `http://localhost:3000`
- **Swagger Documentation**: [http://localhost:3000/api](http://localhost:3000/api)
- **Swagger Spec (JSON)**: `http://localhost:3000/api-json`

---

## API Documentation

### POST `/chat`
Sends a user enquiry to the chatbot.

- **Headers**:
  `Content-Type: application/json`

- **Request Body**:
  ```json
  {
    "message": "What is the price of the watch in Euros"
  }
  ```

- **Response Body (200 OK)**:
  ```json
  {
    "response": "Here are the watches available, along with their converted prices in Euros..."
  }
  ```

---

## Manual Verification Examples

You can test the running API from your terminal using PowerShell or cURL:

#### Product Search Test:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/chat -Method Post -Body '{"message": "I am looking for a phone"}' -ContentType 'application/json'
```

#### Currency Conversion Test:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/chat -Method Post -Body '{"message": "How many Canadian Dollars are 350 Euros"}' -ContentType 'application/json'
```

#### Sequential Search + Conversion Test:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/chat -Method Post -Body '{"message": "What is the price of the watch in Euros"}' -ContentType 'application/json'
```
