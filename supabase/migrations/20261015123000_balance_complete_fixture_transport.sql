set local lock_timeout='2s';
set local statement_timeout='8s';
do $balance$
declare definition text;old_partition text:=$old$get_byte(decode(md5(c.source_id||chr(31)||c.fixture_id),'hex'),0)%2=p_part$old$;
 new_partition text:=$new$(case when get_byte(decode(md5(c.source_id||chr(31)||c.fixture_id),'hex'),0)<96 then 0 else 1 end)=p_part$new$;
begin
 definition:=pg_get_functiondef('public.nothingsports_read_fixture_bundle_part(text,integer,text[],text[],text[],text[])'::regprocedure);
 if md5(definition)<>'9d5b59286828960e5b1371a8659b544d' then raise exception 'Unexpected complete reader; transport rebalance refused';end if;
 if length(definition)-length(replace(definition,old_partition,''))<>length(old_partition) then raise exception 'Expected one reviewed partition predicate';end if;
 -- A smaller first response leaves space for first-request setup. Both parts
 -- remain complete complements after unchanged closure, window and sentinel.
 execute replace(replace(definition,old_partition,new_partition),'fixture-bundle-part.v1','fixture-bundle-part.v2');
end;$balance$;
