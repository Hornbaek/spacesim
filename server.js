const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const dir = __dirname;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
    let url = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(dir, url);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            const ext = path.extname(filePath);
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
            res.end(data);
        }
    });
}).listen(port, () => console.log(`Server running on port ${port}`));
