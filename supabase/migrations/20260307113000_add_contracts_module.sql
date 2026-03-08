CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  contract_label TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  vendor_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'terminated', 'expired')),
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  source_url TEXT,
  start_date DATE,
  end_date DATE,
  renewal_type TEXT NOT NULL DEFAULT 'none' CHECK (renewal_type IN ('none', 'manual', 'tacit')),
  renewal_period_months INTEGER,
  renewal_notice_days INTEGER,
  notice_deadline DATE,
  ocr_status TEXT NOT NULL DEFAULT 'pending_model' CHECK (
    ocr_status IN ('pending_model', 'queued', 'processing', 'completed', 'failed', 'manual_review')
  ),
  ocr_model TEXT,
  ocr_extracted_text TEXT,
  ocr_extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  terms_status TEXT NOT NULL DEFAULT 'not_started' CHECK (
    terms_status IN ('not_started', 'queued', 'reviewing', 'completed', 'failed')
  ),
  terms_url TEXT,
  terms_summary TEXT,
  terms_checked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contracts"
  ON public.contracts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contracts"
  ON public.contracts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contracts"
  ON public.contracts FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON public.contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON public.contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_notice_deadline ON public.contracts(notice_deadline);
CREATE INDEX IF NOT EXISTS idx_contracts_ocr_status ON public.contracts(ocr_status);
CREATE INDEX IF NOT EXISTS idx_contracts_terms_status ON public.contracts(terms_status);

DROP TRIGGER IF EXISTS update_contracts_updated_at ON public.contracts;
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can read their own contract files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload their own contract files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own contract files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own contract files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
