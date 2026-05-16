// src/start.js
const app = require('./server');
const PORT = 3000;

const server = app.listen(PORT, () => {
  console.log(`Ads Spy Tool chạy tại http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} đang bị chiếm. Dùng: netstat -ano | findstr :${PORT}`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
