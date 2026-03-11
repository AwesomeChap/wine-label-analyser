-- Run this in Supabase SQL Editor if wine_analyses already exists without decoded_text.
alter table public.wine_analyses add column if not exists decoded_text text;
