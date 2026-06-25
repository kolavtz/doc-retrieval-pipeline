import { usePlatformStore } from './store/usePlatformStore';

async function runTest() {
  console.log('--- INITIALIZING PLATFORM FAILOVER TEST ---');

  const store = usePlatformStore.getState();

  // 1. Setup mock endpoints
  console.log('\nConfiguring test endpoints...');
  const id1 = store.addEndpoint({
    name: 'Failing Local LLM',
    provider: 'custom',
    baseUrl: 'http://localhost:9999/v1',
    apiKey: 'none',
    modelId: 'llama3-failing',
    isEnabled: true
  });

  const id2 = store.addEndpoint({
    name: 'Backup Groq Llama 3',
    provider: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: 'dummy-key',
    modelId: 'llama-3.1-70b-versatile',
    isEnabled: true
  });

  // Set Priority Queue: [Failing Local, Backup Groq]
  store.setRoutingPriority([id1, id2]);
  console.log('Priority queue set to:', usePlatformStore.getState().routingPriority);

  // 2. Set Demo Mode to true for simulation
  store.setDemoMode(true);
  console.log('Demo mode enabled:', usePlatformStore.getState().isDemoMode);

  // 3. Create a dummy file upload
  const mockFile = {
    name: 'test_invoice_99211.pdf',
    size: 2048,
    type: 'application/pdf'
  } as unknown as File;

  console.log('\nUploading document...');
  await store.uploadDocuments([mockFile]);

  // Wait for OCR simulation to complete
  await new Promise((resolve) => setTimeout(resolve, 800));

  const docs = usePlatformStore.getState().documents;
  const doc = docs[0];
  console.log('Document uploaded:', doc.name);
  console.log('OCR text extracted:\n', doc.rawOcrText.substring(0, 150) + '...\n');

  // 4. Run Extraction and trigger failover
  console.log('Running extraction. This should fail on the Local LLM and succeed on Backup Groq...');
  await store.runExtraction(doc.id);

  // 5. Verify Results
  const updatedDocs = usePlatformStore.getState().documents;
  const processedDoc = updatedDocs.find(d => d.id === doc.id)!;

  console.log('\n--- EXTRACTION COMPLETE ---');
  console.log('Status:', processedDoc.status);
  console.log('Error (if any):', processedDoc.error);
  
  if (processedDoc.extractionResult) {
    const result = processedDoc.extractionResult;
    console.log('Model Used:', result.metadata.modelUsed);
    console.log('Latency:', result.metadata.latencyMs + 'ms');
    console.log('Extracted Data Keys:', Object.keys(result.extractedData));
    console.log('Routing Trajectory:');
    result.metadata.trajectory.forEach((log, index) => {
      console.log(`  Step ${index + 1}: ${log.endpointName} (${log.provider}) -> ${log.status.toUpperCase()} (${log.latencyMs}ms)${log.error ? ' Error: ' + log.error : ''}`);
    });

    console.log('\nValidation Anomalies found:', processedDoc.anomalies.length);
    processedDoc.anomalies.forEach((a) => {
      console.log(`  [${a.type.toUpperCase()}] ${a.message}`);
    });
  }

  // Assertion check
  if (processedDoc.status === 'completed' && processedDoc.extractionResult?.metadata.trajectory.length === 2) {
    console.log('\nTEST RESULT: SUCCESS! Failover routing worked perfectly.');
    process.exit(0);
  } else {
    console.error('\nTEST RESULT: FAILED! Check state updates.');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
