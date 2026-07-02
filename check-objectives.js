import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const lines = env.split('\n');
let supabaseUrl = '';
let supabaseAnonKey = '';
for (const line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    supabaseAnonKey = line.split('=')[1].trim();
  }
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching objectives from Supabase...");
  const { data, error } = await supabase.from('objectives').select('*');
  if (error) {
    console.error("Error fetching:", error);
    return;
  }
  
  console.log(`Found ${data.length} objectives:`);
  for (const obj of data) {
    console.log(`- Title: "${obj.title}", ID: "${obj.id}", Assignments:`, obj.assignments);
  }
}
run();
