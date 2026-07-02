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
  const email = `test.user.${Date.now()}@gmail.com`;
  const password = 'Password123!';

  console.log("Signing up test user...");
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error("SignUp error:", signUpError);
    return;
  }

  const user = signUpData.user;
  console.log("Signed up user:", user.id);

  console.log("Inserting test objective...");
  const objId = `obj-test-${Date.now()}`;
  const { data: insertData, error: insertError } = await supabase
    .from('objectives')
    .insert({
      id: objId,
      user_id: user.id,
      title: 'Test Inspect',
      target: 1,
      category_id: 'sport',
      created_at: new Date().toISOString().slice(0, 10),
    })
    .select();

  if (insertError) {
    console.error("Insert error:", insertError);
  } else {
    console.log("Inserted objective row columns:", Object.keys(insertData[0]));
    console.log("Row data:", insertData[0]);

    console.log("Cleaning up objective...");
    await supabase.from('objectives').delete().eq('id', objId);
  }
}
run();
