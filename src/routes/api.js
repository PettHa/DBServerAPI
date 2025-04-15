// server/src/routes/api.js
const express = require('express');
const router = express.Router();

// Denne funksjonen tar dbQueries som argument (dependency injection)
module.exports = (dbQueries) => {
  if (!dbQueries) {
    throw new Error("api.js requires dbQueries instance");
  }

  // --- Hent alle kategori-IDer ---
  router.get('/categories', async (req, res, next) => {
    try {
      const categoryIds = await dbQueries.getAllCategoryIds();
      res.json(categoryIds);
    } catch (error) {
      next(error); // Send feil til global error handler
    }
  });

  // --- Hent spesifikt kort/kategori basert på ID ---
  router.get('/cards/:id', async (req, res, next) => {
    const cardId = req.params.id;
    try {
      const cardData = await dbQueries.getCardById(cardId); // Bruker wrapperen
      if (cardData) {
        res.json(cardData);
      } else {
        res.status(404).json({ message: `Card with ID ${cardId} not found` });
      }
    } catch (error) {
      next(error);
    }
  });

  // --- Hent alle kort-IDer ---
  router.get('/cards', async (req, res, next) => {
    try {
      const cardIds = await dbQueries.getAllCards();
      res.json(cardIds);
    } catch (error) {
      next(error);
    }
  });


  // --- Oppdater status for et kort ---
  // Bruker POST siden det er en endring, men PUT kan også argumenteres for
  // Trenger express.json() middleware i server.js for å parse req.body
  router.post('/cards/:id/state', express.json(), async (req, res, next) => { // La til express.json() her også for sikkerhets skyld
    const cardId = req.params.id;
    const { state } = req.body; // Hent state fra request body

    // Enkel validering
    if (!state || (state !== 'avhuket' && state !== 'ikke_avhuket')) { // Bruk dine faktiske state-verdier
      return res.status(400).json({ message: "Invalid or missing 'state' in request body. Use 'avhuket' or 'ikke_avhuket'." });
    }

    try {
      const updatedCard = await dbQueries.updateCardState(cardId, state);
      res.json(updatedCard);
    } catch (error) {
      // Håndter spesifikt "not found" vs andre feil?
      if (error.message.includes('not found')) {
           return res.status(404).json({ message: `Card with ID ${cardId} not found for state update.` });
      }
      next(error); // Send andre feil til global handler
    }
  });

  // --- Hent brukerens poengsum ---
  router.get('/user/points', async (req, res, next) => {
    try {
      const points = await dbQueries.calculateUserPoints();
      res.json({ totalPoints: points });
    } catch (error) {
      next(error);
    }
  });

  // --- (Valgfritt) Endepunkt for å tømme cache ---
  // Bør kanskje sikres bedre i en ekte applikasjon
  router.post('/cache/clear', (req, res, next) => {
      try {
          dbQueries.clearCache();
          res.status(200).json({ message: "Server cache cleared" });
      } catch(error) {
          next(error);
      }
  });


  return router; // Returner den konfigurerte routeren
};