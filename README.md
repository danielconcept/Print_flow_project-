# PrintFlow

Multi-tenant printing business management SaaS built with Next.js 16, TypeScript, Supabase, and Tailwind CSS.

## Features

- **Multi-tenancy** - Company-scoped data with RLS, composite FKs, and tenant isolation
- **Customers & Services** - Customer management and print service catalog
- **Quotations** - Create quotes, send for approval, convert to jobs
- **Jobs** - Production workflow with status transitions and material consumption
- **Invoices & Payments** - Invoice generation, payment allocation, void/reverse flows
- **Inventory** - Materials, recipes, stock tracking, purchase orders, goods receipts
- **Expenses** - Operating expense tracking
- **Permissions** - Role-based access control (Owner/Admin/Staff) with granular permissions
- **Audit Trail** - Comprehensive audit logging
- **PDFs** - Invoice and quotation PDF generation
- **Notifications** - In-app notifications with email (Resend) and WhatsApp hooks

## Tech Stack

- **Framework**: Next.js 16.4.2 (App Router, Turbopack)
- **Language**: TypeScript 5.9.3
- **Database**: PostgreSQL (Supabase) with RLS
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS 4.3.3
- **UI Components**: shadcn/ui
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest + PGlite
- **PDFs**: @react-pdf/renderer

## Getting Started

### Prerequisites

- Node.js >= 20.9.0
- npm 11+
- Supabase project (or use PGlite for local testing)

### Installation

```bash
npm install
cp .env.example .env.local
```

### Environment Variables

See `.env.example` for required configuration.

### Development

```bash
npm run dev
```

### Testing

```bash
npm run test          # Run all tests
npm run test:unit     # Run unit tests
npm run test:db       # Run DB/RLS tests
npm run typecheck     # Type checking
npm run lint          # Linting
```

### Database

Migrations are in `supabase/migrations/`. Validate them with:

```bash
npm run db:validate
```

Seed test data with PGlite:

```bash
npm run seed:dev
```

## Architecture

- **Multi-tenancy**: Every tenant-scoped table has `company_id` with composite foreign keys
- **Money**: All monetary values stored as integer kobo (minor units)
- **Quantities**: Stored as milli-units for precision
- **Financial operations**: All financial writes go through RPC functions
- **RLS**: Enforced at database level
- **Permissions**: Mirrored in TypeScript and SQL

## License

Private - All rights reserved
