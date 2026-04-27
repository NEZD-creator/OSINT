const { execSync } = require('child_process');
try {
  console.log(execSync('python3 --version').toString());
  console.log(execSync('pip3 --version || pip --version').toString());
} catch (e) {
  console.error('Missing python/pip');
}
