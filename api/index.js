const express = require('express');
const { Readable } = require('stream');

const app = express();

app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.all('*', async (req, res) => {
  try {
    const cleanPath = req.originalUrl.replace(/^\/+/, '');
    const targetUrl = `https://groq.com{cleanPath}`;

    const authHeader = req.headers.authorization || (process.env.GROQ_API_KEY ? `Bearer ${process.env.GROQ_API_KEY}` : '');

    const headers = {
      'Authorization': authHeader,
      'Content-Type': req.headers['content-type'] || 'application/json',
    };

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (!['GET', 'HEAD'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const upstreamResponse = await fetch(targetUrl, fetchOptions);

    res.status(upstreamResponse.status);

    upstreamResponse.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if (upstreamResponse.body) {
      Readable.fromWeb(upstreamResponse.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(502).json({
      error: {
        message: 'Proxy error: ' + error.message,
        type: 'proxy_error'
      }
    });
  }
});

module.exports = app;
