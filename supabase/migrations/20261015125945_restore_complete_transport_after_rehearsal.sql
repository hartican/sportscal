set local lock_timeout='2s';
set local statement_timeout='8s';
do $restore$
declare definition text;balanced text:=$balanced$(case when get_byte(decode(md5(c.source_id||chr(31)||c.fixture_id),'hex'),0)<96 then 0 else 1 end)=p_part$balanced$;
 original text:=$original$get_byte(decode(md5(c.source_id||chr(31)||c.fixture_id),'hex'),0)%2=p_part$original$;
begin
 definition:=pg_get_functiondef('public.nothingsports_read_fixture_bundle_part(text,integer,text[],text[],text[],text[])'::regprocedure);
 if md5(definition)<>'0bb6e44193c35f0f70c53da608c537a9' then raise exception 'Unexpected complete reader; rehearsal restoration refused';end if;
 if length(definition)-length(replace(definition,balanced,''))<>length(balanced) then raise exception 'Expected one reviewed balanced partition predicate';end if;
 execute replace(replace(definition,balanced,original),'fixture-bundle-part.v2','fixture-bundle-part.v1');
 if md5(pg_get_functiondef('public.nothingsports_read_fixture_bundle_part(text,integer,text[],text[],text[],text[])'::regprocedure))<>'9d5b59286828960e5b1371a8659b544d' then raise exception 'Complete reader restoration differs from reviewed baseline';end if;
end;$restore$;
