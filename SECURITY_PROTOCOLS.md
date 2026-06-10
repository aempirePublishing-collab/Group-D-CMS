# Student Data Security & Cryptographic Protection Protocols (GDCMS)

This document outlines the advanced security architecture implemented in the Group D Class Management System (GDCMS) to ensure the confidentiality, integrity, and availability of student performance data, academic files, and private student notes.

---

## 1. At-Rest Cryptographic Shield (AES-256-CBC)

### Problem Addressed
Files uploaded to general application servers or storage units are vulnerable to unauthorized access if physical storage structures are compromised. Private student notebooks shouldn't exist in plain-text format on raw databases.

### Implemented Protection
1. **Dynamic Initialization Vector (IV)**: For every single file upload (both student submissions and lecture syllabus documents), a unique 16-byte cryptographically-secure random IV is generated using modern secure entropy sources:
   ```typescript
   const iv = crypto.randomBytes(16);
   ```
2. **Symmetric Encryption Cipher**: Files are encrypted with AES-256 in Cipher Block Chaining (CBC) mode before being committed to physical disk.
3. **Appended Binary Block**: The randomized 16-byte IV is prepended to the ciphertext block. During streams/downloads, this block is parsed dynamically, extracting the exact IV to reconstruct the deciphering parameters on-the-fly.
4. **Notebook Level Shielding**: Personal notes are similarly ciphertext-encrypted on backend nodes, ensuring that system db dumps yield no usable student plain-text data.

---

## 2. Multi-Role Authentication with Index Numbers & OAuth 2.0

### Access Verification
1. **Student Indexing**: Students authenticating into the system must register their unique state academic index numbers. Passwords are securely transformed into high-collision resistant SHA-256 representations prior to persistent write events.
2. **OAuth 2.0 Interceptor**: Integrated simulated OAuth gateways permit instant login via official identity providers, securely parsing email scope domains to auto-assign access boundaries (`@gdcms.edu` logins dynamically receive Lecturer status, other handles register as Students).
3. **Bearer Token Guards**: API gateways employ robust authorization guard middleware. The system rejects standard browser cookie storage for critical transactions, utilizing explicit `Authorization: Bearer <sessionToken>` headers to prevent Cross-Site Request Forgery (CSRF).

---

## 3. Recommended Security Hardening Protocols for Production

While GDCMS has implemented strong cryptographic defaults, administrators deploying this full stack should configure these secondary architectural layers:

### A. Strict Transport Security (HSTS) & SSL termination
Enforce TLS 1.3 across all communication nodes. Since student index IDs and session tokens are transmitted over header packets, encrypt all socket tunnels:
```nginx
# Secure NGINX configuration snippet
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
```

### B. Upload Sanitization & Extension Blocklisting
Avoid execution of remote server injection exploits. Ensure our uploaded files are parsed rigorously, utilizing file signature checks (magic bytes check) rather than relying strictly on the client-provided MIME type:
* Ensure uploaded binaries are locked outside the public web application root.
* Strip executable bits from uploaded artifacts using `chmod 0600`.

### C. Rate Limiting on Login Gateways
Enable distributed denial of service defenses and brute forcing mitigations on index login API points:
```typescript
import rateLimit from "express-rate-limit";
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per window
  message: "Too many login attempts, please try again after 15 minutes."
});
```

### D. Session Invalidation Lifecycle
Tokens should utilize a temporal lifespan decay (e.g., 2 hour expiration timestamp verification) to protect shared workstations often found in university computer labs.
