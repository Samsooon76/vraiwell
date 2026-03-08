-- Delete mock workflows that were seeded in the initial migration
DELETE FROM public.workflows 
WHERE name IN ('Onboarding Standard', 'Onboarding Tech', 'Offboarding Standard');
