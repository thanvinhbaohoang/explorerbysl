ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_address text,
  ADD COLUMN IF NOT EXISTS location_title text,
  ADD COLUMN IF NOT EXISTS location_live_period integer;