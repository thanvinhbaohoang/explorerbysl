-- Strengthen RLS policies: Require authentication for all table operations

-- ========================
-- TABLE: customer
-- ========================
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read customer" ON public.customer;
DROP POLICY IF EXISTS "Anyone can insert customer" ON public.customer;
DROP POLICY IF EXISTS "Anyone can update customer" ON public.customer;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can read customer" 
ON public.customer 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Service role can insert customer" 
ON public.customer 
FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update customer" 
ON public.customer 
FOR UPDATE 
TO service_role 
USING (true) 
WITH CHECK (true);

-- ========================
-- TABLE: messages
-- ========================
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.messages;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can read messages" 
ON public.messages 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Service role can insert messages" 
ON public.messages 
FOR INSERT 
TO service_role 
WITH CHECK (true);

-- ========================
-- TABLE: telegram_leads
-- ========================
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read telegram_leads" ON public.telegram_leads;
DROP POLICY IF EXISTS "Anyone can insert telegram_leads" ON public.telegram_leads;
DROP POLICY IF EXISTS "Anyone can update telegram_leads by click_id" ON public.telegram_leads;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can read telegram_leads" 
ON public.telegram_leads 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Service role can insert telegram_leads" 
ON public.telegram_leads 
FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update telegram_leads" 
ON public.telegram_leads 
FOR UPDATE 
TO service_role 
USING (true) 
WITH CHECK (true);

-- ========================
-- TABLE: customer_notes
-- ========================
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read customer_notes" ON public.customer_notes;
DROP POLICY IF EXISTS "Anyone can insert customer_notes" ON public.customer_notes;
DROP POLICY IF EXISTS "Anyone can update customer_notes" ON public.customer_notes;
DROP POLICY IF EXISTS "Anyone can delete customer_notes" ON public.customer_notes;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can read customer_notes" 
ON public.customer_notes 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert customer_notes" 
ON public.customer_notes 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer_notes" 
ON public.customer_notes 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete customer_notes" 
ON public.customer_notes 
FOR DELETE 
TO authenticated 
USING (true);

-- ========================
-- TABLE: customer_summaries
-- ========================
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read customer_summaries" ON public.customer_summaries;
DROP POLICY IF EXISTS "Anyone can insert customer_summaries" ON public.customer_summaries;
DROP POLICY IF EXISTS "Anyone can update customer_summaries" ON public.customer_summaries;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can read customer_summaries" 
ON public.customer_summaries 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Service role can insert customer_summaries" 
ON public.customer_summaries 
FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role can update customer_summaries" 
ON public.customer_summaries 
FOR UPDATE 
TO service_role 
USING (true);

-- ========================
-- TABLE: customer_action_items
-- ========================
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Anyone can read customer_action_items" ON public.customer_action_items;
DROP POLICY IF EXISTS "Anyone can insert customer_action_items" ON public.customer_action_items;
DROP POLICY IF EXISTS "Anyone can update customer_action_items" ON public.customer_action_items;
DROP POLICY IF EXISTS "Anyone can delete customer_action_items" ON public.customer_action_items;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can read customer_action_items" 
ON public.customer_action_items 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert customer_action_items" 
ON public.customer_action_items 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer_action_items" 
ON public.customer_action_items 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete customer_action_items" 
ON public.customer_action_items 
FOR DELETE 
TO authenticated 
USING (true);