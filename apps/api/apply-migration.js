const { spawn } = require('child_process');
const path = require('path');

// Load env
require('dotenv').config({ path: '../../infra/secrets/.env.local' });

console.log('🔄 Applying migrations...');
console.log('Database:', process.env.DATABASE_URL.split('@')[1]);

const proc = spawn('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  timeout: 120000, // 2 minutos
});

proc.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Migrations applied successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Migration failed with code:', code);
    process.exit(1);
  }
});

setTimeout(() => {
  console.log('⏱️ Timeout - migrations may still be running');
  process.exit(0);
}, 120000);
