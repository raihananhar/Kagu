const rateLimit = require('express-rate-limit');
const { getClientByApiKey, getClientById, clients } = require('../config/clients');

// Create rate limiters at initialization time
const rateLimiters = {};
for (const [clientId, client] of Object.entries(clients)) {
  if (client.rateLimit) {
    rateLimiters[clientId] = rateLimit({
      windowMs: client.rateLimit.windowMs,
      max: client.rateLimit.max,
      message: {
        error: 'Rate limit exceeded',
        message: `Too many requests from this client. Try again in ${Math.ceil(client.rateLimit.windowMs / 60000)} minutes.`
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.client.id,
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
      }
    });
  }
}

function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide a valid API key in the X-API-Key header or apiKey query parameter'
    });
  }

  const client = getClientByApiKey(apiKey);
  
  if (!client) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  // Add client information to request object
  req.client = client;
  next();
}

function validateClientAccess(req, res, next) {
  // For KAGU client, verify it's the KAGU client
  if (req.client.id !== 'KAGU') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have access to KAGU data'
    });
  }

  next();
}

function validateAssetAccess(req, res, next) {
  const { ASSET_ID } = req.params;
  const { validateClientAccess: validateAssetPattern } = require('../config/clients');
  
  if (!validateAssetPattern('KAGU', ASSET_ID)) {
    return res.status(403).json({
      error: 'Asset access denied',
      message: 'This asset is not accessible to KAGU client (must start with KAGU or SLTU)'
    });
  }

  next();
}

// Keep the old function name for backward compatibility but redirect to asset validation
function validateDeviceAccess(req, res, next) {
  return validateAssetAccess(req, res, next);
}

function checkPermissions(permission) {
  return (req, res, next) => {
    if (!req.client.permissions[permission]) {
      return res.status(403).json({
        error: 'Permission denied',
        message: `This client does not have ${permission} permission`
      });
    }
    next();
  };
}

function createRateLimiter(req, res, next) {
  const client = req.client;
  
  if (!client || !client.rateLimit) {
    return next();
  }

  const limiter = rateLimiters[client.id];
  if (!limiter) {
    return next();
  }

  limiter(req, res, next);
}

function validateQueryParams(req, res, next) {
  const { limit, offset, startDate, endDate, format } = req.query;

  // Validate limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({
        error: 'Invalid limit parameter',
        message: 'Limit must be a number between 1 and 1000'
      });
    }
    req.query.limit = limitNum;
  }

  // Validate offset
  if (offset !== undefined) {
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        error: 'Invalid offset parameter',
        message: 'Offset must be a non-negative number'
      });
    }
    req.query.offset = offsetNum;
  }

  // Validate date range
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        error: 'Invalid startDate parameter',
        message: 'startDate must be a valid ISO 8601 date string'
      });
    }
    req.query.startDate = start;
  }

  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid endDate parameter',
        message: 'endDate must be a valid ISO 8601 date string'
      });
    }
    req.query.endDate = end;
  }

  // Validate date range logic
  if (req.query.startDate && req.query.endDate && req.query.startDate > req.query.endDate) {
    return res.status(400).json({
      error: 'Invalid date range',
      message: 'startDate must be before endDate'
    });
  }

  // Validate format
  if (format && !['json', 'csv', 'xml'].includes(format)) {
    return res.status(400).json({
      error: 'Invalid format parameter',
      message: 'Format must be one of: json, csv, xml'
    });
  }

  next();
}

function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Rate limit error
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: err.message
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      message: err.message,
      details: err.details || []
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  authenticateApiKey,
  validateClientAccess,
  validateDeviceAccess,
  validateAssetAccess,
  checkPermissions,
  createRateLimiter,
  validateQueryParams,
  errorHandler
};