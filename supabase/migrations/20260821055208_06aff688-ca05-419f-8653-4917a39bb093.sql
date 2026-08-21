GRANT SELECT, INSERT, UPDATE, DELETE ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bankroll_settings TO authenticated;
GRANT ALL ON public.bankroll_settings TO service_role;