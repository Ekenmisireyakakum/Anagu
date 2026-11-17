-- ANAGU Land Administration & Blockchain Title Registry — Supabase PostgreSQL Schema
-- Run this SQL once in your Supabase Dashboard -> SQL Editor to enable persistent database storage.

create table if not exists public.anagu_users (
  id text primary key,
  email text not null unique,
  password_hash text not null default '',
  role text not null check (role in ('CITIZEN', 'SURVEYOR', 'REGISTRAR', 'LAND_ADMINISTRATOR', 'GOVERNOR')),
  full_name text not null,
  phone text not null default '',
  wallet_address text not null,
  wallet_verified boolean not null default false,
  wallet_linked_at text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.anagu_applications (
  id text primary key,
  applicant_id text not null,
  parcel_reference text not null,
  status text not null,
  data jsonb not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.anagu_titles (
  token_id bigint primary key,
  application_id text not null,
  parcel_reference text not null,
  owner_id text not null,
  owner_address text not null,
  is_revoked boolean not null default false,
  data jsonb not null,
  issued_at timestamptz not null default now()
);

create table if not exists public.anagu_listings (
  id text primary key,
  parcel_reference text not null,
  status text not null,
  verification_status text not null default 'VERIFIED',
  token_id bigint,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.anagu_purchases (
  id text primary key,
  listing_id text not null,
  parcel_reference text not null,
  buyer_id text not null,
  token_id bigint not null,
  data jsonb not null,
  purchased_at timestamptz not null default now()
);

create table if not exists public.anagu_audit_logs (
  id text primary key,
  actor_id text not null,
  entity_type text not null,
  entity_id text not null,
  outcome text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.anagu_mqtt_logs (
  id text primary key,
  topic text not null,
  recipient_role text not null,
  data jsonb not null,
  published_at timestamptz not null default now()
);

create table if not exists public.anagu_contacts (
  id text primary key,
  name text not null,
  email text not null,
  organization text not null default 'Public Inquiry',
  subject text not null default 'General Inquiry',
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.anagu_parcel_overrides (
  parcel_id text primary key,
  status text not null check (status in ('available', 'pending', 'active', 'revoked')),
  updated_at timestamptz not null default now()
);

create table if not exists public.anagu_meta (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security (service/secret key bypasses RLS on server routes)
alter table public.anagu_users enable row level security;
alter table public.anagu_applications enable row level security;
alter table public.anagu_titles enable row level security;
alter table public.anagu_listings enable row level security;
alter table public.anagu_purchases enable row level security;
alter table public.anagu_audit_logs enable row level security;
alter table public.anagu_mqtt_logs enable row level security;
alter table public.anagu_contacts enable row level security;
alter table public.anagu_parcel_overrides enable row level security;
alter table public.anagu_meta enable row level security;
