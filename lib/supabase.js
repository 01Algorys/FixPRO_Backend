const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Supabase environment variables not set. Avatar upload will not work.');
  console.warn('   Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file');
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

module.exports = { supabase };
