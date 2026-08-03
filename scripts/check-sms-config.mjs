const required = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM_NUMBER'
];

const missing = required.filter((key) => !process.env[key] || !String(process.env[key]).trim());

if (missing.length) {
  console.error('Faltan variables para SMS recovery:');
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  console.error('\nCopia .env.example a .env.local y completa esos valores.');
  process.exit(1);
}

const hasPrivateKeyHeader = String(process.env.FIREBASE_PRIVATE_KEY || '').includes('BEGIN PRIVATE KEY');
if (!hasPrivateKeyHeader) {
  console.error('FIREBASE_PRIVATE_KEY parece invalida (no contiene BEGIN PRIVATE KEY).');
  process.exit(1);
}

console.log('Configuracion SMS recovery: OK');
