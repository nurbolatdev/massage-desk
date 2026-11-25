-- Only the API (table owner) reads and writes devices; push tokens are not exposed to staff through Supabase.
-- Row level security stays enabled with no policies.

drop policy staff_read on devices;
