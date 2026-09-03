ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bankroll_total numeric NOT NULL DEFAULT 25000;

ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS pick_id uuid REFERENCES public.picks(id) ON DELETE SET NULL;
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS selection text NOT NULL DEFAULT '';
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS stake_percent numeric NOT NULL DEFAULT 2;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, bankroll_total)
  VALUES (NEW.id, COALESCE(split_part(NEW.email, '@', 1), 'Apostador'), 25000)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

INSERT INTO public.profiles (user_id, display_name)
SELECT u.id, COALESCE(split_part(u.email, '@', 1), 'Apostador')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);

DELETE FROM public.user_roles WHERE role = 'admin';
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'prueba4@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;