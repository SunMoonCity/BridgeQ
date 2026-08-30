'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

const mongoose = require('mongoose');

async function testConnection() {
  console.log('--------------------------------------------------');
  console.log('🔍 Testing real MongoDB Atlas connection...');
  console.log('--------------------------------------------------');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  // Mask password for display
  const maskedUri = uri.replace(/:([^@]+)@/, ':****@');
  console.log('URI:', maskedUri);

  try {
    console.log('Connecting...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

    console.log('\n✅ SUCCESS! Connected to real MongoDB Atlas!');
    console.log('   Host:     ', mongoose.connection.host);
    console.log('   Database: ', mongoose.connection.db.databaseName);
    console.log('   State:    ', mongoose.connection.readyState === 1 ? 'Connected (1)' : mongoose.connection.readyState);

    // Ping test
    const ping = await mongoose.connection.db.admin().ping();
    console.log('   Ping:     ', ping);

    console.log('\n🎉 Your real MongoDB Atlas URI is working perfectly!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ CONNECTION FAILED:', err.message);
    console.log('\n--------------------------------------------------');
    console.log('💡 Troubleshooting Checklist:');
    console.log('1. Is your IP whitelisted in Atlas?');
    console.log('   -> Go to https://cloud.mongodb.com -> Network Access -> Add 0.0.0.0/0');
    console.log('2. Is your cluster paused?');
    console.log('   -> Go to https://cloud.mongodb.com -> Database -> Resume Cluster0');
    console.log('3. Are credentials correct in .env?');
    console.log('--------------------------------------------------');
    process.exit(1);
  }
}

testConnection();
