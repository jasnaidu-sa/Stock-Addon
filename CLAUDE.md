# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start Vite dev server on port 5173
npm run build        # Production build for deployment
npm run preview      # Preview production build locally

# Code Quality
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint code linting
```

## Development Server

**IMPORTANT:** This project runs on **port 5173** (Vite default)
- Local dev URL: `http://localhost:5173` or `http://127.0.0.1:5173`
- Admin pages: `http://localhost:5173/admin`
- When using Playwright or browser testing, always use port **5173**, NOT 3000
- Port 3000 may be used by other concurrent Claude projects

## Project Overview

This is **The Bed Shop Stock Addon** - a React TypeScript order management system for mattresses, furniture, and accessories. Built with Vite + React 18, styled with Tailwind CSS and shadcn/ui components.

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui components + Tailwind CSS
- **Database**: Supabase PostgreSQL 
- **Authentication**: Clerk (primary) + Supabase (data layer)
- **Deployment**: Vercel with SPA routing

### Authentication Flow
- **Clerk** handles user authentication and JWT tokens
- **Supabase** manages user profiles and data authorization via RLS
- **No self-registration** - admins create all user accounts
- **Role-based access**: Admin vs Customer permissions

### Database Schema Key Points
- **Orders table**: Auto-generated order numbers (DYN000001, DYN000002...)
- **Order status flow**: pending → approved → completed/shipped/cancelled
- **Product tables**: mattresses, bases, furniture, accessories, foam
- **Audit trail**: order_history table tracks all changes
- **RLS policies**: Enforce data access based on user roles

### Component Organization
```
src/components/
├── admin/          # Admin dashboard, user management, order management
├── auth/           # Login/signup forms
├── cart/           # Shopping cart with provider pattern
├── layout/         # Header, navigation, admin/customer layouts
├── order/          # Order review and management
├── shared/         # Reusable components like order tables
└── ui/             # shadcn/ui component library
```

### Key Files
- `src/lib/supabase.ts` - Supabase client configuration with Clerk JWT integration
- `src/hooks/use-supabase.ts` - Custom hook for authenticated Supabase operations
- `src/types/` - TypeScript definitions for orders, products, customers
- `src/lib/cache-buster.ts` - Aggressive cache management for deployments

## Environment Setup

Required environment variables:
```bash
VITE_SUPABASE_URL=https://cfjvskafvcljvxnawccs.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Database Migrations

Supabase migrations are in `supabase/migrations/`. Key migrations include:
- Order sequence setup for auto-numbering
- RLS policies for role-based access
- Edge functions for admin operations
- Order history triggers for audit trail

**IMPORTANT:** When performing Supabase database operations, always use the Supabase MCP (Model Context Protocol) tools instead of writing Node.js scripts. Available MCP tools include:
- `mcp__supabase__execute_sql` - Execute SQL queries
- `mcp__supabase__apply_migration` - Apply database migrations
- `mcp__supabase__list_tables` - List database tables
- `mcp__supabase__get_project` - Get project information
- And other Supabase MCP tools for comprehensive database management

Use these MCP tools for all database operations, migrations, and queries instead of creating custom scripts.

## Admin Operations

Admin functions are handled via Supabase Edge Functions:
- `admin-create-user` - Create new customer accounts
- `admin-update-user` - Modify user details
- `admin-delete-user` - Remove users
- `admin-reset-user-password` - Password resets
- `admin-update-order` - Order status updates

## Order Management Flow

1. **Order Creation**: Products added to cart → checkout → order created with auto-generated number
2. **Admin Review**: Orders start in 'pending' status for admin approval
3. **Status Updates**: Admin can move orders through lifecycle (approved → shipped → completed)
4. **Audit Trail**: All changes logged in order_history table with timestamps

## Data Access Patterns

- **Customers**: Can only see their own orders and products
- **Admins**: Full access to all data via service role
- **RLS Enforcement**: Database-level security prevents unauthorized access
- **JWT Bridge**: Clerk tokens passed to Supabase for user identification

## Path Aliases

TypeScript path mapping configured:
- `@/*` → `src/*` (components, hooks, lib, etc.)
- Allows clean imports like `import { Button } from '@/components/ui/button'`

## Cache Management

Aggressive cache busting system implemented to handle Vercel deployment updates. Files include cache-buster utility to force client updates on new deployments.

## Test Credentials

For development and testing purposes:

**Admin User:**
- Email: jnaidu@thebedshop.co.za
- Password: Priyen@1234
- Role: Admin (full access to admin dashboard, user management, order management)

**Test Customer User:**
- Email: jasothan.naidu@gmail.com  
- Password: Kubesh@1234
- Role: Customer (order placement, view own orders only)

These credentials are used for testing user functionality, admin operations, and role-based access controls during development.