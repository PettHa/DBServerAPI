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
      next(error); // Send til feilhåndterer
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
      const cardId = req.params.id;
      const cardData = await dbQueries.getCardById(cardId);
      
      if (!cardData) {
        return res.status(404).json({ message: `Card with ID ${cardId} not found` });
      }
      
      res.json(cardData);
    } catch (error) {
      next(error);
    }
  });

  // Oppdater kort-status
  router.put('/cards/:id/state', async (req, res, next) => {
    try {
      const cardId = req.params.id;
      const { state } = req.body;
      
      if (!state || (state !== 'avhuket' && state !== 'ikke_avhuket')) {
        return res.status(400).json({ 
          message: "Invalid request. Body must include 'state' with value 'avhuket' or 'ikke_avhuket'" 
        });
      }
      
      const updatedCard = await dbQueries.updateCardState(cardId, state);
      res.json(updatedCard);
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