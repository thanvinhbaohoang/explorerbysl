-- Drop and recreate the function with proper search_path
DROP TRIGGER IF EXISTS update_telegram_leads_updated_at ON public.telegram_leads;
DROP FUNCTION IF EXISTS public.update_telegram_leads_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_telegram_leads_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_telegram_leads_updated_at
  BEFORE UPDATE ON public.telegram_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_telegram_leads_updated_at();