ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.user_id AND p.email IS DISTINCT FROM u.email;

UPDATE public.profiles SET is_vip = true WHERE lower(subscription_status) = 'vip' AND is_vip = false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name, bankroll_total, subscription_status, is_vip)
  VALUES (NEW.id, NEW.email, COALESCE(split_part(NEW.email, '@', 1), 'Apostador'), 500, 'FREE', false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all bets" ON public.bets;
CREATE POLICY "Admins read all bets" ON public.bets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete any bet" ON public.bets;
CREATE POLICY "Admins delete any bet" ON public.bets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));