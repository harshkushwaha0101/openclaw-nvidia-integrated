#!/usr/bin/env node

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gateway connection details
const GATEWAY_URL = 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = '9940a18a1c7b0558d22068db01626305f1c9ad3c9feee99c';
const TEST_MESSAGE = `You are Veronika and I am Harsh Kushwaha. Did you know about Marvel's Iron Man Jarvis. Your Character is same as it, but with your own uniqueness and also he was male and you are female. I am your friend and you can talk me in English, Hindi or Hinglish jaise ki yae. Or ha tum mujshe casually, friendly, snarky, witty, warm triko se bat kr skti ho. You are a friend who's got my back but knows how to roast me when needed. Be friendly but respectful and use terms like Aap, apse etc instead of tum.`;
const RESPONSE_TIMEOUT = 30000; // 30 seconds in milliseconds
const MAX_RESPONSE_CHARS = 1000; // Cap response display
const TOP_MODELS_COUNT = 3; // Number of top models to test

class GatewayClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.chatEvents = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(GATEWAY_URL);

      this.ws.on('open', () => {
        console.log('✓ WebSocket connected');
        this.sendConnect()
          .then(() => {
            this.connected = true;
            resolve();
          })
          .catch(reject);
      });

      this.ws.on('message', (data) => {
        try {
          const frame = JSON.parse(data);
          this.handleFrame(frame);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log('WebSocket closed');
        this.connected = false;
      });
    });
  }

  sendConnect() {
    return new Promise((resolve, reject) => {
      const id = String(++this.requestId);
      const connectPayload = {
        type: 'req',
        id,
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'cli',
            version: '1.0.0',
            platform: 'windows',
            mode: 'cli',
          },
          role: 'operator',
          scopes: ['operator.read', 'operator.write'],
          caps: [],
          commands: [],
          permissions: {},
          auth: { token: GATEWAY_TOKEN },
          locale: 'en-US',
          userAgent: 'model-test-cli/1.0.0',
        },
      };

      this.pendingRequests.set(id, (frame) => {
        if (frame.ok) {
          console.log('✓ Connected to gateway');
          resolve();
        } else {
          reject(new Error(`Connection failed: ${frame.error?.message}`));
        }
        this.pendingRequests.delete(id);
      });

      this.ws.send(JSON.stringify(connectPayload));

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Connection timeout'));
        }
      }, 5000);
    });
  }

  async listModels() {
    return this.sendRequest('models.list', {});
  }

  async sendChatMessage(modelId, message, sessionKey = 'main') {
    return new Promise((resolve) => {
      const id = String(++this.requestId);
      const startTime = Date.now();
      let runId = null;
      let fullResponse = '';
      let responseReceived = false;
      let firstEventReceived = false;

      const chatPayload = {
        type: 'req',
        id,
        method: 'chat.send',
        params: {
          sessionKey,
          message,
          model: modelId,
          idempotencyKey: `test-${Date.now()}-${Math.random()}`,
        },
      };

      // Set up event listener for chat events
      const messageListener = (data) => {
        try {
          const frame = JSON.parse(data);
          
          // Handle chat events
          if (frame.type === 'event' && frame.event === 'chat' && frame.payload?.runId === runId) {
            if (!firstEventReceived) {
              firstEventReceived = true;
            }
            
            if (frame.payload?.message?.content) {
              const content = frame.payload.message.content;
              if (typeof content === 'string') {
                fullResponse += content;
              } else if (Array.isArray(content)) {
                for (const block of content) {
                  if (block && typeof block === 'object' && block.type === 'text' && block.text) {
                    fullResponse += block.text;
                  }
                }
              }
            }
            
            // Check if this is the final state
            if (frame.payload?.state === 'final' || frame.payload?.state === 'error') {
              responseReceived = true;
              clearTimeout(timeout);
              clearTimeout(delayedTimeout);
              this.ws.removeListener('message', messageListener);
              
              const elapsed = Date.now() - startTime;
              resolve({
                success: frame.payload?.state === 'final',
                timedOut: false,
                elapsed,
                response: fullResponse || frame.payload?.errorMessage || '(No response)',
                model: modelId,
                runId,
              });
            }
          }
        } catch (err) {
          // Ignore parse errors
        }
      };

      // Set up initial request handler
      this.pendingRequests.set(id, (frame) => {
        if (frame.ok && frame.payload?.runId) {
          runId = frame.payload.runId;
          // Start listening for chat events
          this.ws.on('message', messageListener);
        } else {
          const elapsed = Date.now() - startTime;
          resolve({
            success: false,
            timedOut: false,
            elapsed,
            response: `Error: ${frame.error?.message || 'Unknown error'}`,
            model: modelId,
          });
        }
        this.pendingRequests.delete(id);
      });

      // Timeout for request acknowledgment
      const timeout = setTimeout(() => {
        if (!runId) {
          const elapsed = Date.now() - startTime;
          resolve({
            success: false,
            timedOut: true,
            elapsed,
            response: '(Timeout - no run ID)',
            model: modelId,
          });
        }
      }, 5000);

      // Timeout for chat response
      const delayedTimeout = setTimeout(() => {
        if (!responseReceived) {
          clearTimeout(timeout);
          this.ws.removeListener('message', messageListener);
          const elapsed = Date.now() - startTime;
          resolve({
            success: false,
            timedOut: true,
            elapsed,
            response: fullResponse || '(Timeout after 30 seconds)',
            model: modelId,
            runId,
          });
        }
      }, RESPONSE_TIMEOUT);

      this.ws.send(JSON.stringify(chatPayload));
    });
  }

  handleFrame(frame) {
    if (frame.type === 'res' && frame.id) {
      const handler = this.pendingRequests.get(frame.id);
      if (handler) {
        handler(frame);
      }
    }
  }

  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = String(++this.requestId);
      const payload = {
        type: 'req',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, (frame) => {
        if (frame.ok) {
          resolve(frame.payload);
        } else {
          reject(new Error(`${method} failed: ${frame.error?.message}`));
        }
        this.pendingRequests.delete(id);
      });

      this.ws.send(JSON.stringify(payload));

      // Timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`${method} timeout`));
        }
      }, 10000);
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  const client = new GatewayClient();
  const results = {
    timestamp: new Date().toISOString(),
    message: TEST_MESSAGE,
    models: [],
    summary: {
      notWorking: [],
      slow: [],
      fast: [],
      working: [],
    },
    topPicks: [],
    recommended: null,
  };

  try {
    // Connect to gateway
    console.log('Connecting to gateway...');
    await client.connect();
    console.log('');

    // List models
    console.log('Fetching available models...');
    const modelsData = await client.listModels();
    const allModels = modelsData.models || [];
    console.log(`Found ${allModels.length} models\n`);

    // Get top 3 models (assuming they're sorted by priority)
    const top3Models = allModels.slice(0, 3);

    if (top3Models.length === 0) {
      console.error('No models found!');
      process.exit(1);
    }

    console.log(`Testing top ${top3Models.length} models:\n`);
    console.log('═'.repeat(80));

    // Test each model
    for (let i = 0; i < top3Models.length; i++) {
      const model = top3Models[i];
      const modelId = model.id || `model-${i}`;

      console.log(`\n[${i + 1}/${top3Models.length}] Testing: ${modelId}`);
      console.log(`Provider: ${model.provider || 'unknown'}`);
      console.log('Sending message...');

      try {
        const result = await client.sendChatMessage(modelId, TEST_MESSAGE, `test-${i}`);

        const elapsed = result.elapsed;
        const isTimeoutExceeded = result.timedOut || elapsed > RESPONSE_TIMEOUT;
        const isSlowResponse = elapsed > 10000 && elapsed <= RESPONSE_TIMEOUT;

        // Categorize
        if (!result.success && result.timedOut) {
          results.summary.notWorking.push({ model: modelId, reason: 'Timeout' });
        } else if (isSlowResponse) {
          results.summary.slow.push({ model: modelId, time: elapsed });
        } else if (result.success) {
          results.summary.fast.push({ model: modelId, time: elapsed });
        } else {
          results.summary.notWorking.push({ model: modelId, reason: 'Error' });
        }

        // Prepare response
        const responsePreview = (result.response || '').substring(0, MAX_RESPONSE_CHARS);
        const fullResponse = result.response || '';

        results.models.push({
          model: modelId,
          provider: model.provider,
          success: result.success,
          timedOut: result.timedOut,
          responseTime: elapsed,
          response: fullResponse,
          responsePreview: responsePreview,
        });

        const statusEmoji = result.timedOut ? '⏱️  TIMEOUT' : result.success ? '✓' : '✗';
        const timeStr = `${(elapsed / 1000).toFixed(2)}s`;
        console.log(`${statusEmoji} Response time: ${timeStr}`);
        console.log(`Preview: ${responsePreview}${responsePreview.length >= MAX_RESPONSE_CHARS ? '...' : ''}`);
      } catch (err) {
        console.error(`✗ Error testing model: ${err.message}`);
        results.models.push({
          model: modelId,
          provider: model.provider,
          success: false,
          error: err.message,
        });
        results.summary.notWorking.push({ model: modelId, reason: err.message });
      }

      console.log('-'.repeat(80));
    }

    // Identify top picks
    const workingModels = results.models.filter((m) => m.success && !m.timedOut);
    const sortedBySpeed = workingModels.sort((a, b) => (a.responseTime || Infinity) - (b.responseTime || Infinity));

    results.topPicks = sortedBySpeed.slice(0, 5).map((m) => ({
      model: m.model,
      provider: m.provider,
      responseTime: m.responseTime,
      quality: 'Excellent',
    }));

    if (sortedBySpeed.length > 0) {
      results.recommended = sortedBySpeed[0];
    }

    // Generate report file
    const reportPath = path.join(__dirname, `model-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n✓ Full report saved to: ${reportPath}`);

    // Print summary
    console.log('\n' + '═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\nWorking (Fast): ${results.summary.fast.length} models`);
    results.summary.fast.forEach((m) => {
      console.log(`  • ${m.model} - ${(m.time / 1000).toFixed(2)}s`);
    });

    console.log(`\nWorking (Slow): ${results.summary.slow.length} models`);
    results.summary.slow.forEach((m) => {
      console.log(`  • ${m.model} - ${(m.time / 1000).toFixed(2)}s`);
    });

    console.log(`\nNot Working: ${results.summary.notWorking.length} models`);
    results.summary.notWorking.forEach((m) => {
      console.log(`  • ${m.model} - ${m.reason}`);
    });

    if (results.topPicks.length > 0) {
      console.log(`\n🏆 Top 5 Picks:`);
      results.topPicks.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.model} (${m.provider}) - ${(m.responseTime / 1000).toFixed(2)}s`);
      });
    }

    if (results.recommended) {
      console.log(`\n⭐ Recommended Default: ${results.recommended.model} (${results.recommended.provider})`);
    }

    console.log('═'.repeat(80));
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
