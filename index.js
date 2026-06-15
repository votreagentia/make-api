const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Petite fonction utilitaire pour échapper les caractères spéciaux HTML
// (évite tout souci d'affichage si le prénom contient une apostrophe, un guillemet, etc.)
function escapeHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Convertit une date au format français "16 juin 2026 20:00" en objet Date.
// Renvoie null si le format ne correspond pas.
const MOIS_FR = {
  'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
  'juillet': 6, 'août': 7, 'aout': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10,
  'décembre': 11, 'decembre': 11
};

function parseFrenchDate(str) {
  if (!str) return null;
  const match = String(str).trim().match(
    /^(\d{1,2})\s+([a-zàâäéèêëîïôöùûüÿç]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/i
  );
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const monthName = match[2].toLowerCase();
  const year = parseInt(match[3], 10);
  const hour = match[4] ? parseInt(match[4], 10) : 0;
  const minute = match[5] ? parseInt(match[5], 10) : 0;

  if (!(monthName in MOIS_FR)) return null;

  const d = new Date(year, MOIS_FR[monthName], day, hour, minute, 0);
  return isNaN(d.getTime()) ? null : d;
}

// Formate une date en chaîne locale "YYYY-MM-DDTHH:mm:00" (sans "Z"),
// pour que le navigateur l'interprète comme une heure locale, sans décalage de fuseau.
function formatLocalISO(d) {
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00';
}

// Route pour afficher le formulaire
app.get('/capture-email', (req, res) => {
  const clientKey = req.query.key;
  const prenomKey = req.query.prenom;
  const DateHeureDernierRDVKey = req.query.DateHeureDernierRDV;

  if (!clientKey) {
    return res.status(400).send("Clé client manquante.");
  }

  // On essaie de convertir la date reçue (ex: "16 juin 2026 20:00") pour pré-sélectionner l'agenda
  let initialDateISO = null;
  if (DateHeureDernierRDVKey) {
    let parsedDate = parseFrenchDate(DateHeureDernierRDVKey);
    if (!parsedDate) {
      // Repli : on tente le format JS standard (ISO 8601, etc.)
      const fallback = new Date(DateHeureDernierRDVKey);
      if (!isNaN(fallback.getTime())) parsedDate = fallback;
    }
    if (parsedDate) {
      initialDateISO = formatLocalISO(parsedDate);
    }
  }
  // Sécurisation de la chaîne injectée dans le <script> (évite toute fermeture anticipée de balise)
  const initialDateJSON = JSON.stringify(initialDateISO).replace(/</g, '\\u003c');

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

        /* ---------- Champ "Date et heure du RDV" ---------- */
        .date-field-wrapper {
          position: relative;
          width: 100%;
          margin: 10px 0;
          box-sizing: border-box;
        }
        .date-field-wrapper input {
          width: 100%;
          margin: 0;
          padding-right: 40px;
          cursor: pointer;
          background-color: #fff;
        }
        .date-field-wrapper .calendar-icon {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1.1rem;
          pointer-events: none;
        }

        /* ---------- Agenda personnalisé ---------- */
        .picker-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
          box-sizing: border-box;
        }
        .picker-overlay.hidden { display: none; }

        .picker-modal {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0px 6px 20px rgba(0, 0, 0, 0.25);
          width: 320px;
          max-width: 100%;
          padding: 16px;
          box-sizing: border-box;
        }

        .picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 0 0 10px 0;
        }
        .picker-header button {
          background-color: #4682b4;
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          min-width: 32px;
          margin: 0;
          padding: 0;
          font-size: 1.2rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .picker-header button:hover { background-color: #5a9bd4; }
        .picker-header span {
          font-weight: bold;
          color: #4682b4;
          text-transform: capitalize;
        }

        .picker-weekdays,
        .picker-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
          text-align: center;
        }
        .picker-weekdays div {
          font-size: 0.75rem;
          font-weight: bold;
          color: #888;
          padding: 4px 0;
        }
        .picker-days div {
          padding: 8px 0;
          border-radius: 50%;
          cursor: pointer;
          font-size: 0.9rem;
          color: #333;
        }
        .picker-days div:hover { background-color: #e6f0fa; }
        .picker-days div.other-month { color: #cfcfcf; cursor: default; }
        .picker-days div.other-month:hover { background-color: transparent; }
        .picker-days div.today { border: 1px solid #4682b4; }
        .picker-days div.selected {
          background-color: #4682b4;
          color: #fff;
          font-weight: bold;
        }

        .picker-time {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 14px 0 4px;
        }
        .picker-time label {
          display: inline-block;
          width: auto;
          margin: 0;
          font-weight: bold;
          color: #4682b4;
        }
        .picker-time select {
          display: inline-block;
          width: auto;
          margin: 0;
          padding: 6px 8px;
        }

        .picker-actions {
          display: flex;
          gap: 8px;
          margin-top: 14px;
        }
        .picker-actions button {
          margin: 0;
          width: auto;
          flex: 1;
        }
        .picker-actions #cancelPicker {
          background-color: #e6e6e6;
          color: #555;
        }
        .picker-actions #cancelPicker:hover { background-color: #d4d4d4; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Confirmez vos informations</h1>

        <form id="reservationForm" action="/submit-email" method="POST" novalidate>
          <input type="hidden" name="clientKey" value="${escapeHtml(clientKey)}">

          <label for="prenom">Entrez votre Prénom :</label>
          <input type="text" id="prenom" name="prenom" value="${escapeHtml(prenomKey)}" required>

          <label for="nom">Entrez votre nom :</label>
          <input type="text" id="nom" name="nom" required>

          <label for="email">Entrez votre e-mail :</label>
          <input type="email" id="email" name="email" required>

          <label for="dateRdv">Date et heure du rendez-vous :</label>
          <div class="date-field-wrapper">
            <input type="text" id="dateRdv" name="dateRdvAffichage" readonly placeholder="Sélectionnez une date et une heure">
            <span class="calendar-icon" aria-hidden="true">📅</span>
          </div>
          <input type="hidden" id="dateRdvISO" name="dateRdvISO" value="">

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

      <!-- Agenda personnalisé pour la date et l'heure du RDV -->
      <div id="datePickerOverlay" class="picker-overlay hidden">
        <div class="picker-modal" role="dialog" aria-modal="true" aria-label="Sélection de la date et de l'heure du rendez-vous">
          <div class="picker-header">
            <button type="button" id="prevMonth" aria-label="Mois précédent">‹</button>
            <span id="monthYearLabel"></span>
            <button type="button" id="nextMonth" aria-label="Mois suivant">›</button>
          </div>
          <div class="picker-weekdays" id="pickerWeekdays"></div>
          <div class="picker-days" id="pickerDays"></div>
          <div class="picker-time">
            <label for="pickerHour">Heure :</label>
            <select id="pickerHour"></select>
            <span>:</span>
            <select id="pickerMinute"></select>
          </div>
          <div class="picker-actions">
            <button type="button" id="cancelPicker">Annuler</button>
            <button type="button" id="confirmPicker">OK</button>
          </div>
        </div>
      </div>

      <script>
        const form = document.getElementById('reservationForm');
        const prenom = document.getElementById('prenom');
        const nom = document.getElementById('nom');
        const emailInput = document.getElementById('email');
        const dateRdv = document.getElementById('dateRdv');
        const dateRdvISO = document.getElementById('dateRdvISO');
        const typeRsv = document.getElementById('typeRsv');
        const nbrePersonneDiv = document.getElementById('nbrePersonneDiv');
        const nbrePersonne = document.getElementById('nbrePersonne');
        const commentaireDiv = document.getElementById('commentaireDiv');
        const commentaire = document.getElementById('commentaire');
        const charCounter = document.getElementById('charCounter');
        const formError = document.getElementById('formError');

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

          const prenomVal = prenom.value.trim();
          const nomVal = nom.value.trim();
          const emailVal = emailInput.value.trim();
          const dateRdvVal = dateRdvISO.value ? dateRdvISO.value.trim() : '';
          const typeVal = typeRsv.value;
          const nbreVal = nbrePersonne.value ? nbrePersonne.value.trim() : '';
          const commentVal = commentaire.value ? commentaire.value.trim() : '';

          let missingField = false;

          if (!prenomVal) { missingField = true; prenom.classList.add('invalid'); }
          if (!nomVal) { missingField = true; nom.classList.add('invalid'); }
          if (!emailVal) { missingField = true; emailInput.classList.add('invalid'); }
          if (!dateRdvVal) { missingField = true; dateRdv.classList.add('invalid'); }
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

        /* ===================== Agenda personnalisé ===================== */
        (function () {
          const overlay = document.getElementById('datePickerOverlay');
          const monthYearLabel = document.getElementById('monthYearLabel');
          const pickerWeekdays = document.getElementById('pickerWeekdays');
          const pickerDays = document.getElementById('pickerDays');
          const pickerHour = document.getElementById('pickerHour');
          const pickerMinute = document.getElementById('pickerMinute');
          const prevMonthBtn = document.getElementById('prevMonth');
          const nextMonthBtn = document.getElementById('nextMonth');
          const confirmBtn = document.getElementById('confirmPicker');
          const cancelBtn = document.getElementById('cancelPicker');

          const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
          const joursNoms = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

          const initialIso = ${initialDateJSON};

          // Date actuellement sélectionnée (validée par OK)
          let selectedDate = new Date();
          if (initialIso) {
            const d = new Date(initialIso);
            if (!isNaN(d.getTime())) {
              selectedDate = d;
            }
          }

          // Date temporaire utilisée pendant que l'agenda est ouvert
          let tempDate = new Date(selectedDate);
          // Mois/année affichés dans l'agenda
          let viewDate = new Date(selectedDate);

          function pad(n) {
            return n < 10 ? '0' + n : '' + n;
          }

          function formatDisplay(d) {
            return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' à ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
          }

          function formatISO(d) {
            return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':00';
          }

          function roundToStep(value, step) {
            const rounded = Math.round(value / step) * step;
            return rounded >= 60 ? 0 : rounded;
          }

          // Initialisation des champs avec la valeur par défaut (ou la valeur précédente du RDV)
          dateRdv.value = formatDisplay(selectedDate);
          dateRdvISO.value = formatISO(selectedDate);

          // En-têtes des jours de la semaine (Lun -> Dim)
          joursNoms.forEach((j) => {
            const div = document.createElement('div');
            div.textContent = j;
            pickerWeekdays.appendChild(div);
          });

          // Heures : 00 à 23
          for (let h = 0; h < 24; h++) {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = pad(h);
            pickerHour.appendChild(opt);
          }

          // Minutes : 00, 05, 10 ... 55
          for (let m = 0; m < 60; m += 5) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = pad(m);
            pickerMinute.appendChild(opt);
          }

          function renderCalendar() {
            pickerDays.innerHTML = '';
            monthYearLabel.textContent = moisNoms[viewDate.getMonth()] + ' ' + viewDate.getFullYear();

            const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
            let startOffset = firstDay.getDay() - 1; // 0 = Lundi
            if (startOffset < 0) startOffset = 6;

            const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
            const daysInPrevMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0).getDate();
            const today = new Date();

            // Jours du mois précédent (grisés)
            for (let i = 0; i < startOffset; i++) {
              const dayNum = daysInPrevMonth - startOffset + 1 + i;
              const div = document.createElement('div');
              div.textContent = dayNum;
              div.classList.add('other-month');
              pickerDays.appendChild(div);
            }

            // Jours du mois en cours
            for (let day = 1; day <= daysInMonth; day++) {
              const div = document.createElement('div');
              div.textContent = day;
              const cellDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

              if (cellDate.toDateString() === today.toDateString()) {
                div.classList.add('today');
              }
              if (cellDate.toDateString() === tempDate.toDateString()) {
                div.classList.add('selected');
              }

              div.addEventListener('click', () => {
                tempDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, tempDate.getHours(), tempDate.getMinutes());
                renderCalendar();
              });

              pickerDays.appendChild(div);
            }

            // Jours du mois suivant (grisés) pour compléter la grille
            const totalCells = startOffset + daysInMonth;
            const remaining = (7 - (totalCells % 7)) % 7;
            for (let i = 1; i <= remaining; i++) {
              const div = document.createElement('div');
              div.textContent = i;
              div.classList.add('other-month');
              pickerDays.appendChild(div);
            }
          }

          function openPicker() {
            // On repart de la date actuellement validée
            tempDate = new Date(selectedDate);
            viewDate = new Date(selectedDate);

            pickerHour.value = tempDate.getHours();
            pickerMinute.value = roundToStep(tempDate.getMinutes(), 5);

            renderCalendar();
            overlay.classList.remove('hidden');
            dateRdv.classList.remove('invalid');
            hideFormError();
          }

          function closePicker() {
            overlay.classList.add('hidden');
          }

          dateRdv.addEventListener('click', openPicker);
          dateRdv.addEventListener('focus', openPicker);
          document.querySelector('.date-field-wrapper .calendar-icon').addEventListener('click', openPicker);

          prevMonthBtn.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() - 1);
            renderCalendar();
          });

          nextMonthBtn.addEventListener('click', () => {
            viewDate.setMonth(viewDate.getMonth() + 1);
            renderCalendar();
          });

          cancelBtn.addEventListener('click', closePicker);

          overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePicker();
          });

          confirmBtn.addEventListener('click', () => {
            tempDate.setHours(parseInt(pickerHour.value, 10));
            tempDate.setMinutes(parseInt(pickerMinute.value, 10));
            tempDate.setSeconds(0);

            selectedDate = new Date(tempDate);
            dateRdv.value = formatDisplay(selectedDate);
            dateRdvISO.value = formatISO(selectedDate);

            closePicker();
          });
        })();
      </script>
    </body>
    </html>
  `);
});

// Route pour traiter l'envoi des données
app.post('/submit-email', (req, res) => {
  const { clientKey, prenom, nom, email, dateRdvAffichage, dateRdvISO, typeRsv, nbrePersonne, commentaire } = req.body;

  if (!clientKey || !prenom || !nom || !email || !dateRdvISO || !typeRsv) {
    return res.status(400).send('Informations manquantes.');
  }

  const webhookUrl = 'https://hook.eu2.make.com/7w0habdx4zlyvebhvdhe8sixhhkae4yg';

  axios.post(webhookUrl, {
    clientKey,
    prenom,
    nom,
    email,
    dateRdvAffichage,
    dateRdvISO,
    typeRsv,
    nbrePersonne,
    commentaire
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
