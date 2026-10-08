# Transactions Dashboard

An interactive Next.js dashboard for exploring transactions, category averages, and household planning. It includes Mesa analysis, Plan and Forecast simulations, and responsive charts and tables.

## Features

- **🔐 Secure Authentication**: NextAuth.js with credentials-based login for 2 users
- **📊 Category Analysis**: Select a category to inspect its recorded transactions and averages
- **📅 Date Range Filtering**: Custom date picker with "Last Month" and "Last Statement" presets
- **🔄 Dynamic Table Sorting**: Sort by amount, date, place, or category with visual indicators
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **🎨 Smooth Animations**: Framer Motion animations for enhanced user experience
- **🔌 API Integration**: Fetches data from external API with secure credential management

## Tech Stack

- **Next.js 15** - React framework with App Router
- **NextAuth.js** - Authentication and session management
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Interactive chart library
- **Framer Motion** - Animation library
- **Lucide React** - Icon library

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd transactions-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Create environment variables:
```bash
cp .env.local.example .env.local
```

4. Update the environment variables in `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://api.norberto.work/transactions
API_KEY=your-api-key-here
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Interactive Features

1. **Category Selection**: Click on any segment of the pie chart to filter transactions by category
2. **Reset View**: Use the "Reset" button to return to the overview
3. **Detailed Statistics**: When a category is selected, view detailed breakdown including:
   - Total amount spent
   - Number of transactions
   - Percentage of total spending
   - Average transaction amount

### Data Format

The application expects transaction data in the following format:

```json
{
  "id": 64,
  "place": "APPLECOMBILL",
  "amount": "NZ$4.99",
  "date": "16/09/2025",
  "currency": "NZ$",
  "value": 4.99,
  "date_iso": "2025-09-16",
  "category": "Others",
  "subcategory": "Miscellaneous"
}
```

## API Integration

The application uses the live API for transaction data:

- **Live Data**: Configure API credentials in `.env.local`
- **Unavailable API**: The dashboard displays its unavailable or error state; it does not fall back to `data.json`

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run ESLint code analysis

### Code Structure

```
src/
├── app/
│   ├── api/transactions/     # API routes
│   └── page.tsx             # Main dashboard page
├── components/
│   ├── PieChart.tsx         # Interactive pie chart component
│   └── TransactionsTable.tsx # Filterable transactions table
├── hooks/
│   └── useTransactions.ts   # Data fetching and processing hooks
├── services/
│   └── api.ts              # API service layer
└── types/
    └── transaction.ts      # TypeScript type definitions
```

## Security

- Environment variables are properly configured and excluded from version control
- API keys are securely stored in `.env.local`
- No sensitive data is exposed to the client-side

## Performance

- Server-side data fetching with fallback mechanisms
- Optimized re-renders with React hooks
- Responsive animations that don't block the UI
- Efficient data processing and filtering

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License.
