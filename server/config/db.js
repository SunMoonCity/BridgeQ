'use strict';

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const mongoose = require('mongoose');

/**
 * Resolves SRV DNS records to direct shard endpoints if SRV lookup times out on Windows
 */
async function resolveSrvFallback(srvUri) {
  return new Promise((resolve) => {
    const match = srvUri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)(\/.*)?$/);
    if (!match) return resolve(srvUri);

    const [, user, pass, host, query] = match;
    const srvName = `_mongodb._tcp.${host}`;

    dns.resolveSrv(srvName, (err, records) => {
      if (err || !records || records.length === 0) return resolve(srvUri);

      const hosts = records.map(r => `${r.name}:${r.port}`).join(',');
      const queryParams = (query || '?').replace(/^\?/, '');
      const extra = queryParams ? `&${queryParams}` : '';
      const directUri = `mongodb://${user}:${pass}@${hosts}/?ssl=true&authSource=admin${extra}`;
      resolve(directUri);
    });
  });
}

async function connectDB() {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[db] MONGODB_URI is not set in .env');
    return;
  }

  try {
    // Attempt standard connection
    await mongoose.connect(uri, {
      family: 4,
      serverSelectionTimeoutMS: 5000
    });
    console.log('[db] MongoDB Atlas connected successfully');
  } catch (err) {
    if (uri.startsWith('mongodb+srv://')) {
      console.warn('[db] SRV connection timed out. Resolving direct replica set nodes...');
      const fallbackUri = await resolveSrvFallback(uri);
      try {
        await mongoose.connect(fallbackUri, {
          family: 4,
          serverSelectionTimeoutMS: 8000
        });
        console.log('[db] MongoDB Atlas connected successfully via direct node fallback');
        return;
      } catch (fallbackErr) {
        console.error('[db] Direct node fallback failed:', fallbackErr.message);
      }
    } else {
      console.error('[db] MongoDB connection failed:', err.message);
    }
  }
}

module.exports = connectDB;
