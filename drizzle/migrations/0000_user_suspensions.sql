CREATE TABLE public.suspended_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  suspended_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.suspended_users TO authenticated;
GRANT ALL ON public.suspended_users TO service_role;
ALTER TABLE public.suspended_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own suspension" ON public.suspended_users FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read suspensions" ON public.suspended_users FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add suspensions" ON public.suspended_users FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins remove suspensions" ON public.suspended_users FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.suspended_users WHERE user_id = _user_id) $$;

CREATE POLICY "Suspended users blocked" ON public.bets AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_suspended(auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (NOT public.is_suspended(auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Suspended users blocked" ON public.chat_threads AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_suspended(auth.uid())) WITH CHECK (NOT public.is_suspended(auth.uid()));
CREATE POLICY "Suspended users blocked" ON public.chat_messages AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_suspended(auth.uid())) WITH CHECK (NOT public.is_suspended(auth.uid()));
CREATE POLICY "Suspended users blocked" ON public.bankroll_settings AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_suspended(auth.uid())) WITH CHECK (NOT public.is_suspended(auth.uid()));