# Adding Handshake (HNS) Support to Orbiter

## Overview
This document outlines how to add Handshake domain support to Orbiter hosting platform.

## Architecture Changes Needed

### 1. Cloudflare Worker Modifications

```typescript
// orbiter-website-worker/src/index.ts

// Add HNS domain detection
function isHNSDomain(hostname: string): boolean {
  // HNS TLDs don't follow traditional TLD patterns
  const parts = hostname.split('.');
  const tld = parts[parts.length - 1];
  
  // Check if it's a valid HNS TLD (not .com, .org, etc)
  return !isTraditionalTLD(tld) && tld.length > 0;
}

// Add HNS resolver
async function resolveHNSDomain(domain: string): Promise<string | null> {
  try {
    // Option 1: Use HNS Gateway API
    const response = await fetch(`https://hnsgateway.com/api/v0/dns/${domain}`);
    const data = await response.json();
    
    // Look for TXT record with IPFS hash
    const ipfsRecord = data.records?.find(r => 
      r.type === 'TXT' && r.value.startsWith('ipfs=')
    );
    
    return ipfsRecord ? ipfsRecord.value.replace('ipfs=', '') : null;
  } catch (error) {
    console.error('HNS resolution failed:', error);
    return null;
  }
}

// Update main request handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    let ipfsHash: string | null = null;
    
    // Check domain type and resolve accordingly
    if (hostname.endsWith('.orbiter.website')) {
      // Existing Orbiter subdomain logic
      ipfsHash = await resolveOrbiterDomain(hostname, env);
    } else if (isENSDomain(hostname)) {
      // Existing ENS logic
      ipfsHash = await resolveENSDomain(hostname, env);
    } else if (isHNSDomain(hostname)) {
      // New HNS logic
      ipfsHash = await resolveHNSDomain(hostname);
    }
    
    if (ipfsHash) {
      return fetchFromIPFS(ipfsHash, url.pathname);
    }
    
    return new Response('Domain not found', { status: 404 });
  }
};
```

### 2. Smart Contract Extension

```solidity
// contracts/OrbiterHNSResolver.sol

contract OrbiterHNSResolver {
    mapping(string => address) public hnsToContract;
    mapping(string => bool) public verifiedHNSDomains;
    
    event HNSDomainLinked(string domain, address ipcmContract);
    
    function linkHNSDomain(
        string memory hnsDomain,
        address ipcmContract,
        bytes memory ownershipProof
    ) external {
        // Verify HNS ownership
        require(verifyHNSOwnership(hnsDomain, msg.sender, ownershipProof), "Invalid ownership");
        
        hnsToContract[hnsDomain] = ipcmContract;
        verifiedHNSDomains[hnsDomain] = true;
        
        emit HNSDomainLinked(hnsDomain, ipcmContract);
    }
}
```

### 3. Backend API Updates

```typescript
// orbiter-backend/src/routes/domains.ts

router.post('/domains/hns', async (req, res) => {
  const { domain, proof } = req.body;
  
  // Verify HNS ownership
  const isValid = await verifyHNSOwnership(domain, req.user.address, proof);
  
  if (isValid) {
    // Create or update site with HNS domain
    await db.sites.update({
      userId: req.user.id,
      hnsDomain: domain,
      domainType: 'HNS'
    });
    
    // Link in smart contract
    await linkHNSDomainToContract(domain, siteContract);
    
    res.json({ success: true, domain });
  } else {
    res.status(400).json({ error: 'Invalid HNS ownership proof' });
  }
});
```

### 4. CLI Updates

```typescript
// orbiter-cli/src/commands/domain.ts

export async function setDomain(domain: string, options: any) {
  const domainType = detectDomainType(domain);
  
  switch (domainType) {
    case 'HNS':
      console.log('Detected Handshake domain');
      const proof = await generateHNSOwnershipProof(domain);
      await api.linkHNSDomain(domain, proof);
      break;
    case 'ENS':
      // Existing ENS logic
      break;
    default:
      // Regular domain logic
  }
}
```

## Implementation Steps

1. **Fork Orbiter repositories**
   ```bash
   git clone https://github.com/your-fork/orbiter-website-worker
   git clone https://github.com/your-fork/orbiter-resolver
   git clone https://github.com/your-fork/orbiter-backend
   ```

2. **Add HNS libraries**
   ```bash
   npm install @namebase/hns-client
   npm install @handshake-org/hsd
   ```

3. **Update domain validation**
   - Add HNS TLD validation
   - Support Unicode domains
   - Handle HNS-specific record types

4. **Test locally**
   ```bash
   # Run local Cloudflare Worker
   wrangler dev
   
   # Test HNS resolution
   curl -H "Host: yoursite.hns" http://localhost:8787
   ```

5. **Deploy modified version**
   - Deploy updated worker
   - Deploy new contracts
   - Update backend

## HNS Domain Configuration

Users would configure their HNS domains like this:

1. **Add TXT record to HNS domain**:
   ```
   _orbiter.yoursite TXT "ipfs=QmYourIPFSHash"
   ```

2. **Or use HNS blockchain records**:
   ```json
   {
     "records": [{
       "type": "TXT",
       "name": "_orbiter",
       "value": "contract=0xYourIPCMContract"
     }]
   }
   ```

3. **Link via Orbiter CLI**:
   ```bash
   orbiter domain set yoursite.hns --verify
   ```

## Benefits of This Approach

1. **Decentralized naming**: HNS + IPFS + Blockchain = Fully decentralized
2. **Censorship resistant**: No single point of failure
3. **User ownership**: Users control their domains and content
4. **Version history**: All updates tracked on blockchain

## Challenges

1. **HNS adoption**: Limited browser support without extensions
2. **Resolution speed**: Extra lookups may add latency
3. **Complexity**: More moving parts than traditional DNS

## Alternative Approach: HNS Gateway

If modifying Orbiter is too complex, create a gateway service:

```nginx
# nginx config for HNS gateway
server {
    server_name *.hns.to;
    
    location / {
        # Resolve HNS to Orbiter subdomain
        set $orbiter_domain "";
        access_by_lua_block {
            local domain = ngx.var.host:match("(.+)%.hns%.to$")
            -- Lookup HNS → Orbiter mapping
            ngx.var.orbiter_domain = lookup_hns_to_orbiter(domain)
        }
        
        proxy_pass https://$orbiter_domain.orbiter.website;
    }
}
```

This would allow: `yoursite.hns.to` → `yoursite.orbiter.website`