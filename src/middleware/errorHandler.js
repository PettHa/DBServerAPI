// server/src/middleware/errorHandler.js

// Enkel feilhåndterer - logg feilen og send en generell feilmelding
const errorHandler = (err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err); // Logg stack trace eller feilmelding
  
    // Ikke lek sensitive detaljer til klienten i produksjon
    // Du kan sjekke process.env.NODE_ENV === 'production' her
    res.status(500).json({
      message: "An internal server error occurred.",
      // Du kan legge til error.message her under utvikling hvis ønskelig
      // error: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  };
  
  module.exports = errorHandler;