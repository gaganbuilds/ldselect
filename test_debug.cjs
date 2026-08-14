const http = require('http');

http.get('http://localhost:3000/api/debug-password', (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(res.statusCode, body));
}).on('error', e => console.error(e));
