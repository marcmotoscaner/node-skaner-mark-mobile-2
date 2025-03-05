const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const server = createServer(app);
const io = new Server(server);
const fs = require('fs');
let intervalId; // Zmienna do przechowywania identyfikatora interwału
let counter = 1

app.use(express.static(__dirname + "/"));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Funkcja do odczytu zapisanych danych
const readData = () => {
  if (fs.existsSync('data.json')) {
    return JSON.parse(fs.readFileSync('data.json', 'utf8'));
  }
  return {};
};

// Funkcja do zapisywania danych
const saveData = (data) => {
  fs.writeFileSync('data.json', JSON.stringify(data), 'utf8');
};

function extractNumbers(text) {
  const regex = /\d+(\.\d+)?/g; // Dopasowuje liczby całkowite i dziesiętne
  const matches = text.match(regex);
  return matches ? matches.map(Number) : []; // Konwertuje wyniki na liczby
}



const extractOffers = (html) => {
  const $ = cheerio.load(html);
  const offers = [];

  // Wyodrębnij oferty z elementów o klasie mN_WC, pomijając pierwszy element oraz te w divie z data-testid="page-1-listings"
  $('.product-container').each((index, element) => {
    //Sprawdź, czy jakikolwiek przodek ma atrybut data-testid="page-1-listings"
    if ($(element).find('.new-label').length === 1) {
      const motorName = $(element).find('.grid-name').text().trim();
      if (motorName && !extractNumbers(motorName).includes(50) && offers.length < 5) { // Dodaj tylko jeśli nazwa nie jest pusta i ogranicz do 5 ofert
        offers.push(motorName);
      }
   }
  });

  return offers;
};

// Endpoint do uruchamiania pobierania
app.post('/start', (req, res) => {
  if (!intervalId) { // Uruchom interwał tylko jeśli nie jest już uruchomiony
    intervalId = setInterval(fetchData, 500);
    console.log("Pobieranie ofert uruchomione.");
    res.send("Pobieranie ofert uruchomione.");
  } else {
    res.send("Pobieranie już działa.");
  }
});

// Endpoint do zatrzymywania pobierania
app.post('/stop', (req, res) => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null; // Resetuj identyfikator interwału
    console.log("Pobieranie ofert zatrzymane.");
    res.send("Pobieranie ofert zatrzymane.");
  } else {
    res.send("Pobieranie nie jest uruchomione.");
  }
});

// Funkcja fetchData
const fetchData = async () => {
  const url = "https://www.marc-motos-pieces-14.fr/nouveaux-produits?q=%2Fnouveaux-produits&n=48";
  
  try {
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (response.data) {

      const html = response.data;
      // const buffer = Buffer.from(base64String, 'base64');

      // // Konwersja bufora na oryginalny tekst
      // const decodedHtml = buffer.toString('utf-8');
      console.log(html)
      const currentOffers = (extractOffers(html).length === 0 ? readData() : extractOffers(html));
      const savedData = readData();
      counter += 1;
      // Porównaj z zapisanymi danymi
      if (JSON.stringify(currentOffers) !== JSON.stringify(savedData.offers)) {
        console.log('Oferty się zmieniły! Zapisuję nowe oferty.');
        saveData({ offers: currentOffers });
        io.emit('newOffer', currentOffers); // Powiadom klientów o nowych ofertach
        console.log('Nowe oferty:', currentOffers);
      } else {
        console.log('Brak zmian w ofertach.' + counter);
      }
    } else {
      console.log(Buffer.from(response.data.data.httpResponseBody, 'base64').toString());
    }
  } catch (error) {
    console.log(error);
  }
};

io.on('connection', (socket) => {
  console.log('a user connected');
});

// server
server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});