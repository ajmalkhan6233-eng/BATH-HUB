-- Takes the guard OFF again (run as administrator). Removes the triggers, the log and the AI users. Business data is not touched.
DO $do$ DECLARE r record; BEGIN
  FOR r IN SELECT event_object_table t FROM information_schema.triggers WHERE trigger_name = 'guard_capture' LOOP EXECUTE format('DROP TRIGGER IF EXISTS guard_capture ON public.%I', r.t); END LOOP;
END $do$;
-- keep the log as evidence unless you also run:  DROP SCHEMA guard CASCADE;
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ai_chat') THEN REASSIGN OWNED BY ai_chat TO CURRENT_USER; DROP OWNED BY ai_chat; DROP ROLE ai_chat; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ai_pc') THEN REASSIGN OWNED BY ai_pc TO CURRENT_USER; DROP OWNED BY ai_pc; DROP ROLE ai_pc; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bathco_ai') THEN DROP OWNED BY bathco_ai; DROP ROLE bathco_ai; END IF;
END $do$;
