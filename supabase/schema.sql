-- Run this in Supabase SQL Editor to create the table and bucket.

-- Table for wine analyses
create table if not exists public.wine_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  winery text,
  vintage text,
  grape_variety text,
  vineyard_location text,
  country text,
  front_image_url text,
  back_image_url text
);

-- Enable RLS (optional; use service role key in backend to bypass)
alter table public.wine_analyses enable row level security;

-- Allow service role full access (backend uses service role key)
create policy "Service role full access"
  on public.wine_analyses for all
  using (true)
  with check (true);

-- Create storage bucket (run in Dashboard or via API if needed)
-- Bucket name: wine-labels, public if you want public URLs
