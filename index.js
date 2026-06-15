const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Petite fonction utilitaire pour échapper les valeurs injectées dans le HTML
function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Route pour afficher le formulaire
app.get('/capture-email', (req, res) => {
  const clientKey = req.query.key;
  const prenomKey = req.query.prenom;
  const DateHeureDernierRDVKey = req.query.DateHeureDernierRDV;

  if (!clientKey) {
    return res.status(400).send("Clé client manquante.");
  }

  // Valeur initiale de la date de RDV transmise au script côté client,
  // assainie pour ne pas casser le template literal ni le tag <script>.
  const initialDateJson = JSON.stringify(DateHeureDernierRDVKey || '')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/`/g, '\\u0060')
    .replace(/\$/g, '\\u0024');

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

        /* Champ "date et heure du RDV" */
        #dateRdvDisplay {
          background-color: #ffffff;
          cursor: pointer;
        }

        /* Agenda / sélecteur de date et heure */
        .picker-overlay {
          display: flex;
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(70, 130, 180, 0.35);
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 16px;
          box-sizing: border-box;
        }
        .picker-overlay.hidden { display: none; }

        .picker-modal {
          background-color: #ffffff;
          border-radius: 10px;
          box-shadow: 0px 4px 12px rgba(0,0,0,0.2);
          width: 320px;
          max-width: 100%;
          padding: 1.2em;
          text-align: center;
          box-sizing: border-box;
        }

        .picker-title {
          margin: 0 0 14px;
          font-size: 1rem;
          font-weight: bold;
          color: #4682b4;
        }

        .picker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .picker-header .month-label {
          font-weight: bold;
          color: #4682b4;
          text-transform: capitalize;
          font-size: 1rem;
        }
        .picker-nav {
          background-color: #f0f8ff;
          color: #4682b4;
          border: 1px solid #b0c4de;
          border-radius: 5px;
          width: 36px;
          height: 36px;
          min-width: 36px;
          font-size: 1.1rem;
          line-height: 1;
          cursor: pointer;
          margin: 0;
          padding: 0;
        }
        .picker-nav:hover { background-color: #e0eefc; }

        .picker-weekdays, .picker-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .picker-weekdays {
          margin-bottom: 4px;
        }
        .picker-weekdays span {
          font-size: 0.75rem;
          color: #888;
          text-align: center;
          text-transform: uppercase;
        }
        .picker-days { margin-bottom: 14px; }
        .picker-day {
          background: none;
          border: 1px solid transparent;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          line-height: 36px;
          margin: 0 auto;
          padding: 0;
          font-size: 0.9rem;
          color: #333;
          text-align: center;
          cursor: pointer;
        }
        .picker-day:hover { background-color: #f0f8ff; }
        .picker-day.empty { cursor: default; visibility: hidden; }
        .picker-day.today { border-color: #4682b4; }
        .picker-day.selected {
          background-color: #4682b4;
          border-color: #4682b4;
          color: #ffffff;
          font-weight: bold;
        }

        .picker-time {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 0 0 16px;
        }
        .picker-time label {
          width: auto;
          margin: 0;
          font-size: 0.9rem;
          color: #555;
        }
        .picker-time select {
          width: auto;
          margin: 0;
          padding: 8px;
          font-size: 0.95rem;
        }
        .picker-time .time-sep {
          font-weight: bold;
          color: #4682b4;
        }

        .picker-actions {
          display: flex;
          gap: 10px;
        }
        .picker-actions .picker-btn {
          width: auto;
          flex: 1;
          margin: 0;
        }
        .picker-btn.secondary {
          background-color: #ffffff;
          color: #4682b4;
          border: 1px solid #b0c4de;
        }
        .picker-btn.secondary:hover { background-color: #f0f8ff; }

        @media (max-width: 480px) {
          .picker-overlay { align-items: flex-end; padding: 0; }
          .picker-modal {
            width: 100%;
            max-width: 100%;
            border-radius: 14px 14px 0 0;
            padding: 1.4em 1em 1.6em;
          }
          .picker-day { width: 100%; height: 11vw; max-height: 42px; line-height: 11vw; max-width: none; }
          .picker-day.empty { line-height: normal; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Confirmez vos informations</h1>

        <form id="reservationForm" action="/submit-email" method="POST" novalidate>
          <input type="hidden" name="clientKey" value="${escapeHtml(clientKey)}">

          <label for="prenom">Entrez votre prénom :</label>
          <input type="text" id="prenom" name="prenom" value="${escapeHtml(prenomKey)}" required>

          <label for="nom">Entrez votre nom :</label>
          <input type="text" id="nom" name="nom" required>

          <label for="email">Entrez votre e-mail :</label>
          <input type="email" id="email" name="email" required>

          <label for="dateRdvDisplay">Date et heure du rendez-vous :</label>
          <input type="text" id="dateRdvDisplay" name="dateRdvDisplay" readonly required
                 placeholder="Sélectionnez une date et une heure">
          <input type="hidden" id="dateRdvValue" name="dateRdv">

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

      <!-- Agenda / sélecteur de date et heure -->
      <div id="datePickerOverlay" class="picker-overlay hidden">
        <div class="picker-modal" role="dialog" aria-label="Sélecteur de date et heure">
          <p class="picker-title">Choisissez une date et une heure</p>
          <div class="picker-header">
            <button type="button" id="prevMonthBtn" class="picker-nav" aria-label="Mois précédent">&lsaquo;</button>
            <span id="monthYearLabel" class="month-label"></span>
            <button type="button" id="nextMonthBtn" class="picker-nav" aria-label="Mois suivant">&rsaquo;</button>
          </div>
          <div class="picker-weekdays">
            <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>
          </div>
          <div id="calendarDays" class="picker-days"></div>
          <div class="picker-time">
            <label for="hourSelect">Heure</label>
            <select id="hourSelect"></select>
            <span class="time-sep">:</span>
            <select id="minuteSelect"></select>
          </div>
          <div class="picker-actions">
            <button type="button" id="cancelPickerBtn" class="picker-btn secondary">Annuler</button>
            <button type="button" id="confirmPickerBtn" class="picker-btn primary">OK</button>
          </div>
        </div>
      </div>

      <script>
        const form = document.getElementById('reservationForm');
        const prenomInput = document.getElementById('prenom');
        const nom = document.getElementById('nom');
        const emailInput = document.getElementById('email');
        const typeRsv = document.getElementById('typeRsv');
        const nbrePersonneDiv = document.getElementById('nbrePersonneDiv');
        const nbrePersonne = document.getElementById('nbrePersonne');
        const commentaireDiv = document.getElementById('commentaireDiv');
        const commentaire = document.getElementById('commentaire');
        const charCounter = document.getElementById('charCounter');
        const formError = document.getElementById('formError');
        const dateRdvDisplay = document.getElementById('dateRdvDisplay');
        const dateRdvValue = document.getElementById('dateRdvValue');

        typeRsv.addEventListener('change', () => {
          if (typeRsv.value === 'simple') {
            nbrePersonneDiv.classList.remove('hidden');
            commentaireDiv.classList.add('hidden');
          } else if (typeRsv.value === 'privatisation') {
            nbrePersonneDiv.classList.remove('hidden');
            commentaireDiv.classList.remove('hidden');
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

        form.addEventListener('submit', (e) => {
          document.querySelectorAll('input, select, textarea').forEach(el => el.classList.remove('invalid'));
          formError.classList.add('hidden');

          const prenomVal = prenomInput.value.trim();
          const nomVal = nom.value.trim();
          const emailVal = emailInput.value.trim();
          const typeVal = typeRsv.value;
          const nbreVal = nbrePersonne.value ? nbrePersonne.value.trim() : '';
          const commentVal = commentaire.value ? commentaire.value.trim() : '';
          const dateVal = dateRdvValue.value;

          let missingField = false;

          if (!prenomVal) { missingField = true; prenomInput.classList.add('invalid'); }
          if (!nomVal) { missingField = true; nom.classList.add('invalid'); }
          if (!emailVal) { missingField = true; emailInput.classList.add('invalid'); }
          if (!dateVal) { missingField = true; dateRdvDisplay.classList.add('invalid'); }
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

        // ----- Agenda / sélecteur de date et heure -----
        (function () {
          const overlay = document.getElementById('datePickerOverlay');
          const monthYearLabel = document.getElementById('monthYearLabel');
          const calendarDaysEl = document.getElementById('calendarDays');
          const hourSelect = document.getElementById('hourSelect');
          const minuteSelect = document.getElementById('minuteSelect');
          const prevMonthBtn = document.getElementById('prevMonthBtn');
          const nextMonthBtn = document.getElementById('nextMonthBtn');
          const cancelPickerBtn = document.getElementById('cancelPickerBtn');
          const confirmPickerBtn = document.getElementById('confirmPickerBtn');

          const WEEKDAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
          const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

          const initialDateRaw = ${initialDateJson};

          function pad(n) {
            return String(n).padStart(2, '0');
          }

          function parseInitialDate(value) {
            if (!value) return null;
            const parsed = new Date(value);
            return isNaN(parsed.getTime()) ? null : parsed;
          }

          function roundToNextQuarter(date) {
            const d = new Date(date);
            const minutes = d.getMinutes();
            const remainder = minutes % 15;
            if (remainder !== 0) {
              d.setMinutes(minutes + (15 - remainder));
            }
            d.setSeconds(0);
            d.setMilliseconds(0);
            return d;
          }

          function formatDisplayDate(date) {
            return WEEKDAY_NAMES[date.getDay()] + ' ' + pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear() + ' à ' + pad(date.getHours()) + 'h' + pad(date.getMinutes());
          }

          let selectedDate = parseInitialDate(initialDateRaw);
          let viewDate = selectedDate ? new Date(selectedDate) : new Date();

          // Remplissage des sélecteurs heure / minute
          for (let h = 0; h < 24; h++) {
            const opt = document.createElement('option');
            opt.value = String(h);
            opt.textContent = pad(h) + 'h';
            hourSelect.appendChild(opt);
          }
          for (let m = 0; m < 60; m += 15) {
            const opt = document.createElement('option');
            opt.value = String(m);
            opt.textContent = pad(m);
            minuteSelect.appendChild(opt);
          }

          function renderCalendar() {
            monthYearLabel.textContent = MONTH_NAMES[viewDate.getMonth()] + ' ' + viewDate.getFullYear();
            calendarDaysEl.innerHTML = '';

            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const firstDay = new Date(year, month, 1);
            let startWeekday = firstDay.getDay();
            startWeekday = (startWeekday === 0) ? 6 : startWeekday - 1;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = new Date();

            for (let i = 0; i < startWeekday; i++) {
              const empty = document.createElement('span');
              empty.className = 'picker-day empty';
              calendarDaysEl.appendChild(empty);
            }

            for (let day = 1; day <= daysInMonth; day++) {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'picker-day';
              btn.textContent = String(day);

              const thisDate = new Date(year, month, day);

              if (thisDate.toDateString() === today.toDateString()) {
                btn.classList.add('today');
              }
              if (selectedDate && thisDate.toDateString() === selectedDate.toDateString()) {
                btn.classList.add('selected');
              }

              btn.addEventListener('click', () => {
                const hours = selectedDate ? selectedDate.getHours() : parseInt(hourSelect.value, 10);
                const minutes = selectedDate ? selectedDate.getMinutes() : parseInt(minuteSelect.value, 10);
                selectedDate = new Date(year, month, day, hours, minutes);
                renderCalendar();
              });

              calendarDaysEl.appendChild(btn);
            }
          }

          function openPicker() {
            if (!selectedDate) {
              selectedDate = roundToNextQuarter(new Date());
            }
            viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            hourSelect.value = String(selectedDate.getHours());
            minuteSelect.value = String(Math.floor(selectedDate.getMinutes() / 15) * 15);
            renderCalendar();
            overlay.classList.remove('hidden');
          }

          function closePicker() {
            overlay.classList.add('hidden');
          }

          dateRdvDisplay.addEventListener('click', openPicker);
          dateRdvDisplay.addEventListener('focus', openPicker);

          prevMonthBtn.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() - 1);
            renderCalendar();
          });

          nextMonthBtn.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() + 1);
            renderCalendar();
          });

          hourSelect.addEventListener('change', () => {
            if (selectedDate) selectedDate.setHours(parseInt(hourSelect.value, 10));
          });

          minuteSelect.addEventListener('change', () => {
            if (selectedDate) selectedDate.setMinutes(parseInt(minuteSelect.value, 10));
          });

          cancelPickerBtn.addEventListener('click', closePicker);

          overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePicker();
          });

          confirmPickerBtn.addEventListener('click', () => {
            if (!selectedDate) {
              selectedDate = new Date(viewDate);
            }
            selectedDate.setHours(parseInt(hourSelect.value, 10));
            selectedDate.setMinutes(parseInt(minuteSelect.value, 10));
            selectedDate.setSeconds(0);
            selectedDate.setMilliseconds(0);

            dateRdvDisplay.value = formatDisplayDate(selectedDate);
            dateRdvValue.value = selectedDate.toISOString();
            dateRdvDisplay.classList.remove('invalid');
            hideFormError();
            closePicker();
          });

          // Pré-remplissage si une date de RDV a été transmise dans l'URL
          if (selectedDate) {
            dateRdvDisplay.value = formatDisplayDate(selectedDate);
            dateRdvValue.value = selectedDate.toISOString();
          }
        })();
      </script>
    </body>
    </html>
  `);
});

// Route pour traiter l'envoi des données
app.post('/submit-email', (req, res) => {
  const { clientKey, prenom, nom, email, typeRsv, nbrePersonne, commentaire, dateRdv } = req.body;

  if (!clientKey || !prenom || !nom || !email || !typeRsv || !dateRdv) {
    return res.status(400).send('Informations manquantes.');
  }

  const webhookUrl = 'https://hook.eu2.make.com/7w0habdx4zlyvebhvdhe8sixhhkae4yg';

  axios.post(webhookUrl, {
    clientKey,
    prenom,
    nom,
    email,
    typeRsv,
    nbrePersonne,
    commentaire,
    dateRdv
  })
  .then(() => {
    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            text-align: center;
          }
          h1 { color: #4682b4; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Votre demande a bien été prise en compte 🎉</h1>
          <p>Vous allez recevoir un message de confirmation très bientôt.</p>
        </div>
      </body>
      </html>
    `);
  })
  .catch((error) => {
    console.error("Erreur lors de l'envoi au webhook :", error);
    res.status(500).send("Erreur lors de l'envoi de vos informations.");
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
