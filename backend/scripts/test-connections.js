/**
 * Connection Test Script
 * Tests MongoDB, Cloudinary, and Nodemailer connections
 * 
 * Usage: node scripts/test-connections.js
 */

const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const path = require('path');

// Load .env from parent directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PASSED = '\x1b[32m✓ PASSED\x1b[0m';
const FAILED = '\x1b[31m✗ FAILED\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

async function testMongoDB() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  TEST 1: MongoDB Connection');
  console.log(`${'='.repeat(60)}`);

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log(`  ${FAILED} MONGODB_URI is not set in .env`);
    return false;
  }
  console.log(`  ${INFO} URI: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`  ${PASSED} Connected to MongoDB Atlas successfully!`);
    
    // Get database info
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`  ${INFO} Database: ${db.databaseName}`);
    console.log(`  ${INFO} Collections: ${collections.length > 0 ? collections.map(c => c.name).join(', ') : '(empty - new database)'}`);
    
    await mongoose.disconnect();
    console.log(`  ${INFO} Disconnected from MongoDB`);
    return true;
  } catch (error) {
    console.log(`  ${FAILED} ${error.message}`);
    return false;
  }
}

async function testCloudinary() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  TEST 2: Cloudinary Connection');
  console.log(`${'='.repeat(60)}`);

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.log(`  ${FAILED} Cloudinary credentials are not fully set in .env`);
    console.log(`  ${INFO} Cloud Name: ${cloudName ? '✓' : '✗'}`);
    console.log(`  ${INFO} API Key:    ${apiKey ? '✓' : '✗'}`);
    console.log(`  ${INFO} API Secret: ${apiSecret ? '✓' : '✗'}`);
    return false;
  }

  try {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    // Test by getting account info
    const result = await cloudinary.api.ping();
    console.log(`  ${PASSED} Cloudinary ping: ${result.status || 'OK'}`);
    
    // Check account details
    const account = await cloudinary.api.usage();
    console.log(`  ${INFO} Account Plan: ${account.plan || 'Unknown'}`);
    console.log(`  ${INFO} Credits Used: ${account.credits?.usage || 0}/${account.credits?.limit || 'N/A'}`);
    console.log(`  ${INFO} Images: ${account.images || 0} files`);
    
    return true;
  } catch (error) {
    console.log(`  ${FAILED} ${error.message}`);
    return false;
  }
}

async function testNodemailer() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  TEST 3: Nodemailer (Gmail SMTP)');
  console.log(`${'='.repeat(60)}`);

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.log(`  ${FAILED} Gmail credentials are not fully set in .env`);
    console.log(`  ${INFO} EMAIL_USER: ${emailUser ? '✓' : '✗'}`);
    console.log(`  ${INFO} EMAIL_PASS: ${emailPass ? '✓' : '✗'}`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    // Verify transporter configuration
    await transporter.verify();
    console.log(`  ${PASSED} Gmail SMTP connection verified!`);
    console.log(`  ${INFO} Account: ${emailUser}`);

    // Send a test email (optional - uncomment to actually send)
    // console.log(`  ${INFO} Sending test email to ${emailUser}...`);
    // const info = await transporter.sendMail({
    //   from: `"Echo Test" <${emailUser}>`,
    //   to: emailUser,
    //   subject: 'Test Email - Echo',
    //   text: 'This is a test email from your Echo. All services are working!',
    // });
    // console.log(`  ${PASSED} Test email sent! Message ID: ${info.messageId}`);

    return true;
  } catch (error) {
    console.log(`  ${FAILED} ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log(`\n\x1b[35m${'='.repeat(60)}\x1b[0m`);
  console.log(`\x1b[35m     Echo - Service Connection Tests\x1b[0m`);
  console.log(`\x1b[35m${'='.repeat(60)}\x1b[0m`);
  console.log(`  Started: ${new Date().toLocaleString()}`);

  const results = {
    mongodb: await testMongoDB(),
    cloudinary: await testCloudinary(),
    nodemailer: await testNodemailer(),
  };

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('  SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  const passedCount = Object.values(results).filter(r => r === true).length;
  const totalCount = Object.keys(results).length;

  console.log(`  MongoDB:    ${results.mongodb ? PASSED : FAILED}`);
  console.log(`  Cloudinary: ${results.cloudinary ? PASSED : FAILED}`);
  console.log(`  Nodemailer: ${results.nodemailer ? PASSED : FAILED}`);
  console.log(`  ${passedCount}/${totalCount} tests passed`);
  console.log(`  Overall: ${allPassed ? '\x1b[32mALL CONNECTIONS WORKING\x1b[0m' : '\x1b[31mSOME CONNECTIONS FAILED\x1b[0m'}`);
  console.log(`  Finished: ${new Date().toLocaleString()}\n`);

  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
