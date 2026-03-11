-- Run this in Supabase SQL Editor if wine_analyses already exists without extraction_prompt.
alter table public.wine_analyses add column if not exists extraction_prompt text;
