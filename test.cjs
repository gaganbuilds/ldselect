const http = require('http');

const tryLogin = (password) => {
  return new Promise((resolve) => {
    const data = JSON.stringify({ password });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({status: res.statusCode, body, password}));
    });
    req.write(data);
    req.end();
  });
};

(async () => {
  const pw = await tryLogin('Ld!Admin7vQ2@xP9$Km4');
  console.log(pw);
})();
