-- Create table for AI-generated summaries
CREATE TABLE public.customer_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customer(id) ON DELETE CASCADE,
  summary_data JSONB NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for manual customer notes
CREATE TABLE public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customer(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for tracking action items
CREATE TABLE public.customer_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customer(id) ON DELETE CASCADE,
  action_text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.customer_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_action_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_summaries
CREATE POLICY "Anyone can read customer_summaries" 
ON public.customer_summaries FOR SELECT USING (true);

CREATE POLICY "Anyone can insert customer_summaries" 
ON public.customer_summaries FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update customer_summaries" 
ON public.customer_summaries FOR UPDATE USING (true);

-- RLS policies for customer_notes
CREATE POLICY "Anyone can read customer_notes" 
ON public.customer_notes FOR SELECT USING (true);

CREATE POLICY "Anyone can insert customer_notes" 
ON public.customer_notes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update customer_notes" 
ON public.customer_notes FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete customer_notes" 
ON public.customer_notes FOR DELETE USING (true);

-- RLS policies for customer_action_items
CREATE POLICY "Anyone can read customer_action_items" 
ON public.customer_action_items FOR SELECT USING (true);

CREATE POLICY "Anyone can insert customer_action_items" 
ON public.customer_action_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update customer_action_items" 
ON public.customer_action_items FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete customer_action_items" 
ON public.customer_action_items FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX idx_customer_summaries_customer_id ON public.customer_summaries(customer_id);
CREATE INDEX idx_customer_notes_customer_id ON public.customer_notes(customer_id);
CREATE INDEX idx_customer_action_items_customer_id ON public.customer_action_items(customer_id);
CREATE INDEX idx_customer_action_items_completed ON public.customer_action_items(is_completed);

-- Trigger to update updated_at for notes
CREATE TRIGGER update_customer_notes_updated_at
  BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_telegram_leads_updated_at();