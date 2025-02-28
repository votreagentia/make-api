const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Route pour afficher le formulaire de confirmation d'email
app.get('/capture-email', (req, res) => {
  const clientKey = req.query.key;

  if (!clientKey) {
    return res.status(400).send("Clé client manquante.");
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirmez votre adresse e-mail</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f0f8ff;
          color: #333;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .container {
          background-color: #ffffff;
          padding: 2em;
          border-radius: 10px;
          box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          text-align: center;
        }
        h1 {
          color: #4682b4;
        }
        label, input, button {
          font-size: 1rem;
          margin: 10px 0;
        }
        input {
          width: calc(100% - 20px);
          padding: 10px;
          border: 1px solid #b0c4de;
          border-radius: 5px;
        }
        button {
          background-color: #4682b4;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        }
        button:hover {
          background-color: #5a9bd4;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Confirmez votre adresse e-mail</h1>
        <form action="/submit-email" method="POST">
          <input type="hidden" name="clientKey" value="${clientKey}">
          <label for="email">Entrez votre e-mail :</label><br>
          <input type="email" id="email" name="email" required><br><br>
          <button type="submit">Confirmer</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Route pour traiter l'envoi de l'email
app.post('/submit-email', (req, res) => {
  const { clientKey, email } = req.body;

  if (!clientKey || !email) {
    return res.status(400).send('Informations manquantes.');
  }

  // Appel à votre webhook Make.com pour mettre à jour le CRM
  const axios = require('axios');
  const webhookUrl = 'https://hook.eu2.make.com/ro26bov9dhgei3rnsb3ycvgpe6kowq8q';

  axios.post(webhookUrl, {
    clientKey,
    email
  })
  .then(() => {
    res.send('Merci, votre adresse e-mail a bien été confirmée.');
  })
  .catch((error) => {
    console.error('Erreur lors de l\'envoi au webhook :', error);
    res.status(500).send('Erreur lors de l\'envoi de votre e-mail.');
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});