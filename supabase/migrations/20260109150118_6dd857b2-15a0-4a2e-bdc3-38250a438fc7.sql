-- =============================================
-- 1. Add onboarding_completed to profiles
-- =============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- =============================================
-- 2. Create user roles system (secure pattern)
-- =============================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has admin or manager role
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- First user of an org becomes admin (handled via trigger later)
CREATE POLICY "First user can set their role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1)
);

-- =============================================
-- 3. Create invitations system
-- =============================================
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_at timestamp with time zone
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for invitations
CREATE POLICY "Admins and managers can create invitations"
ON public.invitations
FOR INSERT
WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can view all invitations"
ON public.invitations
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can view invitations they created"
ON public.invitations
FOR SELECT
USING (public.has_role(auth.uid(), 'manager') AND invited_by = auth.uid());

CREATE POLICY "Admins and managers can update invitations"
ON public.invitations
FOR UPDATE
USING (public.is_admin_or_manager(auth.uid()));

-- Allow anyone to read invitation by token (for accepting)
CREATE POLICY "Anyone can view invitation by token"
ON public.invitations
FOR SELECT
USING (true);

-- =============================================
-- 4. Trigger to assign admin role to first user
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_first_user_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first user with completed onboarding, make them admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_profile_onboarding_complete
  AFTER UPDATE OF onboarding_completed ON public.profiles
  FOR EACH ROW
  WHEN (NEW.onboarding_completed = true AND OLD.onboarding_completed = false)
  EXECUTE FUNCTION public.handle_first_user_admin();

-- =============================================
-- 5. Function to accept invitation and assign role
-- =============================================
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation record;
BEGIN
  -- Find valid invitation
  SELECT * INTO _invitation
  FROM public.invitations
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now();
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Assign role to user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _invitation.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = _invitation.id;
  
  RETURN true;
END;
$$;