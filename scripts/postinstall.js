// ============================================================
// Postinstall script: generates Prisma client
// ============================================================

const { execSync } = require('child_process')

// Generate Prisma client - with timeout to prevent hanging
try {
  console.log('[postinstall] Generating Prisma client...')
  execSync('npx prisma generate', {
    stdio: 'inherit',
    env: { ...process.env },
    timeout: 120000
  })
  console.log('[postinstall] Prisma client generated successfully')
} catch (error) {
  console.warn('[postinstall] Prisma generate warning:', error.message)
  // Don't fail - the build.js script will also try
}
