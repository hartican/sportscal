set local lock_timeout='2s';set local statement_timeout='8s';
do $guard$ begin
 if md5(pg_get_functiondef('public.nothingsports_diagnose_fixture_part(text,integer,text[],text[],text[],text[])'::regprocedure))<>'0c2ff6716ab9af806aab61d175203505' then raise exception 'Temporary diagnostic differs from reviewed body';end if;
end $guard$;
drop function public.nothingsports_diagnose_fixture_part(text,integer,text[],text[],text[],text[]);
