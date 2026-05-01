#!/usr/bin/env node

/**
 * Model Testing Script for OpenClaw Gateway
 * Tests top 3 models with a custom prompt and tracks response times
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_MESSAGE = `You are Veronika and I am Harsh Kushwaha. Did you know about Marvel's Iron Man Jarvis. Your Character is same as it, but with your own uniqueness and also he was male and you are female. I am your friend and you can talk me in English, Hindi or Hinglish jaise ki yae. Or ha tum mujshe casually, friendly, snarky, witty, warm triko se bat kr skti ho. You are a friend who's got my back but knows how to roast me when needed. Be friendly but respectful and use terms like Aap, apse etc instead of tum.`;

const RESPONSE_TIMEOUT = 30000; // 30 seconds
const TOP_MODELS = [
  'nvidia/meta/llama-3.1-70b-instruct',
  'nvidia/meta/llama-3.1-8b-instruct',
  'nvidia/minimaxai/minimax-m2.5'
];

async function runModelTest() {
  const results = {
    timestamp: new Date().toISOString(),
    gateway_url: 'http://127.0.0.1:18789',
    test_message: TEST_MESSAGE,
    models_tested: [],
    summary: {
      working: [],
      slow: [],
      timedOut: [],
      failed: []
    },
    topPicks: [],
    recommendedDefault: null,
  };

  console.log('═'.repeat(100));
  console.log('🤖 OpenClaw Model Performance Testing');
  console.log('═'.repeat(100));
  console.log(`\n⏱️  Test Started: ${new Date().toISOString()}`);
  console.log(`📊 Testing ${TOP_MODELS.length} Models`);
  console.log(`🔗 Gateway: http://127.0.0.1:18789`);
  console.log(`⏰ Response Timeout: ${RESPONSE_TIMEOUT / 1000}s`);
  console.log('\n' + '═'.repeat(100));
  console.log('TEST MESSAGE:');
  console.log('═'.repeat(100));
  console.log(TEST_MESSAGE);
  console.log('\n' + '═'.repeat(100) + '\n');

  for (let i = 0; i < TOP_MODELS.length; i++) {
    const modelId = TOP_MODELS[i];
    const sessionKey = `test-model-${i}-${Date.now()}`;

    console.log(`\n[${i + 1}/${TOP_MODELS.length}] Testing Model: ${modelId}`);
    console.log('-'.repeat(100));

    const startTime = Date.now();
    let response = '';
    let success = false;
    let timedOut = false;
    let responseTime = 0;

    try {
      // Call the agent with the specific model
      const cmd = `pnpm openclaw agent --model "${modelId}" --message "${TEST_MESSAGE.replace(/"/g, '\\"')}" --json`;
      
      console.log(`📤 Sending message...`);
      console.log(`⏱️  Start time: ${new Date().toLocaleTimeString()}`);

      try {
        const output = execSync(cmd, {
          timeout: RESPONSE_TIMEOUT,
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        responseTime = Date.now() - startTime;
        
        try {
          const parsed = JSON.parse(output);
          response = parsed.output || parsed.message || JSON.stringify(parsed).substring(0, 1000);
          success = !parsed.error;
        } catch {
          response = output.substring(0, 1000);
          success = true;
        }
      } catch (err) {
        responseTime = Date.now() - startTime;
        if (err.killed) {
          timedOut = true;
          response = '(Timeout - response exceeded 30 seconds)';
        } else {
          response = `Error: ${err.message}`;
          success = false;
        }
      }

      const isSlowResponse = responseTime > 10000 && responseTime <= RESPONSE_TIMEOUT;
      const responsePreview = response.substring(0, 300);

      console.log(`✅ Response received`);
      console.log(`⏱️  Response Time: ${(responseTime / 1000).toFixed(2)}s`);
      console.log(`📄 Preview: ${responsePreview}${responsePreview.length >= 300 ? '...' : ''}`);

      const modelResult = {
        model: modelId,
        responseTime,
        success: !timedOut && success,
        timedOut,
        response,
        timestamp: new Date().toISOString(),
        quality: timedOut ? 'timeout' : responseTime > 20000 ? 'very-slow' : responseTime > 10000 ? 'slow' : responseTime > 5000 ? 'medium' : 'fast',
      };

      results.models_tested.push(modelResult);

      // Categorize
      if (timedOut) {
        results.summary.timedOut.push(modelId);
      } else if (isSlowResponse) {
        results.summary.slow.push({ model: modelId, time: responseTime });
      } else if (success) {
        results.summary.working.push({ model: modelId, time: responseTime });
      } else {
        results.summary.failed.push(modelId);
      }

    } catch (err) {
      console.error(`❌ Test failed: ${err.message}`);
      responseTime = Date.now() - startTime;
      results.models_tested.push({
        model: modelId,
        responseTime,
        success: false,
        timedOut: false,
        error: err.message,
        timestamp: new Date().toISOString(),
        quality: 'failed',
      });
      results.summary.failed.push(modelId);
    }

    console.log('-'.repeat(100));
  }

  // Generate recommendations
  const workingModels = results.models_tested
    .filter(m => !m.timedOut && m.success)
    .sort((a, b) => a.responseTime - b.responseTime);

  if (workingModels.length > 0) {
    results.topPicks = workingModels.map(m => ({
      rank: workingModels.indexOf(m) + 1,
      model: m.model,
      responseTime: m.responseTime,
      quality: m.quality,
    }));

    results.recommendedDefault = {
      model: workingModels[0].model,
      responseTime: workingModels[0].responseTime,
      reason: 'Fastest response time with successful output',
    };
  }

  // Save report
  const reportPath = path.join(__dirname, `model-test-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  // Print summary
  console.log('\n' + '═'.repeat(100));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(100));

  console.log(`\n✅ Working (Fast): ${results.summary.working.length} model(s)`);
  results.summary.working.forEach((m) => {
    console.log(`   • ${m.model} - ${(m.time / 1000).toFixed(2)}s`);
  });

  console.log(`\n⚠️  Working (Slow): ${results.summary.slow.length} model(s)`);
  results.summary.slow.forEach((m) => {
    console.log(`   • ${m.model} - ${(m.time / 1000).toFixed(2)}s`);
  });

  console.log(`\n⏱️  Timed Out: ${results.summary.timedOut.length} model(s)`);
  results.summary.timedOut.forEach((m) => {
    console.log(`   • ${m}`);
  });

  console.log(`\n❌ Failed: ${results.summary.failed.length} model(s)`);
  results.summary.failed.forEach((m) => {
    console.log(`   • ${m}`);
  });

  if (results.topPicks.length > 0) {
    console.log(`\n🏆 Top Picks:`);
    results.topPicks.forEach((m) => {
      console.log(`   ${m.rank}. ${m.model}`);
      console.log(`      Response Time: ${(m.responseTime / 1000).toFixed(2)}s`);
      console.log(`      Quality: ${m.quality}`);
    });
  }

  if (results.recommendedDefault) {
    console.log(`\n⭐ Recommended Default Model:`);
    console.log(`   Model: ${results.recommendedDefault.model}`);
    console.log(`   Response Time: ${(results.recommendedDefault.responseTime / 1000).toFixed(2)}s`);
    console.log(`   Reason: ${results.recommendedDefault.reason}`);
  }

  console.log(`\n💾 Full Report: ${reportPath}`);
  console.log('═'.repeat(100));
  console.log(`\n✨ Test Completed: ${new Date().toISOString()}\n`);

  return results;
}

runModelTest().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
