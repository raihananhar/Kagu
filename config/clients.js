const clients = {
  'KAGU': {
    name: 'KAGU Client',
    apiKey: 'api_key_kagu_12345',
    assetPatterns: ['KAGU*', 'SZLU*', 'TRIU*'], // Assets starting with KAGU, SZLU, or TRIU
    specificAssets: [
      'TRIU8784787',
      'KAGU3330950',
      'KAGU3330820',
      'SZLU9721417',
      'SZLU3961914',
      'KAGU3331180',
      'KAGU3331339',
      'KAGU3331283',
      'KAGU7771228',
      'KAGU3331302'
    ],
    totalAssets: 10, // 7x KAGU + 2x SZLU + 1x TRIU assets
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 2000 // limit to 2000 requests per windowMs
    },
    permissions: {
      realTime: true,
      historical: true,
      export: true,
      gps: true,
      reefer: true
    }
  }
};

function getClientById(clientId) {
  return clients[clientId] || null;
}

function getClientByApiKey(apiKey) {
  for (const [clientId, client] of Object.entries(clients)) {
    if (client.apiKey === apiKey) {
      return { ...client, id: clientId };
    }
  }
  return null;
}

function validateClientAccess(clientId, assetId) {
  const client = getClientById(clientId);
  if (!client) {
    return false;
  }
  
  // First check if it's in the specific assets list (exact match)
  if (client.specificAssets && client.specificAssets.includes(assetId)) {
    return true;
  }
  
  // Then check if assetId matches any of the client's asset patterns
  return client.assetPatterns.some(pattern => {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return regex.test(assetId);
  });
}

function filterAssetsForClient(clientId, events) {
  const client = getClientById(clientId);
  if (!client) {
    return [];
  }
  
  return events.filter(event => {
    // Check both DeviceData.LastAssetID and ReeferData.AssetID
    const deviceAssetId = event.Event?.DeviceData?.LastAssetID;
    const reeferAssetId = event.Event?.ReeferData?.AssetID;
    
    const assetToCheck = reeferAssetId || deviceAssetId;
    
    if (!assetToCheck) {
      return false;
    }
    
    // First check if it's in the specific assets list (exact match)
    if (client.specificAssets && client.specificAssets.includes(assetToCheck)) {
      return true;
    }
    
    // Then check if assetId matches any of the client's asset patterns
    return client.assetPatterns.some(pattern => {
      const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
      return regex.test(assetToCheck);
    });
  });
}

function getExpectedAssetsForClient(clientId) {
  const client = getClientById(clientId);
  if (!client) {
    return { expectedCount: 0, specificAssets: [], patterns: [] };
  }
  
  return {
    expectedCount: client.totalAssets,
    specificAssets: client.specificAssets || [],
    patterns: client.assetPatterns || []
  };
}

function getAllClients() {
  return Object.keys(clients).map(id => ({
    id,
    name: clients[id].name,
    assetCount: clients[id].totalAssets,
    assetPatterns: clients[id].assetPatterns,
    permissions: clients[id].permissions
  }));
}

module.exports = {
  clients,
  getClientById,
  getClientByApiKey,
  validateClientAccess,
  filterAssetsForClient,
  getExpectedAssetsForClient,
  getAllClients
};