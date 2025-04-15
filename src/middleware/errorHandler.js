// server/src/middleware/errorHandler.js
/**
 * Global feilhåndterer for API-et
 */
function errorHandler(err, req, res, next) {
    console.error('API Error:', err);
    
    // Sjekk om det er en Neo4j-feil
    const isNeo4jError = err.code && err.message && (
      err.code.startsWith('Neo.') || 
      err.message.includes('Neo4j')
    );
    
    if (isNeo4jError) {
      return res.status(500).json({
        error: 'Database Error',
        message: 'An error occurred while communicating with the database'
      });
    }
    
    // For andre feil
    res.status(err.status || 500).json({
      error: err.name || 'Server Error',
      message: err.message || 'An unexpected error occurred'
    });
  }
  
  module.exports = errorHandler;