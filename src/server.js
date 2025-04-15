// server/src/server.js
const path = require('path');

// 1. Last .env fil FØRST (kun for lokal kjøring)
// Peker til .env i prosjekt-roten
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 2. Importer moduler
const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const DBQueries = require('./dbQueries'); // Din klasse
const createApiRoutes = require('./routes/api'); // Funksjon som lager ruter
const errorHandler = require('./middleware/errorHandler'); // Feilhåndterer

// 3. Hent konfigurasjon fra miljøvariabler
const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, PORT = 3001, NEO4J_DATABASE = 'neo4j' } = process.env;

// 4. Valider konfigurasjon (essensielt!)
if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  console.error('FATAL ERROR: Missing Neo4j Credentials (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD) in environment variables!');
  process.exit(1); // Avslutt hvis kritisk konfig mangler
}

let driver;
let dbQueries;

try {
    // 5. Initialize Neo4j Driver with improved configuration
    const driverConfig = {};
    
    if (NEO4J_URI.includes('databases.neo4j.io') || 
        NEO4J_URI.startsWith('neo4j+s://') || 
        NEO4J_URI.startsWith('bolt+s://')) {
      // Configuration for Neo4j Aura or any secure connection
      Object.assign(driverConfig, {
        encrypted: true,
        trust: 'TRUST_SYSTEM_CA_SIGNED_CERTIFICATES',
        connectionTimeout: 30000,
        maxConnectionPoolSize: 50, // You can adjust this based on your needs
        userAgent: 'MyApp/1.0'
      });
    } else {
      // Configuration for local/non-Aura databases
      Object.assign(driverConfig, {
        encrypted: false,
        userAgent: 'MyApp/1.0'
      });
    }
    
    // Create driver with the appropriate config
    driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD), driverConfig);
  
    // Test connectivity
    driver.verifyConnectivity({ database: NEO4J_DATABASE })
      .then(() => {
        console.log(`Successfully connected to Neo4j DB: ${NEO4J_DATABASE} at ${NEO4J_URI.split('@')[1]}`);
        
        // Optional: Run a test query to ensure full functionality
        const session = driver.session({ database: NEO4J_DATABASE });
        return session.run('RETURN 1 as test')
          .then(() => {
            console.log('Neo4j test query executed successfully');
            return session.close();
          })
          .catch(error => {
            console.error('Neo4j test query failed:', error);
            return session.close().then(() => Promise.reject(error));
          });
      })
      .catch(error => console.error('Neo4j Driver - Connection verification failed:', error));
  
    // 6. Initialize DBQueries with the driver
    dbQueries = new DBQueries(driver);
  
  } catch (error) {
    console.error('FATAL ERROR: Failed to create Neo4j driver:', error);
    process.exit(1);
  }

// 7. Opprett Express app
const app = express();

// 8. Bruk Middleware
// CORS: Tillat forespørsler fra din frontend (viktig for npm start)
// Juster origin etter behov for produksjon hvis frontend er på annet domene
app.use(cors({
    // origin: 'http://localhost:3000' // Eksempel: Lås til frontend dev server
    origin: '*' // Enklest for start, men vurder å begrense i produksjon
}));
app.use(express.json()); // For å parse JSON request bodies (f.eks. for POST /state)

// 9. Definer API Ruter
// Send dbQueries-instansen til rutefunksjonen
app.use('/api', createApiRoutes(dbQueries));

// 10. Server statiske filer (Frontend build) - for Docker/Produksjon
// Mappen 'public' i server-mappen vil inneholde build fra 'client/build'
const staticFilesPath = path.join(__dirname, '..', 'public');
app.use(express.static(staticFilesPath));

// 11. Catch-all for å sende index.html (Client-side routing)
// Må komme ETTER API-ruter og ETTER static files
app.get('*', (req, res) => {
  // Hvis kallet startet med /api, var det en feil i rutingen over
  if (req.originalUrl.startsWith('/api/')) {
     console.warn(`API route not found, but caught by '*': ${req.method} ${req.originalUrl}`);
     return res.status(404).json({ message: 'API endpoint not found' });
  }
  // Send index.html for alle andre GET-requests
  res.sendFile(path.resolve(staticFilesPath, 'index.html'), (err) => {
      if (err) {
          // Hvis index.html ikke finnes (f.eks. før første build)
          res.status(404).send("Frontend not found. Have you built the client app?");
      }
  });
});


// 12. Bruk Global Feilhåndterer (Må være den SISTE middleware)
app.use(errorHandler);

// 13. Start Serveren
const serverInstance = app.listen(PORT, () => {
  console.log(`-------------------------------------------------------------------`);
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  console.log(`Connected to Neo4j Aura instance (User: ${NEO4J_USER})`); // Vær forsiktig med logg i prod
  console.log(`Serving frontend from: ${staticFilesPath}`);
  console.log(`API available at: http://localhost:${PORT}/api`);
  console.log(`-------------------------------------------------------------------`);
});

// 14. Graceful Shutdown (Viktig for Docker og generell stabilitet)
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Closing server and Neo4j driver...`);
  serverInstance.close(async () => {
    console.log('HTTP server closed.');
    if (driver) {
      try {
        await driver.close();
        console.log('Neo4j driver closed.');
      } catch (error) {
        console.error('Error closing Neo4j driver:', error);
      }
    }
    process.exit(0); // Avslutt prosessen
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker stop etc.