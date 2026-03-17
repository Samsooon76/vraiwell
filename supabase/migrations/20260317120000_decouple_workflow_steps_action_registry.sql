-- Decouple workflow_steps from workflow_actions.
-- The app stores a stable reference (integration_id + action_key) plus a snapshot fallback.

ALTER TABLE public.workflow_steps
  ADD COLUMN IF NOT EXISTS integration_id TEXT;

ALTER TABLE public.workflow_steps
  ADD COLUMN IF NOT EXISTS action_key TEXT;

ALTER TABLE public.workflow_steps
  ADD COLUMN IF NOT EXISTS action_snapshot JSONB;

DO $$
BEGIN
  -- action_id used to be mandatory; we keep it for backward compatibility but new steps may not set it.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workflow_steps'
      AND column_name = 'action_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.workflow_steps ALTER COLUMN action_id DROP NOT NULL;
  END IF;
EXCEPTION
  WHEN undefined_column THEN
    -- Older schema variations; ignore.
    NULL;
END $$;

-- Backfill references and snapshot from workflow_actions for existing steps.
UPDATE public.workflow_steps ws
SET
  integration_id = wa.integration_id,
  action_key = wa.action_key,
  action_snapshot = COALESCE(
    ws.action_snapshot,
    jsonb_build_object(
      'integration_id', wa.integration_id,
      'action_key', wa.action_key,
      'name', wa.name,
      'description', wa.description,
      'icon', wa.icon,
      'category', wa.category,
      'input_schema', wa.input_schema,
      'edge_function', wa.edge_function,
      'is_active', wa.is_active
    )
  )
FROM public.workflow_actions wa
WHERE
  ws.action_id = wa.id
  AND (
    ws.integration_id IS NULL
    OR ws.action_key IS NULL
    OR ws.action_snapshot IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_workflow_steps_action_ref
  ON public.workflow_steps(integration_id, action_key);

