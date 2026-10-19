/* ==========================================================
   OurCity: connection to Supabase (our back end)
   The URL and the PUBLISHABLE key are safe to keep in the page,
   because the database rules (Row Level Security) decide what
   each visitor may do.
   NEVER put the "secret" or "service_role" key in any file here.
   ========================================================== */
var SUPABASE_URL = 'https://koxtuyjwzawshsfscyer.supabase.co';
var SUPABASE_KEY = 'sb_publishable_uo22kuYlGkq8BeDO29MIZw___oWdQ4c';

// "supabase" comes from the library script loaded before this file
window.sb = (window.supabase && SUPABASE_KEY.indexOf('PASTE_') !== 0)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;
