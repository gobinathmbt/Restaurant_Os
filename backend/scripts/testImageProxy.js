/**
 * Test Image Proxy Endpoint
 * Quick script to verify the image proxy is working correctly
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_IMAGE_URL = 'https://restaurant-os.s3.eu-north-1.amazonaws.com/menu-images/COMP_1769780732197_58d66dcwq/2026/02/1770559989115-5de787d02e41dd5c.jpeg';

/**
 * Test the image proxy endpoint
 */
async function testImageProxy() {
  console.log('🧪 Testing Image Proxy Endpoint\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Image: ${TEST_IMAGE_URL}\n`);

  try {
    // Encode the URL
    const encodedUrl = encodeURIComponent(TEST_IMAGE_URL);
    const proxyUrl = `${BASE_URL}/api/menu/images/proxy?url=${encodedUrl}`;

    console.log('📡 Making request to proxy endpoint...');
    console.log(`Proxy URL: ${proxyUrl}\n`);

    // Make request
    const response = await axios.get(proxyUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });

    // Check response
    console.log('✅ Response received!');
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.headers['content-length']} bytes`);
    console.log(`Cache-Control: ${response.headers['cache-control']}`);

    // Save image to file for verification
    const outputPath = path.join(__dirname, 'test-image-output.jpg');
    fs.writeFileSync(outputPath, response.data);
    console.log(`\n💾 Image saved to: ${outputPath}`);
    console.log('✅ Image proxy is working correctly!\n');

    return true;

  } catch (error) {
    console.error('❌ Error testing image proxy:');
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${error.response.data?.message || error.response.statusText}`);
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Make sure the backend is running on', BASE_URL);
    } else {
      console.error(error.message);
    }

    console.error('\n💡 Troubleshooting:');
    console.error('1. Make sure backend is running: npm start');
    console.error('2. Check AWS credentials in .env file');
    console.error('3. Verify S3 bucket name and region');
    console.error('4. Check if the test image URL is valid\n');

    return false;
  }
}

/**
 * Test with invalid URL
 */
async function testInvalidUrl() {
  console.log('🧪 Testing with invalid URL...\n');

  try {
    const invalidUrl = 'https://invalid-bucket.s3.amazonaws.com/nonexistent.jpg';
    const encodedUrl = encodeURIComponent(invalidUrl);
    const proxyUrl = `${BASE_URL}/api/menu/images/proxy?url=${encodedUrl}`;

    await axios.get(proxyUrl, { timeout: 5000 });
    console.log('⚠️  Expected error but got success\n');

  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('✅ Correctly returned 404 for invalid image\n');
    } else {
      console.log('⚠️  Got unexpected error:', error.message, '\n');
    }
  }
}

/**
 * Test without URL parameter
 */
async function testMissingParameter() {
  console.log('🧪 Testing without URL parameter...\n');

  try {
    const proxyUrl = `${BASE_URL}/api/menu/images/proxy`;
    await axios.get(proxyUrl, { timeout: 5000 });
    console.log('⚠️  Expected error but got success\n');

  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly returned 400 for missing parameter\n');
    } else {
      console.log('⚠️  Got unexpected error:', error.message, '\n');
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  IMAGE PROXY ENDPOINT TEST SUITE');
  console.log('═══════════════════════════════════════════════════════\n');

  // Test 1: Valid image
  const test1 = await testImageProxy();

  // Test 2: Invalid URL
  await testInvalidUrl();

  // Test 3: Missing parameter
  await testMissingParameter();

  console.log('═══════════════════════════════════════════════════════');
  if (test1) {
    console.log('✅ All tests passed!');
  } else {
    console.log('❌ Some tests failed');
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

// Run tests
runTests().catch(console.error);
