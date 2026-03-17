-- Add user_id to tools for isolation
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Update RLS policies for tools
DROP POLICY IF EXISTS "Authenticated users can view tools" ON public.tools;
DROP POLICY IF EXISTS "Authenticated users can manage tools" ON public.tools;

CREATE POLICY "Users can view their own tools"
  ON public.tools FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own tools"
  ON public.tools FOR ALL
  USING (auth.uid() = user_id);

-- Add token storage to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS slack_token TEXT,
ADD COLUMN IF NOT EXISTS notion_token TEXT,
ADD COLUMN IF NOT EXISTS hubspot_token TEXT,
ADD COLUMN IF NOT EXISTS microsoft_token TEXT;

-- Remove global active tools from initial seed to prevent "accidental" shared state
-- (Users will start with an empty list or connect their own)
DELETE FROM public.tools WHERE user_id IS NULL AND is_active = true;
;
