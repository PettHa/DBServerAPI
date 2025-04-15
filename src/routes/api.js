// server/src/routes/api.js
const express = require('express');

/**
 * Oppretter API-ruter for applikasjonen
 * @param {DBQueries} dbQueries - Instans av DBQueries-klassen
 * @returns {Router} Express router med alle API-endepunkt
 */
function createApiRoutes(dbQueries) {
  const router = express.Router();

  // --- KATEGORI ENDEPUNKTER ---
  
  // Hent alle kategori-IDer
  router.get('/categories', async (req, res, next) => {
    try {
      const categoryIds = await dbQueries.getAllCategoryIds();
      res.json(categoryIds);
    } catch (error) {
      next(error);
    }
  });

  // --- KORT ENDEPUNKTER ---
  
  // Hent alle kort-IDer
  router.get('/cards', async (req, res, next) => {
    try {
      const cardIds = await dbQueries.getAllCards();
      res.json(cardIds);
    } catch (error) {
      next(error);
    }
  });

  // Hent et spesifikt kort
  router.get('/cards/:id', async (req, res, next) => {
    try {
      let cardId = req.params.id;
      console.log(`API received card request for ID: ${cardId}, type: ${typeof cardId}`);
      
      // Konverter til tall hvis mulig
      if (!isNaN(cardId)) {
        cardId = parseInt(cardId, 10);
        console.log(`Converted ID to number: ${cardId}`);
      }
      
      const cardData = await dbQueries.getCardById(cardId);
      
      if (!cardData) {
        return res.status(404).json({ message: `Card with ID ${cardId} not found` });
      }
      
      // Konverter Neo4j records til vanlige JSON-objekter for API-respons
      // Sjekk om dataen er en array eller ikke
      if (Array.isArray(cardData)) {
        const processedData = cardData.map(record => {
          // Sjekk om det er et Neo4j record med toObject-metode
          if (record && typeof record.toObject === 'function') {
            return record.toObject();
          }
          return record; // Allerede et vanlig objekt
        });
        
        res.json(processedData);
      } else {
        // Hvis det ikke er en array, konverter direkte
        const result = cardData && typeof cardData.toObject === 'function' 
          ? cardData.toObject() 
          : cardData;
          
        res.json([result]); // Returner alltid som array for konsistens
      }
    } catch (error) {
      next(error);
    }
  });

  // Oppdater kort-status
  router.put('/cards/:id/state', async (req, res, next) => {
    try {
      let cardId = req.params.id;
      
      // Konverter til tall hvis mulig
      if (!isNaN(cardId)) {
        cardId = parseInt(cardId, 10);
      }
      
      const { state } = req.body;
      
      if (!state || (state !== 'avhuket' && state !== 'ikke_avhuket')) {
        return res.status(400).json({ 
          message: "Invalid request. Body must include 'state' with value 'avhuket' or 'ikke_avhuket'" 
        });
      }
      
      const updatedCard = await dbQueries.updateCardState(cardId, state);
      
      // Konverter Neo4j record til vanlig JSON-objekt for API-respons
      const responseData = updatedCard && typeof updatedCard.toObject === 'function' 
        ? updatedCard.toObject() 
        : updatedCard;
        
      res.json(responseData);
    } catch (error) {
      // Hvis feilen handler om at kortet ikke ble funnet, send 404
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  });
  
  // --- BRUKER ENDEPUNKTER ---
  
  // Beregn og hent brukerpoeng
  router.get('/points', async (req, res, next) => {
    try {
      const points = await dbQueries.calculateUserPoints();
      res.json({ points });
    } catch (error) {
      next(error);
    }
  });
  
  // --- ADMIN/DEBUG ENDEPUNKTER ---
  
  // Tøm cache (kun for utviklingsformål)
  router.post('/admin/clear-cache', async (req, res, next) => {
    try {
      dbQueries.clearCache();
      res.json({ message: "Cache cleared successfully" });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createApiRoutes;