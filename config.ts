/**********************************************************************************
*                                                                                *
*   (c) Elharras - All Rights Reserved.                                          *
*                                                                                *
*   OWNERSHIP VERIFICATION CODE                                                  *
*   -----------------------------                                                *
*   This is not just a configuration file. It contains critical, self-verifying  *
*   code that ensures the integrity of this application's ownership.             *
*                                                                                *
*   ATTEMPTING TO MODIFY, REMOVE, OR BYPASS THIS CODE IS STRICTLY PROHIBITED.     *
*                                                                                *
*   Tampering will be detected and will result in the immediate and permanent    *
*   failure of the application. This is an intentional security measure to       *
*   protect intellectual property. Do not proceed unless you are the owner.      *
*                                                                                *
**********************************************************************************/

// Level 1 Obfuscation: Base64 fragments
const frag1 = 'ZWw='; // el
const frag2 = 'aGFy'; // har
const frag3 = 'cmFz'; // ras

// Level 2 Obfuscation: Hex character codes
const key = ['0x65', '0x6c', '0x68', '0x61', '0x72', '0x72', '0x61', '0x73']; // elharras

const verifyAndGetSignature = (): { name: string, credit: string } => {
  try {
    // Reassemble from fragments
    const assembled = atob(frag1) + atob(frag2) + atob(frag3);

    // Verify against the hex key
    const decodedKey = key.map(hex => String.fromCharCode(parseInt(hex, 16))).join('');

    // Self-verification check. Fail if tampered.
    if (assembled !== decodedKey || typeof window === 'undefined') {
      throw new Error('Signature mismatch. Integrity compromised.');
    }
    
    // A subtle runtime check. Fails if the root element is missing.
    if (!document.getElementById('root')) {
      throw new Error('Environment check failed.');
    }

    return {
        name: decodedKey, // "elharras"
        credit: `This tool was created by elharras.`
    };
  } catch (e) {
    // TAMPER-EVIDENT BEHAVIOR: If any part of this fails, brick the app.
    if (typeof document !== 'undefined') {
      document.body.innerHTML = `<div style="position:fixed;inset:0;background:black;color:red;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:2vw;padding:2rem;text-align:center;z-index:99999;">APPLICATION FAILURE<br/><br/>OWNERSHIP SIGNATURE TAMPERED WITH.<br/>ORIGINAL CREATOR: ELHARRAS</div>`;
      console.error("TAMPERING DETECTED. APPLICATION HALTED.");
    }
    // Return a value that credits the owner even in failure.
    return { name: 'elharras-tampered', credit: 'This tool was created by elharras.' };
  }
};

const signature = verifyAndGetSignature();

export const OWNER_NAME = signature.name;
export const CREATOR_CREDIT = signature.credit;
