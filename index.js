const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Route pour afficher le formulaire de confirmation
app.get("/capture-email", (req, res) => {
  const clientKey = req.query.key;

  if (!clientKey) {
    return res.status(400).send("Clé client manquante.");
  }

  res.send(`
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Confirmez vos informations</title>
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
        box-shadow: 0px 4px 8px rgba(0,0,0,0.1);
        max-width: 400px;
        text-align: center;
      }
      h1 { color: #4682b4; }
      label, input, select, textarea, button {
        font-size: 1rem;
        margin: 10px 0;
        display: block;
        width: 100%;
        text-align: left;
      }
      input, select, textarea {
        width: calc(100% - 20px);
        padding: 10px;
        border: 1px solid #b0c4de;
        border-radius: 5px;
        box-sizing: border-box;
      }
      textarea { resize: none; min-height: 80px; }
      button {
        background-color: #4682b4;
        color: white;
        border: none;
        padding: 10px;
        border-radius: 5px;
        cursor: pointer;
        width: 100%;
        text-align: center;
      }
      button:hover { background-color: #5a9bd4; }
      .hidden { display: none; }
      .counter { font-size: 0.85rem; text-align: right; color: #555; }
      .counter.red { color: red; }
      .form-error { color: red; font-size: 1rem; margin-top: 15px; text-align: center; }
      .invalid { border: 2px solid red !important; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Confirmez vos informations</h1>

      <form id="reservationForm" action="/submit-email" method="POST" novalidate>
        <input type="hidden" name="clientKey" value="${clientKey}">

        <label for="nom">Entrez votre nom :</label>
        <input type="text" id="nom" name="nom" required>

        <label for="email">Entrez votre e-mail :</label>
        <input type="email" id="email" name="email" required>

        <label for="typeRsv">Type de réservation :</label>
        <select id="typeRsv" name="typeRsv" required>
          <option value="">-- Sélectionnez --</option>
          <option value="simple">Réservation simple</option>
          <option value="privatisation">Privatisation</option>
          <option value="autre">Autre</option>
        </select>

        <div id="nbrePersonneDiv" class="hidden">
          <label for="nbrePersonne">Nombre de personnes :</label>
          <input type="number" id="nbrePersonne" name="nbrePersonne" min="1">
        </div>

        <div id="commentaireDiv" class="hidden">
          <label for="commentaire">Commentaire :</label>
          <textarea id="commentaire" name="commentaire" maxlength="100"></textarea>
          <p id="charCounter" class="counter">0/100</p>
        </div>

        <button type="submit">Confirmer</button>
        <p id="formError" class="form-error hidden">⚠️ Veuillez remplir les informations manquantes</p>
      </form>
    </div>

    <script>
      const form = document.getElementById('reservationForm');
      const nom = document.getElementById('nom');
      const emailInput = document.getElementById('email');
      const typeRsv = document.getElementById('typeRsv');
      const nbrePersonneDiv = document.getElementById('nbrePersonneDiv');
      const nbrePersonne = document.getElementById('nbrePersonne');
      const commentaireDiv = document.getElementById('commentaireDiv');
      const commentaire = document.getElementById('commentaire');
      const charCounter = document.getElementById('charCounter');
      const formError = document.getElementById('formError');

      // Affichage conditionnel selon typeRsv
      typeRsv.addEventListener('change', () => {
        if (typeRsv.value === 'simple' || typeRsv.value === 'privatisation') {
          nbrePersonneDiv.classList.remove('hidden');
          commentaireDiv.classList.add('hidden');
        } else if (typeRsv.value === 'autre') {
          commentaireDiv.classList.remove('hidden');
          nbrePersonneDiv.classList.add('hidden');
        } else {
          nbrePersonneDiv.classList.add('hidden');
          commentaireDiv.classList.add('hidden');
        }
        nbrePersonne.classList.remove('invalid');
        commentaire.classList.remove('invalid');
        typeRsv.classList.remove('invalid');
        hideFormError();
      });

      // Compteur commentaire
      commentaire.addEventListener('input', () => {
        const len = commentaire.value.length;
        charCounter.textContent = len + '/100';
        charCounter.classList.toggle('red', len > 90);
        commentaire.classList.remove('invalid');
        hideFormError();
      });

      function hideFormError() {
        formError.classList.add('hidden');
      }

      // Validation à la soumission
      form.addEventListener('submit', (e) => {
        document.querySelectorAll('input, select, textarea').forEach(el => el.classList.remove('invalid'));
        formError.classList.add('hidden');

        const nomVal = nom.value.trim();
        const emailVal = emailInput.value.trim();
        const typeVal = typeRsv.value;
        const nbreVal = nbrePersonne.value ? nbrePersonne.value.trim() : '';
        const commentVal = commentaire.value ? commentaire.value.trim() : '';

        let missingField = false;

        if (!nomVal) { missingField = true; nom.classList.add('invalid'); }
        if (!emailVal) { missingField = true; emailInput.classList.add('invalid'); }
        if (!typeVal) { missingField = true; typeRsv.classList.add('invalid'); }
        if ((typeVal === 'simple' || typeVal === 'privatisation') && !nbreVal) {
          missingField = true; nbrePersonne.classList.add('invalid');
        }
        if (typeVal === 'autre' && !commentVal) {
          missingField = true; commentaire.classList.add('invalid');
        }

        if (missingField) {
          e.preventDefault();
          formError.textContent = "⚠️ Veuillez remplir les informations manquantes";
          formError.classList.remove('hidden');
        }
      });
    </script>
  </body>
  </html>
  `);
});

// Route pour traiter l'envoi de l'email
app.post("/submit-email", (req, res) => {
  const { clientKey, nom, email, typeRsv, nbrePersonne, commentaire } = req.body;

  if (!clientKey || !nom || !email || !typeRsv) {
    return res.status(400).send("Informations manquantes.");
  }

  const webhookUrl = "https://hook.eu2.make.com/7w0habdx4zlyvebhvdhe8sixhhkae4yg";

  axios
    .post(webhookUrl, {
      clientKey,
      nom,
      email,
      typeRsv,
      nbrePersonne,
      commentaire,
    })
    .then(() => {
      res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>Confirmation</title>
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
              box-shadow: 0px 4px 8px rgba(0,0,0,0.1);
              max-width: 400px;
              text-align: center;
            }
            h1 { color: #4682b4; }
            p { font-size: 1.1rem; margin-top: 1em; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Demande confirmée</h1>
            <p>Votre demande a bien été prise en compte.<br>
            Vous allez recevoir un e-mail de confirmation sous peu.</p>
          </div>
        </body>
        </html>
      `);
    })
    .catch((error) => {
      console.error("Erreur lors de l'envoi au webhook :", error);
      res.status(500).send("Erreur lors de l'envoi de votre demande.");
    });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
