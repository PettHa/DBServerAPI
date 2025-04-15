// server/src/routes/api.js
const express = require('express');
// Importer nødvendige funksjoner fra express-validator
const { param, validationResult } = require('express-validator');

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
      next(error); // Send feil til feilhåndteringsmiddleware
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

  // --- Definer valideringsregler for kort-ID ---
  const validateCardId = [
    param('id') // Målrett mot 'id' parameteren i URLen
      .notEmpty().withMessage('Card ID cannot be empty') // Sjekk at den ikke er tom
      .isInt({ min: 1 }).withMessage('Card ID must be a positive integer') // Sjekk at det er et heltall større enn 0
      // .escape() // Valgfritt: Saniter input for å forhindre XSS hvis IDen skulle bli brukt usikkert et sted
  ];

  // Hent et spesifikt kort (med inputvalidering)
  router.get('/cards/:id', validateCardId, async (req, res, next) => { // Legg til validateCardId som middleware
    // Sjekk om valideringen feilet
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Returner 400 Bad Request med valideringsfeilene
      return res.status(400).json({ errors: errors.array() });
    }

    // Hvis valideringen passerte, fortsett med rute-logikken
    try {
      // Vi vet nå at req.params.id er et gyldig positivt heltall (som streng)
      const cardId = parseInt(req.params.id, 10); // Konverter til tall
      console.log(`API received card request for validated ID: ${cardId}`);

      const cardData = await dbQueries.getCardById(cardId);

      // Sjekk om kortet ble funnet (dbQueries kan returnere null, undefined, eller tom array)
      if (!cardData || (Array.isArray(cardData) && cardData.length === 0)) {
        return res.status(404).json({ message: `Card with ID ${cardId} not found` });
      }

      // Konverter Neo4j records til vanlige JSON-objekter for API-respons
      // Sjekk om dataen er en array eller ikke
      let processedData;
      if (Array.isArray(cardData)) {
        processedData = cardData.map(record =>
          record && typeof record.toObject === 'function' ? record.toObject() : record
        );
      } else {
        // Enkelt objekt
        processedData = [ // Returner alltid som array for konsistens
            cardData && typeof cardData.toObject === 'function'
            ? cardData.toObject()
            : cardData
        ];
      }

      res.json(processedData);

    } catch (error) {
      next(error); // Send database/interne feil videre
    }
  });


  // --- ADMIN/DEBUG ENDEPUNKTER ---

  // Tøm cache (kun for utviklingsformål)
  router.post('/admin/clear-cache', async (req, res, next) => {
    // Merk: Hvis denne ruten skulle hatt input (f.eks. i body), ville vi validert det også.
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