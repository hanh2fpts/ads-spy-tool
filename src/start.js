// src/start.js
const app = require('./server');
const PORT = 3000;
const server = app.listen(PORT, () => console.log(`Ads Spy Tool chạy tại http://localhost:${PORT}`));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Lỗi: Port ${PORT} đang bị chiếm bởi tiến trình khác.`);
    console.error(`\nCách xử lý trên macOS:`);
    console.error(`  1. Tìm tiến trình đang dùng port: lsof -i :${PORT}`);
    console.error(`  2. Dừng tiến trình đó:            kill -9 $(lsof -ti :${PORT})`);
    console.error(`  3. Chạy lại:                       npm start\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});
