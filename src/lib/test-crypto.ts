import { encryptText, decryptText } from './crypto/encryption';

// Mock browser window globals for Node environment to test client-side module
if (typeof window === 'undefined') {
  const { webcrypto } = require('crypto');
  global.window = {
    crypto: webcrypto,
    btoa: (str: string) => Buffer.from(str, 'binary').toString('base64'),
    atob: (b64: string) => Buffer.from(b64, 'base64').toString('binary')
  } as any;
}

async function runCryptoTest() {
  console.log('--- STARTING COMPLIANCE ENCRYPTION PIPELINE VERIFICATION ---');
  
  const testPayload = JSON.stringify({
    document_id: "doc-test-9921",
    file_name: "june_charge_receipt.pdf",
    category: "Bills",
    raw_ocr_text: "STATEMENT OF CHARGE: Acme Corp. Subtotal: $450.00. Tax: $36.00. Total: $486.00",
    extracted_metadata: {
      invoice_number: "INV-2026-9921",
      grand_total: 486.00,
      vendor_name: "Acme Corp"
    }
  }, null, 2);

  const correctPassphrase = "secure-startup-passphrase-2026";
  const incorrectPassphrase = "wrong-hacker-passphrase";

  try {
    // 1. Run Encryption
    console.log('\nStep 1: Running client-side AES-GCM 256-bit encryption...');
    const encryptedPkg = await encryptText(testPayload, correctPassphrase);
    console.log('✔ Encryption successful!');
    console.log('IV Base64 Length:', encryptedPkg.iv.length);
    console.log('Salt Base64 Length:', encryptedPkg.salt.length);
    console.log('Ciphertext Base64 Length:', encryptedPkg.ciphertext.length);

    // 2. Decrypt with correct passphrase
    console.log('\nStep 2: Decrypting with the CORRECT passphrase...');
    const decryptedPayload = await decryptText(encryptedPkg, correctPassphrase);
    
    if (decryptedPayload === testPayload) {
      console.log('✔ Decryption successful! Plaintext matches the source exactly.');
      const parsed = JSON.parse(decryptedPayload);
      console.log(`  Decrypted Doc ID: ${parsed.document_id}`);
      console.log(`  Decrypted Vendor: ${parsed.extracted_metadata.vendor_name}`);
      console.log(`  Decrypted Total: $${parsed.extracted_metadata.grand_total}`);
    } else {
      throw new Error("Decrypted payload does not match the source text.");
    }

    // 3. Decrypt with incorrect passphrase
    console.log('\nStep 3: Attempting decryption with an INCORRECT passphrase (checking fail-safes)...');
    try {
      await decryptText(encryptedPkg, incorrectPassphrase);
      // If we reach this line, it failed to reject
      throw new Error("Rejection failure: Decryption succeeded with the WRONG passphrase!");
    } catch (err: any) {
      if (err.message && err.message.includes("Rejection failure")) {
        throw err;
      }
      console.log('✔ Rejection successful! Decryption threw an expected cryptographic verification exception:');
      console.log(`  Exception details: ${err.message || err}`);
    }

    console.log('\n--- VERIFICATION COMPLETED: ALL TESTS PASS ---');
    console.log('Client-side cryptography is secure, conforming to zero-knowledge requirements.');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ CRYPTOGRAPHIC VERIFICATION FAILED:', error.message || error);
    process.exit(1);
  }
}

runCryptoTest();
