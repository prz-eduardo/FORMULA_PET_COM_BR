// scrap-forvets.js
const axios = require('axios');
const cheerio = require('cheerio');

// Firebase
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDpRqVdMO966X-e34c1KQJXRKlwzvzgV04",
  authDomain: "formulapet-com-br.firebaseapp.com",
  projectId: "formulapet-com-br",
  storageBucket: "formulapet-com-br.firebasestorage.app",
  messagingSenderId: "814626284746",
  appId: "1:814626284746:web:552698e044e1845f028033",
  measurementId: "G-5V2ZJ16LX6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Função principal
async function scrapForVets() {
  const url = 'https://www.forvets.com.br/guia-de-ativos/';
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const rows = $('#guia table tbody tr');

  for (let i = 0; i < rows.length; i++) {
    const tr = rows.eq(i);
    const ativo = {
      nome: tr.find('td').eq(0).text().trim(),
      descricao: tr.find('td').eq(1).text().trim(),
      doseCaes: tr.find('td').eq(2).text().trim(),
      doseGatos: tr.find('td').eq(3).text().trim(),
    };

    console.log('Scraped ativo:', ativo);

    // Salvar no Firebase
    await addDoc(collection(db, 'ativos'), ativo);
  }

  console.log('Todos os ativos foram importados!');
}

// Rodar
scrapForVets().catch(console.error);
