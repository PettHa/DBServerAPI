// server/src/dbQueries.js
// (Lim inn din komplette DBQueries-klasse her)

const neo4j = require('neo4j-driver'); // Kan fjernes hvis ikke brukt direkte her

/**
* DBQueries
*
* Encapsulates all Neo4j database operations for the application.
* ... (resten av din klassebeskrivelse) ...
*/
class DBQueries {
    constructor(driver) {
      if (!driver) {
        throw new Error("DBQueries requires a Neo4j driver instance.");
      }
      this.driver = driver;
      // Cache for spørringer
      this.cache = {
        categoryIds: null,
        cards: null // Cache for liste over alle kort-IDer
        // Merk: Individuelle kort caches også med `card_${cardId}` nøkkel
      };
      console.log("DBQueries initialized"); // Kan fjernes i prod
    }

    // --- Kjerne Spørringsmetode ---
    async executeCypher(cypher, params = {}, cacheKey = null) {
        if (!this.driver) {
          // Denne sjekken er teknisk overflødig pga. constructor, men god praksis
          console.error("Neo4j driver is not available.");
          throw new Error("No active Neo4j connection");
        }

        // Sjekk om resultat er cachet (kun hvis cacheKey er gitt)
        if (cacheKey && this.cache[cacheKey]) {
          console.log(`CACHE HIT for: ${cacheKey}`);
          // Returner en kopi for å unngå utilsiktet mutasjon av cache
          return Array.isArray(this.cache[cacheKey])
            ? [...this.cache[cacheKey]]
            : this.cache[cacheKey];
        }

        console.log(`Executing Cypher (len=${cypher.length}): ${cypher.substring(0, 100)}...`);
        const session = this.driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j'}); // Bruk default DB eller env var

        try {
          const result = await session.run(cypher, params);
          const records = result.records; // Hent ut records

          // Lagre resultat i cache hvis cacheKey er angitt
          if (cacheKey) {
            console.log(`CACHE SET for: ${cacheKey}`);
            // Lagre en kopi i cachen
            this.cache[cacheKey] = [...records];
          }

          return records; // Returner de faktiske records
        } catch (error) {
          console.error(`Neo4j Query Error in executeCypher for query:\n ${cypher}\nParams: ${JSON.stringify(params)}\nError:`, error);
          // Vurder å kaste en mer spesifikk feil eller logge annerledes
          throw error; // Kast feilen videre
        } finally {
          // Sørg ALLTID for å lukke session
          if (session) {
             await session.close();
          }
        }
    }

    // --- Hent Alle Kategori-IDer ---
    async getAllCategoryIds() {
      const cacheKey = 'categoryIds';
      // Bruk executeCypher for å håndtere caching
      const cypher = "MATCH (k:Kategori) RETURN k.kategori_id ORDER BY k.kategori_id"; // Sorter gjerne
      const records = await this.executeCypher(cypher, {}, cacheKey);
      // Behandle resultatet
      const categoryIds = records.map(record => record.get('k.kategori_id'));
      console.log("Category IDs fetched/returned:", categoryIds.length);
      return categoryIds;
    }

    // --- Hent Kortdata Basert på ID ---
    // MERK: fetchCardDataById brukte en kompleks strategi med to spørringer.
    // For enkelhets skyld kombinerer vi eller forenkler her.
    // En kombinert spørring er ofte bedre, men kan bli kompleks.
    // Velger en litt forenklet versjon av den første spørringen din for eksempelet.
    async fetchCardDataById(cardId) {
      const cacheKey = `card_${cardId}`;
      // Sjekk cache først (håndteres nå i executeCypher hvis vi sender cacheKey)
      console.log(`Fetching card data for ID: ${cardId}`);

      // Forbedret spørring (juster etter ditt faktiske behov):
      const cypher = `
        MATCH (k:Kategori {kategori_id: $cardId})
        OPTIONAL MATCH (k)-[:Inneholder]->(s:Spørsmål)
        OPTIONAL MATCH (s)-[:Inneholder]->(a:Alternativ)
        OPTIONAL MATCH (a)-[:Dekker]->(t:RammeverksTiltak)
        OPTIONAL MATCH (t)<-[:Inneholder]-(r:Rammeverk)
        RETURN
          k.kategori_id AS id,
          k.kategori AS kategori_tekst,
          k.kategori_beskrivelse AS kategori_beskrivelse,
          k.kategori_kort AS kategori_kort,
          // Samle spørsmål og deres alternativer
          collect(DISTINCT {
            sporsmal_tekst: s.sporsmal,
            alternativer: [(s)-[:Inneholder]->(a_nested) | {
              alternativ_tekst: a_nested.alternativ_tekst,
              alternativ_beskrivelse: a_nested.alternativ_beskrivelse,
              alternativ_hva: a_nested.hva_skal_implementeres,
              alternativ_hvordan: a_nested.hvordan_implementere,
              alternativ_tiltak_info: [(a_nested)-[:Dekker]->(t_nested)<-[:Inneholder]-(r_nested) | {
                id: t_nested.\`Lokal ID\`,
                tittel: t_nested.Tiltak,
                kapittel: t_nested.Kapittel,
                standard: t_nested.Standard,
                rammeverk: r_nested.Rammeverk
              }]
            }]
          }) AS sporsmal_med_alternativer,
          // Samle rammeverk direkte knyttet til kategorien (hvis relevant)
          collect(DISTINCT r.Rammeverk) AS direkte_rammeverk,
          collect(DISTINCT t.\`Lokal ID\`) AS dekkede_tiltak_lokal_id
        LIMIT 1 // Siden vi matcher på unik kategori_id
      `;

      // Vi sender cacheKey hit slik at executeCypher kan håndtere det
      const records = await this.executeCypher(cypher, { cardId }, cacheKey);

      if (!records || records.length === 0) {
        console.log("No card found for ID:", cardId);
        return null; // Returner null hvis ingenting ble funnet
      }

      // Neo4j-driveren returnerer komplekse objekter. Vi transformerer til vanlig JS-objekt.
      const rawResult = records[0].toObject();

      // Manuell transformasjon for å få en renere struktur (valgfritt men anbefalt)
      const cardData = {
          id: rawResult.id,
          kategori_tekst: rawResult.kategori_tekst,
          kategori_beskrivelse: rawResult.kategori_beskrivelse,
          kategori_kort: rawResult.kategori_kort,
          sporsmal: rawResult.sporsmal_med_alternativer.map(sq => ({
              sporsmal_tekst: sq.sporsmal_tekst,
              alternativer: sq.alternativer.map(alt => ({
                  ...alt,
                  // Konverter tiltak til enklere array hvis det finnes
                  alternativ_tiltak_info: alt.alternativ_tiltak_info || []
              }))
          })),
          rammeverk: rawResult.direkte_rammeverk || [],
          lokal_ids: rawResult.dekkede_tiltak_lokal_id || []
      };


      // Cache resultatet (gjøres nå i executeCypher)
      // if (cardData) {
      //   this.cache[cacheKey] = cardData; // Cache den transformerte dataen
      // }

      // Sjekk om resultatet er tomt etter transformasjon
      if (!cardData.id) {
        console.warn(`Data processing issue for card ID: ${cardId}. Raw result:`, rawResult);
        return null;
      }

      console.log("Card data processed for ID:", cardId);
      return cardData; // Returner det transformerte objektet
    }

    // --- Wrapper for getCardById (bruker den nye fetch-metoden) ---
    async getCardById(cardId) {
      // Denne kaller nå bare fetchCardDataById som inkluderer caching
      return await this.fetchCardDataById(cardId);
    }

    // --- Oppdater Kortstatus ---
    async updateCardState(cardId, state) {
      // Valider state input
      if (state !== 'avhuket' && state !== 'ikke_avhuket') { // Juster til dine faktiske states
          throw new Error("Invalid state value provided. Must be 'avhuket' or 'ikke_avhuket'.");
      }

      // Ved oppdatering, fjern cachen for dette spesifikke kortet
      const cacheKey = `card_${cardId}`;
      if (this.cache[cacheKey]) {
        console.log(`CACHE INVALIDATE for: ${cacheKey}`);
        delete this.cache[cacheKey];
      }
      // Vurder også å invalidere annen relatert cache, f.eks. brukerpoeng hvis det er cachet

      // Antar at 'Kort' noden er den samme som 'Kategori' i din modell for state?
      // Hvis state er på en annen node, juster spørringen.
      // Bruker Kategori her basert på din getCardById
      const cypher = `
        MATCH (k:Kategori {kategori_id: $cardId})
        SET k.state = $state
        RETURN k.kategori_id AS id, k.state AS state
      `;

      // Ikke bruk cacheKey her, da vi *alltid* vil kjøre denne mot DB
      const records = await this.executeCypher(cypher, { cardId, state });

      if (records.length === 0) {
          throw new Error(`Could not update state for card ID: ${cardId}. Card not found.`);
      }

      console.log(`State updated for card ${cardId} to ${state}`);
      return records[0].toObject(); // Returner det oppdaterte objektet
    }

    // --- Hent Alle Kort (IDer) ---
    // Antar at 'Kort' tilsvarer 'Kategori' i din bruk?
    async getAllCards() {
      const cacheKey = 'cards'; // Cache for listen over alle IDer

      // Bruk executeCypher for caching
      const cypher = `
        MATCH (k:Kategori) // Eller MATCH (k:Kort) hvis det er en egen node
        RETURN k.kategori_id AS id // Eller k.kort_id
        ORDER BY id // Greit å sortere
      `;
      const records = await this.executeCypher(cypher, {}, cacheKey);

      const cardIds = records.map(record => record.get('id'));
      console.log("All card IDs fetched/returned:", cardIds.length);
      return cardIds;
    }

    // --- Beregn Brukerpoeng ---
    // Denne bør sannsynligvis IKKE caches aggressivt, da den endres ved updateCardState.
    async calculateUserPoints() {
      console.log("Calculating user points...");
      // Juster spørringen basert på din faktiske datamodell for poeng og state
      // Antar her at 'Kategori' har 'state' og poeng-relaterte felt
      const cypher = `
        MATCH (k:Kategori) // Eller :Kort
        WHERE k.state = 'avhuket' // Bruk riktig state-verdi
        // COALESCE håndterer null-verdier (hvis poeng ikke alltid er satt)
        RETURN sum(coalesce(k.poeng, 0)) + sum(coalesce(k.alternativ_poeng, 0)) AS totalPoints
      `;

      // Ikke bruk cacheKey for denne
      const records = await this.executeCypher(cypher);

      // Håndter tilfellet der ingen kort er avhuket (resultatet er én record med null)
      if (!records || records.length === 0 || !records[0].get('totalPoints')) {
          return 0; // Returner 0 hvis ingen poeng funnet
      }

      // Bruk toBigInt for potensielt store tall, konverter til Number hvis trygt
      const totalPoints = records[0].get('totalPoints');
      // Neo4j driver kan returnere tall som BigInt eller spesielle number types.
      // Konverter til vanlig number hvis innenfor JS sitt trygge heltallsområde.
      return neo4j.integer.toNumber(totalPoints);
    }

    // --- Metode for å Tømme Hele Cachen ---
    clearCache() {
      this.cache = {
        categoryIds: null,
        cards: null
        // Merk: fjerner ikke individuelle `card_${id}` cacher her
        // For å fjerne *alt*:
        // this.cache = {};
      };
      console.log("Cleared primary caches (categoryIds, cards)");
      // For å tømme *all* cache (inkludert individuelle kort):
      // Object.keys(this.cache).forEach(key => delete this.cache[key]);
      // console.log("Cleared ALL caches");
    }
}

module.exports = DBQueries; // Eksporter klassen